import path from "path";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { Worker } from "bullmq";
import { redis } from "../lib/queue/redis";
import { updateRenderJob } from "../lib/queue/renderJobStore";

type ExportSettings = {
  preset: string;
  label: string;
  quality: string;
  qualityLabel: string;
  width: number;
  height: number;
  crf: number;
  audioBitrate: string;
  fps: number;
  renderScale: number;
};

let cachedBundle: string | null = null;
let cachedBundleAt = 0;
let cachedRuntimePromise: Promise<{
  bundle: any;
  renderMedia: any;
  selectComposition: any;
}> | null = null;

const BUNDLE_CACHE_TTL = 1000 * 60 * 60 * 2;
const MAX_DURATION_SECONDS = 600;
const EXPORTS_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const RENDER_TIMEOUT_MS = 1000 * 60 * 25;
const MAX_RENDER_CONCURRENCY = Number(
  process.env.REMOTION_MAX_RENDER_CONCURRENCY || 1,
);
const ASSET_CHECK_CONCURRENCY = Number(
  process.env.RENDER_ASSET_CHECK_CONCURRENCY || 2,
);
const PROGRESS_UPDATE_INTERVAL_MS = 1500;
const SAFE_RENDER_SCALES = [1, 0.75, 0.5] as const;
const DEFAULT_RENDER_FONT_FAMILY = "KFGQPC Uthmanic Script HAFS";
const DEFAULT_BISMILLAH_DURATION_SECONDS = 3.2;
const BISMILLAH_TEXT = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";

new Worker(
  "render-queue",
  async (job) => {
    const jobId = job.data?.jobId || String(job.id);

    try {
      console.log("Processing render job:", jobId);

      const result = await renderQuranVideo({
        jobId,
        body: job.data?.body || {},
        exportSettings: job.data?.exportSettings,
        siteUrl: job.data?.siteUrl,
      });

      console.log("Render completed:", jobId);
      return result;
    } catch (error: any) {
      console.error("RENDER_WORKER_ERROR:", error);

      await updateRenderJob(jobId, {
        status: "failed",
        progress: 0,
        message: error?.message || "حدث خطأ أثناء تصدير الفيديو",
        error: error?.message || String(error),
        completedAt: new Date().toISOString(),
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

console.log("Render worker started");

async function renderQuranVideo({
  jobId,
  body,
  exportSettings: incomingExportSettings,
  siteUrl: incomingSiteUrl,
}: {
  jobId: string;
  body: any;
  exportSettings?: ExportSettings;
  siteUrl?: string;
}) {
  const ayahs = Array.isArray(body.ayahs) ? body.ayahs : [];

  if (!incomingExportSettings) {
    throw new Error("Missing export settings for render job");
  }

  const exportSettings = normalizeExportSettings(incomingExportSettings);
  const safeRenderScale = getIntegerSafeRenderScale(
    exportSettings.width,
    exportSettings.height,
    exportSettings.renderScale,
  );

  const firstAyah = ayahs[0]?.numberInSurah || "start";
  const lastAyah = ayahs[ayahs.length - 1]?.numberInSurah || "end";

  const siteUrl =
    incomingSiteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "http://ec2-16-171-195-194.eu-north-1.compute.amazonaws.com";

  const publicSiteUrl = siteUrl.replace(/\/$/, "");
  const bismillahAudioUrl = `${publicSiteUrl}/audio/bismillah.mp3`;
  const bismillahDuration = Math.max(
    Number(body.bismillahDuration || DEFAULT_BISMILLAH_DURATION_SECONDS),
    1.8,
  );
  const showBismillahIntro = body.showBismillahIntro !== false;

  await updateRenderJob(jobId, {
    status: "validating",
    progress: 5,
    message: "جاري فحص الخلفية وملفات الصوت",
  });

  if (!ayahs.length) {
    throw new Error("لا توجد آيات للتصدير");
  }

  if (!body.backgroundVideoUrl) {
    throw new Error("لا توجد خلفية للتصدير");
  }

  await assertAssetAvailable(body.backgroundVideoUrl, "الخلفية");

  if (showBismillahIntro) {
    await assertAssetAvailable(bismillahAudioUrl, "صوت البسملة");
  }

  const audioAssets: Array<{ url: string; label: string }> = ayahs
    .map((ayah: any, index: number) => ({
      url: String(ayah.audio || ""),
      label: `صوت الآية رقم ${ayah.numberInSurah || index + 1}`,
    }))
    .filter((asset: { url: string }) => Boolean(asset.url));

  await mapWithConcurrency<{ url: string; label: string }>(
    audioAssets,
    getAssetCheckConcurrency(),
    async (asset) => {
      await assertAssetAvailable(asset.url, asset.label);
    },
  );

  const totalDurationInSeconds = getDurationSecondsWithBismillahIntro({
    ayahs,
    showBismillahIntro,
    bismillahDuration,
  });

  if (totalDurationInSeconds > MAX_DURATION_SECONDS) {
    throw new Error("مدة الفيديو طويلة جدًا. الحد الحالي 10 دقائق.");
  }

  const durationInFrames = Math.max(
    Math.ceil(totalDurationInSeconds * exportSettings.fps),
    Math.ceil(5 * exportSettings.fps),
  );

  const { bundle, renderMedia, selectComposition } = await loadRemotionRuntime();

  const preparedAyahs = preprocessAyahsForRender({
    ayahs,
    exportWidth: exportSettings.width,
    exportHeight: exportSettings.height,
    textSize: Number(body.textSize || 72),
    highlightMode: body.wordHighlightMode || "smart",
    highlightSpeed: Number(body.wordHighlightSpeed || 1),
  });

  const inputProps = {
    ayahs: preparedAyahs,

    textColor: body.textColor || "#ffffff",
    textSize: Number(body.textSize || 72),
    fontFamily: normalizeRenderFontFamily(body.fontFamily),

    backgroundStyle: body.backgroundStyle || "emerald",
    backgroundVideoUrl: body.backgroundVideoUrl,
    backgroundType: body.backgroundType || "video",

    isRemotionRender: true,

    textPosition: body.textPosition || "center",
    animationStyle: body.animationStyle || "slide",
    wordSpeed: body.wordSpeed || "normal",

    showWordHighlight: body.showWordHighlight ?? true,
    wordHighlightColor: body.wordHighlightColor || "#34d399",
    wordHighlightGlowColor: body.wordHighlightGlowColor || "#34d399",
    wordDimColor: body.wordDimColor || "rgba(255,255,255,0.62)",
    wordHighlightStyle: body.wordHighlightStyle || "glow",
    wordHighlightTransition: body.wordHighlightTransition || "scale",
    wordHighlightSpeed: Number(body.wordHighlightSpeed || 1),
    wordHighlightOffset: Number(body.wordHighlightOffset || 0),
    wordHighlightHold: Number(body.wordHighlightHold || 0.12),
    wordHighlightMode: body.wordHighlightMode || "smart",
    manualWordTimings: body.manualWordTimings || {},

    showBismillahIntro,
    bismillahAudioUrl,
    bismillahDuration,

    showSurahName: body.showSurahName ?? true,
    surahName: body.surahName || "",
    surahNameColor: body.surahNameColor || "#ffffff",
    surahNameSize: Number(body.surahNameSize || 38),
    surahNamePosition: body.surahNamePosition || "top",

    showReciterName: body.showReciterName ?? true,
    reciter: body.reciter || "",
    reciterNameColor: body.reciterNameColor || "#34d399",
    reciterNameSize: Number(body.reciterNameSize || 28),
    reciterNamePosition: body.reciterNamePosition || "bottom",

    showBrandName: body.showBrandName ?? true,
    brandName: body.brandName || "وذكر | wzkerq",
    brandNameColor: body.brandNameColor || "#ffffff",
    brandNameSize: Number(body.brandNameSize || 24),
    brandNamePosition: body.brandNamePosition || "bottom",
    brandNameStyle: body.brandNameStyle || "glass",

    showProgressBar: body.showProgressBar ?? true,
    showCountdownTimer: body.showCountdownTimer ?? true,
    progressColor: body.progressColor || "#34d399",
    timerColor: body.timerColor || "#ffffff",
    progressPosition: body.progressPosition || "bottom",
    timerPosition: body.timerPosition || "bottom",
    progressHeight: Number(body.progressHeight || 5),
    timerSize: Number(body.timerSize || 18),

    exportPreset: exportSettings.preset,
    exportQuality: exportSettings.quality,
    exportQualityLabel: exportSettings.qualityLabel,
    exportWidth: exportSettings.width,
    exportHeight: exportSettings.height,
    exportFps: exportSettings.fps,
    renderScale: safeRenderScale,
  };

  const entry = path.join(process.cwd(), "remotion", "Root.tsx");

  const shouldRebuildBundle =
    !cachedBundle || Date.now() - cachedBundleAt > BUNDLE_CACHE_TTL;

  let bundled = cachedBundle;

  if (shouldRebuildBundle) {
    await updateRenderJob(jobId, {
      status: "bundling",
      progress: 12,
      message: "جاري بناء مشروع Remotion",
    });

    bundled = await bundle({
      entryPoint: entry,
      webpackOverride: (config: any) => config,
    });

    cachedBundle = bundled;
    cachedBundleAt = Date.now();
  } else {
    await updateRenderJob(jobId, {
      status: "bundling",
      progress: 18,
      message: "تم استخدام نسخة Remotion المحفوظة لتسريع التصدير",
    });
  }

  if (!bundled) {
    throw new Error("Failed to create Remotion bundle");
  }

  const composition = await selectComposition({
    serveUrl: bundled,
    id: "QuranReel",
    inputProps,
  });

  const finalComposition = {
    ...composition,
    durationInFrames,
    fps: exportSettings.fps,
    width: exportSettings.width,
    height: exportSettings.height,
  };

  const exportsDir = path.join(process.cwd(), "public", "exports");
  await mkdir(exportsDir, { recursive: true });

  const fileId = jobId.slice(0, 8);

  const safePreset = sanitizeFileName(
    exportSettings.preset || "export",
  );

  const safeQuality = sanitizeFileName(
    exportSettings.quality || "quality",
  );

  const safeSurahName = sanitizeFileName(body.surahName || "") || "surah";

  const safeReciter = sanitizeFileName(body.reciter || "") || "reciter";

  const fileName =
    `${safeReciter}-` +
    `${safeSurahName}-` +
    `ayah-${firstAyah}-to-${lastAyah}-` +
    `${safePreset}-` +
    `${safeQuality}-` +
    `${exportSettings.width}x${exportSettings.height}-` +
    `${fileId}.mp4`;
  const outputLocation = path.join(exportsDir, fileName);

  await cleanupOldExports(exportsDir);

  await updateRenderJob(jobId, {
    status: "rendering",
    progress: 25,
    message: `جاري تصدير الفيديو ${exportSettings.label} - ${exportSettings.qualityLabel} (${exportSettings.width}x${exportSettings.height})`,
    fileName,
    durationInSeconds: totalDurationInSeconds,
    durationInFrames,
    exportPreset: exportSettings.preset,
    exportQuality: exportSettings.quality,
    exportWidth: exportSettings.width,
    exportHeight: exportSettings.height,
    exportFps: exportSettings.fps,
  });

  const renderConcurrency = getRenderConcurrency();
  let lastProgressUpdateAt = 0;
  let lastReportedProgress = 24;

  await renderMedia({
    composition: finalComposition,
    serveUrl: bundled,

    codec: "h264",
    audioCodec: "aac",

    outputLocation,
    inputProps,

    crf: getRenderCrf(exportSettings.quality, exportSettings.crf),
    audioBitrate: getAudioBitrate(exportSettings.audioBitrate),

    concurrency: renderConcurrency,
    scale: safeRenderScale,

    imageFormat: "jpeg",
    jpegQuality: getJpegQuality(exportSettings.quality),

    x264Preset: getX264Preset(exportSettings.quality),
    pixelFormat: "yuv420p",

    chromiumOptions: {
      disableWebSecurity: true,
      gl: getChromiumGlBackend(),
      enableMultiProcessOnLinux: false,
      ignoreCertificateErrors: true,
    },

    timeoutInMilliseconds: RENDER_TIMEOUT_MS,

    onProgress: async ({ progress }: { progress: number }) => {
      const renderProgress = Math.round(progress * 100);
      const totalProgress = Math.min(
        99,
        25 + Math.round(renderProgress * 0.74),
      );

      const now = Date.now();
      const progressDelta = Math.abs(totalProgress - lastReportedProgress);
      const shouldUpdate =
        totalProgress >= 99 ||
        progressDelta >= 2 ||
        now - lastProgressUpdateAt >= PROGRESS_UPDATE_INTERVAL_MS;

      if (!shouldUpdate) return;

      lastProgressUpdateAt = now;
      lastReportedProgress = totalProgress;

      await updateRenderJob(jobId, {
        status: "rendering",
        progress: totalProgress,
        message: `جاري التصدير ${renderProgress}%`,
      });

      console.log(
        JSON.stringify({
          type: "render-progress",
          jobId,
          progress: totalProgress,
          renderProgress,
          renderConcurrency,
          quality: exportSettings.quality,
          scale: safeRenderScale,
        }),
      );
    },
  });

  const encodedFileName = encodeURIComponent(fileName);
  const url = `${publicSiteUrl}/exports/${encodedFileName}`;

  await updateRenderJob(jobId, {
    status: "completed",
    progress: 100,
    message: "تم التصدير بنجاح",
    url,
    fileName,
    durationInSeconds: totalDurationInSeconds,
    durationInFrames,
    exportPreset: exportSettings.preset,
    exportQuality: exportSettings.quality,
    exportWidth: exportSettings.width,
    exportHeight: exportSettings.height,
    exportFps: exportSettings.fps,
    completedAt: new Date().toISOString(),
  });

  return {
    jobId,
    status: "completed",
    progress: 100,
    url,
    fileName,
    durationInSeconds: totalDurationInSeconds,
    durationInFrames,
    exportPreset: exportSettings.preset,
    exportQuality: exportSettings.quality,
    exportWidth: exportSettings.width,
    exportHeight: exportSettings.height,
    exportFps: exportSettings.fps,
  };
}

async function loadRemotionRuntime() {
  if (!cachedRuntimePromise) {
    cachedRuntimePromise = (async () => {
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)",
      ) as (specifier: string) => Promise<any>;

      const [bundler, renderer] = await Promise.all([
        dynamicImport("@remotion/bundler"),
        dynamicImport("@remotion/renderer"),
      ]);

      return {
        bundle: bundler.bundle,
        renderMedia: renderer.renderMedia,
        selectComposition: renderer.selectComposition,
      };
    })();
  }

  return cachedRuntimePromise;
}

function normalizeExportSettings(settings: ExportSettings): ExportSettings {
  const quality = settings.quality || "standard";

  return {
    ...settings,
    fps: clampNumber(Math.round(Number(settings.fps || 30)), 24, 30),
    width: makeEvenInteger(Math.max(Math.round(Number(settings.width || 1080)), 360)),
    height: makeEvenInteger(Math.max(Math.round(Number(settings.height || 1920)), 360)),
    crf: getRenderCrf(quality, Number(settings.crf)),
    audioBitrate: getAudioBitrate(settings.audioBitrate),
    renderScale: getIntegerSafeRenderScale(
      makeEvenInteger(Math.max(Math.round(Number(settings.width || 1080)), 360)),
      makeEvenInteger(Math.max(Math.round(Number(settings.height || 1920)), 360)),
      getRenderScale({
        ...settings,
        quality,
      }),
    ),
  };
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<void>,
) {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => runNext()));
}

function getAssetCheckConcurrency() {
  if (Number.isFinite(ASSET_CHECK_CONCURRENCY) && ASSET_CHECK_CONCURRENCY > 0) {
    return Math.max(1, Math.floor(ASSET_CHECK_CONCURRENCY));
  }

  return 2;
}

async function assertAssetAvailable(url: string, label: string): Promise<void> {
  if (!url) return;

  if (
    url.startsWith("/") ||
    url.startsWith("file:") ||
    url.includes("localhost")
  ) {
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Asset returned ${response.status}`);
    }
  } catch {
    console.warn(`Skipping remote asset validation for ${label}: ${url}`);
  }
}


function getDurationSecondsWithBismillahIntro({
  ayahs,
  showBismillahIntro,
  bismillahDuration,
}: {
  ayahs: Array<{ text?: string; duration?: number }>;
  showBismillahIntro: boolean;
  bismillahDuration: number;
}) {
  const rawDurationSeconds = ayahs.reduce((total: number, ayah: any) => {
    return total + Math.max(Number(ayah.duration || 5), 0.1);
  }, 0);

  if (!showBismillahIntro) {
    return rawDurationSeconds;
  }

  const introDuration = Math.max(
    Number(bismillahDuration || DEFAULT_BISMILLAH_DURATION_SECONDS),
    1.8,
  );

  const firstText = ayahs[0]?.text || "";

  if (!firstText) {
    return introDuration;
  }

  if (isBismillahOnly(firstText)) {
    const restDuration = ayahs.slice(1).reduce((total: number, ayah: any) => {
      return total + Math.max(Number(ayah.duration || 5), 0.1);
    }, 0);

    return introDuration + restDuration;
  }

  if (startsWithBismillah(firstText)) {
    return rawDurationSeconds;
  }

  return rawDurationSeconds + introDuration;
}

function isBismillahOnly(text: string) {
  return normalizeArabicForBismillah(text) === normalizeArabicForBismillah(BISMILLAH_TEXT);
}

function startsWithBismillah(text: string) {
  return normalizeArabicForBismillah(text).startsWith(
    normalizeArabicForBismillah(BISMILLAH_TEXT),
  );
}

function normalizeArabicForBismillah(value: string) {
  return String(value || "")
    .replace(/﷽/g, "بسم الله الرحمن الرحيم")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u06D6-\u06ED۝۞]/g, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF]/g, "")
    .trim();
}

function normalizeRenderFontFamily(fontFamily?: string) {
  const value = String(fontFamily || "").trim();

  if (
    value === "KFGQPC" ||
    value === "KFGQPC Uthmanic" ||
    value === "KFGQPC Uthmanic Script" ||
    value === "KFGQPC Uthmanic Script HAFS" ||
    value === "Uthmanic"
  ) {
    return "KFGQPC Uthmanic Script HAFS";
  }

  if (
    value === "AmiriQuran" ||
    value === "Amiri Quran" ||
    value === "Amiri Quran Regular"
  ) {
    return "Amiri Quran";
  }

  if (value === "Noto Naskh" || value === "Noto Naskh Arabic") {
    return "Noto Naskh Arabic";
  }

  if (value === "IBM Plex Arabic" || value === "IBM Plex Sans Arabic") {
    return "IBM Plex Sans Arabic";
  }

  if (value === "Cairo") {
    return "Cairo";
  }

  if (value === "Amiri") {
    return "Amiri";
  }

  return DEFAULT_RENDER_FONT_FAMILY;
}


type PreprocessAyah = {
  text: string;
  audio?: string;
  duration?: number;
  numberInSurah?: number;
};

function preprocessAyahsForRender({
  ayahs,
  exportWidth,
  exportHeight,
  textSize,
  highlightMode,
  highlightSpeed,
}: {
  ayahs: PreprocessAyah[];
  exportWidth: number;
  exportHeight: number;
  textSize: number;
  highlightMode: string;
  highlightSpeed: number;
}) {
  const captionLayout = getPreparedCaptionLayout({
    width: exportWidth,
    height: exportHeight,
    requestedTextSize: textSize,
  });

  const safeSpeed = Math.max(highlightSpeed || 1, 0.25);

  return ayahs.map((ayah) => {
    const duration = Math.max(Number(ayah.duration || 5), 0.5);
    const words = splitArabicWordsForRender(ayah.text || "");
    const mappedDuration = duration / safeSpeed;
    const wordStartTimes = buildAutoWordStartTimesForRender({
      words,
      duration: mappedDuration,
      mode: highlightMode,
    });

    return {
      ...ayah,
      __prepared: {
        sourceText: ayah.text || "",
        duration,
        fontSize: captionLayout.fontSize,
        isLandscape: captionLayout.isLandscape,
        isSquare: captionLayout.isSquare,
        highlightMode,
        highlightSpeed: safeSpeed,
        words,
        captionPages: buildPagedCaptionLinesForRender({
          words,
          fontSize: captionLayout.fontSize,
          isLandscape: captionLayout.isLandscape,
          isSquare: captionLayout.isSquare,
        }),
        wordStartTimes,
      },
    };
  });
}

function getPreparedCaptionLayout({
  width,
  height,
  requestedTextSize,
}: {
  width: number;
  height: number;
  requestedTextSize: number;
}) {
  const safeWidth = Math.max(width || 1080, 360);
  const safeHeight = Math.max(height || 1920, 360);
  const aspectRatio = safeWidth / safeHeight;

  const isLandscape = aspectRatio > 1.2;
  const isSquare = aspectRatio >= 0.9 && aspectRatio <= 1.1;

  const referenceWidth = 1080;
  const referenceHeight = 1920;
  const physicalScale = Math.min(
    safeWidth / referenceWidth,
    safeHeight / referenceHeight,
  );

  const opticalScale = Math.pow(clampNumber(physicalScale, 0.52, 1.55), 0.3);
  const userScale = clampNumber(requestedTextSize / 72, 0.72, 1.08);
  const baseFont = isLandscape ? 68 : isSquare ? 52 : 42;

  const fontSize = clampNumber(
    baseFont * opticalScale * userScale,
    isLandscape ? 38 : isSquare ? 28 : 24,
    isLandscape ? 68 : isSquare ? 44 : 32,
  );

  return {
    fontSize: Math.min(Math.max(fontSize, 22), 56),
    isLandscape,
    isSquare,
  };
}

function buildPagedCaptionLinesForRender({
  words,
  fontSize,
  isLandscape = false,
  isSquare = false,
}: {
  words: string[];
  fontSize: number;
  isLandscape?: boolean;
  isSquare?: boolean;
}) {
  if (!words.length) return [];

  const maxWordsPerPage = isLandscape ? 20 : isSquare ? 13 : 10;
  const targetCharsPerPage = isLandscape
    ? clampNumber(Math.round(fontSize * 3.2), 110, 190)
    : isSquare
      ? clampNumber(Math.round(fontSize * 2.5), 72, 120)
      : clampNumber(Math.round(fontSize * 2.35), 56, 92);

  const pages: Array<{
    lines: Array<Array<{ word: string; originalIndex: number }>>;
  }> = [];

  let pageItems: Array<{ word: string; originalIndex: number }> = [];
  let pageLength = 0;

  words.forEach((word, index) => {
    const nextLength = pageLength + word.length + (pageItems.length ? 1 : 0);
    const shouldStartNewPage =
      pageItems.length >= 5 &&
      (nextLength > targetCharsPerPage || pageItems.length >= maxWordsPerPage);

    if (shouldStartNewPage) {
      pages.push({
        lines: splitCaptionPageIntoLinesForRender(pageItems),
      });

      pageItems = [];
      pageLength = 0;
    }

    pageItems.push({ word, originalIndex: index });
    pageLength += word.length + (pageItems.length > 1 ? 1 : 0);
  });

  if (pageItems.length) {
    pages.push({
      lines: splitCaptionPageIntoLinesForRender(pageItems),
    });
  }

  return pages;
}

function splitCaptionPageIntoLinesForRender(
  items: Array<{ word: string; originalIndex: number }>,
) {
  if (items.length <= 4) return [items];

  let bestSplit = Math.ceil(items.length / 2);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let split = 2; split <= items.length - 2; split += 1) {
    const firstLength = items
      .slice(0, split)
      .map((item) => item.word)
      .join(" ").length;
    const secondLength = items
      .slice(split)
      .map((item) => item.word)
      .join(" ").length;
    const balancePenalty = Math.abs(firstLength - secondLength);
    const orphanPenalty = items.length - split <= 2 || split <= 2 ? 100 : 0;
    const score = balancePenalty + orphanPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestSplit = split;
    }
  }

  return [items.slice(0, bestSplit), items.slice(bestSplit)];
}

function buildAutoWordStartTimesForRender({
  words,
  duration,
  mode,
}: {
  words: string[];
  duration: number;
  mode: string;
}) {
  if (!words.length) return [];

  if (mode === "linear" || mode === "karaoke") {
    const wordDuration = duration / words.length;
    return words.map((_, index) => index * wordDuration);
  }

  const weights = words.map(getRecitationWordWeightForRender);
  const totalWeight = weights.reduce((sum, item) => sum + item, 0);
  let cursor = 0;

  return words.map((_, index) => {
    const start = cursor;
    const share = weights[index] / Math.max(totalWeight, 0.001);
    cursor += share * duration;
    return start;
  });
}

function getRecitationWordWeightForRender(rawWord: string) {
  const word = rawWord || "";
  const cleanWord = word.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "");
  const letters = cleanWord.length;
  const harakat = (word.match(/[ًٌٍَُِّْٰ]/g) || []).length;
  const maddLetters = (word.match(/[اويىآ]/g) || []).length;
  const shadda = (word.match(/[ّ]/g) || []).length;
  const hasSmallPause = /[،؛]/.test(word);
  const hasBigPause = /[.؟!ۚۖۗۙۛۜ]/.test(word);
  const hasAyahStop = /[۝۞]/.test(word);

  let weight = 0.9;
  weight += letters * 0.28;
  weight += harakat * 0.035;
  weight += maddLetters * 0.24;
  weight += shadda * 0.2;
  if (hasSmallPause) weight += 0.75;
  if (hasBigPause) weight += 1.15;
  if (hasAyahStop) weight += 1.4;

  return clampNumber(weight, 0.9, 4.5);
}

function splitArabicWordsForRender(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function getRenderConcurrency() {
  const envConcurrency = Number(process.env.REMOTION_RENDER_CONCURRENCY);

  if (Number.isFinite(envConcurrency) && envConcurrency > 0) {
    return Math.max(
      1,
      Math.min(Math.floor(envConcurrency), MAX_RENDER_CONCURRENCY, 1),
    );
  }

  return 1;
}


function getIntegerSafeRenderScale(
  width: number,
  height: number,
  requestedScale: number,
) {
  const safeWidth = makeEvenInteger(width || 1080);
  const safeHeight = makeEvenInteger(height || 1920);
  const requested = clampNumber(Number(requestedScale || 1), 0.5, 1);

  const bestSafeScale =
    SAFE_RENDER_SCALES.find((scale) => {
      const scaledWidth = safeWidth * scale;
      const scaledHeight = safeHeight * scale;

      return (
        scale <= requested &&
        Number.isInteger(scaledWidth) &&
        Number.isInteger(scaledHeight) &&
        scaledWidth % 2 === 0 &&
        scaledHeight % 2 === 0
      );
    }) || 1;

  return bestSafeScale;
}

function makeEvenInteger(value: number) {
  const rounded = Math.round(Number(value || 0));

  if (!Number.isFinite(rounded) || rounded <= 0) return 2;

  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function getRenderScale(exportSettings: Partial<ExportSettings>) {
  const envScale = Number(process.env.REMOTION_RENDER_SCALE);

  if (Number.isFinite(envScale) && envScale > 0) {
    return clampNumber(envScale, 0.55, 1);
  }

  if (exportSettings.quality === "draft") return 0.62;
  if (exportSettings.quality === "standard") return 0.72;
  if (exportSettings.quality === "ultra") return 0.9;

  return clampNumber(Number(exportSettings.renderScale || 0.8), 0.7, 0.86);
}

function getRenderCrf(quality: string, incomingCrf: number) {
  if (quality === "draft") return 31;
  if (quality === "standard") return 27;
  if (quality === "ultra") return 22;

  if (Number.isFinite(incomingCrf)) {
    return clampNumber(Math.round(incomingCrf), 23, 31);
  }

  return 25;
}

function getAudioBitrate(incomingAudioBitrate?: string) {
  if (incomingAudioBitrate && /^\d+k$/.test(incomingAudioBitrate)) {
    return incomingAudioBitrate;
  }

  return "128k";
}

function getJpegQuality(quality: string) {
  if (quality === "draft") return 70;
  if (quality === "standard") return 74;
  if (quality === "ultra") return 84;

  return 78;
}

function getX264Preset(quality: string) {
  if (quality === "draft") return "ultrafast";
  if (quality === "standard") return "superfast";
  if (quality === "ultra") return "veryfast";

  return "superfast";
}

function getChromiumGlBackend() {
  const requestedGl = process.env.REMOTION_CHROMIUM_GL;

  if (requestedGl) {
    return requestedGl as "angle" | "egl" | "swangle" | "vulkan" | "disabled";
  }

  return "swangle";
}

function sanitizeFileName(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

async function cleanupOldExports(exportsDir: string) {
  try {
    const files = await readdir(exportsDir);
    const now = Date.now();

    await Promise.all(
      files.map(async (file) => {
        if (!file.endsWith(".mp4")) return;

        const filePath = path.join(exportsDir, file);
        const fileStat = await stat(filePath);

        if (now - fileStat.mtimeMs > EXPORTS_MAX_AGE_MS) {
          await unlink(filePath);
        }
      }),
    );
  } catch (error) {
    console.log("CLEANUP_EXPORTS_ERROR:", error);
  }
}

import path from "path";
import os from "os";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RenderJobStatus =
  | "queued"
  | "validating"
  | "bundling"
  | "rendering"
  | "completed"
  | "failed";

type RenderJob = {
  id: string;
  status: RenderJobStatus;
  progress: number;
  message: string;
  fileName?: string;
  url?: string;
  error?: string;
  reciter?: string;
  surahName?: string;
  fromAyah?: number | string;
  toAyah?: number | string;
  durationInSeconds?: number;
  durationInFrames?: number;
  exportPreset?: string;
  exportQuality?: string;
  exportWidth?: number;
  exportHeight?: number;
  exportFps?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

let cachedBundle: string | null = null;
let cachedBundleAt = 0;
let isRendering = false;

const renderJobs = new Map<string, RenderJob>();

const BUNDLE_CACHE_TTL = 1000 * 60 * 30;
const FPS = 30;
const MIN_DURATION_FRAMES = 150;
const MAX_DURATION_SECONDS = 600;
const EXPORTS_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const ASSET_CHECK_TIMEOUT_MS = 10000;
const MAX_RENDER_JOBS_HISTORY = 25;
const RENDER_TIMEOUT_MS = 1000 * 60 * 15;
const DEFAULT_RENDER_CONCURRENCY_RATIO = 0.65;

const EXPORT_PRESETS: Record<
  string,
  {
    label: string;
    width: number;
    height: number;
  }
> = {
  reels: {
    label: "Reels",
    width: 1080,
    height: 1920,
  },
  tiktok: {
    label: "TikTok",
    width: 1080,
    height: 1920,
  },
  shorts: {
    label: "YouTube Shorts",
    width: 1080,
    height: 1920,
  },
  whatsapp: {
    label: "WhatsApp Status",
    width: 720,
    height: 1280,
  },
  square: {
    label: "Square Post",
    width: 1080,
    height: 1080,
  },
  landscape: {
    label: "Landscape",
    width: 1920,
    height: 1080,
  },
};

const EXPORT_QUALITIES: Record<
  string,
  {
    label: string;
    crf: number;
    audioBitrate: string;
    fps: number;
    renderScale: number;
  }
> = {
  draft: {
    label: "Draft",
    crf: 34,
    audioBitrate: "80k",
    fps: 24,
    renderScale: 0.75,
  },
  standard: {
    label: "Standard",
    crf: 30,
    audioBitrate: "96k",
    fps: 24,
    renderScale: 1,
  },
  high: {
    label: "High",
    crf: 24,
    audioBitrate: "160k",
    fps: 24,
    renderScale: 1,
  },
  ultra: {
    label: "Ultra",
    crf: 20,
    audioBitrate: "192k",
    fps: 30,
    renderScale: 1,
  },
};

export async function GET() {
  const jobs = Array.from(renderJobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({
    isRendering,
    jobs,
  });
}

export async function POST(request: Request) {
  let jobId = "";
  let acquiredRenderLock = false;

  try {
    const body = await request.json();
    const ayahs = Array.isArray(body.ayahs) ? body.ayahs : [];

    const exportSettings = resolveExportSettings(body);

    jobId = crypto.randomUUID();

    const firstAyah = ayahs[0]?.numberInSurah || "start";
    const lastAyah = ayahs[ayahs.length - 1]?.numberInSurah || "end";

    createRenderJob({
      id: jobId,
      status: "queued",
      progress: 0,
      message: "تم إنشاء مهمة التصدير",
      reciter: body.reciter || "",
      surahName: body.surahName || "",
      fromAyah: firstAyah,
      toAyah: lastAyah,
      exportPreset: exportSettings.preset,
      exportQuality: exportSettings.quality,
      exportWidth: exportSettings.width,
      exportHeight: exportSettings.height,
      exportFps: exportSettings.fps,
    });

    if (!ayahs.length) {
      updateRenderJob(jobId, {
        status: "failed",
        progress: 0,
        message: "لا توجد آيات للتصدير",
        error: "لا توجد آيات للتصدير",
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        { jobId, message: "لا توجد آيات للتصدير" },
        { status: 400 },
      );
    }

    if (!body.backgroundVideoUrl) {
      updateRenderJob(jobId, {
        status: "failed",
        progress: 0,
        message: "لا توجد خلفية للتصدير",
        error: "لا توجد خلفية للتصدير",
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        { jobId, message: "لا توجد خلفية للتصدير" },
        { status: 400 },
      );
    }

    if (isRendering) {
      updateRenderJob(jobId, {
        status: "failed",
        progress: 0,
        message: "يوجد فيديو يتم تصديره حاليًا. حاول مرة أخرى بعد قليل.",
        error: "Render busy",
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          jobId,
          message: "يوجد فيديو يتم تصديره حاليًا. حاول مرة أخرى بعد قليل.",
        },
        { status: 429 },
      );
    }

    isRendering = true;
    acquiredRenderLock = true;

    updateRenderJob(jobId, {
      status: "validating",
      progress: 5,
      message: "جاري فحص الخلفية وملفات الصوت",
    });

    await assertAssetAvailable(body.backgroundVideoUrl, "الخلفية");

    const audioUrls = ayahs
      .map((ayah: any) => ayah.audio)
      .filter((url: string | undefined) => Boolean(url));

    await Promise.all(
      audioUrls.map((url: string, index: number) =>
        assertAssetAvailable(
          url,
          `صوت الآية رقم ${ayahs[index]?.numberInSurah || index + 1}`,
        ),
      ),
    );

    const totalDurationInSeconds = ayahs.reduce(
      (total: number, ayah: any) => total + Number(ayah.duration || 5),
      0,
    );

    if (totalDurationInSeconds > MAX_DURATION_SECONDS) {
      updateRenderJob(jobId, {
        status: "failed",
        progress: 0,
        message: "مدة الفيديو طويلة جدًا. الحد الحالي 10 دقائق.",
        error: "Video duration is too long",
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          jobId,
          message: "مدة الفيديو طويلة جدًا. الحد الحالي 10 دقائق.",
        },
        { status: 400 },
      );
    }

    const durationInFrames = Math.max(
      Math.ceil(totalDurationInSeconds * exportSettings.fps),
      Math.ceil(5 * exportSettings.fps),
    );

    const { bundle } = await import("@remotion/bundler");
    const { renderMedia, selectComposition } =
      await import("@remotion/renderer");

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
      fontFamily: body.fontFamily || "Amiri",

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
      renderScale: exportSettings.renderScale,
    };

    const entry = path.join(process.cwd(), "remotion", "Root.tsx");

    const shouldRebuildBundle =
      !cachedBundle || Date.now() - cachedBundleAt > BUNDLE_CACHE_TTL;

    let bundled = cachedBundle;

    if (shouldRebuildBundle) {
      updateRenderJob(jobId, {
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
      updateRenderJob(jobId, {
        status: "bundling",
        progress: 18,
        message: "تم استخدام نسخة Remotion المحفوظة لتسريع التصدير",
      });
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

    const safeReciter = sanitizeFileName(body.reciter || "reciter");
    const safeSurah = sanitizeFileName(body.surahName || "surah");
    const fileId = jobId.slice(0, 8);
    const safePreset = sanitizeFileName(exportSettings.preset || "export");
    const safeQuality = sanitizeFileName(exportSettings.quality || "quality");

    const fileName = `${safeReciter}-${safeSurah}-ayah-${firstAyah}-to-${lastAyah}-${safePreset}-${safeQuality}-${exportSettings.width}x${exportSettings.height}-${fileId}.mp4`;

    const outputLocation = path.join(exportsDir, fileName);

    await cleanupOldExports(exportsDir);

    updateRenderJob(jobId, {
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

    await renderMedia({
      composition: finalComposition,
      serveUrl: bundled,

      codec: "h264",
      audioCodec: "aac",

      outputLocation,

      inputProps,

      crf: exportSettings.crf,
      audioBitrate: exportSettings.audioBitrate,

      // Render multiple frames in parallel instead of locking Remotion to 1 worker.
      // This is the biggest export-speed win on local / VPS rendering.
      concurrency: renderConcurrency,

      // JPEG frames are much lighter than PNG for cinematic video exports.
      imageFormat: "jpeg",
      jpegQuality: getJpegQuality(exportSettings.quality),

      // Faster H.264 encoding presets. CRF still controls visual quality.
      x264Preset: getX264Preset(exportSettings.quality),

      chromiumOptions: {
        disableWebSecurity: true,
        gl: getChromiumGlBackend(),
        enableMultiProcessOnLinux: true,
      },

      timeoutInMilliseconds: RENDER_TIMEOUT_MS,

      onProgress: ({ progress }: { progress: number }) => {
        const renderProgress = Math.round(progress * 100);

        const totalProgress = Math.min(
          99,
          25 + Math.round(renderProgress * 0.74),
        );

        updateRenderJob(jobId, {
          status: "rendering",
          progress: totalProgress,
          message: `جاري التصدير ${renderProgress}%`,
        });

        console.log(`RENDER_PROGRESS:${renderProgress}`);
      },
    });

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const url = `${siteUrl}/exports/${fileName}`;

    updateRenderJob(jobId, {
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

    return NextResponse.json({
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
    });
  } catch (error: any) {
    console.error("RENDER_ERROR:", error);

    if (jobId) {
      updateRenderJob(jobId, {
        status: "failed",
        progress: 0,
        message: error?.message || "حدث خطأ أثناء تصدير الفيديو",
        error: error?.message || String(error),
        completedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        jobId,
        error: "Render failed",
        message: error?.message || "حدث خطأ أثناء تصدير الفيديو",
      },
      { status: 500 },
    );
  } finally {
    if (acquiredRenderLock) {
      isRendering = false;
    }
  }
}

function resolveExportSettings(body: any) {
  const requestedPreset = String(body.exportPreset || "reels").trim();
  const preset = EXPORT_PRESETS[requestedPreset] ? requestedPreset : "reels";

  const requestedQuality = String(body.exportQuality || "high").trim();
  const quality = EXPORT_QUALITIES[requestedQuality]
    ? requestedQuality
    : "high";

  const presetSettings = EXPORT_PRESETS[preset];
  const qualitySettings = EXPORT_QUALITIES[quality];

  const requestedWidth = Number(body.exportWidth || presetSettings.width);
  const requestedHeight = Number(body.exportHeight || presetSettings.height);

  const width = clampNumber(
    Number.isFinite(requestedWidth)
      ? Math.round(requestedWidth)
      : presetSettings.width,
    360,
    3840,
  );

  const height = clampNumber(
    Number.isFinite(requestedHeight)
      ? Math.round(requestedHeight)
      : presetSettings.height,
    360,
    3840,
  );

  return {
    preset,
    label: presetSettings.label,
    quality,
    qualityLabel: qualitySettings.label,
    width: makeEven(width),
    height: makeEven(height),
    crf: qualitySettings.crf,
    audioBitrate: qualitySettings.audioBitrate,
    fps: clampNumber(Number(body.exportFps || qualitySettings.fps), 24, 60),
    renderScale: qualitySettings.renderScale,
  };
}

async function assertAssetAvailable(url: string, label: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSET_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${label} غير متاح حاليًا`);
    }
  } catch {
    try {
      const fallback = await fetch(url, {
        method: "GET",
        headers: {
          Range: "bytes=0-1",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (!fallback.ok && fallback.status !== 206) {
        throw new Error(`${label} غير متاح حاليًا`);
      }
    } catch {
      throw new Error(
        `تعذر تحميل ${label}. جرّب تغيير الخلفية أو إعادة إنشاء المعاينة.`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

function createRenderJob(job: Omit<RenderJob, "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();

  renderJobs.set(job.id, {
    ...job,
    createdAt: now,
    updatedAt: now,
  });

  trimRenderJobsHistory();
}

function updateRenderJob(
  jobId: string,
  updates: Partial<Omit<RenderJob, "id" | "createdAt">>,
) {
  const current = renderJobs.get(jobId);

  if (!current) return;

  renderJobs.set(jobId, {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  trimRenderJobsHistory();
}

function trimRenderJobsHistory() {
  const jobs = Array.from(renderJobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const oldJobs = jobs.slice(MAX_RENDER_JOBS_HISTORY);

  oldJobs.forEach((job) => {
    renderJobs.delete(job.id);
  });
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
  if (items.length <= 4) {
    return [items];
  }

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
    return Math.max(1, Math.floor(envConcurrency));
  }

  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT);

  if (isRailway) {
    return 1;
  }

  const cpuCount = Math.max(os.cpus()?.length || 2, 2);
  const envRatio = Number(process.env.REMOTION_CONCURRENCY_RATIO);
  const ratio =
    Number.isFinite(envRatio) && envRatio > 0 && envRatio <= 1
      ? envRatio
      : DEFAULT_RENDER_CONCURRENCY_RATIO;

  return clampNumber(Math.floor(cpuCount * ratio), 2, cpuCount);
}

function getJpegQuality(quality: string) {
  if (quality === "draft") return 76;
  if (quality === "standard") return 80;
  if (quality === "ultra") return 88;

  return 82;
}

function getX264Preset(quality: string) {
  if (quality === "draft") return "ultrafast";
  if (quality === "standard") return "veryfast";
  if (quality === "ultra") return "faster";

  return "veryfast";
}

function getChromiumGlBackend() {
  const requestedGl = process.env.REMOTION_CHROMIUM_GL;

  if (requestedGl) {
    return requestedGl as "angle" | "egl" | "swangle" | "vulkan" | "disabled";
  }

  return "angle";
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function makeEven(value: number) {
  return value % 2 === 0 ? value : value + 1;
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

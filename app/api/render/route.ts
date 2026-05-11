import path from "path";
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
const MAX_DURATION_SECONDS = 180;
const EXPORTS_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const ASSET_CHECK_TIMEOUT_MS = 10000;
const MAX_RENDER_JOBS_HISTORY = 25;

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
        message: "مدة الفيديو طويلة جدًا. الحد الحالي 3 دقائق.",
        error: "Video duration is too long",
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          jobId,
          message: "مدة الفيديو طويلة جدًا. الحد الحالي 3 دقائق.",
        },
        { status: 400 },
      );
    }

    const durationInFrames = Math.max(
      Math.ceil(totalDurationInSeconds * FPS),
      MIN_DURATION_FRAMES,
    );

    const nodeRequire = eval("require");

    const { bundle } = nodeRequire("@remotion/bundler");
    const { renderMedia, selectComposition } =
      nodeRequire("@remotion/renderer");

    const inputProps = {
      ayahs,
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
      fps: FPS,
      width: 1080,
      height: 1920,
    };

    const exportsDir = path.join(process.cwd(), "public", "exports");
    await mkdir(exportsDir, { recursive: true });

    const safeReciter = sanitizeFileName(body.reciter || "reciter");
    const safeSurah = sanitizeFileName(body.surahName || "surah");
    const fileId = jobId.slice(0, 8);
    const fileName = `${safeReciter}-${safeSurah}-ayah-${firstAyah}-to-${lastAyah}-${fileId}.mp4`;
    const outputLocation = path.join(exportsDir, fileName);

    await cleanupOldExports(exportsDir);

    updateRenderJob(jobId, {
      status: "rendering",
      progress: 25,
      message: "جاري تصدير الفيديو ودمج الصوت",
      fileName,
      durationInSeconds: totalDurationInSeconds,
      durationInFrames,
    });

    await renderMedia({
      composition: finalComposition,
      serveUrl: bundled,
      codec: "h264",
      audioCodec: "aac",
      outputLocation,
      inputProps,

      crf: 25,
      audioBitrate: "160k",
      concurrency: 2,

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

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
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

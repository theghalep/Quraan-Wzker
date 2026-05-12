import { NextResponse } from "next/server";
import crypto from "crypto";
import { renderQueue } from "@/lib/queue/renderQueue";

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

const MAX_DURATION_SECONDS = 600;
const MAX_RENDER_JOBS_HISTORY = 25;

const renderJobs = new Map<string, RenderJob>();

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
  const queueJobs = await renderQueue.getJobs([
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  ]);

  const bullJobs = await Promise.all(
    queueJobs.map(async (job) => {
      const state = await job.getState();
      const progress = Number(job.progress || 0);
      const data = job.data || {};
      const result = job.returnvalue || {};
      const failedReason = job.failedReason;

      return normalizeQueueJob({
        id: String(data.jobId || job.id),
        state,
        progress,
        data,
        result,
        failedReason,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn,
      });
    }),
  );

  const memoryJobs = Array.from(renderJobs.values());
  const merged = new Map<string, RenderJob>();

  memoryJobs.forEach((job) => merged.set(job.id, job));
  bullJobs.forEach((job) => merged.set(job.id, job));

  const jobs = Array.from(merged.values())
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, MAX_RENDER_JOBS_HISTORY);

  return NextResponse.json({
    isRendering: jobs.some((job) => job.status === "rendering"),
    jobs,
  });
}

export async function POST(request: Request) {
  let jobId = "";

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
      return failJob(jobId, "لا توجد آيات للتصدير", 400);
    }

    if (!body.backgroundVideoUrl) {
      return failJob(jobId, "لا توجد خلفية للتصدير", 400);
    }

    const totalDurationInSeconds = ayahs.reduce(
      (total: number, ayah: any) => total + Number(ayah.duration || 5),
      0,
    );

    if (totalDurationInSeconds > MAX_DURATION_SECONDS) {
      return failJob(jobId, "مدة الفيديو طويلة جدًا. الحد الحالي 10 دقائق.", 400);
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

await renderQueue.add(
  "render-video",
  {
    jobId,
    body,
    exportSettings,
  },
  {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 20,
    removeOnFail: 50,
  }
);

    updateRenderJob(jobId, {
      status: "queued",
      progress: 0,
      message: "تمت إضافة الفيديو إلى قائمة الانتظار",
      durationInSeconds: totalDurationInSeconds,
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: "queued",
      progress: 0,
      message: "تمت إضافة الفيديو إلى قائمة الانتظار",
    });
  } catch (error: any) {
    console.error("RENDER_QUEUE_ERROR:", error);

    if (jobId) {
      updateRenderJob(jobId, {
        status: "failed",
        progress: 0,
        message: error?.message || "حدث خطأ أثناء إضافة الفيديو إلى قائمة الانتظار",
        error: error?.message || String(error),
        completedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        jobId,
        error: "Queue failed",
        message: error?.message || "حدث خطأ أثناء إضافة الفيديو إلى قائمة الانتظار",
      },
      { status: 500 },
    );
  }
}

function failJob(jobId: string, message: string, status: number) {
  updateRenderJob(jobId, {
    status: "failed",
    progress: 0,
    message,
    error: message,
    completedAt: new Date().toISOString(),
  });

  return NextResponse.json({ jobId, message }, { status });
}

function normalizeQueueJob({
  id,
  state,
  progress,
  data,
  result,
  failedReason,
  createdAt,
  processedAt,
  finishedAt,
}: {
  id: string;
  state: string;
  progress: number;
  data: any;
  result: any;
  failedReason?: string;
  createdAt?: number;
  processedAt?: number;
  finishedAt?: number;
}): RenderJob {
  const meta = data?.meta || {};
  const body = data?.body || {};
  const exportSettings = data?.exportSettings || {};

  const status: RenderJobStatus =
    state === "completed"
      ? "completed"
      : state === "failed"
        ? "failed"
        : state === "active"
          ? "rendering"
          : "queued";

  return {
    id,
    status,
    progress: status === "completed" ? 100 : progress || 0,
    message:
      result?.message ||
      (status === "completed"
        ? "تم التصدير بنجاح"
        : status === "failed"
          ? failedReason || "فشل التصدير"
          : status === "rendering"
            ? "جاري تصدير الفيديو"
            : "في قائمة الانتظار"),
    fileName: result?.fileName,
    url: result?.url,
    error: failedReason,
    reciter: body.reciter || "",
    surahName: body.surahName || "",
    fromAyah: meta.firstAyah,
    toAyah: meta.lastAyah,
    durationInSeconds: meta.totalDurationInSeconds,
    durationInFrames: result?.durationInFrames,
    exportPreset: exportSettings.preset,
    exportQuality: exportSettings.quality,
    exportWidth: exportSettings.width,
    exportHeight: exportSettings.height,
    exportFps: exportSettings.fps,
    createdAt: createdAt
      ? new Date(createdAt).toISOString()
      : new Date().toISOString(),
    updatedAt: new Date(processedAt || finishedAt || Date.now()).toISOString(),
    completedAt: finishedAt ? new Date(finishedAt).toISOString() : undefined,
  };
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

function resolveExportSettings(body: any): ExportSettings {
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function makeEven(value: number) {
  return value % 2 === 0 ? value : value + 1;
}

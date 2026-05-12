import { NextResponse } from "next/server";
import crypto from "crypto";
import { renderQueue } from "@/lib/queue/renderQueue";
import {
  getRenderJob,
  updateRenderJob,
} from "@/lib/queue/renderJobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RenderJobStatus =
  | "queued"
  | "validating"
  | "bundling"
  | "rendering"
  | "completed"
  | "failed";

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

type RenderJobResponse = {
  id: string;
  status: RenderJobStatus;
  progress: number;
  message: string;
  url?: string;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  exportPreset?: string;
  exportQuality?: string;
  exportWidth?: number;
  exportHeight?: number;
  exportFps?: number;
  durationInSeconds?: number;
  durationInFrames?: number;
};

const MAX_DURATION_SECONDS = 600;
const MAX_RENDER_JOBS_HISTORY = 25;

const EXPORT_PRESETS = {
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
} as const;

const EXPORT_QUALITIES = {
  draft: {
    label: "Draft",
    crf: 34,
    audioBitrate: "80k",
    fps: 24,
    renderScale: 0.7,
  },

  standard: {
    label: "Standard",
    crf: 30,
    audioBitrate: "96k",
    fps: 24,
    renderScale: 0.85,
  },

  high: {
    label: "High",
    crf: 23,
    audioBitrate: "128k",
    fps: 30,
    renderScale: 1,
  },

  ultra: {
    label: "Ultra",
    crf: 20,
    audioBitrate: "192k",
    fps: 30,
    renderScale: 1,
  },
} as const;

export async function GET() {
  const queueJobs = await renderQueue.getJobs([
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  ]);

  const jobs = await Promise.all(
    queueJobs.slice(0, MAX_RENDER_JOBS_HISTORY).map(async (job) => {
      const id = String(job.data?.jobId || job.id);
      const redisJob = await getRenderJob(id);
      const bullStatus = getBullJobStatus(job);
      const status = normalizeStatus(redisJob?.status || bullStatus);

      const progress = clampNumber(
        Number(redisJob?.progress ?? job.progress ?? 0),
        0,
        100,
      );

      const createdAt =
        redisJob?.createdAt ||
        (job.timestamp
          ? new Date(job.timestamp).toISOString()
          : new Date().toISOString());

      const updatedAt =
        redisJob?.updatedAt ||
        new Date(job.finishedOn || job.processedOn || Date.now()).toISOString();

      const normalizedJob: RenderJobResponse = {
        id,
        status,
        progress: status === "completed" ? 100 : progress,
        message:
          redisJob?.message ||
          job.returnvalue?.message ||
          getDefaultStatusMessage(status),
        url: redisJob?.url || job.returnvalue?.url,
        fileName: redisJob?.fileName || job.returnvalue?.fileName,
        error:
          status === "failed"
            ? redisJob?.error || job.failedReason || undefined
            : undefined,
        createdAt,
        updatedAt,
        completedAt:
          redisJob?.completedAt ||
          (job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined),
        exportPreset: redisJob?.exportPreset || job.data?.exportSettings?.preset,
        exportQuality:
          redisJob?.exportQuality || job.data?.exportSettings?.quality,
        exportWidth: redisJob?.exportWidth || job.data?.exportSettings?.width,
        exportHeight: redisJob?.exportHeight || job.data?.exportSettings?.height,
        exportFps: redisJob?.exportFps || job.data?.exportSettings?.fps,
        durationInSeconds: redisJob?.durationInSeconds,
        durationInFrames:
          redisJob?.durationInFrames || job.returnvalue?.durationInFrames,
      };

      return normalizedJob;
    }),
  );

  const sortedJobs = jobs
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, MAX_RENDER_JOBS_HISTORY);

  return NextResponse.json({
    isRendering: sortedJobs.some((job) =>
      ["queued", "validating", "bundling", "rendering"].includes(job.status),
    ),
    jobs: sortedJobs,
  });
}

export async function POST(request: Request) {
  let jobId = "";

  try {
    const body = await request.json();
    const ayahs = Array.isArray(body.ayahs) ? body.ayahs : [];

    if (!ayahs.length) {
      return NextResponse.json(
        {
          error: "لا توجد آيات",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.backgroundVideoUrl) {
      return NextResponse.json(
        {
          error: "لا توجد خلفية",
        },
        {
          status: 400,
        },
      );
    }

    const totalDurationInSeconds = ayahs.reduce(
      (total: number, ayah: any) => total + Number(ayah.duration || 5),
      0,
    );

    if (totalDurationInSeconds > MAX_DURATION_SECONDS) {
      return NextResponse.json(
        {
          error: "مدة الفيديو طويلة جدًا",
        },
        {
          status: 400,
        },
      );
    }

    const exportSettings = resolveExportSettings(body);
    jobId = crypto.randomUUID();

    const now = new Date().toISOString();

    await updateRenderJob(jobId, {
      status: "queued",
      progress: 0,
      message: "تمت إضافة الفيديو لقائمة الانتظار",
      createdAt: now,
      updatedAt: now,
      durationInSeconds: totalDurationInSeconds,
      exportPreset: exportSettings.preset,
      exportQuality: exportSettings.quality,
      exportWidth: exportSettings.width,
      exportHeight: exportSettings.height,
      exportFps: exportSettings.fps,
    });

    await renderQueue.add(
      "render-video",
      {
        jobId,
        body,
        exportSettings,
        siteUrl:
          process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.PUBLIC_SITE_URL ||
          request.headers.get("origin") ||
          "http://localhost:3000",
      },
      {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
        removeOnComplete: {
          age: 60 * 60,
          count: 10,
        },
        removeOnFail: {
          age: 60 * 60 * 6,
          count: 20,
        },
      },
    );

    return NextResponse.json({
      success: true,
      jobId,
      status: "queued",
      progress: 0,
      message: "تمت إضافة الفيديو لقائمة الانتظار",
    });
  } catch (error: any) {
    console.error("RENDER_ROUTE_ERROR:", error);

    if (jobId) {
      await updateRenderJob(jobId, {
        status: "failed",
        progress: 0,
        message: error?.message || "Render queue failed",
        error: error?.message || String(error),
        completedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        error: error?.message || "Render queue failed",
      },
      {
        status: 500,
      },
    );
  }
}

function getBullJobStatus(job: any): RenderJobStatus {
  if (job.finishedOn && !job.failedReason) return "completed";
  if (job.failedReason) return "failed";
  if (job.processedOn) return "rendering";
  return "queued";
}

function normalizeStatus(status: string | undefined): RenderJobStatus {
  if (
    status === "queued" ||
    status === "validating" ||
    status === "bundling" ||
    status === "rendering" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }

  return "queued";
}

function getDefaultStatusMessage(status: RenderJobStatus) {
  if (status === "completed") return "تم التصدير بنجاح";
  if (status === "failed") return "فشل التصدير";
  if (status === "validating") return "جاري فحص الملفات";
  if (status === "bundling") return "جاري تجهيز Remotion";
  if (status === "rendering") return "جاري التصدير";
  return "في قائمة الانتظار";
}

function resolveExportSettings(body: any): ExportSettings {
  const requestedPreset = String(body.exportPreset || "reels").trim();
  const preset = Object.prototype.hasOwnProperty.call(
    EXPORT_PRESETS,
    requestedPreset,
  )
    ? requestedPreset
    : "reels";

  const requestedQuality = String(body.exportQuality || "high").trim();
  const quality = Object.prototype.hasOwnProperty.call(
    EXPORT_QUALITIES,
    requestedQuality,
  )
    ? requestedQuality
    : "high";

  const presetSettings =
    EXPORT_PRESETS[preset as keyof typeof EXPORT_PRESETS];

  const qualitySettings =
    EXPORT_QUALITIES[quality as keyof typeof EXPORT_QUALITIES];

  return {
    preset,
    label: presetSettings.label,
    quality,
    qualityLabel: qualitySettings.label,

    width: makeEven(
      clampNumber(Number(body.exportWidth || presetSettings.width), 360, 3840),
    ),

    height: makeEven(
      clampNumber(Number(body.exportHeight || presetSettings.height), 360, 3840),
    ),

    crf: qualitySettings.crf,
    audioBitrate: qualitySettings.audioBitrate,
    fps: clampNumber(Number(body.exportFps || qualitySettings.fps), 24, 60),
    renderScale: qualitySettings.renderScale,
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function makeEven(value: number) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

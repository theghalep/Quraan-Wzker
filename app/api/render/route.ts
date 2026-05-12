import { NextResponse } from "next/server";
import crypto from "crypto";
import { renderQueue } from "@/lib/queue/renderQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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

const renderJobs = new Map();

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
};

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
};

export async function GET() {
  const queueJobs = await renderQueue.getJobs([
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  ]);

  const jobs = queueJobs
    .map((job) => ({
      id: String(job.data?.jobId || job.id),
      status:
        job.finishedOn && !job.failedReason
          ? "completed"
          : job.failedReason
            ? "failed"
            : job.processedOn
              ? "rendering"
              : "queued",

      progress: Number(job.progress || 0),

      message:
        job.returnvalue?.message ||
        (job.failedReason
          ? "فشل التصدير"
          : job.processedOn
            ? "جاري التصدير"
            : "في قائمة الانتظار"),

      url: job.returnvalue?.url,
      fileName: job.returnvalue?.fileName,

      createdAt: new Date(job.timestamp).toISOString(),

      updatedAt: new Date(
        job.finishedOn || job.processedOn || Date.now(),
      ).toISOString(),
    }))
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

    renderJobs.set(jobId, {
      id: jobId,
      status: "queued",
      progress: 0,
      message: "تمت إضافة الفيديو لقائمة الانتظار",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await renderQueue.add(
      "render-video",
      {
        jobId,
        body,
        exportSettings,
      },

      {
        attempts: 2,

        backoff: {
          type: "exponential",
          delay: 3000,
        },

        removeOnComplete: 10,
        removeOnFail: 20,
      },
    );

    return NextResponse.json({
      success: true,
      jobId,
      status: "queued",
      progress: 0,
    });
  } catch (error: any) {
    console.error("RENDER_ROUTE_ERROR:", error);

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
  return Math.min(Math.max(value, min), max);
}

function makeEven(value: number) {
  return value % 2 === 0 ? value : value + 1;
}
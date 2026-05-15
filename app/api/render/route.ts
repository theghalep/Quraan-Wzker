import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { unlink } from "fs/promises";
import { renderQueue } from "@/lib/queue/renderQueue";
import {
  getRecentRenderJobs,
  getRenderJob,
  updateRenderJob,
  requestRenderJobCancellation,
} from "@/lib/queue/renderJobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RenderJobStatus =
  | "queued"
  | "validating"
  | "bundling"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

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
  cancelRequested?: boolean;
  cancelledAt?: string;
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
    renderScale: 1,
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
    audioBitrate: "128k",
    fps: 30,
    renderScale: 1,
  },

  ultra: {
    label: "Ultra",
    crf: 21,
    audioBitrate: "160k",
    fps: 30,
    renderScale: 1,
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (jobId) {
      const redisJob = await getRenderJob(jobId);
      const bullJob = await renderQueue.getJob(jobId);

      if (!redisJob && !bullJob) {
        return NextResponse.json(
          {
            success: false,
            error: "Job not found",
            message: "لم يتم العثور على مهمة التصدير",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        job: normalizeJobResponse(jobId, redisJob, bullJob),
      });
    }

    const redisJobs = await getRecentRenderJobs(MAX_RENDER_JOBS_HISTORY);

    const jobs = await Promise.all(
      redisJobs.map(async (redisJob) => {
        const id = String(redisJob.id);
        const bullJob = await renderQueue.getJob(id);
        return normalizeJobResponse(id, redisJob, bullJob);
      }),
    );

    const sortedJobs = jobs
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, MAX_RENDER_JOBS_HISTORY);

    return NextResponse.json({
      success: true,
      isRendering: sortedJobs.some((job) =>
        ["queued", "validating", "bundling", "rendering"].includes(job.status),
      ),
      jobs: sortedJobs,
    });
  } catch (error: any) {
    console.error("RENDER_GET_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to read render jobs",
        message: "حدث خطأ أثناء قراءة حالة التصدير",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let jobId = "";

  try {
    const body = await request.json();
    const ayahs = Array.isArray(body.ayahs) ? body.ayahs : [];

    if (!ayahs.length) {
      return NextResponse.json(
        {
          success: false,
          error: "لا توجد آيات",
          message: "لا توجد آيات للتصدير",
        },
        { status: 400 },
      );
    }

    if (!body.backgroundVideoUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "لا توجد خلفية",
          message: "اختار أو ارفع خلفية أولًا",
        },
        { status: 400 },
      );
    }

    const totalDurationInSeconds = ayahs.reduce(
      (total: number, ayah: any) => total + Number(ayah.duration || 5),
      0,
    );

    if (totalDurationInSeconds > MAX_DURATION_SECONDS) {
      return NextResponse.json(
        {
          success: false,
          error: "مدة الفيديو طويلة جدًا",
          message: "مدة الفيديو طويلة جدًا. الحد الحالي 10 دقائق.",
        },
        { status: 400 },
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
        jobId,
      },
    );

    return NextResponse.json({
      success: true,
      jobId,
      status: "queued",
      progress: 0,
      message: "تمت إضافة الفيديو لقائمة الانتظار",
      exportPreset: exportSettings.preset,
      exportQuality: exportSettings.quality,
      exportWidth: exportSettings.width,
      exportHeight: exportSettings.height,
      exportFps: exportSettings.fps,
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
        success: false,
        error: error?.message || "Render queue failed",
        message: "حدث خطأ أثناء إضافة الفيديو لقائمة التصدير",
      },
      { status: 500 },
    );
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          message: "Job ID مطلوب لإلغاء التصدير",
        },
        { status: 400 },
      );
    }

    const redisJob = await getRenderJob(jobId);
    const bullJob = await renderQueue.getJob(jobId);

    if (!redisJob && !bullJob) {
      return NextResponse.json(
        {
          success: false,
          message: "لم يتم العثور على مهمة التصدير",
        },
        { status: 404 },
      );
    }

    await requestRenderJobCancellation(jobId);

    // Waiting/delayed jobs can be removed immediately. Active jobs cannot be
    // forcibly removed from BullMQ; the worker sees the Redis cancellation flag
    // and stops renderMedia() through Remotion's cancelSignal.
    if (bullJob) {
      try {
        const state = await bullJob.getState();
        if (["waiting", "delayed", "prioritized", "paused"].includes(state)) {
          await bullJob.remove();
        }
      } catch (error) {
        console.warn("RENDER_CANCEL_BULL_REMOVE_SKIPPED:", error);
      }
    }

    const fileName = redisJob?.fileName || bullJob?.returnvalue?.fileName;
    if (fileName) {
      await unlink(path.join(process.cwd(), "public", "exports", fileName)).catch(() => undefined);
    }

    return NextResponse.json({
      success: true,
      jobId,
      status: "cancelled",
      progress: 0,
      message: "تم إرسال أمر الإلغاء. لو الرندر بدأ بالفعل سيتم إيقافه من worker خلال ثواني.",
    });
  } catch (error: any) {
    console.error("RENDER_DELETE_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
        message: "تعذر إلغاء التصدير",
      },
      { status: 500 },
    );
  }
}

function normalizeJobResponse(
  id: string,
  redisJob: any | null,
  bullJob: any | null,
): RenderJobResponse {
  const bullStatus = getBullJobStatus(bullJob);
  const status = normalizeStatus(redisJob?.status || bullStatus);

  const progress = clampNumber(
    Number(redisJob?.progress ?? bullJob?.progress ?? 0),
    0,
    100,
  );

  const createdAt =
    redisJob?.createdAt ||
    (bullJob?.timestamp
      ? new Date(bullJob.timestamp).toISOString()
      : new Date().toISOString());

  const updatedAt =
    redisJob?.updatedAt ||
    new Date(bullJob?.finishedOn || bullJob?.processedOn || Date.now()).toISOString();

  return {
    id,
    status,
    progress: status === "completed" ? 100 : progress,
    message:
      redisJob?.message ||
      bullJob?.returnvalue?.message ||
      getDefaultStatusMessage(status),
    url: redisJob?.url || bullJob?.returnvalue?.url,
    fileName: redisJob?.fileName || bullJob?.returnvalue?.fileName,
    error:
      status === "failed"
        ? redisJob?.error || bullJob?.failedReason || undefined
        : undefined,
    cancelRequested: Boolean(redisJob?.cancelRequested),
    cancelledAt: redisJob?.cancelledAt,
    createdAt,
    updatedAt,
    completedAt:
      redisJob?.completedAt ||
      (bullJob?.finishedOn ? new Date(bullJob.finishedOn).toISOString() : undefined),
    exportPreset: redisJob?.exportPreset || bullJob?.data?.exportSettings?.preset,
    exportQuality: redisJob?.exportQuality || bullJob?.data?.exportSettings?.quality,
    exportWidth: redisJob?.exportWidth || bullJob?.data?.exportSettings?.width,
    exportHeight: redisJob?.exportHeight || bullJob?.data?.exportSettings?.height,
    exportFps: redisJob?.exportFps || bullJob?.data?.exportSettings?.fps,
    durationInSeconds: redisJob?.durationInSeconds,
    durationInFrames:
      redisJob?.durationInFrames || bullJob?.returnvalue?.durationInFrames,
  };
}

function getBullJobStatus(job: any | null): RenderJobStatus {
  if (!job) return "queued";
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
    status === "failed" ||
    status === "cancelled"
  ) {
    return status;
  }

  return "queued";
}

function getDefaultStatusMessage(status: RenderJobStatus) {
  if (status === "completed") return "تم التصدير بنجاح";
  if (status === "failed") return "فشل التصدير";
  if (status === "cancelled") return "تم إلغاء التصدير";
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

  const presetSettings = EXPORT_PRESETS[preset as keyof typeof EXPORT_PRESETS];
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
    fps: clampNumber(Number(body.exportFps || qualitySettings.fps), 24, 30),
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

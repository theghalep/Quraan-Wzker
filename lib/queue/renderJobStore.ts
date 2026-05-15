import { redis } from "./redis";

export type RenderJobStatus =
  | "queued"
  | "validating"
  | "bundling"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export type RenderJobRecord = {
  id: string;
  status?: RenderJobStatus;
  progress?: number;
  message?: string;
  fileName?: string;
  url?: string;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  durationInSeconds?: number;
  durationInFrames?: number;
  exportPreset?: string;
  exportQuality?: string;
  exportWidth?: number;
  exportHeight?: number;
  exportFps?: number;
};

const JOB_TTL_SECONDS = 60 * 60 * 24;
const COMPLETED_JOB_TTL_SECONDS = 60 * 60 * 6;
const FAILED_JOB_TTL_SECONDS = 60 * 60 * 12;
const RENDER_JOBS_INDEX_KEY = "render-jobs:index";
const MAX_RENDER_JOBS_INDEX_SIZE = 100;

function getJobKey(jobId: string) {
  return `render-job:${jobId}`;
}

function getJobTtl(status?: RenderJobStatus) {
  if (status === "completed") return COMPLETED_JOB_TTL_SECONDS;
  if (status === "failed") return FAILED_JOB_TTL_SECONDS;
  if (status === "cancelled") return FAILED_JOB_TTL_SECONDS;
  return JOB_TTL_SECONDS;
}

export async function updateRenderJob(
  jobId: string,
  updates: Partial<RenderJobRecord>,
) {
  const key = getJobKey(jobId);
  const now = new Date().toISOString();

  let current: RenderJobRecord = {
    id: jobId,
    createdAt: now,
  };

  const currentRaw = await redis.get(key);

  if (currentRaw) {
    try {
      current = JSON.parse(currentRaw);
    } catch {
      current = {
        id: jobId,
        createdAt: now,
      };
    }
  }

  const next: RenderJobRecord = {
    ...current,
    ...updates,
    id: jobId,
    createdAt: current.createdAt || updates.createdAt || now,
    updatedAt: now,
  };

  const ttl = getJobTtl(next.status);
  const score = new Date(next.createdAt || now).getTime();

  await redis
    .multi()
    .set(key, JSON.stringify(next), "EX", ttl)
    .zadd(RENDER_JOBS_INDEX_KEY, score, jobId)
    .zremrangebyrank(RENDER_JOBS_INDEX_KEY, 0, -(MAX_RENDER_JOBS_INDEX_SIZE + 1))
    .expire(RENDER_JOBS_INDEX_KEY, JOB_TTL_SECONDS)
    .exec();

  return next;
}

export async function getRenderJob(jobId: string) {
  const raw = await redis.get(getJobKey(jobId));

  if (!raw) return null;

  try {
    return JSON.parse(raw) as RenderJobRecord;
  } catch {
    return null;
  }
}

export async function getRecentRenderJobs(limit = 25) {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
  const ids = await redis.zrevrange(RENDER_JOBS_INDEX_KEY, 0, safeLimit - 1);

  if (!ids.length) return [];

  const rows = await Promise.all(ids.map((id) => getRenderJob(id)));

  return rows.filter(Boolean) as RenderJobRecord[];
}

export async function deleteRenderJob(jobId: string) {
  await redis
    .multi()
    .del(getJobKey(jobId))
    .zrem(RENDER_JOBS_INDEX_KEY, jobId)
    .exec();
}


export async function cancelRenderJob(jobId: string, message = "تم إلغاء التصدير") {
  return updateRenderJob(jobId, {
    status: "cancelled",
    progress: 0,
    message,
    error: message,
    cancelledAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
}

export async function isRenderJobCancelled(jobId: string) {
  const job = await getRenderJob(jobId);
  return job?.status === "cancelled";
}

import { redis } from "./redis";

export type RenderJobStatus =
  | "queued"
  | "validating"
  | "bundling"
  | "rendering"
  | "completed"
  | "failed";

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

function getJobTtl(status?: RenderJobStatus) {
  if (status === "completed") return COMPLETED_JOB_TTL_SECONDS;
  if (status === "failed") return FAILED_JOB_TTL_SECONDS;
  return JOB_TTL_SECONDS;
}

export async function updateRenderJob(
  jobId: string,
  updates: Partial<RenderJobRecord>,
) {
  const key = `render-job:${jobId}`;

  let current: RenderJobRecord = {
    id: jobId,
    createdAt: new Date().toISOString(),
  };

  const currentRaw = await redis.get(key);

  if (currentRaw) {
    try {
      current = JSON.parse(currentRaw);
    } catch {
      current = {
        id: jobId,
        createdAt: new Date().toISOString(),
      };
    }
  }

  const next: RenderJobRecord = {
    ...current,
    ...updates,
    id: jobId,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(key, JSON.stringify(next), "EX", getJobTtl(next.status));

  return next;
}

export async function getRenderJob(jobId: string) {
  const raw = await redis.get(`render-job:${jobId}`);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as RenderJobRecord;
  } catch {
    return null;
  }
}

export async function deleteRenderJob(jobId: string) {
  await redis.del(`render-job:${jobId}`);
}
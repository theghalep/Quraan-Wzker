import { redis } from "./redis";

export type RenderJobStatus =
  | "queued"
  | "validating"
  | "bundling"
  | "rendering"
  | "completed"
  | "failed";

export async function updateRenderJob(jobId: string, updates: any) {
  const key = `render-job:${jobId}`;
  const currentRaw = await redis.get(key);
  const current = currentRaw ? JSON.parse(currentRaw) : {};

  const next = {
    ...current,
    ...updates,
    id: jobId,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(key, JSON.stringify(next), "EX", 60 * 60 * 24);
}

export async function getRenderJob(jobId: string) {
  const raw = await redis.get(`render-job:${jobId}`);
  return raw ? JSON.parse(raw) : null;
}
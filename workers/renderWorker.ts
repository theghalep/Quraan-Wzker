import { Worker } from "bullmq";
import { redis } from "../lib/queue/redis";
import { updateRenderJob } from "../lib/queue/renderJobStore";

new Worker(
  "render-queue",
  async (job) => {
    const { jobId } = job.data;

    console.log("Processing render job:", jobId);

    await updateRenderJob(jobId, {
      status: "rendering",
      progress: 10,
      message: "بدأ العامل الخلفي معالجة الفيديو",
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    await updateRenderJob(jobId, {
      status: "completed",
      progress: 100,
      message: "تم اختبار العامل الخلفي بنجاح",
      completedAt: new Date().toISOString(),
    });

    console.log("Render completed:", jobId);
  },
  {
    connection: redis,
  },
);

console.log("Render worker started");
import { Worker } from "bullmq";
import { redis } from "../lib/queue/redis";

const worker = new Worker(
  "render-queue",
  async (job) => {
    console.log("Processing render job:", job.id);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("Render completed:", job.id);
  },
  {
    connection: redis,
  }
);

console.log("Render worker started");
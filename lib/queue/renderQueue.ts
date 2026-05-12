import { Queue } from "bullmq";
import { redis } from "./redis";

export const renderQueue = new Queue("render-queue", {
  connection: redis,
});
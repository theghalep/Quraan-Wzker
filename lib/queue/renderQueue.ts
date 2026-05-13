import { Queue } from "bullmq";
import { redis } from "./redis";

export const renderQueue = new Queue("render-queue", {
  connection: redis,

  defaultJobOptions: {
    attempts: 2,

    backoff: {
      type: "exponential",
      delay: 3000,
    },

    removeOnComplete: {
      age: 60 * 60,
      count: 25,
    },

    removeOnFail: {
      age: 60 * 60 * 24,
      count: 50,
    },
  },
});

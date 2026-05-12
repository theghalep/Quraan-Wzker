import IORedis from "ioredis";

const isProduction = process.env.NODE_ENV === "production";

export const redis = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",

  port: Number(process.env.REDIS_PORT || 6379),

  password: process.env.REDIS_PASSWORD || undefined,

  maxRetriesPerRequest: null,

  enableReadyCheck: false,

  lazyConnect: true,

  connectTimeout: 10000,

  keepAlive: 30000,

  family: 4,

  retryStrategy(times) {
    const delay = Math.min(times * 1000, 10000);

    console.log(`Redis reconnect attempt ${times}`);

    return delay;
  },

  reconnectOnError() {
    return true;
  },
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("ready", () => {
  console.log("Redis ready");
});

redis.on("error", (error) => {
  console.error("Redis error:", error);
});

redis.on("close", () => {
  console.log("Redis connection closed");
});

if (isProduction) {
  process.on("SIGINT", async () => {
    await redis.quit();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await redis.quit();
    process.exit(0);
  });
}
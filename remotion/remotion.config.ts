import { Config } from "@remotion/cli/config";
import os from "os";

const cpuCount = Math.max(os.cpus()?.length || 2, 2);
const concurrency = Math.max(2, Math.floor(cpuCount * 0.75));

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setConcurrency(concurrency);
Config.setChromiumOpenGlRenderer("angle");
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);

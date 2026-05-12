/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,

  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./image-loader.js",
  },

  outputFileTracingIncludes: {
    "/api/render": [
      "./node_modules/@remotion/bundler/**/*",
      "./node_modules/@remotion/renderer/**/*",
      "./node_modules/@remotion/lambda/**/*",
      "./node_modules/remotion/**/*",
    ],
  },
};

module.exports = nextConfig;

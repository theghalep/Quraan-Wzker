/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,

  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./image-loader.js",
  },

  experimental: {
    outputFileTracingIncludes: {
      "/api/render": [
        "./node_modules/@remotion/**/*",
        "./node_modules/remotion/**/*",
        "./node_modules/@rspack/**/*",
        "./node_modules/esbuild/**/*",
      ],
    },
  },
};

module.exports = nextConfig;

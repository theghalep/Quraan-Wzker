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
        "./node_modules/execa/**/*",
        "./node_modules/extract-zip/**/*",
        "./node_modules/fs-extra/**/*",
        "./node_modules/source-map/**/*",
        "./node_modules/p-limit/**/*",
        "./node_modules/puppeteer-core/**/*",
        "./node_modules/@puppeteer/**/*",
      ],
    },
  },
};

module.exports = nextConfig;

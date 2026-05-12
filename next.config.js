/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false,

  swcMinify: true,

  experimental: {
    serverComponentsExternalPackages: [
      "@remotion/bundler",
      "@remotion/renderer",
    ],
  },

  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./image-loader.js",
  },
};

module.exports = nextConfig;

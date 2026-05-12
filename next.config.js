/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,

  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./image-loader.js",
  },
};

module.exports = nextConfig;
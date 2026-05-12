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
      "/api/render": ["./node_modules/**/*"],
    },
  },
};

module.exports = nextConfig;

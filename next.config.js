/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@remotion/bundler",
      "@remotion/renderer",
    ],
  },
};

module.exports = nextConfig;

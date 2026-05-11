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

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        "@remotion/bundler": "commonjs @remotion/bundler",
        "@remotion/renderer": "commonjs @remotion/renderer",
      });
    }

    return config;
  },

  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

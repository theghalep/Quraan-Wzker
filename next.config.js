/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,

  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./image-loader.js",
  },

  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
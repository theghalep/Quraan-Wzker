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
        "./node_modules/@remotion/renderer/node_modules/**/*",
        "./node_modules/@remotion/bundler/node_modules/**/*",
        "./node_modules/remotion/**/*",
        "./node_modules/@rspack/**/*",
        "./node_modules/esbuild/**/*",

        "./node_modules/execa/**/*",
        "./node_modules/extract-zip/**/*",
        "./node_modules/cross-spawn/**/*",
        "./node_modules/which/**/*",
        "./node_modules/path-key/**/*",
        "./node_modules/shebang-command/**/*",
        "./node_modules/shebang-regex/**/*",
        "./node_modules/mimic-fn/**/*",
        "./node_modules/isexe/**/*",
        "./node_modules/npm-run-path/**/*",
        "./node_modules/strip-final-newline/**/*",
        "./node_modules/human-signals/**/*",
        "./node_modules/signal-exit/**/*",
        "./node_modules/merge-stream/**/*",
        "./node_modules/get-stream/**/*",
        "./node_modules/is-stream/**/*",
        "./node_modules/onetime/**/*",

        "./node_modules/debug/**/*",
        "./node_modules/yauzl/**/*",
        "./node_modules/fd-slicer/**/*",
        "./node_modules/buffer-crc32/**/*",
        "./node_modules/pend/**/*",
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

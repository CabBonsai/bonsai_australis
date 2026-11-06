import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    rules: {},
  },
  // The booklet PDF route runs headless Chromium; make sure its binary files ship with the function.
  outputFileTracingIncludes: {
    '/api/booklets/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;

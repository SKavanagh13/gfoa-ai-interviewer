import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": [
      "./prompts/post-interview-analysis.system.md",
      "./docs/locked/03-per-interview-output-specification.md",
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for Docker. On Vercel it breaks the platform build
  // (ENOENT next-server.js.nft.json) and leaves the domain with no Ready deploy.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  serverExternalPackages: [
    "@node-rs/argon2",
    "bullmq",
    "ioredis",
    "@sentry/node",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;

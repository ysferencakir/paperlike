import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: process.env.CAP_DEV_IP ? [process.env.CAP_DEV_IP] : undefined,
};

export default nextConfig;

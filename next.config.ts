import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/option-guidance",
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

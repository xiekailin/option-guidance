import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/option-guidance",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

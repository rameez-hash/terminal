import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/transactions/[id]/invoice": ["./src/fonts/**/*.ttf", "./public/fonts/**/*.ttf"],
    "/api/payment-links/[id]/invoice": ["./src/fonts/**/*.ttf", "./public/fonts/**/*.ttf"],
  },
};

export default nextConfig;

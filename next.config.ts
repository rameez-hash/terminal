import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/transactions/[id]/invoice": [
      "./src/fonts/**/*.ttf",
      "./public/fonts/**/*.ttf",
      "./src/invoice-assets/**/*.png",
      "./public/invoice-assets/**/*.png",
    ],
    "/api/payment-links/[id]/invoice": [
      "./src/fonts/**/*.ttf",
      "./public/fonts/**/*.ttf",
      "./src/invoice-assets/**/*.png",
      "./public/invoice-assets/**/*.png",
    ],
  },
};

export default nextConfig;

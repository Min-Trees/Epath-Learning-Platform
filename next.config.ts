import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Tăng giới hạn body cho Route Handler để upload video lớn (local fallback).
  // Giá trị này áp dụng cho fetch handler của App Router, không chỉ server actions.
  // Lưu ý: backend thật (Viettel IDC S3) nên dùng multipart upload cho file >100MB;
  // local fallback chỉ phục vụ DEV.
  // Body limit được áp dụng trong route local-receive thông qua headers tùy chỉnh
  // vì Next.js Route Handler mặc định không có cấu hình bodySizeLimit như server actions.
};

export default nextConfig;


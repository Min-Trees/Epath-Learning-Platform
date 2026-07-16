import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon đơn giản: chữ "e" trên nền xanh. Next.js sẽ tự serve tại /icon
// và gắn vào <head>, loại bỏ 404 /favicon.ico.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        e
      </div>
    ),
    { ...size }
  );
}
import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { verifyStreamSession } from "@/lib/stream-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const session = verifyStreamSession(token);
    if (!session) {
      return new NextResponse("Invalid or expired token", { status: 401 });
    }

    const client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });

    const cmd = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET ?? "",
      Key: session.fk,
    });

    const response = await client.send(cmd);
    if (!response.Body) {
      return new NextResponse("File not found", { status: 404 });
    }

    const chunks: Uint8Array[] = [];
    const contentLength = response.ContentLength;
    
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    const videoBuffer = Buffer.concat(chunks);

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": getContentType(session.fk),
        "Content-Length": String(videoBuffer.length),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[stream/file] error:", e);
    return new NextResponse(
      e instanceof Error ? e.message : "Internal error",
      { status: 500 }
    );
  }
}

function getContentType(fileKey: string): string {
  const ext = fileKey.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    pdf: "application/pdf",
  };
  return types[ext] ?? "application/octet-stream";
}

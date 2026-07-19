import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { verifyStreamSession } from "@/lib/stream-session";
import { renderPptxToHtml } from "@/lib/ppt-render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

interface RouteContext {
  params: Promise<{ token: string }>;
}

const LEGACY_PPT_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const session = verifyStreamSession(token);
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }
    if (session.kind !== "ppt") {
      return NextResponse.json(
        { error: "Token này không phải loại ppt" },
        { status: 400 }
      );
    }

    const cmd = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET ?? "",
      Key: session.fk,
    });
    const upstream = await s3.send(cmd);
    if (!upstream.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // S3 Body is a Node Readable — collect to Buffer.
    const chunks: Buffer[] = [];
    for await (const chunk of upstream.Body as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);

    // Reject legacy .ppt binary — not supported by jszip-only renderer.
    const head = buf.subarray(0, 8);
    if (head.length === 8 && head.every((b, i) => b === LEGACY_PPT_MAGIC[i])) {
      return NextResponse.json(
        {
          error:
            "Định dạng .ppt (PowerPoint 97-2003) chưa được hỗ trợ. Vui lòng chuyển sang .pptx.",
        },
        { status: 415 }
      );
    }

    const result = await renderPptxToHtml(buf);

    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[stream/ppt] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
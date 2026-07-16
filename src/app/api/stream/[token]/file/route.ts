import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
      return new Response("Invalid or expired token", { status: 401 });
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

    const presignedUrl = await getSignedUrl(client, cmd, { expiresIn: 3600 });

    return NextResponse.json({
      success: true,
      url: presignedUrl,
      kind: session.kind,
      fileKey: session.fk,
    });
  } catch (e) {
    console.error("[stream/file] error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

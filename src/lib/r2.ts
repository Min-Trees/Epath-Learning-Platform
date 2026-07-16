// This file is for server-side use only (S3-compatible storage).
//
// Hỗ trợ Cloudflare R2 và Viettel IDC S3 - tự động detect theo env.
//
// Env bắt buộc (xem .env.example):
//   S3_ENDPOINT / R2_ACCOUNT_ID (để detect provider)
//   S3_ACCESS_KEY_ID / R2_ACCESS_KEY_ID
//   S3_SECRET_ACCESS_KEY / R2_SECRET_ACCESS_KEY
//   S3_BUCKET / R2_BUCKET
//
// Nếu chưa cấu hình và S3_USE_LOCAL_FALLBACK=1, hệ thống sẽ dùng "mock local":
//   - Presigned PUT URL: trỏ tới /api/uploads/local-receive (route trong app)
//   - File lưu trong thư mục LOCAL_R2_DIR (mặc định: os.tmpdir()/r2-mock)
//   - Presigned GET URL: trỏ tới /api/files/local/[...key] (route trong app)
// Lưu ý: mock chỉ phục vụ DEV. PRODUCTION phải cấu hình storage thật.

import { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
import os from "node:os";

const s3Endpoint = process.env.S3_ENDPOINT ?? "";
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";
const s3Bucket = process.env.S3_BUCKET ?? "";
const s3Region = process.env.S3_REGION ?? "auto";
const useLocalFallback =
  (process.env.S3_USE_LOCAL_FALLBACK ?? "0") === "1";

export const R2_CONFIGURED = Boolean(
  s3Endpoint && s3AccessKeyId && s3SecretAccessKey && s3Bucket
);
export const R2_USE_LOCAL_FALLBACK = useLocalFallback && !R2_CONFIGURED;
export const R2_BUCKET = s3Bucket;

export const LOCAL_R2_DIR =
  process.env.LOCAL_R2_DIR || path.join(os.tmpdir(), "r2-mock");

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: s3Region,
    endpoint: s3Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    },
  });
  return _client;
}

export function buildFileKey(opts: {
  programId: string;
  lessonId: string;
  fileName: string;
}): string {
  const safe = opts.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `programs/${opts.programId}/lessons/${opts.lessonId}/${Date.now()}_${safe}`;
}

export async function presignPutUrl(opts: {
  fileKey: string;
  contentType: string;
  contentLength?: number;
  expiresInSeconds?: number;
  appBaseUrl?: string; // dùng cho local fallback
}): Promise<string> {
  if (R2_USE_LOCAL_FALLBACK) {
    const base = opts.appBaseUrl ?? "http://localhost:3000";
    const exp = opts.expiresInSeconds ?? 600;
    // Token giả - dùng HMAC sau nếu cần bảo mật hơn. Ở đây chỉ cần key + exp.
    const sig = Buffer.from(`${opts.fileKey}|${exp}`).toString("base64url");
    const u = new URL(`${base}/api/uploads/local-receive`);
    u.searchParams.set("key", opts.fileKey);
    u.searchParams.set("exp", String(exp));
    u.searchParams.set("sig", sig);
    return u.toString();
  }
  const cmd = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: opts.fileKey,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  });
  return getSignedUrl(getClient(), cmd, {
    expiresIn: opts.expiresInSeconds ?? 600, // 10 phút
  });
}

export async function presignGetUrl(opts: {
  fileKey: string;
  expiresInSeconds?: number;
  appBaseUrl?: string;
  downloadFileName?: string;
}): Promise<string> {
  if (R2_USE_LOCAL_FALLBACK) {
    const base = opts.appBaseUrl ?? "http://localhost:3000";
    const exp = opts.expiresInSeconds ?? 900;
    const sig = Buffer.from(`${opts.fileKey}|${exp}`).toString("base64url");
    const segments = opts.fileKey.split("/").map(encodeURIComponent).join("/");
    const u = new URL(`${base}/api/files/local/${segments}`);
    u.searchParams.set("exp", String(exp));
    u.searchParams.set("sig", sig);
    if (opts.downloadFileName) {
      u.searchParams.set("dl", opts.downloadFileName);
    }
    return u.toString();
  }
  const cmd = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: opts.fileKey,
  });
  return getSignedUrl(getClient(), cmd, {
    expiresIn: opts.expiresInSeconds ?? 900, // 15 phút
  });
}


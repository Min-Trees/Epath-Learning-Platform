import jwt from "jsonwebtoken";

const SECRET = process.env.STREAM_SESSION_SECRET || "";
if (!SECRET && process.env.NODE_ENV === "production") {
  // Don't throw in dev so the file can be imported without crashing;
  // calls will fail with a clear error.
  console.warn("[stream-session] STREAM_SESSION_SECRET is empty");
}

export interface StreamSessionPayload {
  /** user uid */
  uid: string;
  /** user email (for watermark text) */
  email: string;
  /** lesson id */
  lid: string;
  /** file key in R2 */
  fk: string;
  /** "video" | "pdf" */
  kind: "video" | "pdf";
  /** session id (random) - for tracking access */
  sid: string;
}

export function signStreamSession(
  payload: StreamSessionPayload,
  ttlSeconds = 600
): string {
  if (!SECRET) throw new Error("STREAM_SESSION_SECRET chưa được cấu hình");
  return jwt.sign(payload, SECRET, { expiresIn: ttlSeconds });
}

export function verifyStreamSession(
  token: string
): StreamSessionPayload | null {
  if (!SECRET) throw new Error("STREAM_SESSION_SECRET chưa được cấu hình");
  try {
    const decoded = jwt.verify(token, SECRET);
    if (typeof decoded === "string") return null;
    const p = decoded as Record<string, unknown>;
    if (
      typeof p.uid !== "string" ||
      typeof p.email !== "string" ||
      typeof p.lid !== "string" ||
      typeof p.fk !== "string" ||
      typeof p.sid !== "string" ||
      (p.kind !== "video" && p.kind !== "pdf")
    ) {
      return null;
    }
    return p as unknown as StreamSessionPayload;
  } catch {
    return null;
  }
}

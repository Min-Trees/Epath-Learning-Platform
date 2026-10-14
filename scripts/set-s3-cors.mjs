import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env.local");

const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const idx = trimmed.indexOf("=");
  if (idx > -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
});

console.log("S3 Endpoint:", env.S3_ENDPOINT);
console.log("S3 Bucket:", env.S3_BUCKET);

const s3 = new S3Client({
  region: env.S3_REGION || "ap-southeast-1",
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

async function main() {
  try {
    console.log("Checking current CORS on bucket:", env.S3_BUCKET);
    const curr = await s3.send(new GetBucketCorsCommand({ Bucket: env.S3_BUCKET }));
    console.log("Current CORS:", JSON.stringify(curr.CORSRules, null, 2));
  } catch (e) {
    console.log("GetBucketCors error:", e.message);
  }

  try {
    console.log("Setting CORS rules on bucket:", env.S3_BUCKET);
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: env.S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
              AllowedOrigins: [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "https://lptraininghub.lp-intranet.id.vn",
                "https://lp-intranet.id.vn",
                "https://www.lp-intranet.id.vn",
                "*"
              ],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 86400,
            },
          ],
        },
      })
    );
    console.log("SUCCESS! CORS configuration applied successfully to S3 bucket.");
  } catch (e) {
    console.error("Failed to set CORS:", e.message);
  }
}

main();

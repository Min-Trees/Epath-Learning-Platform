/**
 * Automated Firestore Backup Script
 * Xuất dữ liệu các collections cốt lõi sang file JSON nén, lưu trữ xoay vòng 7 ngày gần nhất.
 * Sử dụng: node scripts/backup-db.mjs
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env từ file .env hoặc .env.local
const rootDir = path.resolve(__dirname, "..");
if (fs.existsSync(path.join(rootDir, ".env.local"))) {
  dotenv.config({ path: path.join(rootDir, ".env.local") });
} else {
  dotenv.config({ path: path.join(rootDir, ".env") });
}

const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
const privateKey = privateKeyRaw.includes("\\n")
  ? privateKeyRaw.replace(/\\n/g, "\n")
  : privateKeyRaw;

if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !privateKey) {
  console.error("❌ Thiếu cấu hình Firebase Admin trong biến môi trường!");
  process.exit(1);
}

const app = getApps()[0] || initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = getFirestore(app);

// Các collections cần sao lưu
const COLLECTIONS_TO_BACKUP = [
  "users",
  "programs",
  "lessons",
  "progress",
  "assignments",
  "test_results",
  "comments",
  "notifications",
  "settings",
];

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(rootDir, "backups");
const MAX_BACKUP_RETENTION = 7; // Giữ 7 bản sao lưu gần nhất

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = path.join(BACKUP_DIR, `backup-${timestamp}`);

  console.log(`🚀 [BACKUP] Khởi động quá trình sao lưu Firestore...`);
  console.log(`📁 Thư mục đích: ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const manifest = {
    timestamp: new Date().toISOString(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    collections: {},
  };

  for (const colName of COLLECTIONS_TO_BACKUP) {
    try {
      const snap = await db.collection(colName).get();
      const docsData = [];
      snap.forEach((doc) => {
        docsData.push({
          id: doc.id,
          data: doc.data(),
        });
      });

      const colFile = path.join(targetDir, `${colName}.json`);
      fs.writeFileSync(colFile, JSON.stringify(docsData, null, 2), "utf8");
      manifest.collections[colName] = docsData.length;
      console.log(`  ✓ Đã sao lưu collection [${colName}]: ${docsData.length} documents`);
    } catch (err) {
      console.error(`  ⚠️ Lỗi khi sao lưu collection [${colName}]:`, err.message);
      manifest.collections[colName] = { error: err.message };
    }
  }

  // Ghi file manifest
  fs.writeFileSync(path.join(targetDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`✅ [BACKUP] Hoàn tất sao lưu! Thông tin:`, manifest.collections);

  // Dọn dẹp bản sao lưu cũ quá retention
  cleanupOldBackups();
}

function cleanupOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const items = fs.readdirSync(BACKUP_DIR)
      .filter((name) => name.startsWith("backup-"))
      .map((name) => ({
        name,
        path: path.join(BACKUP_DIR, name),
        time: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time); // Mới nhất lên đầu

    if (items.length > MAX_BACKUP_RETENTION) {
      const toDelete = items.slice(MAX_BACKUP_RETENTION);
      for (const item of toDelete) {
        console.log(`🧹 Dọn dẹp bản sao lưu cũ: ${item.name}`);
        fs.rmSync(item.path, { recursive: true, force: true });
      }
    }
  } catch (err) {
    console.error("⚠️ Không thể dọn dẹp bản sao lưu cũ:", err.message);
  }
}

runBackup().catch((err) => {
  console.error("❌ Thất bại quá trình sao lưu:", err);
  process.exit(1);
});

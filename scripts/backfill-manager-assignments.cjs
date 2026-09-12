// scripts/backfill-manager-assignments.cjs
// One-shot: quét tất cả programs đã published, với mỗi manager trong
// assignedManagers mà CHƯA có assignment → tạo assignment.
//
// Idempotent: bỏ qua nếu assignment đã tồn tại.
// Chỉ chạy cho programs có status === "published".

const path = require('path');
const fs = require('fs');

// Load .env.local manually
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v.replace(/\\n/g, '\n');
    }
  });
}

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Thiếu FIREBASE_ADMIN_* env trong .env.local');
    process.exit(1);
  }

  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  const db = getFirestore(app);

  console.log('\n=== BACKFILL MANAGER ASSIGNMENTS ===\n');

  // 1. Quét tất cả programs
  console.log('[1] Đang quét programs...');
  const progsSnap = await db.collection('programs').get();

  let scanned = 0;
  let publishedCount = 0;
  let managersScanned = 0;
  let assignmentsCreated = 0;
  let skippedAlreadyExists = 0;
  const affectedUsers = new Set();
  const details = [];

  // Gom các cặp (uid, programId) cần tạo assignment
  const needCreate = [];

  for (const pSnap of progsSnap.docs) {
    scanned++;
    const data = pSnap.data();
    const status = data.status || 'draft';
    const managers = Array.isArray(data.assignedManagers) ? data.assignedManagers : [];
    if (status !== 'published' || managers.length === 0) continue;
    publishedCount++;

    for (const uid of managers) {
      if (!uid || typeof uid !== 'string') continue;
      managersScanned++;

      const aRef = db.collection('assignments').doc(`${uid}_${pSnap.id}`);
      const aSnap = await aRef.get();
      if (aSnap.exists) {
        skippedAlreadyExists++;
        continue;
      }
      needCreate.push({
        uid,
        programId: pSnap.id,
        programTitle: data.title || '(no title)',
      });
      affectedUsers.add(uid);
    }
  }

  console.log(`   Scanned: ${scanned}, Published có manager: ${publishedCount}`);
  console.log(`   Manager-program pairs: ${managersScanned}, Skipped (exists): ${skippedAlreadyExists}`);
  console.log(`   Cần tạo mới: ${needCreate.length}`);

  if (needCreate.length === 0) {
    console.log('\n✅ Không có gì cần backfill. Tất cả managers đã có assignment.');
    process.exit(0);
  }

  console.log('\n[2] Assignments sẽ được tạo:');
  for (const item of needCreate) {
    console.log(`  - ${item.uid} → ${item.programId} (${item.programTitle})`);
  }

  // 2. Tạo assignments bằng batch
  console.log('\n[3] Đang tạo assignments...');
  let batchOps = 0;
  let batch = db.batch();
  const timestamp = new Date();

  for (const item of needCreate) {
    const aRef = db.collection('assignments').doc(`${item.uid}_${item.programId}`);
    batch.set(aRef, {
      userId: item.uid,
      programId: item.programId,
      assignedAt: timestamp,
      assignedBy: 'backfill-script',
      status: 'not_started',
      source: 'backfill_from_manager',
    });
    batchOps++;
    assignmentsCreated++;

    if (batchOps >= 400) {
      await batch.commit();
      console.log(`   committed batch (${batchOps} ops)`);
      batch = db.batch();
      batchOps = 0;
    }
  }
  if (batchOps > 0) {
    await batch.commit();
    console.log(`   committed final batch (${batchOps} ops)`);
  }

  console.log('\n========================================');
  console.log('KẾT QUẢ:');
  console.log(`  Assignments created: ${assignmentsCreated}`);
  console.log(`  Affected users:      ${affectedUsers.size}`);
  console.log('========================================');
  console.log('\n⚠️  Lưu ý: cache /api/me/programs (TTL 30s) sẽ tự expire.');
  console.log('   User chỉ cần F5 trang dashboard/programs là thấy chương trình mới.');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  console.error(err);
  process.exit(1);
});

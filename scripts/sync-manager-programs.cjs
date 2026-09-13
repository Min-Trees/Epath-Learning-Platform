// scripts/sync-manager-programs.cjs
// Đồng bộ chương trình cho user Trần Thị Tuyết Linh
// - Tìm user theo email
// - Lấy danh sách tất cả programs
// - Cập nhật assignedManagers cho user đó

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
      // strip quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v.replace(/\\n/g, '\n');
    }
  });
}

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const TARGET_EMAIL = '299linhtran@gmail.com';

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
  const db = getFirestore(app);

  console.log(`\n=== SYNC MANAGER PROGRAMS ===`);
  console.log(`Target email: ${TARGET_EMAIL}\n`);

  // 1. Tìm user theo email
  console.log('[1] Tìm user theo email...');
  const usersSnap = await db.collection('users').get();
  const matchedUsers = usersSnap.docs.filter((d) => {
    const data = d.data();
    return data.email && data.email.toLowerCase() === TARGET_EMAIL.toLowerCase();
  });

  if (matchedUsers.length === 0) {
    console.error(`❌ Không tìm thấy user với email: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  const userDoc = matchedUsers[0];
  const userId = userDoc.id;
  const userData = userDoc.data();
  console.log(`✅ Tìm thấy user: ${userData.displayName || '(no name)'}`);
  console.log(`   UID: ${userId}`);
  console.log(`   Role: ${userData.role}`);
  console.log(`   Active: ${userData.isActive}`);

  if (userData.role !== 'manager') {
    console.warn(`⚠️  User không phải role "manager" (hiện tại: ${userData.role})`);
  }

  // 2. Lấy tất cả programs
  console.log('\n[2] Lấy danh sách programs...');
  const progsSnap = await db.collection('programs').get();
  console.log(`✅ Tổng số programs trong Firestore: ${progsSnap.size}`);

  const allPrograms = progsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  console.log('\n=== Danh sách programs ===');
  allPrograms.forEach((p, i) => {
    const am = p.assignedManagers || [];
    const hasManager = am.includes(userId);
    const status = p.status || 'unknown';
    const mark = hasManager ? '✅' : '⚠️';
    console.log(`${(i + 1).toString().padStart(2)}. ${mark} [${status.padEnd(9)}] ${p.title}`);
    console.log(`    ID: ${p.id}`);
    console.log(`    assignedManagers: [${(am || []).join(', ')}]`);
  });

  // 3. Cập nhật assignedManagers cho user này (chỉ thêm vào nếu chưa có)
  console.log('\n[3] Cập nhật assignedManagers...');
  let updatedCount = 0;
  let skippedCount = 0;

  const batch = db.batch();
  for (const p of allPrograms) {
    const currentManagers = p.assignedManagers || [];
    if (currentManagers.includes(userId)) {
      skippedCount++;
      continue;
    }
    const newManagers = [...currentManagers, userId];
    const ref = db.collection('programs').doc(p.id);
    batch.update(ref, {
      assignedManagers: newManagers,
      updatedAt: new Date(),
    });
    updatedCount++;
  }

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`✅ Đã cập nhật ${updatedCount} programs`);
  } else {
    console.log(`ℹ️  Không có program nào cần cập nhật`);
  }
  console.log(`   Bỏ qua: ${skippedCount} (đã có manager này rồi)`);

  // 4. Verify lại
  console.log('\n[4] Xác minh lại sau khi cập nhật...');
  const verifySnap = await db.collection('programs').get();
  let verifiedCount = 0;
  verifySnap.docs.forEach((d) => {
    const data = d.data();
    if ((data.assignedManagers || []).includes(userId)) {
      verifiedCount++;
    }
  });
  console.log(`✅ Số programs có assigned user này: ${verifiedCount}/${verifySnap.size}`);

  // 5. Hiển thị danh sách programs đã gán
  console.log('\n=== DANH SÁCH PROGRAMS ĐÃ GÁN CHO USER ===');
  verifySnap.docs.forEach((d, i) => {
    const data = d.data();
    if ((data.assignedManagers || []).includes(userId)) {
      console.log(`${(i + 1).toString().padStart(2)}. [${(data.status || 'unknown').padEnd(9)}] ${data.title}`);
    }
  });

  console.log('\n=== HOÀN TẤT ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

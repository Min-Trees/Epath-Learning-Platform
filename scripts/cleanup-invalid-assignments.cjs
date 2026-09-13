// scripts/cleanup-invalid-assignments.cjs
// Dọn dẹp assignments không hợp lệ (trỏ đến programs đã bị xóa hoặc không tồn tại)

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

  console.log(`\n=== CLEANUP INVALID ASSIGNMENTS ===`);
  console.log(`Target email: ${TARGET_EMAIL}\n`);

  // 1. Find user
  console.log('[1] Tìm user...');
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

  // 2. Get all existing programs
  console.log('\n[2] Lấy danh sách programs hiện tại...');
  const progsSnap = await db.collection('programs').get();
  const validProgramIds = new Set(progsSnap.docs.map(d => d.id));
  console.log(`✅ Số programs tồn tại: ${progsSnap.size}`);

  // 3. Get all assignments for this user
  console.log('\n[3] Lấy assignments của user...');
  const assignSnap = await db.collection('assignments').where('userId', '==', userId).get();
  console.log(`✅ Số assignment hiện tại: ${assignSnap.size}`);

  // 4. Find invalid assignments (pointing to non-existent programs)
  const invalidAssignments = [];
  const validAssignments = [];

  assignSnap.docs.forEach(d => {
    const data = d.data();
    if (!validProgramIds.has(data.programId)) {
      invalidAssignments.push({
        id: d.id,
        programId: data.programId,
        status: data.status,
      });
    } else {
      validAssignments.push(d);
    }
  });

  console.log(`\n=== KẾT QUẢ ===`);
  console.log(`✅ Assignments hợp lệ: ${validAssignments.length}`);
  console.log(`❌ Assignments không hợp lệ: ${invalidAssignments.length}`);

  if (invalidAssignments.length > 0) {
    console.log('\n=== ASSIGNMENTS SẼ XÓA ===');
    invalidAssignments.forEach((a, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ProgramID: ${a.programId} | Status: ${a.status}`);
    });

    // 5. Delete invalid assignments
    console.log('\n[4] Xóa assignments không hợp lệ...');
    const batch = db.batch();
    invalidAssignments.forEach(a => {
      const ref = db.collection('assignments').doc(a.id);
      batch.delete(ref);
    });
    await batch.commit();
    console.log(`✅ Đã xóa ${invalidAssignments.length} assignments không hợp lệ`);
  }

  // 6. Summary
  console.log('\n=== TÓM TẮT ===');
  console.log(`Trước cleanup: ${assignSnap.size} assignments`);
  console.log(`Sau cleanup: ${validAssignments.length} assignments`);
  console.log(`Đã xóa: ${invalidAssignments.length} assignments không hợp lệ`);

  if (validAssignments.length > 0) {
    console.log('\n=== ASSIGNMENTS HỢP LỆ CÒN LẠI ===');
    validAssignments.forEach((d, i) => {
      const data = d.data();
      const progDoc = progsSnap.docs.find(p => p.id === data.programId);
      const progTitle = progDoc ? progDoc.data().title : '(program đã xóa)';
      console.log(`${(i + 1).toString().padStart(2)}. ${progTitle} | Status: ${data.status}`);
    });
  }

  console.log('\n=== HOÀN TẤT ===');
  console.log('\n⚠️  NOTE: Sau khi chạy script này, user cần refresh trang dashboard để thấy số mới.');
  console.log('       Cache sẽ tự động hết hạn sau 30 giây, hoặc user có thể đăng nhập lại.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

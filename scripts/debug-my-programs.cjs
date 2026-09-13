// scripts/debug-my-programs.cjs
// Debug xem API /api/me/programs trả về gì cho user Duyên Nguyễn

const path = require('path');
const fs = require('fs');

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
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
  const db = getFirestore(app);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║       DEBUG: CHƯƠNG TRÌNH CỦA TÔI - DUYÊN NGUYỄN          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Tìm user Duyên Nguyễn
  console.log('[1] Tìm user Duyên Nguyễn...');
  const usersSnap = await db.collection('users').get();
  const duyen = usersSnap.docs.find(d => {
    const data = d.data();
    return data.displayName && data.displayName.includes('Duyên');
  });

  if (!duyen) {
    console.log('   ❌ Không tìm thấy user Duyên Nguyễn');
    process.exit(1);
  }

  const duyenId = duyen.id;
  const duyenData = duyen.data();
  console.log(`   ✅ User ID: ${duyenId}`);
  console.log(`   Name: ${duyenData.displayName}`);
  console.log(`   Email: ${duyenData.email}`);
  console.log(`   Role: ${duyenData.role}`);

  // 2. Lấy assignments của Duyên
  console.log('\n[2] Lấy assignments của Duyên...');
  const assignSnap = await db.collection('assignments')
    .where('userId', '==', duyenId)
    .get();

  console.log(`   Tổng assignments: ${assignSnap.size}`);
  const programIds = [];
  assignSnap.docs.forEach(d => {
    const data = d.data();
    programIds.push(data.programId);
    console.log(`   - Program ${data.programId} | Status: ${data.status}`);
  });

  // 3. Lấy thông tin các programs
  console.log('\n[3] Thông tin các programs của Duyên:');
  console.log('   ' + '─'.repeat(70));

  if (programIds.length === 0) {
    console.log('   ❌ KHÔNG CÓ assignment nào!');
  } else {
    for (const programId of programIds) {
      const programDoc = await db.collection('programs').doc(programId).get();
      if (programDoc.exists) {
        const p = programDoc.data();
        console.log(`   📚 ${p.title}`);
        console.log(`      Status: ${p.status}`);
        console.log(`      Lessons: ${(p.lessons || []).length}`);
        console.log(`      Created: ${p.createdAt?.toDate?.()?.toISOString()}`);
      } else {
        console.log(`   ⚠️  Program ${programId} không tồn tại!`);
      }
    }
  }

  // 4. Kiểm tra các chương trình khác (so sánh)
  console.log('\n[4] Tất cả programs trong hệ thống:');
  console.log('   ' + '─'.repeat(70));
  const allProgramsSnap = await db.collection('programs').get();
  allProgramsSnap.docs.forEach(d => {
    const p = d.data();
    const isAssigned = programIds.includes(d.id);
    const isManager = (p.assignedManagers || []).includes(duyenId);
    const marker = isAssigned ? '✅' : (isManager ? '🟡' : '  ');
    console.log(`   ${marker} ${p.title} [${p.status}]`);
    if (isAssigned && isManager) console.log(`      (Gán để học + làm manager)`);
    else if (isAssigned) console.log(`      (Gán để học)`);
    else if (isManager) console.log(`      (Chỉ là manager, KHÔNG có assignment!)`);
  });

  // 5. Mô phỏng query của API /api/me/programs
  console.log('\n[5] Mô phỏng query API /api/me/programs:');
  console.log('   ' + '─'.repeat(70));

  // Query như trong code
  const query = await db.collection('assignments')
    .where('userId', '==', duyenId)
    .get();

  const result = [];
  for (const doc of query.docs) {
    const a = doc.data();
    const pDoc = await db.collection('programs').doc(a.programId).get();
    if (pDoc.exists) {
      result.push({
        assignmentId: doc.id,
        programId: a.programId,
        programTitle: pDoc.data().title,
        status: a.status,
      });
    }
  }

  console.log(`   Số chương trình sẽ hiển thị: ${result.length}`);
  result.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.programTitle}`);
  });

  // 6. Kiểm tra cache
  console.log('\n[6] Cache trên client:');
  console.log('   ' + '─'.repeat(70));
  console.log('   ⚠️  Cache có thể là nguyên nhân! Cần F5 hoặc clear localStorage');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                  HOÀN TẤT DEBUG                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

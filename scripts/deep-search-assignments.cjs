// scripts/deep-search-assignments.cjs
// Tìm tất cả assignments liên quan đến Yến (JzIeIPvBVXR17KNHtf7EkaDG1fB2)
// Bao gồm cả các program Yến làm manager

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

  const yenId = 'JzIeIPvBVXR17KNHtf7EkaDG1fB2';

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         DEEP SEARCH ASSIGNMENTS FOR YẾN CHÂU            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Tất cả assignments của Yến
  console.log('[1] Tất cả assignments của Yến (userId = yenId):');
  const directSnap = await db.collection('assignments')
    .where('userId', '==', yenId)
    .get();
  console.log(`   Số lượng: ${directSnap.size}`);
  directSnap.docs.forEach(d => {
    const data = d.data();
    console.log(`   - ${d.id}: programId=${data.programId}, status=${data.status}`);
  });

  // 2. Tất cả programs Yến là manager
  console.log('\n[2] Tất cả programs Yến là manager:');
  const allPrograms = await db.collection('programs').get();
  const yenManagedPrograms = [];
  allPrograms.docs.forEach(d => {
    const data = d.data();
    const managers = data.assignedManagers || [];
    if (managers.includes(yenId)) {
      yenManagedPrograms.push({ id: d.id, title: data.title, status: data.status, managerId: data.managerId });
      console.log(`   📚 ${data.title} [${data.status}]`);
      console.log(`      ProgramId: ${d.id}`);
      console.log(`      Managers: ${managers.join(', ')}`);
    }
  });
  console.log(`   Tổng: ${yenManagedPrograms.length} programs`);

  // 3. Tìm xem có program nào trong danh sách managed mà Yến CHƯA có assignment?
  console.log('\n[3] Programs Yến làm manager nhưng CHƯA có assignment:');
  console.log('   ' + '─'.repeat(70));
  const assignedProgramIds = new Set();
  directSnap.docs.forEach(d => assignedProgramIds.add(d.data().programId));

  let missingCount = 0;
  for (const prog of yenManagedPrograms) {
    if (!assignedProgramIds.has(prog.id)) {
      missingCount++;
      console.log(`   ⚠️  "${prog.title}" [${prog.status}]`);
      console.log(`      ProgramId: ${prog.id}`);
    }
  }
  if (missingCount === 0) {
    console.log('   ✅ Tất cả programs Yến làm manager đều đã có assignment');
  } else {
    console.log(`   Tổng: ${missingCount} programs thiếu assignment`);
  }

  // 4. Check: Có programs nào Yến có assignment nhưng không phải manager?
  console.log('\n[4] Programs Yến có assignment nhưng KHÔNG làm manager:');
  console.log('   ' + '─'.repeat(70));
  const yenManagedIds = new Set(yenManagedPrograms.map(p => p.id));
  let count = 0;
  for (const progId of assignedProgramIds) {
    if (!yenManagedIds.has(progId)) {
      const progDoc = await db.collection('programs').doc(progId).get();
      if (progDoc.exists) {
        console.log(`   📚 "${progDoc.data().title}" [${progDoc.data().status}]`);
        console.log(`      ProgramId: ${progId}`);
        count++;
      }
    }
  }
  if (count === 0) {
    console.log('   ✅ Tất cả programs Yến có assignment đều là manager');
  }

  // 5. Kiểm tra user "Duyên Nguyễn" để so sánh
  console.log('\n[5] So sánh với Duyên Nguyễn (ffV2UNpvm0Z6TsFl41iPsup6aTK2):');
  console.log('   ' + '─'.repeat(70));
  const duyenId = 'ffV2UNpvm0Z6TsFl41iPsup6aTK2';
  const duyenSnap = await db.collection('assignments')
    .where('userId', '==', duyenId)
    .get();
  console.log(`   Duyên có ${duyenSnap.size} assignments`);
  duyenSnap.docs.forEach(d => {
    const data = d.data();
    console.log(`   - programId: ${data.programId}, status: ${data.status}`);
  });

  // 6. Tổng kết
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    TỔNG KẾT                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`   Yến Châu:`);
  console.log(`   - Assignments: ${directSnap.size}`);
  console.log(`   - Programs làm manager: ${yenManagedPrograms.length}`);
  console.log(`   - Programs thiếu assignment: ${missingCount}`);
  console.log(`\n   → Nếu Yến thấy 2 programs → ĐÚNG với database`);
  console.log(`   → Nếu muốn thấy thêm → Cần gán thêm assignment cho ${missingCount} programs`);

  console.log('\n');
  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

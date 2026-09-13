// scripts/assign-missing-program.cjs
// Gán thêm program còn thiếu cho Yến Châu

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
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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
  const programId = 'cvENn2JTdbdcP1t03TUI'; // Training HighScope - Tập huấn Group Times

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          GÁN PROGRAM CÒN THIẾU CHO YẾN CHÂU              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Kiểm tra assignment đã tồn tại chưa
  const assignmentId = `${yenId}_${programId}`;
  const existingRef = db.collection('assignments').doc(assignmentId);
  const existing = await existingRef.get();

  if (existing.exists) {
    console.log('⚠️  Assignment đã tồn tại rồi!');
    console.log(`   Document ID: ${assignmentId}`);
    console.log(`   Data: ${JSON.stringify(existing.data(), null, 2)}`);
    process.exit(0);
  }

  // Lấy thông tin program
  const programDoc = await db.collection('programs').doc(programId).get();
  if (!programDoc.exists) {
    console.log('❌ Program không tồn tại!');
    process.exit(1);
  }
  const program = programDoc.data();
  console.log(`📚 Program: ${program.title}`);
  console.log(`   Status: ${program.status}`);

  // Lấy thông tin user
  const userDoc = await db.collection('users').doc(yenId).get();
  if (!userDoc.exists) {
    console.log('❌ User không tồn tại!');
    process.exit(1);
  }
  const user = userDoc.data();
  console.log(`👤 User: ${user.displayName}`);

  // Tạo assignment
  console.log('\nĐang tạo assignment...');
  await existingRef.set({
    userId: yenId,
    programId: programId,
    assignedAt: FieldValue.serverTimestamp(),
    assignedBy: 'system-fix-script',
    status: 'not_started',
  });

  console.log('✅ Đã tạo assignment!');
  console.log(`   Document ID: ${assignmentId}`);

  // Verify
  const verify = await existingRef.get();
  console.log(`\n📋 Verify:`);
  console.log(`   Exists: ${verify.exists}`);
  console.log(`   Data: ${JSON.stringify(verify.data(), null, 2)}`);

  // Đếm lại assignments của Yến
  const allSnap = await db.collection('assignments')
    .where('userId', '==', yenId)
    .get();
  console.log(`\n📊 Tổng assignments của Yến bây giờ: ${allSnap.size}`);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     HOÀN TẤT                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log('👉 Yến Châu giờ refresh trang "Chương trình của tôi" sẽ thấy 3 chương trình');
  console.log('   (Server cache 30s + Client cache 30s sẽ tự refresh)');

  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

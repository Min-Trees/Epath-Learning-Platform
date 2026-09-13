// scripts/delete-2-programs.cjs
// Xóa 2 programs cụ thể và dọn dẹp assignments

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

const TARGET_EMAIL = '299linhtran@gmail.com';

// 2 programs cần xóa
const PROGRAMS_TO_DELETE = [
  { id: '409rg18iDwXdLhQ7MDPG', title: 'Hướng dẫn đánh giá trẻ Tiny MOET' },
  { id: 'pUIi1FgZeF0xrHNi6RId', title: 'Hướng dẫn đánh giá trẻ - CT Tăng cường MG' },
];

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
  const db = getFirestore(app);

  console.log('\n=== XÓA 2 PROGRAMS ===\n');
  console.log('Programs sẽ xóa:');
  PROGRAMS_TO_DELETE.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.title} (${p.id})`);
  });

  // Find user
  const usersSnap = await db.collection('users').get();
  const userDoc = usersSnap.docs.find(d => d.data().email?.toLowerCase() === TARGET_EMAIL.toLowerCase());
  if (!userDoc) {
    console.error('User not found');
    process.exit(1);
  }
  const userId = userDoc.id;
  console.log('\nUser:', userDoc.data().displayName);

  // Step 1: Xóa assignments của user cho 2 programs này
  console.log('\n[1] Xóa assignments của user...');
  const assignSnap = await db.collection('assignments').where('userId', '==', userId).get();
  let deletedAssignments = 0;
  const batchDeleteAssign = db.batch();
  
  assignSnap.docs.forEach(d => {
    if (PROGRAMS_TO_DELETE.some(p => p.id === d.data().programId)) {
      batchDeleteAssign.delete(db.collection('assignments').doc(d.id));
      deletedAssignments++;
      console.log(`   - Xóa assignment: ${d.data().programId}`);
    }
  });

  if (deletedAssignments > 0) {
    await batchDeleteAssign.commit();
    console.log(`   Đã xóa ${deletedAssignments} assignments`);
  } else {
    console.log('   Không có assignment nào của user cho 2 programs này');
  }

  // Step 2: Xóa 2 programs
  console.log('\n[2] Xóa 2 programs...');
  const batchDeleteProg = db.batch();
  PROGRAMS_TO_DELETE.forEach(p => {
    batchDeleteProg.delete(db.collection('programs').doc(p.id));
    console.log(`   - Xóa program: ${p.title}`);
  });
  await batchDeleteProg.commit();
  console.log('   Đã xóa 2 programs');

  // Step 3: Verify
  console.log('\n[3] Xác minh kết quả...');
  const newAssignSnap = await db.collection('assignments').where('userId', '==', userId).get();
  const newProgsSnap = await db.collection('programs').get();
  
  console.log(`\n=== KẾT QUẢ ===`);
  console.log(`Assignments còn lại: ${newAssignSnap.size}`);
  console.log(`Programs còn lại: ${newProgsSnap.size}`);

  // Liệt kê assignments còn lại
  if (newAssignSnap.size > 0) {
    const progTitles = {};
    newProgsSnap.docs.forEach(d => { progTitles[d.id] = d.data().title; });
    console.log('\n=== ASSIGNMENTS CÒN LẠI ===');
    newAssignSnap.docs.forEach((d, i) => {
      const data = d.data();
      const title = progTitles[data.programId] || '(đã xóa)';
      console.log(`${i + 1}. ${title} | ${data.status}`);
    });
  }

  console.log('\n=== HOÀN TẤT ===');
  console.log('\n⚠️  User cần refresh trang dashboard để thấy số mới.\n');

  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

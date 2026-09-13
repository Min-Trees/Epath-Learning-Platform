// scripts/delete-invalid-assignments.cjs
// Xóa assignments trỏ đến programs đã bị xóa

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

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
  const db = getFirestore(app);

  console.log('\n=== XÓA ASSIGNMENTS KHÔNG HỢP LỆ ===\n');

  // Find user
  const usersSnap = await db.collection('users').get();
  const userDoc = usersSnap.docs.find(d => d.data().email?.toLowerCase() === TARGET_EMAIL.toLowerCase());
  if (!userDoc) {
    console.error('User not found');
    process.exit(1);
  }
  const userId = userDoc.id;
  console.log('User:', userDoc.data().displayName);

  // Get all programs
  const progsSnap = await db.collection('programs').get();
  const validProgramIds = new Set(progsSnap.docs.map(d => d.id));
  console.log('Programs trong Firestore:', progsSnap.size);

  // Get user assignments
  const assignSnap = await db.collection('assignments').where('userId', '==', userId).get();
  console.log('Assignments hiện tại:', assignSnap.size);

  // Find invalid assignments
  const invalidAssignments = [];
  assignSnap.docs.forEach(d => {
    const pid = d.data().programId;
    if (!validProgramIds.has(pid)) {
      invalidAssignments.push({ id: d.id, programId: pid, status: d.data().status });
    }
  });

  console.log('\n=== ASSIGNMENTS SẼ XÓA ===');
  if (invalidAssignments.length > 0) {
    invalidAssignments.forEach(a => {
      console.log(' - ProgramID:', a.programId, '| Status:', a.status);
    });

    // Delete
    console.log('\nĐang xóa', invalidAssignments.length, 'assignments...');
    const batch = db.batch();
    invalidAssignments.forEach(a => {
      batch.delete(db.collection('assignments').doc(a.id));
    });
    await batch.commit();
    console.log('Đã xóa xong!');
  } else {
    console.log('Không có assignment không hợp lệ.');
  }

  // Count after
  const newSnap = await db.collection('assignments').where('userId', '==', userId).get();
  console.log('\n=== KẾT QUẢ ===');
  console.log('Assignments sau khi dọn:', newSnap.size);

  if (newSnap.size > 0) {
    console.log('\n=== ASSIGNMENTS CÒN LẠI ===');
    const programTitles = {};
    progsSnap.docs.forEach(d => { programTitles[d.id] = d.data().title; });
    newSnap.docs.forEach((d, i) => {
      const data = d.data();
      const title = programTitles[data.programId] || '(đã xóa)';
      console.log(`${i + 1}. ${title} | ${data.status}`);
    });
  }

  console.log('\n=== HOÀN TẤT ===\n');
  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

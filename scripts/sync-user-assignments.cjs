// scripts/sync-user-assignments.cjs
// Đồng bộ assignments cho user Trần Thị Tuyết Linh
// Đảm bảo user được gán vào tất cả programs mà họ là manager

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
const ASSIGNED_BY_ADMIN = 'SYSTEM_SYNC'; // UID của admin hoặc system

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
  const db = getFirestore(app);

  console.log(`\n=== SYNC USER ASSIGNMENTS ===`);
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
  console.log(`   Role: ${userData.role}`);

  // 2. Get all programs where user is manager (in assignedManagers)
  console.log('\n[2] Tìm programs user là manager...');
  const progsSnap = await db.collection('programs').get();
  const managedPrograms = progsSnap.docs
    .filter((d) => {
      const data = d.data();
      return (data.assignedManagers || []).includes(userId) && data.status === 'published';
    })
    .map((d) => ({ id: d.id, title: d.data().title, status: d.data().status }));

  console.log(`✅ Số programs user là manager (published): ${managedPrograms.length}`);

  // 3. Get current assignments for this user
  console.log('\n[3] Lấy assignments hiện tại...');
  const assignSnap = await db.collection('assignments').where('userId', '==', userId).get();
  const existingAssignments = new Set(assignSnap.docs.map((d) => d.data().programId));
  console.log(`✅ Số assignment hiện tại: ${existingAssignments.size}`);

  // 4. Find programs that need assignments
  const programsNeedingAssignment = managedPrograms.filter((p) => !existingAssignments.has(p.id));
  
  console.log(`\n⚠️  Programs cần thêm assignment: ${programsNeedingAssignment.length}`);
  if (programsNeedingAssignment.length > 0) {
    console.log('\n=== PROGRAMS CẦN THÊM ASSIGNMENT ===');
    programsNeedingAssignment.forEach((p, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${p.title}`);
      console.log(`    ID: ${p.id}`);
    });
  }

  // 5. Create assignments for missing programs
  if (programsNeedingAssignment.length > 0) {
    console.log('\n[4] Tạo assignments...');
    const batch = db.batch();
    const timestamp = new Date();

    for (const p of programsNeedingAssignment) {
      const docId = `${userId}_${p.id}`;
      const ref = db.collection('assignments').doc(docId);
      batch.set(ref, {
        userId,
        programId: p.id,
        assignedAt: timestamp,
        assignedBy: ASSIGNED_BY_ADMIN,
        status: 'not_started',
      });
      console.log(`   + Thêm assignment: ${p.title}`);
    }

    await batch.commit();
    console.log(`✅ Đã tạo ${programsNeedingAssignment.length} assignments mới`);
  } else {
    console.log('\n[4] Không cần tạo assignments mới');
  }

  // 6. Verify
  console.log('\n[5] Xác minh kết quả...');
  const verifySnap = await db.collection('assignments').where('userId', '==', userId).get();
  console.log(`✅ Tổng số assignments sau sync: ${verifySnap.size}`);

  console.log('\n=== TẤT CẢ ASSIGNMENTS CỦA USER ===');
  verifySnap.docs.forEach((d, i) => {
    const data = d.data();
    const prog = managedPrograms.find(p => p.id === data.programId);
    console.log(`${(i + 1).toString().padStart(2)}. ${prog ? prog.title : data.programId} | Status: ${data.status}`);
  });

  console.log('\n=== HOÀN TẤT ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

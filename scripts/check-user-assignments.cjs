// scripts/check-user-assignments.cjs
// Kiểm tra assignments của user Trần Thị Tuyết Linh

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

  console.log(`\n=== CHECK USER ASSIGNMENTS ===`);
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

  // 2. Check assignments for this user
  console.log('\n[2] Kiểm tra assignments của user...');
  const assignSnap = await db.collection('assignments').where('userId', '==', userId).get();
  console.log(`✅ Số assignment của user: ${assignSnap.size}`);

  if (assignSnap.size > 0) {
    console.log('\n=== ASSIGNMENTS CỦA USER ===');
    assignSnap.docs.forEach((d, i) => {
      const data = d.data();
      console.log(`${(i + 1).toString().padStart(2)}. ProgramID: ${data.programId} | Status: ${data.status}`);
    });
  }

  // 3. Check programs assignedManagers
  console.log('\n[3] Kiểm tra assignedManagers của user trong programs...');
  const progsSnap = await db.collection('programs').get();
  const managedPrograms = progsSnap.docs.filter((d) => {
    const data = d.data();
    return (data.assignedManagers || []).includes(userId);
  });

  console.log(`✅ Số programs có user trong assignedManagers: ${managedPrograms.size}`);

  console.log('\n=== PROGRAMS TRONG assignedManagers ===');
  managedPrograms.forEach((d, i) => {
    const data = d.data();
    console.log(`${(i + 1).toString().padStart(2)}. ${data.title}`);
    console.log(`    ID: ${d.id}`);
    console.log(`    Status: ${data.status}`);
  });

  // 4. Check if there's a mismatch between assignments and assignedManagers
  const assignedProgramIds = new Set(assignSnap.docs.map(d => d.data().programId));
  const managedProgramIds = new Set(managedPrograms.docs.map(d => d.id));

  console.log('\n[4] So sánh assignments vs assignedManagers...');
  console.log(`   Programs trong assignments: ${assignedProgramIds.size}`);
  console.log(`   Programs trong assignedManagers: ${managedProgramIds.size}`);

  // Programs in assignedManagers but not in assignments (user is manager but not assigned to learn)
  const managerOnly = [...managedProgramIds].filter(id => !assignedProgramIds.has(id));
  if (managerOnly.length > 0) {
    console.log(`\n⚠️  Programs user là manager nhưng CHƯA được gán (để học): ${managerOnly.length}`);
    managerOnly.forEach(pid => {
      const prog = managedPrograms.docs.find(d => d.id === pid);
      console.log(`   - ${prog.data().title} (${pid})`);
    });
  }

  console.log('\n=== HOÀN TẤT ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

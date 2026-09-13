// scripts/check-ghost-programs.cjs
// Kiểm tra 2 ghost programs có dữ liệu gì

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

  const ids = ['409rg18iDwXdLhQ7MDPG', 'pUIi1FgZeF0xrHNi6RId'];

  console.log('\n=== KIỂM TRA 2 GHOST PROGRAMS ===\n');

  for (const id of ids) {
    console.log(`\nID: ${id}`);
    const doc = await db.collection('programs').doc(id).get();
    if (!doc.exists) {
      console.log('  ❌ KHÔNG TỒN TẠI');
      continue;
    }
    const data = doc.data();
    console.log('  Tồn tại: CÓ');
    console.log('  Raw data:', JSON.stringify(data, null, 2));

    // Check assignments
    const assigns = await db.collection('assignments').where('programId', '==', id).get();
    console.log(`  Assignments: ${assigns.size}`);
    assigns.docs.forEach(d => {
      const aData = d.data();
      console.log(`    - userId: ${aData.userId}, status: ${aData.status}`);
    });
  }

  // Check assignments of admin
  console.log('\n\n=== ASSIGNMENTS CỦA ADMIN ===');
  const adminId = 'mo5PcpvxpBW0Gd6SmG003X4rDw93';
  const adminAssigns = await db.collection('assignments').where('userId', '==', adminId).get();
  console.log(`Tổng: ${adminAssigns.size}`);
  adminAssigns.docs.forEach(d => {
    const aData = d.data();
    console.log(`  - programId: ${aData.programId}, status: ${aData.status}`);
  });

  // Total programs count
  console.log('\n\n=== TỔNG PROGRAMS VÀ ASSIGNMENTS ===');
  const allProgs = await db.collection('programs').get();
  const allAssigns = await db.collection('assignments').get();
  console.log(`Tổng programs: ${allProgs.size}`);
  console.log(`Tổng assignments: ${allAssigns.size}`);

  // Check programs that have at least 1 assignment
  const programIdsWithAssign = new Set();
  allAssigns.docs.forEach(d => {
    programIdsWithAssign.add(d.data().programId);
  });
  console.log(`Programs có ≥1 assignment: ${programIdsWithAssign.size}`);

  // Programs without any assignment
  const progsWithoutAssign = allProgs.docs.filter(d => !programIdsWithAssign.has(d.id));
  console.log(`\nPrograms KHÔNG có assignment: ${progsWithoutAssign.length}`);
  progsWithoutAssign.forEach(d => {
    console.log(`  - ${d.id}: title=${d.data().title || '(no title)'}, status=${d.data().status || '(no status)'}`);
  });

  process.exit(0);
}

main().catch(e => { console.error('Lỗi:', e); process.exit(1); });

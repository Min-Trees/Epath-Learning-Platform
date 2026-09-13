// scripts/check-employees-manager.cjs
// Kiểm tra employees có managerId trỏ tới manager nào

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

  console.log('\n=== KIỂM TRA EMPLOYEE → MANAGER ===\n');

  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  usersSnap.docs.forEach(d => userMap.set(d.id, { id: d.id, ...d.data() }));

  const employees = [];
  const managers = [];
  usersSnap.docs.forEach(d => {
    const data = d.data();
    if (data.role === 'employee') employees.push(userMap.get(d.id));
    else if (data.role === 'manager') managers.push(userMap.get(d.id));
  });

  console.log(`Tổng managers: ${managers.length}`);
  managers.forEach(m => {
    console.log(`  • ${m.displayName} (${m.id})`);
  });

  console.log(`\nTổng employees: ${employees.length}\n`);

  let withManager = 0;
  let withoutManager = 0;
  const managerCounts = new Map();

  employees.forEach(e => {
    if (e.managerId) {
      withManager++;
      managerCounts.set(e.managerId, (managerCounts.get(e.managerId) || 0) + 1);
      const m = userMap.get(e.managerId);
      console.log(`  ${e.displayName}: managerId=${e.managerId} (${m?.displayName || 'NOT FOUND'})`);
    } else {
      withoutManager++;
      console.log(`  ⚠️  ${e.displayName}: KHÔNG CÓ managerId`);
    }
  });

  console.log(`\n  Có managerId: ${withManager}`);
  console.log(`  KHÔNG có managerId: ${withoutManager}\n`);

  console.log('Số NV theo từng manager:');
  managerCounts.forEach((count, mid) => {
    const m = userMap.get(mid);
    console.log(`  • ${m?.displayName || mid}: ${count} NV`);
  });

  console.log('\n=== KẾT LUẬN ===\n');
  if (withoutManager > 0) {
    console.log(`⚠️  Có ${withoutManager} employees KHÔNG có managerId.`);
    console.log('   Khi manager cố gán chương trình cho NV này, server sẽ từ chối với lỗi:');
    console.log('   "Bạn không có quyền gán cho các user: ..."');
  }
  if (withManager === 0) {
    console.log('❌ KHÔNG có employee nào có managerId → manager không thể gán NV nào.');
    console.log('   Cần set managerId cho từng employee để manager có thể gán chương trình.');
  }

  process.exit(0);
}

main().catch(e => { console.error('Lỗi:', e); process.exit(1); });

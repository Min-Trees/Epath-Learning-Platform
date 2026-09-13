// scripts/list-all-programs.cjs
// Liệt kê toàn bộ chương trình để xác minh 2 chương trình bị thiếu

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

  // 2 IDs đã từng bị xóa trong delete-2-programs.cjs
  const DELETED_IDS = [
    '409rg18iDwXdLhQ7MDPG',
    'pUIi1FgZeF0xrHNi6RId',
  ];

  console.log('\n=== KIỂM TRA 2 PROGRAMS ĐÃ XÓA ===\n');
  for (const id of DELETED_IDS) {
    const doc = await db.collection('programs').doc(id).get();
    if (doc.exists) {
      const d = doc.data();
      console.log(`  ✅ CÒN: ${id} | "${d.title}" | status=${d.status}`);
    } else {
      console.log(`  ❌ ĐÃ XÓA: ${id}`);
    }
  }

  console.log('\n=== TẤT CẢ PROGRAMS HIỆN TẠI (10) ===\n');
  const allPrograms = await db.collection('programs').get();
  console.log(`Tổng: ${allPrograms.size}\n`);

  const rows = [];
  for (const doc of allPrograms.docs) {
    const d = doc.data();
    rows.push({
      id: doc.id,
      title: d.title || '(no title)',
      status: d.status || 'unknown',
      category: d.category || '-',
      lessons: (d.lessons || []).length,
      managers: (d.assignedManagers || []).length,
      createdAt: d.createdAt?.toDate?.()?.toISOString() || '-',
    });
  }

  // Sắp xếp theo ngày tạo
  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  rows.forEach((r, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. [${r.status.padEnd(9)}] ${r.title}`);
    console.log(`    id=${r.id} | lessons=${r.lessons} | managers=${r.managers} | ${r.createdAt}`);
  });

  // Thống kê
  console.log('\n=== THỐNG KÊ ===');
  const published = rows.filter(r => r.status === 'published').length;
  const draft = rows.filter(r => r.status === 'draft').length;
  const archived = rows.filter(r => r.status === 'archived').length;
  console.log(`Published: ${published}`);
  console.log(`Draft    : ${draft}`);
  console.log(`Archived : ${archived}`);

  process.exit(0);
}

main().catch(e => { console.error('Lỗi:', e); process.exit(1); });

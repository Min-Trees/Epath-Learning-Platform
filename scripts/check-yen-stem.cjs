// scripts/check-yen-stem.cjs
// Kiểm tra Yến đang thiếu chương trình STEM nào trong "lịch sử"

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

  const YEN_EMAIL = 'yen.chau@littlepeople.edu.vn';

  // 1. Tìm Yến
  const usersSnap = await db.collection('users').get();
  const yen = usersSnap.docs.find(d => d.data().email === YEN_EMAIL);
  if (!yen) {
    console.log('❌ Không tìm thấy Yến');
    process.exit(1);
  }
  const yenId = yen.id;
  console.log('Yến UID:', yenId);

  // 2. Lấy tất cả programs
  const allPrograms = await db.collection('programs').get();
  console.log(`\nTổng programs: ${allPrograms.size}`);

  // Lọc STEM programs (theo title hoặc description)
  const stemPrograms = allPrograms.docs.filter(d => {
    const data = d.data();
    const t = (data.title || '').toLowerCase();
    const desc = (data.description || '').toLowerCase();
    return t.includes('stem') || desc.includes('stem');
  });
  console.log(`Programs có "STEM" trong title/description: ${stemPrograms.length}`);

  // In ra tất cả STEM programs
  console.log('\n=== TẤT CẢ PROGRAMS CÓ "STEM" ===');
  for (const p of stemPrograms) {
    const data = p.data();
    console.log(`  ${p.id} | status=${data.status} | ${data.title}`);
  }

  // 3. Lấy assignments của Yến
  const assignments = await db.collection('assignments').where('userId', '==', yenId).get();
  const yenProgramIds = new Set(assignments.docs.map(d => d.data().programId));
  console.log(`\nYến có ${assignments.size} assignments (${yenProgramIds.size} unique programs)`);

  // 4. Programs mà Yến là manager
  const yenManagedPrograms = stemPrograms.filter(d => {
    const managers = d.data().assignedManagers || [];
    return managers.includes(yenId);
  });
  console.log(`Yến là manager của ${yenManagedPrograms.length} STEM program(s)`);

  // 5. So sánh: STEM programs mà Yến là manager NHƯNG chưa có assignment
  console.log('\n=== KIỂM TRA: Yến là manager nhưng KHÔNG có assignment ===');
  const missingAssignment = [];
  for (const p of yenManagedPrograms) {
    const data = p.data();
    if (!yenProgramIds.has(p.id)) {
      missingAssignment.push({ id: p.id, title: data.title, status: data.status });
      console.log(`  ❌ ${p.id} | ${data.title} | status=${data.status}`);
    } else {
      console.log(`  ✅ ${p.id} | ${data.title} | status=${data.status}`);
    }
  }

  // 6. Kiểm tra ngược: STEM programs có assignment của Yến
  console.log('\n=== STEM programs có assignment của Yến ===');
  for (const doc of assignments.docs) {
    const a = doc.data();
    const pDoc = allPrograms.docs.find(d => d.id === a.programId);
    if (pDoc) {
      const data = pDoc.data();
      const isStem = (data.title || '').toLowerCase().includes('stem') ||
                     (data.description || '').toLowerCase().includes('stem');
      if (isStem) {
        console.log(`  - ${a.programId} | ${data.title} | status=${data.status} | assignStatus=${a.status}`);
      }
    }
  }

  // 7. Tổng kết
  console.log('\n=== KẾT LUẬN ===');
  console.log(`STEM programs trong hệ thống: ${stemPrograms.length}`);
  console.log(`Yến là manager của: ${yenManagedPrograms.length} STEM program(s)`);
  console.log(`Yến có assignment cho: ${assignments.docs.filter(d => {
    const p = allPrograms.docs.find(p => p.id === d.data().programId);
    if (!p) return false;
    const t = (p.data().title || '').toLowerCase();
    return t.includes('stem');
  }).length} STEM program(s)`);
  console.log(`BỊ THIẾU: ${missingAssignment.length} STEM program(s)`);

  process.exit(0);
}

main().catch(e => { console.error('Lỗi:', e); process.exit(1); });

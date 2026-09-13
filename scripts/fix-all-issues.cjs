// scripts/fix-all-issues.cjs
// Sửa tất cả vấn đề phát hiện được

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

// Programs đã xóa
const DELETED_PROGRAM_IDS = ['409rg18iDwXdLhQ7MDPG', 'pUIi1FgZeF0xrHNi6RId'];

// Manager cần thêm assignments
const MISSING_ASSIGNMENTS = [
  { userId: 'Duyên Nguyễn', userEmail: null, programId: null }, // sẽ tìm bằng email
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

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              SỬA TẤT CẢ VẤN ĐỀ PHÁT HIỆN               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Load all data
  console.log('[1] Đang tải dữ liệu...');
  const [programsSnap, assignmentsSnap, usersSnap] = await Promise.all([
    db.collection('programs').get(),
    db.collection('assignments').get(),
    db.collection('users').get(),
  ]);

  const programs = new Map();
  programsSnap.docs.forEach(d => {
    programs.set(d.id, { id: d.id, ...d.data() });
  });

  const users = new Map();
  usersSnap.docs.forEach(d => {
    users.set(d.id, { id: d.id, ...d.data() });
  });

  // === BƯỚC 1: Xóa 30 assignments không hợp lệ ===
  console.log('\n[2] Xóa assignments trỏ đến programs đã xóa...');
  const batchDelete = db.batch();
  let deleteCount = 0;

  assignmentsSnap.docs.forEach(d => {
    const data = d.data();
    if (DELETED_PROGRAM_IDS.includes(data.programId)) {
      batchDelete.delete(db.collection('assignments').doc(d.id));
      deleteCount++;
    }
  });

  if (deleteCount > 0) {
    await batchDelete.commit();
    console.log(`   ✅ Đã xóa ${deleteCount} assignments không hợp lệ`);
  } else {
    console.log('   ℹ️  Không có assignments nào cần xóa');
  }

  // === BƯỚC 2: Thêm assignments thiếu cho Duyên Nguyễn ===
  console.log('\n[3] Thêm assignments cho manager Duyên Nguyễn...');
  
  // Tìm user Duyên Nguyễn
  const duyenUser = usersSnap.docs.find(d => {
    const data = d.data();
    return data.displayName && data.displayName.includes('Duyên');
  });

  if (!duyenUser) {
    console.log('   ❌ Không tìm thấy user Duyên Nguyễn');
  } else {
    const duyenId = duyenUser.id;
    const duyenData = duyenUser.data();
    console.log(`   ✅ Tìm thấy user: ${duyenData.displayName} (${duyenId})`);

    // Tìm programs có Duyên trong assignedManagers
    const programsForDuyen = [];
    programsSnap.docs.forEach(d => {
      const data = d.data();
      if ((data.assignedManagers || []).includes(duyenId)) {
        programsForDuyen.push({ id: d.id, title: data.title, status: data.status });
      }
    });
    console.log(`   ✅ Programs có Duyên làm manager: ${programsForDuyen.length}`);

    // Lấy assignments hiện tại của Duyên
    const duyenAssignments = new Set();
    assignmentsSnap.docs.forEach(d => {
      if (d.data().userId === duyenId) {
        duyenAssignments.add(d.data().programId);
      }
    });
    console.log(`   ✅ Assignments hiện tại của Duyên: ${duyenAssignments.size}`);

    // Tìm assignments thiếu
    const missingPrograms = programsForDuyen.filter(p => !duyenAssignments.has(p.id));
    
    if (missingPrograms.length > 0) {
      console.log(`\n   ⚠️  Programs cần thêm assignment:`);
      const batchAdd = db.batch();
      const timestamp = new Date();

      missingPrograms.forEach(p => {
        const docId = `${duyenId}_${p.id}`;
        batchAdd.set(db.collection('assignments').doc(docId), {
          userId: duyenId,
          programId: p.id,
          assignedAt: timestamp,
          assignedBy: 'SYSTEM_FIX',
          status: 'not_started',
        });
        console.log(`      + ${p.title}`);
      });

      await batchAdd.commit();
      console.log(`\n   ✅ Đã thêm ${missingPrograms.length} assignments cho Duyên Nguyễn`);
    } else {
      console.log('   ℹ️  Duyên Nguyễn đã có đủ assignments');
    }
  }

  // === BƯỚC 3: Verify ===
  console.log('\n[4] Xác minh kết quả...');
  
  // Đếm lại assignments
  const newAssignSnap = await db.collection('assignments').get();
  let orphanedCount = 0;
  
  newAssignSnap.docs.forEach(d => {
    if (DELETED_PROGRAM_IDS.includes(d.data().programId)) {
      orphanedCount++;
    }
  });

  console.log(`\n   Assignments còn lại: ${newAssignSnap.size}`);
  console.log(`   Assignments trỏ đến programs đã xóa: ${orphanedCount}`);

  if (orphanedCount === 0) {
    console.log('\n   ✅ Tất cả assignments không hợp lệ đã được xóa!');
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    HOÀN TẤT SỬA LỖI                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n⚠️  Users cần refresh trang dashboard để thấy số mới.\n');

  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

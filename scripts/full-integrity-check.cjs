// scripts/full-integrity-check.cjs
// Kiểm tra toàn bộ tính toàn vẹn dữ liệu giữa assignments và programs

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

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         KIỂM TRA TOÀN VẸN DỮ LIỆU HỆ THỐNG               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Load all data
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

  console.log(`   ✅ Programs: ${programs.size}`);
  console.log(`   ✅ Assignments: ${assignmentsSnap.size}`);
  console.log(`   ✅ Users: ${users.size}`);

  // 2. Check assignments -> orphaned (program doesn't exist)
  console.log('\n[2] Kiểm tra assignments trỏ đến program đã xóa...');
  const orphanedAssignments = [];
  
  assignmentsSnap.docs.forEach(d => {
    const data = d.data();
    if (!programs.has(data.programId)) {
      orphanedAssignments.push({
        id: d.id,
        userId: data.userId,
        programId: data.programId,
        status: data.status,
      });
    }
  });

  if (orphanedAssignments.length > 0) {
    console.log(`   ❌ TÌM THẤY ${orphanedAssignments.length} assignments không hợp lệ:`);
    orphanedAssignments.forEach(a => {
      const user = users.get(a.userId);
      const userName = user?.displayName || user?.email || a.userId;
      console.log(`      - Assignment ${a.id}`);
      console.log(`        User: ${userName}`);
      console.log(`        ProgramID: ${a.programId} (đã xóa)`);
    });
  } else {
    console.log('   ✅ Không có assignments không hợp lệ');
  }

  // 3. Check for duplicate assignments (same user + same program)
  console.log('\n[3] Kiểm tra assignments trùng lặp...');
  const assignmentMap = new Map();
  const duplicateAssignments = [];
  
  assignmentsSnap.docs.forEach(d => {
    const data = d.data();
    const key = `${data.userId}_${data.programId}`;
    if (assignmentMap.has(key)) {
      duplicateAssignments.push({
        existingId: assignmentMap.get(key),
        newId: d.id,
        userId: data.userId,
        programId: data.programId,
      });
    } else {
      assignmentMap.set(key, d.id);
    }
  });

  if (duplicateAssignments.length > 0) {
    console.log(`   ⚠️  TÌM THẤY ${duplicateAssignments.length} cặp trùng lặp:`);
    duplicateAssignments.forEach(d => {
      console.log(`      - User ${d.userId} + Program ${d.programId}`);
      console.log(`        IDs: ${d.existingId} vs ${d.newId}`);
    });
  } else {
    console.log('   ✅ Không có assignments trùng lặp');
  }

  // 4. Check programs without any assignments
  console.log('\n[4] Kiểm tra programs chưa có ai được gán...');
  const programsWithAssignments = new Set();
  assignmentsSnap.docs.forEach(d => {
    programsWithAssignments.add(d.data().programId);
  });

  const unassignedPrograms = [];
  programs.forEach((p, id) => {
    if (!programsWithAssignments.has(id) && p.status === 'published') {
      unassignedPrograms.push({ id, title: p.title, status: p.status });
    }
  });

  if (unassignedPrograms.length > 0) {
    console.log(`   ⚠️  ${unassignedPrograms.length} programs chưa có ai được gán:`);
    unassignedPrograms.forEach(p => {
      console.log(`      - ${p.title}`);
    });
  } else {
    console.log('   ✅ Tất cả programs đã có người được gán');
  }

  // 5. Check assignedManagers vs assignments consistency
  console.log('\n[5] Kiểm tra assignedManagers vs assignments...');
  let managersWithoutAssignment = 0;
  
  programs.forEach((p, programId) => {
    const managers = p.assignedManagers || [];
    managers.forEach(managerId => {
      const key = `${managerId}_${programId}`;
      if (!assignmentMap.has(key)) {
        managersWithoutAssignment++;
        const manager = users.get(managerId);
        console.log(`   ⚠️  Manager chưa có assignment: ${manager?.displayName || managerId}`);
        console.log(`      Program: ${p.title}`);
      }
    });
  });

  if (managersWithoutAssignment === 0) {
    console.log('   ✅ Tất cả managers đều có assignment');
  }

  // 6. Summary per user
  console.log('\n[6] Thống kê theo user...');
  const userStats = new Map();
  
  assignmentsSnap.docs.forEach(d => {
    const data = d.data();
    if (!userStats.has(data.userId)) {
      userStats.set(data.userId, { total: 0, not_started: 0, in_progress: 0, completed: 0 });
    }
    const stats = userStats.get(data.userId);
    stats.total++;
    if (data.status === 'not_started') stats.not_started++;
    else if (data.status === 'in_progress') stats.in_progress++;
    else if (data.status === 'completed') stats.completed++;
  });

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  USER                    │ TOTAL │ CHƯA  │ ĐANG  │ XONG  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  userStats.forEach((stats, userId) => {
    const user = users.get(userId);
    const name = (user?.displayName || user?.email || userId).substring(0, 22);
    const pad = ' '.repeat(Math.max(0, 22 - name.length));
    console.log(`║ ${name}${pad} │ ${String(stats.total).padStart(5)} │ ${String(stats.not_started).padStart(4)} │ ${String(stats.in_progress).padStart(4)} │ ${String(stats.completed).padStart(4)} ║`);
  });
  
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // 7. Final recommendations
  console.log('\n[7] Khuyến nghị...');
  if (orphanedAssignments.length > 0) {
    console.log(`   🔴 Cần xóa ${orphanedAssignments.length} assignments không hợp lệ`);
  }
  if (duplicateAssignments.length > 0) {
    console.log(`   🔴 Cần xóa ${duplicateAssignments.length} assignments trùng lặp`);
  }
  if (managersWithoutAssignment > 0) {
    console.log(`   🟡 Cần thêm ${managersWithoutAssignment} assignments cho managers`);
  }
  if (orphanedAssignments.length === 0 && duplicateAssignments.length === 0 && managersWithoutAssignment === 0) {
    console.log('   ✅ Dữ liệu hoàn toàn nhất quán!');
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    HOÀN TẤT KIỂM TRA                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

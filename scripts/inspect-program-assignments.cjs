// scripts/inspect-program-assignments.cjs
// Diagnostic: liệt kê programs + managers + assignments để tìm inconsistency

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
  console.log('║     INSPECT: PROGRAMS + MANAGERS + ASSIGNMENTS               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Get all users
  console.log('[1] USERS (managers + admins)');
  console.log('─'.repeat(70));
  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  const managers = [];
  const admins = [];
  const employees = [];
  usersSnap.docs.forEach(d => {
    const data = d.data();
    userMap.set(d.id, { id: d.id, ...data });
    if (data.role === 'manager') managers.push(userMap.get(d.id));
    else if (data.role === 'admin') admins.push(userMap.get(d.id));
    else if (data.role === 'employee') employees.push(userMap.get(d.id));
  });
  console.log(`Tổng users: ${usersSnap.size}`);
  console.log(`  Admins:    ${admins.length}`);
  admins.forEach(u => console.log(`     • ${u.displayName || '(no name)'} | ${u.email} | id=${u.id}`));
  console.log(`  Managers:  ${managers.length}`);
  managers.forEach(u => console.log(`     • ${u.displayName || '(no name)'} | ${u.email} | id=${u.id} | managerId=${u.managerId || '(none)'}`));
  console.log(`  Employees: ${employees.length}`);

  // 2. Get all programs
  console.log('\n[2] PROGRAMS');
  console.log('─'.repeat(70));
  const progsSnap = await db.collection('programs').get();
  const programs = [];
  progsSnap.docs.forEach(d => {
    programs.push({ id: d.id, ...d.data() });
  });
  console.log(`Tổng programs: ${programs.length}\n`);
  programs.forEach((p, i) => {
    const mgrs = (p.assignedManagers || []).length;
    console.log(`${(i+1).toString().padStart(2)}. [${(p.status||'?').padEnd(9)}] "${p.title}"`);
    console.log(`    id=${p.id} | managers=${mgrs} | ${mgrs > 0 ? '[' + (p.assignedManagers || []).map(uid => {
      const u = userMap.get(uid);
      return u ? u.displayName : uid;
    }).join(', ') + ']' : ''}`);
  });

  // 3. Get all assignments
  console.log('\n[3] ASSIGNMENTS');
  console.log('─'.repeat(70));
  const assignSnap = await db.collection('assignments').get();
  console.log(`Tổng assignments: ${assignSnap.size}`);
  const assignByProgram = new Map(); // programId -> [{userId, status, source}]
  const assignByUser = new Map();    // userId -> [programId]
  assignSnap.docs.forEach(d => {
    const data = d.data();
    const pid = data.programId;
    const uid = data.userId;
    if (!assignByProgram.has(pid)) assignByProgram.set(pid, []);
    assignByProgram.get(pid).push({ userId: uid, status: data.status, source: data.source });
    if (!assignByUser.has(uid)) assignByUser.set(uid, []);
    assignByUser.get(uid).push(pid);
  });

  // 4. Check consistency: published programs with assignedManagers → all those managers must have assignment
  console.log('\n[4] KIỂM TRA ĐỒNG BỘ: published programs có assignedManagers nhưng chưa có assignment');
  console.log('─'.repeat(70));
  let inconsistencyCount = 0;
  for (const p of programs) {
    if (p.status !== 'published') continue;
    const mgrs = p.assignedManagers || [];
    if (mgrs.length === 0) continue;
    const existingAssigns = assignByProgram.get(p.id) || [];
    const existingUserIds = new Set(existingAssigns.map(a => a.userId));
    const missing = mgrs.filter(uid => !existingUserIds.has(uid));
    if (missing.length > 0) {
      inconsistencyCount++;
      console.log(`  ⚠️  "${p.title}" (${p.id})`);
      console.log(`     assignedManagers: ${mgrs.length} (${mgrs.map(uid => {
        const u = userMap.get(uid);
        return u ? u.displayName : uid;
      }).join(', ')})`);
      console.log(`     Có assignment:    ${existingAssigns.length} users`);
      console.log(`     THIẾU assignment: ${missing.length} users → ${missing.map(uid => {
        const u = userMap.get(uid);
        return u ? u.displayName : uid;
      }).join(', ')}`);
    }
  }
  if (inconsistencyCount === 0) {
    console.log('  ✅ Tất cả managers trong assignedManagers của programs đã published đều có assignment');
  }

  // 5. Check for "orphan" assignments: assignment exists but program is unpublished or program deleted
  console.log('\n[5] KIỂM TRA: assignments của programs đã bị xóa / chưa publish');
  console.log('─'.repeat(70));
  const programMap = new Map(programs.map(p => [p.id, p]));
  let orphanCount = 0;
  for (const [pid, assigns] of assignByProgram.entries()) {
    const p = programMap.get(pid);
    if (!p) {
      orphanCount++;
      console.log(`  ⚠️  Program ID "${pid}" KHÔNG TỒN TẠI nhưng có ${assigns.length} assignments`);
      assigns.forEach(a => {
        const u = userMap.get(a.userId);
        console.log(`     → user: ${u ? u.displayName : a.userId}`);
      });
      continue;
    }
    if (p.status !== 'published') {
      // Draft program có assignment cho user (có thể là manager) - vẫn được tính
      // không phải orphan. Bỏ qua.
    }
  }
  if (orphanCount === 0) {
    console.log('  ✅ Không có orphan assignments');
  }

  // 6. For each MANAGER, list programs they should see
  console.log('\n[6] CHƯƠNG TRÌNH CỦA TỪNG MANAGER (qua assignedManagers)');
  console.log('─'.repeat(70));
  for (const m of managers) {
    const mgrPrograms = programs.filter(p => (p.assignedManagers || []).includes(m.id));
    const assignmentsForMgr = assignByUser.get(m.id) || [];
    const assignmentProgramIds = new Set(assignmentsForMgr);

    console.log(`\n  Manager: ${m.displayName} (${m.id})`);
    console.log(`  Programs trong assignedManagers: ${mgrPrograms.length}`);
    mgrPrograms.forEach(p => {
      const hasAssignment = assignmentProgramIds.has(p.id);
      console.log(`    ${hasAssignment ? '✅' : '❌'} [${(p.status||'?').padEnd(9)}] "${p.title}" (assignment: ${hasAssignment ? 'CÓ' : 'THIẾU'})`);
    });
    console.log(`  Tổng assignments: ${assignmentsForMgr.length}`);
    const missing = mgrPrograms.filter(p => !assignmentProgramIds.has(p.id));
    if (missing.length > 0) {
      console.log(`  ⚠️  THIẾU assignment cho ${missing.length} programs đã publish:`);
      missing.forEach(p => {
        console.log(`     → "${p.title}"`);
      });
    }
  }

  // 7. For each EMPLOYEE, list programs they should see
  console.log('\n[7] CHƯƠNG TRÌNH CỦA TỪNG EMPLOYEE');
  console.log('─'.repeat(70));
  for (const e of employees.slice(0, 5)) {
    const empAssigns = assignByUser.get(e.id) || [];
    console.log(`\n  Employee: ${e.displayName} (${e.id})`);
    console.log(`  Tổng assignments: ${empAssigns.length}`);
    empAssigns.forEach(pid => {
      const p = programMap.get(pid);
      if (!p) {
        console.log(`    ⚠️  Program ${pid} KHÔNG TỒN TẠI`);
      } else {
        console.log(`    [${(p.status||'?').padEnd(9)}] "${p.title}"`);
      }
    });
  }
  if (employees.length > 5) {
    console.log(`\n  ... và ${employees.length - 5} employees khác`);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                  HOÀN TẤT INSPECT                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

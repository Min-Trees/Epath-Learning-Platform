// scripts/test-managers-auto-assign.cjs
// Test API PUT /api/programs/:programId/managers có tự động tạo assignment không

const path = require('path');
const fs = require('fs');

// Load env
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

async function getIdToken(email, password) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.idToken;
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.log('Usage: node scripts/test-managers-auto-assign.cjs <admin_email> <password>');
    process.exit(1);
  }

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
  const db = getFirestore(app);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     TEST AUTO-ASSIGN KHI GÁN MANAGER                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Lấy 1 chương trình đã publish để test
  const programsSnap = await db.collection('programs').where('status', '==', 'published').limit(1).get();
  if (programsSnap.empty) {
    console.log('❌ Không tìm thấy chương trình published nào');
    process.exit(1);
  }
  const program = programsSnap.docs[0];
  const programId = program.id;
  const programData = program.data();
  console.log(`📚 Program: ${programData.title}`);
  console.log(`   ID: ${programId}`);
  console.log(`   Status: ${programData.status}`);
  console.log(`   Current assignedManagers: [${(programData.assignedManagers || []).join(', ')}]\n`);

  // Lấy 1 manager chưa có trong assignedManagers
  const allUsersSnap = await db.collection('users').get();
  const allUsers = allUsersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const currentManagers = programData.assignedManagers || [];
  const candidate = allUsers.find((u) => !currentManagers.includes(u.id));
  if (!candidate) {
    console.log('❌ Không tìm được user nào để test');
    process.exit(1);
  }
  console.log(`👤 User sẽ thêm làm manager: ${candidate.fullName || candidate.email}`);
  console.log(`   ID: ${candidate.id}\n`);

  // Kiểm tra assignment hiện tại
  const existingAssignRef = db.collection('assignments').doc(`${candidate.id}_${programId}`);
  const existingAssignSnap = await existingAssignRef.get();
  console.log(`📋 Assignment hiện tại của user này cho program: ${existingAssignSnap.exists ? 'ĐÃ CÓ' : 'CHƯA CÓ'}\n`);

  // Lưu lại state để restore
  const originalManagers = [...currentManagers];

  // Xoá assignment nếu có (để test fresh)
  if (existingAssignSnap.exists) {
    await existingAssignRef.delete();
    console.log('   (đã xoá assignment cũ để test fresh)\n');
  }

  console.log('─'.repeat(64));
  console.log('BƯỚC 1: Login admin và gọi PUT /api/programs/:id/managers');
  console.log('─'.repeat(64));

  const token = await getIdToken(email, password);
  console.log('✅ Đăng nhập admin thành công');

  const newManagerIds = [...originalManagers, candidate.id];
  const res = await fetch(`http://localhost:3000/api/programs/${programId}/managers`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ managerIds: newManagerIds }),
  });
  const data = await res.json();
  console.log(`\n📡 Response status: ${res.status}`);
  console.log('📦 Response body:', JSON.stringify(data, null, 2));

  console.log('\n─'.repeat(64));
  console.log('BƯỚC 2: Verify assignment đã được tạo tự động');
  console.log('─'.repeat(64));

  // Đợi 1s cho Firestore settle
  await new Promise((r) => setTimeout(r, 1000));

  const afterSnap = await existingAssignRef.get();
  if (afterSnap.exists) {
    console.log('\n✅ PASS: Assignment đã được tạo tự động!');
    console.log('   Data:', JSON.stringify(afterSnap.data(), null, 2));
  } else {
    console.log('\n❌ FAIL: Assignment KHÔNG được tạo tự động');
  }

  console.log('\n─'.repeat(64));
  console.log('BƯỚC 3: Cleanup - restore về state ban đầu');
  console.log('─'.repeat(64));

  // Restore program về state cũ
  const restoreRes = await fetch(`http://localhost:3000/api/programs/${programId}/managers`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ managerIds: originalManagers }),
  });
  const restoreData = await restoreRes.json();
  console.log('\n📡 Restore response:', JSON.stringify(restoreData, null, 2));

  if (restoreData.data?.assignmentsCreated?.length > 0) {
    console.log('\n⚠️  Lưu ý: Khi restore, cũng đã tạo assignment mới (vì logic detect manager MỚI so với state hiện tại).');
    console.log('   Đây là hành vi ĐÚNG — nếu muốn gỡ assignment, cần xoá thủ công.');
  }

  console.log('\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('Lỗi:', e);
  process.exit(1);
});

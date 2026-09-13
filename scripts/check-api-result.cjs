// scripts/check-api-result.cjs
// Kiểm tra kết quả API /api/me/programs cho user

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

  console.log(`\n=== KIỂM TRA API /api/me/programs ===`);
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
  console.log(`   Is Admin: ${userData.role === 'admin'}`);

  // 2. Simulate the API logic exactly
  console.log('\n[2] Simulate API logic...');

  // Get assignments
  let assignmentsSnap;
  if (userData.role === 'admin') {
    assignmentsSnap = await db
      .collection('assignments')
      .orderBy('assignedAt', 'desc')
      .limit(500)
      .get();
  } else {
    assignmentsSnap = await db
      .collection('assignments')
      .where('userId', '==', userId)
      .get();
  }
  console.log(`   Assignments raw: ${assignmentsSnap.size}`);

  // Dedup by programId
  const dedupMap = new Map();
  const STATUS_PRIORITY = { completed: 3, in_progress: 2, not_started: 1 };

  for (const a of assignmentsSnap.docs) {
    const aData = a.data();
    const key = aData.programId;
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, a);
    } else {
      const existingStatus = existing.data().status;
      const newStatus = aData.status;
      if (STATUS_PRIORITY[newStatus] > STATUS_PRIORITY[existingStatus]) {
        dedupMap.set(key, a);
      }
    }
  }
  console.log(`   Assignments after dedup: ${dedupMap.size}`);

  // Get programs
  const assignments = Array.from(dedupMap.values());
  const programIds = assignments.map(a => a.data().programId);
  
  const programRefs = programIds.map(id => db.collection('programs').doc(id));
  const programSnaps = await db.getAll(...programRefs);
  
  const programMap = new Map();
  for (const snap of programSnaps) {
    if (snap.exists) {
      const data = snap.data();
      programMap.set(snap.id, {
        id: snap.id,
        title: data.title,
        status: data.status,
      });
    }
  }
  console.log(`   Programs found in DB: ${programMap.size}`);

  // Build items (same logic as API)
  const items = [];
  for (const a of assignments) {
    const aData = a.data();
    const programData = programMap.get(aData.programId);
    const isPublished = programData?.status === 'published';
    
    // Non-admin và non-published program bị skip
    if (userData.role !== 'admin' && !isPublished) {
      console.log(`   ⚠️  Skip (not published): ${programData?.title || aData.programId}`);
      continue;
    }

    items.push({
      programId: aData.programId,
      status: aData.status,
      programTitle: programData?.title || '(deleted)',
    });
  }

  console.log(`\n=== KẾT QUẢ API ===`);
  console.log(`Tổng số items trả về: ${items.length}`);

  // Tính stats như dashboard
  const inProgress = items.filter(p => p.status === 'in_progress' || p.status === 'not_started');
  const completed = items.filter(p => p.status === 'completed');

  console.log(`\n=== STATS NHƯ DASHBOARD ===`);
  console.log(`Đang học (in_progress + not_started): ${inProgress.length}`);
  console.log(`Hoàn thành (completed): ${completed.length}`);
  console.log(`Tổng: ${items.length}`);

  console.log('\n=== CHI TIẾT ITEMS ===');
  items.forEach((item, i) => {
    const statusLabel = item.status === 'in_progress' ? 'Đang học' : 
                        item.status === 'not_started' ? 'Chưa bắt đầu' : 'Hoàn thành';
    console.log(`${(i+1).toString().padStart(2)}. ${statusLabel.padEnd(15)} | ${item.programTitle}`);
  });

  // Check programs in assignedManagers
  console.log('\n=== ASSIGNED MANAGERS CHECK ===');
  const progsSnap = await db.collection('programs').get();
  let inAssignedManagers = 0;
  progsSnap.docs.forEach(d => {
    const data = d.data();
    if ((data.assignedManagers || []).includes(userId)) {
      inAssignedManagers++;
    }
  });
  console.log(`Programs có user trong assignedManagers: ${inAssignedManagers}`);

  console.log('\n=== HOÀN TẤT ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

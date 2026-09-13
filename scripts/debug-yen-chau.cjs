// scripts/debug-yen-chau.cjs
// Debug xem API /api/me/programs trả về gì cho user Châu Nguyễn Kim Yến

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
  console.log('║    DEBUG: CHƯƠNG TRÌNH CỦA TÔI - CHÂU NGUYỄN KIM YẾN     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Tìm user Châu Nguyễn Kim Yến
  console.log('[1] Tìm user Châu Nguyễn Kim Yến...');
  const usersSnap = await db.collection('users').get();
  const yen = usersSnap.docs.find(d => {
    const data = d.data();
    return data.email === 'yen.chau@littlepeople.edu.vn';
  });

  if (!yen) {
    console.log('   ❌ Không tìm thấy user yen.chau@littlepeople.edu.vn');
    // Thử tìm gần đúng
    const similar = usersSnap.docs.filter(d => {
      const data = d.data();
      return data.displayName && (data.displayName.includes('Yến') || data.displayName.includes('Châu'));
    });
    console.log('   Gợi ý:');
    similar.forEach(d => {
      const data = d.data();
      console.log(`   - ${data.displayName} (${data.email})`);
    });
    process.exit(1);
  }

  const yenId = yen.id;
  const yenData = yen.data();
  console.log(`   ✅ User ID: ${yenId}`);
  console.log(`   Name: ${yenData.displayName}`);
  console.log(`   Email: ${yenData.email}`);
  console.log(`   Role: ${yenData.role}`);
  console.log(`   ManagerId: ${yenData.managerId}`);

  // 2. Lấy assignments của Yến
  console.log('\n[2] Lấy assignments của Yến...');
  const assignSnap = await db.collection('assignments')
    .where('userId', '==', yenId)
    .get();

  console.log(`   Tổng assignments: ${assignSnap.size}`);
  const programIds = [];
  assignSnap.docs.forEach(d => {
    const data = d.data();
    programIds.push(data.programId);
    console.log(`   - Program ${data.programId} | Status: ${data.status}`);
  });

  // 3. Lấy thông tin các programs
  console.log('\n[3] Thông tin các programs của Yến:');
  console.log('   ' + '─'.repeat(70));

  if (programIds.length === 0) {
    console.log('   ❌ KHÔNG CÓ assignment nào!');
  } else {
    for (const programId of programIds) {
      const programDoc = await db.collection('programs').doc(programId).get();
      if (programDoc.exists) {
        const p = programDoc.data();
        console.log(`   📚 ${p.title}`);
        console.log(`      Status: ${p.status}`);
        console.log(`      Lessons: ${(p.lessons || []).length}`);
        console.log(`      Created: ${p.createdAt?.toDate?.()?.toISOString()}`);
      } else {
        console.log(`   ⚠️  Program ${programId} không tồn tại!`);
      }
    }
  }

  // 4. Kiểm tra tất cả programs trong hệ thống
  console.log('\n[4] Tất cả programs trong hệ thống:');
  console.log('   ' + '─'.repeat(70));
  const allProgramsSnap = await db.collection('programs').get();
  allProgramsSnap.docs.forEach(d => {
    const p = d.data();
    const isAssigned = programIds.includes(d.id);
    const marker = isAssigned ? '✅' : '  ';
    console.log(`   ${marker} ${p.title} [${p.status}]`);
  });

  // 5. Mô phỏng query của API /api/me/programs
  console.log('\n[5] Mô phỏng query API /api/me/programs:');
  console.log('   ' + '─'.repeat(70));

  // Query như trong code
  const query = await db.collection('assignments')
    .where('userId', '==', yenId)
    .get();

  const result = [];
  for (const doc of query.docs) {
    const a = doc.data();
    const pDoc = await db.collection('programs').doc(a.programId).get();
    if (pDoc.exists) {
      const pData = pDoc.data();
      const isPublished = pData.status === 'published';
      result.push({
        assignmentId: doc.id,
        programId: a.programId,
        programTitle: pData.title,
        status: a.status,
        programStatus: pData.status,
        isPublished,
        willShow: isPublished, // Non-admin: chỉ show published
      });
    } else {
      result.push({
        assignmentId: doc.id,
        programId: a.programId,
        programTitle: '⚠️ KHÔNG TỒN TẠI',
        status: a.status,
        programStatus: 'DELETED',
        willShow: false,
      });
    }
  }

  console.log(`   Tổng assignments: ${result.length}`);
  console.log(`   Sẽ hiển thị (published): ${result.filter(r => r.willShow).length}`);
  console.log('');
  result.forEach((r, i) => {
    const icon = r.willShow ? '✅' : '❌';
    const note = r.willShow ? '' : ` [${r.programStatus}]`;
    console.log(`   ${i + 1}. ${icon} ${r.programTitle}${note}`);
  });

  // 6. Kiểm tra assignedManagers
  console.log('\n[6] Kiểm tra assignedManagers của từng program:');
  console.log('   ' + '─'.repeat(70));
  for (const programId of programIds) {
    const programDoc = await db.collection('programs').doc(programId).get();
    if (programDoc.exists) {
      const p = programDoc.data();
      const managers = p.assignedManagers || [];
      const isYenManager = managers.includes(yenId);
      console.log(`   ${p.title}:`);
      console.log(`      Status: ${p.status}`);
      console.log(`      Managers: ${managers.length > 0 ? managers.join(', ') : '(không có)'}`);
      console.log(`      Yến là manager: ${isYenManager ? '✅ CÓ' : '❌ KHÔNG'}`);
    }
  }

  // 7. Kiểm tra managerId của user
  console.log('\n[7] Kiểm tra managerId của Yến:');
  console.log('   ' + '─'.repeat(70));
  if (yenData.managerId) {
    const managerDoc = await db.collection('users').doc(yenData.managerId).get();
    if (managerDoc.exists) {
      const mData = managerDoc.data();
      console.log(`   Manager: ${mData.displayName} (${mData.email})`);
    } else {
      console.log(`   ⚠️ ManagerId ${yenData.managerId} không tồn tại!`);
    }
  } else {
    console.log('   ❌ Không có managerId!');
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    KẾT LUẬN                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const visibleCount = result.filter(r => r.willShow).length;
  if (visibleCount < result.length) {
    const hidden = result.filter(r => !r.willShow);
    console.log(`⚠️  Có ${hidden.length} chương trình bị ẨN vì:`);
    hidden.forEach((h, i) => {
      console.log(`   ${i + 1}. ${h.programTitle}`);
      if (h.programStatus === 'DELETED') {
        console.log(`      → Chương trình đã bị XÓA khỏi hệ thống`);
      } else if (h.programStatus === 'draft') {
        console.log(`      → Chương trình chưa PUBLISH (chỉ admin mới thấy)`);
      }
    });
  } else {
    console.log('✅ Tất cả chương trình đều được hiển thị');
  }

  console.log('\n');
  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

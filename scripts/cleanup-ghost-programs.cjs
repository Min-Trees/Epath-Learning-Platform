// scripts/cleanup-ghost-programs.cjs
// Xóa vĩnh viễn các "ghost programs" - document programs rỗng {} không có title,
// không có createdAt, không có status, không có assignments.
// Nguyên nhân: doc bị xóa một phần trước đó nhưng vẫn còn tồn tại trong DB
// (Firestore delete chỉ xóa khi gọi .delete() thành công).

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
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Thiếu FIREBASE_ADMIN_* env');
    process.exit(1);
  }

  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  const db = getFirestore(app);

  console.log('\n=== CLEANUP GHOST PROGRAMS ===\n');
  console.log('Quét tất cả programs, tìm doc rỗng / thiếu title / thiếu createdAt ...\n');

  const allProgs = await db.collection('programs').get();
  const allAssigns = await db.collection('assignments').get();
  const programIdsWithAssign = new Set(
    allAssigns.docs.map((d) => d.data().programId)
  );

  const ghosts = [];
  const incomplete = []; // thiếu 1 trong các field cần thiết nhưng có 1 phần data

  allProgs.docs.forEach((d) => {
    const data = d.data();
    const hasTitle = typeof data.title === 'string' && data.title.trim().length > 0;
    const hasCreatedAt = data.createdAt !== undefined && data.createdAt !== null;
    const hasStatus = typeof data.status === 'string';
    const hasAssignments = programIdsWithAssign.has(d.id);
    const isCompletelyEmpty = Object.keys(data).length === 0;

    if (isCompletelyEmpty || (!hasTitle && !hasCreatedAt && !hasStatus)) {
      ghosts.push({ id: d.id, reason: isCompletelyEmpty ? 'empty' : 'missing core fields' });
    } else if (!hasTitle || !hasCreatedAt) {
      incomplete.push({ id: d.id, data, hasTitle, hasCreatedAt, hasStatus, hasAssignments });
    }
  });

  console.log(`Tổng programs: ${allProgs.size}`);
  console.log(`Ghost (rỗng/thiếu hết core fields): ${ghosts.length}`);
  console.log(`Incomplete (thiếu 1 số field): ${incomplete.length}\n`);

  if (ghosts.length === 0 && incomplete.length === 0) {
    console.log('✅ Không có program nào cần dọn dẹp.');
    process.exit(0);
  }

  if (ghosts.length > 0) {
    console.log('GHOST PROGRAMS SẼ XÓA:');
    ghosts.forEach((g, i) => {
      console.log(`  ${i + 1}. ${g.id} (${g.reason})`);
    });
  }

  if (incomplete.length > 0) {
    console.log('\nINCOMPLETE PROGRAMS (cần review):');
    incomplete.forEach((g, i) => {
      console.log(`  ${i + 1}. ${g.id}`);
      console.log(`     title: ${g.hasTitle ? '✓' : '✗'} | createdAt: ${g.hasCreatedAt ? '✓' : '✗'} | status: ${g.hasStatus ? '✓' : '✗'} | assignments: ${g.hasAssignments ? '✓' : '✗'}`);
      console.log(`     data: ${JSON.stringify(g.data).substring(0, 100)}`);
    });
  }

  // Xóa ghosts
  if (ghosts.length > 0) {
    console.log('\n[1] Đang xóa ghost programs...');
    const batch = db.batch();
    ghosts.forEach((g) => {
      batch.delete(db.collection('programs').doc(g.id));
      console.log(`   - Xóa: ${g.id}`);
    });
    await batch.commit();
    console.log(`   ✅ Đã xóa ${ghosts.length} ghost programs\n`);
  }

  // Với incomplete: nếu là draft không có assignments, ta cũng nên xóa
  // (vì nó hiển thị trong admin/programs nhưng vô dụng)
  const toDelete = incomplete.filter(
    (g) => !g.hasAssignments && (!g.hasTitle || !g.hasCreatedAt)
  );
  if (toDelete.length > 0) {
    console.log('[2] Đang xóa các incomplete programs không có assignments...');
    const batch = db.batch();
    toDelete.forEach((g) => {
      batch.delete(db.collection('programs').doc(g.id));
      console.log(`   - Xóa: ${g.id}`);
    });
    await batch.commit();
    console.log(`   ✅ Đã xóa ${toDelete.length} incomplete programs\n`);
  }

  // Verify
  console.log('[VERIFY] Kiểm tra lại...');
  const verifyProgs = await db.collection('programs').get();
  const verifyAssigns = await db.collection('assignments').get();
  console.log(`Programs còn lại: ${verifyProgs.size}`);
  console.log(`Assignments còn lại: ${verifyAssigns.size}`);
  console.log(`Programs có assignment: ${new Set(verifyAssigns.docs.map((d) => d.data().programId)).size}`);

  // Confirm tất cả programs hiện tại đều có title + createdAt + status
  const stillBroken = verifyProgs.docs.filter((d) => {
    const data = d.data();
    return !data.title || !data.createdAt || !data.status;
  });
  if (stillBroken.length === 0) {
    console.log('\n✅ Tất cả programs còn lại đều hợp lệ (có title, createdAt, status)');
  } else {
    console.log(`\n⚠️  Vẫn còn ${stillBroken.length} programs chưa hợp lệ:`);
    stillBroken.forEach((d) => console.log(`   - ${d.id}: ${JSON.stringify(d.data()).substring(0, 80)}`));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

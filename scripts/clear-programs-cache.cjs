// scripts/clear-programs-cache.cjs
// Xóa cache liên quan đến user Yến Châu

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
  console.log('║              XÓA CACHE PROGRAMS                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Xóa cache theo pattern
  const patterns = [
    'programs:list',
    'programs:assigned:',
    'me:programs:',
    'cache:programs:',
    'programs:cache:',
  ];

  let deletedCount = 0;

  // Tìm trong collection 'cache'
  try {
    const cacheSnap = await db.collection('cache').get();
    console.log(`Tìm thấy ${cacheSnap.size} cache documents trong 'cache' collection`);
    for (const doc of cacheSnap.docs) {
      const data = doc.data();
      const id = doc.id;
      if (patterns.some(p => id.includes(p)) ||
          (data.userId === 'JzIeIPvBVXR17KNHtf7EkaDG1fB2')) {
        await doc.ref.delete();
        console.log(`   ✅ Đã xóa cache: ${id}`);
        deletedCount++;
      }
    }
  } catch (e) {
    console.log('   Không tìm thấy collection cache');
  }

  // Tìm trong collection 'programCache'
  try {
    const pcSnap = await db.collection('programCache').get();
    console.log(`\nTìm thấy ${pcSnap.size} cache documents trong 'programCache' collection`);
    for (const doc of pcSnap.docs) {
      const data = doc.data();
      const id = doc.id;
      if (patterns.some(p => id.includes(p)) ||
          (data.userId === 'JzIeIPvBVXR17KNHtf7EkaDG1fB2')) {
        await doc.ref.delete();
        console.log(`   ✅ Đã xóa cache: ${id}`);
        deletedCount++;
      }
    }
  } catch (e) {}

  console.log(`\n📊 Tổng cache đã xóa: ${deletedCount}`);
  console.log('\n💡 Lưu ý: Client cache sẽ tự hết hạn sau 30s. Để refresh ngay:');
  console.log('   - Mở DevTools > Application > Clear storage');
  console.log('   - Hoặc Hard reload (Ctrl+Shift+R)');

  process.exit(0);
}

main().catch(e => {
  console.error('Lỗi:', e);
  process.exit(1);
});

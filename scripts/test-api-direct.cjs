// scripts/test-api-direct.cjs
// Gọi trực tiếp API /api/programs và /api/me/programs để xem phản hồi

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
const { getAuth } = require('firebase-admin/auth');

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });

  const auth = getAuth(app);
  const API_BASE = process.env.API_BASE || 'http://localhost:3000';

  // Get custom token cho test users, sau đó exchange lấy ID token
  const testUsers = [
    { email: 'admin@epath.com', label: 'ADMIN', uid: 'mo5PcpvxpBW0Gd6SmG003X4rDw93' },
    { email: 'yen.chau@littlepeople.edu.vn', label: 'MANAGER (Yến)', uid: 'JzIeIPvBVXR17KNHtf7EkaDG1fB2' },
    { email: '299linhtran@gmail.com', label: 'MANAGER (Linh)', uid: 'md9lsGgaGmgsMf2GoYBqXK23oFE2' },
  ];

  for (const u of testUsers) {
    console.log(`\n\n========== TEST AS ${u.label} (${u.email}) ==========`);
    try {
      // Lấy custom token
      const customToken = await auth.createCustomToken(u.uid, { email: u.email });
      // Exchange custom token for ID token (POST to identitytoolkit)
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const idTokenResp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: customToken, returnSecureToken: true }),
        }
      );
      const idTokenData = await idTokenResp.json();
      const idToken = idTokenData.idToken;

      if (!idToken) {
        console.log('  ❌ Không lấy được ID token:', idTokenData);
        continue;
      }

      console.log(`  ✅ Got ID token`);

      // Test /api/programs
      console.log(`\n  [GET /api/programs]`);
      const progResp = await fetch(`${API_BASE}/api/programs`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const progData = await progResp.json();
      if (progData.success) {
        console.log(`  Total programs: ${progData.data.items.length}`);
        progData.data.items.forEach((p, i) => {
          console.log(`    ${i+1}. [${p.status || '?'}] "${p.title || '(no title)'}" (managers: ${(p.assignedManagers || []).length})`);
        });
      } else {
        console.log(`  ❌ Error:`, progData);
      }

      // Test /api/me/programs
      console.log(`\n  [GET /api/me/programs]`);
      const myResp = await fetch(`${API_BASE}/api/me/programs`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const myData = await myResp.json();
      if (myData.success) {
        console.log(`  Total items: ${myData.data.items.length}`);
        myData.data.items.forEach((it, i) => {
          console.log(`    ${i+1}. [${it.program?.status || '?'}] "${it.program?.title || '(no title)'}"`);
        });
      } else {
        console.log(`  ❌ Error:`, myData);
      }
    } catch (err) {
      console.log(`  ❌ Lỗi:`, err.message);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error('Lỗi:', e); process.exit(1); });

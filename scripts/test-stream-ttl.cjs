// Quick test of new TTL
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

(async () => {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
  const auth = getAuth(app);

  const TEST_USERS = [
    { uid: 'mo5PcpvxpBW0Gd6SmG003X4rDw93', label: 'ADMIN' },
    { uid: 'JzIeIPvBVXR17KNHtf7EkaDG1fB2', label: 'MANAGER (Yến)' },
  ];

  for (const u of TEST_USERS) {
    console.log(`\n========== ${u.label} ==========`);
    const customToken = await auth.createCustomToken(u.uid);
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const resp = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });
    const data = await resp.json();
    const idToken = data.idToken;

    // Find a video lesson
    const progsResp = await fetch('http://localhost:3000/api/programs', {
      headers: { Authorization: 'Bearer ' + idToken },
    });
    const progs = await progsResp.json();
    let videoLesson = null;
    let programId = null;
    for (const p of progs.data.items) {
      const lr = await fetch('http://localhost:3000/api/programs/' + p.id, {
        headers: { Authorization: 'Bearer ' + idToken },
      });
      const lp = await lr.json();
      const v = lp.data.lessons.find(l => l.contentType === 'video');
      if (v) {
        videoLesson = v;
        programId = p.id;
        break;
      }
    }
    if (!videoLesson) {
      console.log('  No video lesson found for this user');
      continue;
    }
    console.log(`  Lesson: ${videoLesson.title} (${videoLesson.id})`);

    // Get stream token
    const tokResp = await fetch('http://localhost:3000/api/stream/token', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + idToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId, lessonId: videoLesson.id, kind: 'video' }),
    });
    const tok = await tokResp.json();
    if (!tok.success) {
      console.log('  Token error:', tok);
      continue;
    }
    console.log(`  Token TTL: ${tok.data.expiresIn}s = ${(tok.data.expiresIn / 3600).toFixed(2)}h`);

    // Test Range request
    const rangeResp = await fetch('http://localhost:3000/api/stream/' + tok.data.token + '/file', {
      headers: { Range: 'bytes=0-1023' },
    });
    console.log(`  Range[0-1023] status: ${rangeResp.status}`);
    console.log(`  Content-Range: ${rangeResp.headers.get('content-range')}`);
    console.log(`  Content-Length: ${rangeResp.headers.get('content-length')}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

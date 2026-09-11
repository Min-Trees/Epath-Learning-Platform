// scripts/verify-vps.mjs - Verify VPS deployment
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const HOST = '103.72.57.100';
const USER = 'root';
const PASS = 'j!@tbVc8GHPMYzK';

const conn = new Client();
conn.on('ready', () => {
  const run = (cmd) => new Promise((res) => {
    conn.exec(cmd, (err, stream) => {
      let out = '';
      stream.on('data', d => out += d);
      stream.on('close', () => res(out.trim()));
    });
  });
  
  (async () => {
    const [version, appUrl, pm2] = await Promise.all([
      run('cd /var/www/epath && git log -1 --format="%h %s"'),
      run('grep "NEXT_PUBLIC_APP_URL" /var/www/epath/.env.local'),
      run('pm2 list'),
    ]);
    
    console.log('=== VPS Deployment Info ===');
    console.log('Git version:', version);
    console.log('APP URL:', appUrl);
    console.log('\nPM2 status:');
    console.log(pm2);
    
    conn.end();
  })();
});
conn.on('error', e => { console.error('SSH error:', e.message); process.exit(1); });
conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 15000 });

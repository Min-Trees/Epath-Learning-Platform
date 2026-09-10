// scripts/check-vps-env.mjs - Check VPS env for APP_URL
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const HOST = '103.72.57.100';
const USER = 'root';
const PASS = 'j!@tbVc8GHPMYzK';

const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -E "NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_APP_NAME|MAIL_" /var/www/epath/.env.local', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', () => conn.end());
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
  });
});
conn.on('error', e => { console.error('SSH error:', e.message); process.exit(1); });
conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 15000 });

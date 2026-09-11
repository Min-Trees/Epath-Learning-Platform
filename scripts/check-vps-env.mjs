// scripts/check-vps-env.mjs - Check VPS env for APP_URL
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createConnection } = require('./_ssh-helper.cjs');

const conn = createConnection({ readyTimeout: 15_000 });
conn.on('ready', () => {
  conn.exec('grep -E "NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_APP_NAME|MAIL_" /var/www/epath/.env.local', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', () => conn.end());
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
  });
});
conn.on('error', e => { console.error('SSH error:', e.message); process.exit(1); });

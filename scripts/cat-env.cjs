// scripts/cat-env.cjs - Print VPS .env.local
const { createConnection } = require('./_ssh-helper.cjs');

const conn = createConnection({ readyTimeout: 20_000 });
conn.on('ready', () => {
  const script = `set -e
cd /var/www/epath
echo "=== CURRENT env.local ==="
cat .env.local
`;
  conn.exec(script, (e, s) => {
    s.on('data', d => process.stdout.write(d.toString()));
    s.stderr.on('data', d => process.stderr.write(d.toString()));
    s.on('close', () => { conn.end(); process.exit(0); });
  });
});
conn.on('error', err => { console.error('SSH err:', err.message); process.exit(1); });

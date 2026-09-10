const {Client} = require('ssh2');
const conn = new Client();
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
conn.connect({host:'103.72.57.100', port:22, username:'root', password:'j!@tbVc8GHPMYzK', readyTimeout: 20000});

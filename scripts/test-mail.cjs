const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const script = `set -e
cd /var/www/epath
echo "=== Test mail: forgot-password API (kiểm tra mail có gửi đi không)"
# Test endpoint forgot-password với email thật
RESPONSE=$(curl -s -X POST http://127.0.0.1:3000/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"npminhtri.be@gmail.com"}' --max-time 10 || echo "NO_ENDPOINT")
echo "API response: $RESPONSE"

echo "=== Check mail code"
grep -n "MAIL_FROM\\|MAIL_HOST\\|MAIL_USERNAME" .env.local

echo "=== Check mail route exists"
ls -la src/app/api/auth/ 2>/dev/null
`;
  conn.exec(script, (e, s) => {
    s.on('data', d => process.stdout.write(d.toString()));
    s.stderr.on('data', d => process.stderr.write(d.toString()));
    s.on('close', () => { conn.end(); process.exit(0); });
  });
});
conn.on('error', err => { console.error(err.message); process.exit(1); });
conn.connect({host:'103.72.57.100', port:22, username:'root', password:'j!@tbVc8GHPMYzK', readyTimeout: 20000});

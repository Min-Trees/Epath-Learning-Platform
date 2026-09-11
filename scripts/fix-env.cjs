// scripts/fix-env.cjs - Fix APP_URL + MAIL_FROM on VPS .env.local
const { createConnection } = require('./_ssh-helper.cjs');

const conn = createConnection({ readyTimeout: 20_000 });
conn.on('ready', () => {
  const script = `set -e
cd /var/www/epath
echo "=== BEFORE ==="
grep -n "NEXT_PUBLIC_APP_URL\|MAIL_FROM\|MAIL_" .env.local
echo "=== FIX APP_URL & MAIL_FROM ==="
sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://lptraininghub.lp-intranet.id.vn|' .env.local
grep -q "^MAIL_FROM=" .env.local || echo 'MAIL_FROM="Epath System Training <npminhtri.be@gmail.com>"' >> .env.local
echo "=== AFTER ==="
grep -n "NEXT_PUBLIC_APP_URL\|MAIL_" .env.local
echo "=== RELOAD PM2 ==="
pm2 reload epath --update-env
sleep 2
echo "=== HEALTH CHECK ==="
curl -sI http://127.0.0.1:3000/ --max-time 5 2>&1 | head -3
echo "=== TEST EMAIL ROUTE EXISTS ==="
ls src/app/api/auth/forgot-password/ 2>/dev/null || echo NOT_FOUND
`;
  conn.exec(script, (e, s) => {
    s.on('data', d => process.stdout.write(d.toString()));
    s.stderr.on('data', d => process.stderr.write(d.toString()));
    s.on('close', () => { conn.end(); process.exit(0); });
  });
});
conn.on('error', err => { console.error('SSH err:', err.message); process.exit(1); });

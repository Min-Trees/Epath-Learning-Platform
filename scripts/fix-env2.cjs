// scripts/fix-env2.cjs - Fix APP_URL + MAIL_FROM (v2)
const { createConnection } = require('./_ssh-helper.cjs');

const conn = createConnection({ readyTimeout: 20_000 });
conn.on('ready', () => {
  const script = `bash -c '
set -e
cd /var/www/epath
echo "===> Fix APP_URL"
sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://lptraininghub.lp-intranet.id.vn|" .env.local

echo "===> Add MAIL_FROM"
if ! grep -q "^MAIL_FROM=" .env.local; then
  echo "MAIL_FROM=\\"Epath System Training <npminhtri.be@gmail.com>\\"" >> .env.local
fi

echo "===> Result:"
grep -n "NEXT_PUBLIC_APP_URL\|^MAIL" .env.local

echo "===> Reload PM2"
pm2 reload epath --update-env
pm2 save
sleep 1

echo "===> Health check"
curl -sI http://127.0.0.1:3000/ --max-time 5 2>&1 | head -3
'`;
  conn.exec(script, (e, s) => {
    s.on('data', d => process.stdout.write(d.toString()));
    s.stderr.on('data', d => process.stderr.write(d.toString()));
    s.on('close', code => { console.log('\\n[exit ' + code + ']'); conn.end(); process.exit(code || 0); });
  });
});
conn.on('error', err => { console.error('SSH err:', err.message); process.exit(1); });

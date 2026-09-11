// scripts/check-vps.cjs - Dump VPS nginx/pm2/env diagnostics
const { createConnection } = require('./_ssh-helper.cjs');

const conn = createConnection({ readyTimeout: 20_000 });
conn.on('ready', () => {
  const script = `set +e
echo "=== NGINX ==="
ls /etc/nginx/sites-enabled/ 2>&1
ls /etc/nginx/conf.d/ 2>&1
echo "--- nginx conf epath ---"
cat /etc/nginx/sites-enabled/epath 2>/dev/null || cat /etc/nginx/conf.d/epath.conf 2>/dev/null || cat /etc/nginx/conf.d/epath-training.conf 2>/dev/null || echo "NO_NGINX_CONFIG"
echo "=== PORTS LISTEN ==="
ss -tlnp 2>/dev/null | head -30
echo "=== DOMAIN CURL ==="
curl -sI -k https://lptraininghub.lp-intranet.id.vn/ --max-time 6 2>&1 | head -10
echo "--- check port 3000 ---"
curl -sI http://127.0.0.1:3000/ --max-time 5 2>&1 | head -5
echo "=== ENV MAIL/DOMAIN ==="
cat /var/www/epath/.env.local 2>/dev/null | grep -iE "mail|smtp|email|NEXT_PUBLIC|APP_URL|VERCEL" | head -30
echo "=== PM2 STATUS ==="
pm2 list
echo "=== CERTBOT / SSL ==="
ls /etc/letsencrypt/live/ 2>&1 || echo NO_CERTBOT
echo "=== NGINX TEST ==="
nginx -t 2>&1
`;
  conn.exec(script, (e, s) => {
    s.on('data', d => process.stdout.write(d.toString()));
    s.stderr.on('data', d => process.stderr.write(d.toString()));
    s.on('close', () => { conn.end(); process.exit(0); });
  });
});
conn.on('error', err => { console.error('SSH err:', err.message); process.exit(1); });

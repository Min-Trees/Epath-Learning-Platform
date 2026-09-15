/**
 * scripts/ssh-inspect.cjs
 *
 * SSH vào VPS để xem log, env, health status.
 *
 * CÁCH DÙNG:
 *   PowerShell:  $env:VPS_PASSWORD="your_password"; node scripts/ssh-inspect.cjs
 *   bash/WSL:    export VPS_PASSWORD="your_password"; node scripts/ssh-inspect.cjs
 *   CMD:         set VPS_PASSWORD=your_password && node scripts/ssh-inspect.cjs
 *
 * KHÔNG hardcode credentials trong file này — luôn dùng _ssh-helper.cjs.
 */

const { createConnection, execCommand, getVpsPassword } = require('./_ssh-helper.cjs');

// Fail-fast nếu thiếu password
getVpsPassword();

async function main() {
  const conn = createConnection({ readyTimeout: 30_000 });

  conn.on('ready', async () => {
    try {
      const out = await execCommand(conn, [
        'echo "=== ENV: APP_URL / CDN / STREAM ==="',
        'grep -E "(NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_APP_NAME|MAIL_HOST|MAIL_USERNAME|CDN_DOMAIN|STREAM_SESSION_SECRET)" /var/www/epath/.env.local || true',
        '',
        'echo "=== PM2 LOGS (last 60) ==="',
        'pm2 logs epath --lines 60 --nostream --raw 2>&1 | tail -60',
        '',
        'echo "=== Quick health check ==="',
        'curl -s -o /dev/null -w "HTTP %{http_code}" https://lptraininghub.lp-intranet.id.vn/login',
      ].join('\n'), 60_000);

      console.log('\n--- Done ---');
      conn.end();
      process.exit(0);
    } catch (e) {
      console.error('SSH exec error:', e.message);
      conn.end();
      process.exit(1);
    }
  });

  conn.on('error', (e) => {
    console.error('SSH ERR:', e.message);
    process.exit(1);
  });
}

main();

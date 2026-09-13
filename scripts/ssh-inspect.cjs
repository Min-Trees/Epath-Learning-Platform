const ssh = require('ssh2');

const c = new ssh.Client();
c.on('ready', () => {
  c.exec(
    'echo "=== ENV ===" && grep -E "(CDN_DOMAIN|STREAM_SESSION_SECRET|S3_)" /var/www/epath/.env.local || true && echo "=== PM2 LOGS (last 60) ===" && pm2 logs epath --lines 60 --nostream --raw 2>&1 | tail -60',
    (err, stream) => {
      let out = '';
      stream.on('data', (d) => (out += d.toString()));
      stream.on('close', () => {
        console.log(out);
        c.end();
      });
    }
  );
}).on('error', (e) => {
  console.error('SSH ERR:', e.message);
  process.exit(1);
}).connect({
  host: '103.72.57.100',
  port: 22,
  username: 'root',
  password: '25062024@Th',
  readyTimeout: 30000,
});

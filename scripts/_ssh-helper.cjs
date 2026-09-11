/**
 * scripts/_ssh-helper.cjs
 *
 * Helper dùng chung cho các script SSH vào VPS.
 *
 * QUAN TRỌNG: KHÔNG BAO GIỜ hardcode password trong file này.
 * Mọi script phải đọc VPS_PASSWORD từ biến môi trường.
 *
 * Cách dùng:
 *   1. Set env var trước khi chạy:
 *        $env:VPS_PASSWORD="your_password"   # PowerShell
 *        export VPS_PASSWORD="your_password" # bash
 *   2. Chạy script: node scripts/vps-deploy.mjs
 *
 * Nếu thiếu VPS_PASSWORD → script fail ngay với thông báo rõ ràng.
 */

const { Client } = require('ssh2');

const HOST = '103.72.57.100';
const USER = 'root';

function getVpsPassword() {
  const pass = process.env.VPS_PASSWORD;
  if (!pass || pass.trim().length === 0) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════╗');
    console.error('║  THIẾU VPS_PASSWORD — không thể kết nối SSH vào VPS       ║');
    console.error('╠════════════════════════════════════════════════════════════╣');
    console.error('║  Cách 1 (PowerShell):                                     ║');
    console.error('║    $env:VPS_PASSWORD="your_password"                       ║');
    console.error('║    node scripts/vps-deploy.mjs                             ║');
    console.error('║                                                            ║');
    console.error('║  Cách 2 (bash / Git Bash / WSL):                           ║');
    console.error('║    export VPS_PASSWORD="your_password"                     ║');
    console.error('║    node scripts/vps-deploy.mjs                             ║');
    console.error('║                                                            ║');
    console.error('║  Cách 3 (Windows CMD):                                     ║');
    console.error('║    set VPS_PASSWORD=your_password                          ║');
    console.error('║    node scripts/vps-deploy.mjs                             ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }
  return pass;
}

function createConnection({ readyTimeout = 30_000 } = {}) {
  const conn = new Client();
  conn.on('error', (err) => {
    console.error('[ssh] error:', err.message);
    process.exit(1);
  });
  conn.connect({
    host: HOST,
    port: 22,
    username: USER,
    password: getVpsPassword(),
    readyTimeout,
  });
  return conn;
}

/**
 * Chạy 1 command và trả về { stdout, stderr, code }.
 * Caller tự quản lý connection lifecycle.
 */
function execCommand(conn, cmd, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timer;
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
      stream.on('data', (d) => {
        const s = d.toString('utf8');
        stdout += s;
        process.stdout.write(s);
      });
      stream.stderr.on('data', (d) => {
        const s = d.toString('utf8');
        stderr += s;
        process.stderr.write(s);
      });
      timer = setTimeout(() => {
        try {
          stream.close();
        } catch {}
        reject(new Error(`Command timeout after ${timeoutMs}ms: ${cmd.slice(0, 80)}`));
      }, timeoutMs);
    });
  });
}

module.exports = {
  HOST,
  USER,
  getVpsPassword,
  createConnection,
  execCommand,
};

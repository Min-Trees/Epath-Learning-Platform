// scripts/vps-deploy.mjs - Main deploy orchestrator
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const HOST = '103.72.57.100';
const USER = 'root';
const PASS = process.env.VPS_PASSWORD || 'j!@tbVc8GHPMYzK';

// Khi deploy lần đầu, repo ở /var/www/epath nhưng chưa có .git.
// Tôi sẽ: clone vào /var/www/epath.new, rsync source vào /var/www/epath, build, reload.
const CURRENT_DIR = '/var/www/epath';
const NEW_DIR = '/var/www/epath.new';
const GIT_REMOTE = 'https://github.com/Min-Trees/Epath-Learning-Platform.git';

function runCmd(client, cmd, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '', timer;
    client.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
      stream.on('data', d => { const s = d.toString('utf8'); stdout += s; process.stdout.write(s); });
      stream.stderr.on('data', d => { const s = d.toString('utf8'); stderr += s; process.stderr.write(s); });
      timer = setTimeout(() => { try { stream.close(); } catch {}; reject(new Error(`Timeout ${timeoutMs}ms: ${cmd.slice(0,80)}`)); }, timeoutMs);
    });
  });
}

async function sshExec(steps) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', async () => {
      try {
        const out = [];
        for (const step of steps) {
          const r = await runCmd(conn, step.cmd, step.timeout || 300_000);
          out.push(r);
          if (r.code !== 0 && !step.allowFail) {
            conn.end();
            return reject(new Error(`Step failed (exit ${r.code}): ${step.label || step.cmd.slice(0,80)}\n${r.stderr.slice(-500)}`));
          }
        }
        conn.end();
        resolve(out);
      } catch (e) {
        try { conn.end(); } catch {}
        reject(e);
      }
    });
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30_000 });
  });
}

async function healthCheck() {
  return new Promise((resolve) => {
    const conn = new Client();
    let elapsed = 0;
    let stopped = false;
    const stop = (val) => { if (!stopped) { stopped = true; try { conn.end(); } catch {}; resolve(val); } };

    conn.on('ready', async () => {
      const tick = async () => {
        try {
          const r = await runCmd(conn, `curl -fsS --max-time 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 2>/dev/null; echo ""`, 10_000);
          const r2 = await runCmd(conn, `curl -fsS --max-time 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>/dev/null; echo ""`, 10_000);
          const code = (r.stdout + r2.stdout).trim();
          const ok = code.includes('200') || code.includes('307');
          console.log(`  [health] elapsed=${elapsed}s code=${code}`);
          if (ok) return stop(true);
          elapsed += 2;
          if (elapsed >= 30) return stop(false);
          setTimeout(tick, 2000);
        } catch {
          elapsed += 2;
          if (elapsed >= 30) return stop(false);
          setTimeout(tick, 2000);
        }
      };
      tick();
    });
    conn.on('error', () => stop(false));
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30_000 });
  });
}

console.log('============================================');
console.log(' DEPLOY EpathSystemTraining → VPS');
console.log('============================================\n');

// Step 1: Backup + clone fresh
console.log('[1/5] Backup current dir + clone fresh repo...');
await sshExec([
  {
    label: 'backup',
    cmd: `set -e
      cd /var/www
      TS=$(date +%Y%m%d-%H%M%S)
      if [ -d epath ] && [ ! -d epath.backup-\\$TS ]; then
        cp -a epath epath.backup-\\$TS
        echo "BACKUP=epath.backup-\\$TS"
      fi
      rm -rf ${NEW_DIR}
      git clone --depth 1 ${GIT_REMOTE} ${NEW_DIR}
      cd ${NEW_DIR}
      git rev-parse HEAD
      git log -1 --oneline
    `,
    timeout: 180_000,
  },
]);

// Step 2: Copy env.local + ecosystem.config.js (giữ nguyên config cũ cho PM2)
// Và copy source code, package.json
console.log('\n[2/5] Sync source code → /var/www/epath (giữ nguyên env, ecosystem.config.js, .next/, node_modules/)...');
await sshExec([
  {
    label: 'sync',
    cmd: `set -e
      cd /var/www
      # Backup những file cần giữ nguyên trên VPS
      cp -a epath/.env.local /tmp/env.local.bak 2>/dev/null || true
      cp -a epath/ecosystem.config.js /tmp/ecosystem.config.js.bak 2>/dev/null || true
      cp -a epath/.env.example /tmp/env.example.bak 2>/dev/null || true
      cp -a epath/firestore.rules /tmp/firestore.rules.bak 2>/dev/null || true
      cp -a epath/firebase.json /tmp/firebase.json.bak 2>/dev/null || true
      cp -a epath/.firebaserc /tmp/firebaserc.bak 2>/dev/null || true
      cp -a epath/storage.rules /tmp/storage.rules.bak 2>/dev/null || true
      cp -a epath/firestore.indexes.json /tmp/firestore.indexes.json.bak 2>/dev/null || true
      cp -a epath/build.log /tmp/build.log.bak 2>/dev/null || true

      # Xóa source cũ (giữ node_modules, .next, .env.local)
      cd epath
      find . -maxdepth 1 -mindepth 1 ! -name node_modules ! -name .next ! -name '.env*' -exec rm -rf {} +

      # Copy source mới từ NEW_DIR sang (loại trừ file lớn không cần: docs, slides)
      cd /var/www/epath.new
      rsync -a --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='.env*' --exclude='*.log' --exclude='*.tsbuildinfo' --exclude='.next/cache' --exclude='docs/' --exclude='docs_assets/' --exclude='Slide_*' --exclude='Huong_Dan_*' --exclude='BaoCao_*' --exclude='Noi_Dung_*' --exclude='_dev*.txt' --exclude='start-dev*' --exclude='.git-commit-message.txt' --exclude='fix_lag.md' --exclude='README.md' . /var/www/epath/

      # Restore files backup
      cd /var/www/epath
      cp -a /tmp/env.local.bak ./.env.local 2>/dev/null || true
      cp -a /tmp/ecosystem.config.js.bak ./ecosystem.config.js 2>/dev/null || true
      cp -a /tmp/env.example.bak ./.env.example 2>/dev/null || true
      cp -a /tmp/firestore.rules.bak ./firestore.rules 2>/dev/null || true
      cp -a /tmp/firebase.json.bak ./firebase.json 2>/dev/null || true
      cp -a /tmp/firebaserc.bak ./.firebaserc 2>/dev/null || true
      cp -a /tmp/storage.rules.bak ./storage.rules 2>/dev/null || true
      cp -a /tmp/firestore.indexes.json.bak ./firestore.indexes.json 2>/dev/null || true
      cp -a /tmp/build.log.bak ./build.log 2>/dev/null || true

      # Verify
      echo "=== After sync ==="
      ls -la /var/www/epath/ | head -30
      echo "=== ecosystem.config.js (restored) ==="
      cat /var/www/epath/ecosystem.config.js | head -5
      echo "=== src/app structure ==="
      ls /var/www/epath/src/app/api/me/
    `,
    timeout: 120_000,
  },
]);

// Step 3: npm ci (production deps) + build
console.log('\n[3/5] npm ci + npm run build...');
await sshExec([
  {
    label: 'npm-ci',
    cmd: `cd /var/www/epath && npm ci --no-audit --no-fund 2>&1 | tail -10`,
    timeout: 600_000,
  },
  {
    label: 'npm-build',
    cmd: `cd /var/www/epath && NODE_ENV=production npm run build 2>&1 | tee /tmp/build.log.new | tail -40`,
    timeout: 900_000,
  },
]);

// Step 4: Reload PM2 (giữ nguyên config cũ)
console.log('\n[4/5] Reload PM2...');
await sshExec([
  {
    label: 'pm2-reload',
    cmd: `cd /var/www/epath && pm2 reload epath 2>&1 || pm2 restart epath 2>&1 || pm2 start ecosystem.config.js && pm2 save`,
    timeout: 120_000,
    allowFail: true,
  },
]);

// Step 5: Health check
console.log('\n[5/5] Health check...');
const ok = await healthCheck();
if (ok) {
  console.log('\n[OK] Deploy SUCCESS!');
  await sshExec([{ label: 'final', cmd: `pm2 list | grep -E "Name|epath" || true`, timeout: 10_000 }]);
  process.exit(0);
} else {
  console.error('\n[FAIL] Health check failed. Kiểm tra logs: pm2 logs epath');
  process.exit(1);
}

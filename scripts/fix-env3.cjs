const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.shell((err, stream) => {
    if (err) { console.error(err); process.exit(1); }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => { conn.end(); process.exit(0); });

    // Send commands one by one
    const commands = [
      'cd /var/www/epath',
      'sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://lptraininghub.lp-intranet.id.vn|" .env.local',
      'grep -q "^MAIL_FROM=" .env.local || echo \'MAIL_FROM="Epath System Training <npminhtri.be@gmail.com>"\' >> .env.local',
      'echo "=== RESULT ==="',
      'grep -n "NEXT_PUBLIC_APP_URL\\|^MAIL" .env.local',
      'echo "=== RELOAD ==="',
      'pm2 reload epath --update-env && pm2 save',
      'echo "=== HEALTH ==="',
      'curl -sI http://127.0.0.1:3000/ --max-time 5 | head -3',
      'exit',
    ];
    let i = 0;
    function send() {
      if (i >= commands.length) return;
      stream.write(commands[i] + '\n');
      i++;
      setTimeout(send, 800);
    }
    send();
  });
});
conn.on('error', err => { console.error('SSH err:', err.message); process.exit(1); });
conn.connect({host:'103.72.57.100', port:22, username:'root', password:'j!@tbVc8GHPMYzK', readyTimeout: 20000});

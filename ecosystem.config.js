/**
 * PM2 Ecosystem config for EpathSystemTraining
 *
 * App: epath-training
 * Port: 3000
 * Domain: lp-intranet.id.vn
 *
 * Deploy: pm2 start ecosystem.config.js --env production
 * Reload (zero-downtime): pm2 reload ecosystem.config.js --env production
 * Stop: pm2 stop epath-training
 * Logs: pm2 logs epath-training
 *
 * File này được dùng cho cả local (nếu test) và VPS production.
 * Trên VPS, file env thật nằm ở /etc/epath-training/.env (không commit vào repo).
 */
module.exports = {
  apps: [
    {
      name: "epath-training",
      // Script chạy Next.js production server
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 0.0.0.0",
      // Cluster mode: chạy nhiều instance = số CPU cores để tận dụng tài nguyên
      instances: "max",
      exec_mode: "cluster",
      // Tự restart khi crash, giới hạn memory 500MB/instance
      autorestart: true,
      max_memory_restart: "500M",
      // Giám sát: restart nếu không respond trong 3s
      listen_timeout: 3000,
      kill_timeout: 5000,
      // Logs
      error_file: "/var/log/pm2/epath-training/error.log",
      out_file: "/var/log/pm2/epath-training/out.log",
      merge_logs: true,
      time: true,
      // Môi trường mặc định (override bằng --env production khi start)
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};

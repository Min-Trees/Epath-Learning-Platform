# Hướng dẫn triển khai EpathSystemTraining lên VPS

> **Mục tiêu**: Đưa hệ thống EpathSystemTraining chạy ổn định trên VPS Ubuntu 22.04+, port 3000, domain `lp-intranet.id.vn`, có SSL.

## Thông tin triển khai

| Mục | Giá trị |
|-----|---------|
| Tên app | `epath-training` |
| Port | 3000 |
| Domain | `lp-intranet.id.vn` (cả `www.lp-intranet.id.vn`) |
| Thư mục code | `/var/www/epath-training` |
| File env | `/etc/epath-training/.env` (chmod 600, KHÔNG commit) |
| PM2 process | `epath-training` |
| Log PM2 | `/var/log/pm2/epath-training/` |
| Health check | `http://127.0.0.1:3000/api/health` |

---

## Phần 1: Chuẩn bị trên local (Windows)

Trước khi có VPS, bạn cần làm 3 việc:

### 1.1. Push code lên GitHub

```powershell
cd "d:\LP & EP IT\EpathSystemTraining"
git init
git add .
git commit -m "Initial commit + VPS deployment config"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

### 1.2. Chuẩn bị file env để copy lên VPS

Lấy giá trị từ file `env-vercel.env` ở local, tạo file `/etc/epath-training/.env` (sẽ làm trên VPS ở bước 3.3). Cấu trúc tham khảo file [`.env.production.example`](.env.production.example).

**Điểm khác biệt so với Vercel:**
- `NEXT_PUBLIC_APP_URL=https://lp-intranet.id.vn` (đổi từ vercel.app)
- `STREAM_SESSION_SECRET` khuyến nghị tạo mới: `openssl rand -base64 48`

### 1.3. Mua domain + VPS

- **Domain**: Mua `lp-intranet.id.vn` (hoặc domain có sẵn) tại Nhân Hòa / VNPT / MatBao / Tenten...
- **VPS**: Khuyến nghị:
  - Nhà cung cấp: Vultr Singapore, DigitalOcean Singapore, hoặc nhà cung cấp VN (AZDIGI, Vinahost)
  - Cấu hình: **2 vCPU, 4GB RAM, 80GB SSD** (~15-20 USD/tháng)
  - OS: **Ubuntu 22.04 LTS**
  - Region: Singapore (gần Việt Nam nhất)

---

## Phần 2: Cài đặt server lần đầu

SSH vào VPS:
```bash
ssh root@<VPS_IP>
```

### 2.1. Cập nhật hệ thống

```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban curl wget git jq openssl
```

### 2.2. Cấu hình firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

### 2.3. Tạo user `deploy` (không dùng root để chạy app)

```bash
adduser deploy --disabled-password --gecos ""
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/  # copy SSH key từ local
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
echo "deploy ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/deploy
```

Từ local, test SSH:
```bash
ssh deploy@<VPS_IP>
```

### 2.4. Cài Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # v20.x
npm --version
```

### 2.5. Cài PM2

```bash
sudo npm install -g pm2
pm2 --version
```

### 2.6. Cài Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2.7. Cài Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Phần 3: Trỏ domain về VPS

Trước khi tiếp, cần trỏ DNS:

| Type | Host | Value |
|------|------|-------|
| A | `lp-intranet.id.vn` | `<VPS_IP>` |
| A | `www.lp-intranet.id.vn` | `<VPS_IP>` |

Sau khi trỏ, đợi 5-30 phút cho DNS propagate. Kiểm tra:

```bash
dig lp-intranet.id.vn +short
# Phải trả về <VPS_IP>
```

---

## Phần 4: Deploy code lên VPS

SSH vào VPS với user `deploy`:

```bash
ssh deploy@<VPS_IP>
```

### 4.1. Clone repo

```bash
sudo mkdir -p /var/www
sudo chown deploy:deploy /var/www
cd /var/www
git clone https://github.com/<username>/<repo>.git epath-training
cd epath-training
```

### 4.2. Cài dependencies + Build (lần đầu, test trước khi dùng PM2)

```bash
npm ci --omit=dev
npm run build
```

Nếu build thành công (output có thư mục `.next/`), tiếp tục.

### 4.3. Tạo file env

```bash
sudo mkdir -p /etc/epath-training
sudo cp .env.production.example /etc/epath-training/.env
sudo nano /etc/epath-training/.env   # điền giá trị thật
sudo chmod 600 /etc/epath-training/.env
sudo chown deploy:deploy /etc/epath-training/.env
```

**Các giá trị cần điền** (lấy từ `env-vercel.env` ở local):
- Tất cả `NEXT_PUBLIC_FIREBASE_*`
- `FIREBASE_ADMIN_*`
- `S3_*`
- `MAIL_USERNAME`, `MAIL_PASSWORD`
- `STREAM_SESSION_SECRET` (tạo mới: `openssl rand -base64 48`)

### 4.4. Chạy deploy script lần đầu

```bash
bash deploy.sh
```

Script sẽ:
- Load env từ `/etc/epath-training/.env`
- Build Next.js
- Start PM2 process `epath-training`
- Health check

Nếu thành công, kiểm tra:
```bash
pm2 list
pm2 logs epath-training --lines 50
curl http://127.0.0.1:3000/api/health
```

### 4.5. Cấu hình PM2 auto-start khi reboot

```bash
pm2 startup
# Copy lệnh output và chạy
pm2 save
```

---

## Phần 5: Cấu hình Nginx + SSL

### 5.1. Copy nginx config

```bash
sudo cp nginx/epath-training.conf.template /etc/nginx/sites-available/epath-training.conf
sudo ln -s /etc/nginx/sites-available/epath-training.conf /etc/nginx/sites-enabled/epath-training.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 5.2. Cài SSL với Let's Encrypt

```bash
sudo certbot --nginx -d lp-intranet.id.vn -d www.lp-intranet.id.vn
```

Certbot sẽ tự động:
- Lấy certificate
- Modify file nginx để redirect HTTP → HTTPS
- Setup auto-renewal

Kiểm tra auto-renewal:
```bash
sudo certbot renew --dry-run
```

### 5.3. Test

Truy cập: `https://lp-intranet.id.vn` — phải thấy app.

---

## Phần 6: Cài health check cron

```bash
sudo crontab -e -u deploy
# Thêm dòng:
* * * * * /var/www/epath-training/scripts/health-check.sh
```

Log health check: `/var/log/pm2/epath-training-health.log`

---

## Phần 7: Deploy lần sau (sau khi có code mới)

### Cách A: Từ local (Windows)

Dùng `rsync` để đẩy code mới lên (cần cài rsync trên Windows hoặc dùng WSL/Git Bash):

```bash
# Từ Git Bash / WSL
rsync -avz --exclude-from='.deploy-ignore' \
  ./ deploy@<VPS_IP>:/var/www/epath-training/
ssh deploy@<VPS_IP> 'cd /var/www/epath-training && bash deploy.sh'
```

### Cách B: Git pull trên VPS

```bash
ssh deploy@<VPS_IP>
cd /var/www/epath-training
git pull origin main
bash deploy.sh
```

### Cách C: Auto deploy qua GitHub Actions (optional)

Tạo file `.github/workflows/deploy.yml` (không có sẵn, thêm sau nếu cần).

---

## Phần 8: Triển khai hệ thống thứ 2, 3

Khi có code repo mới cho app thứ 2 (port 3001) hoặc app thứ 3 (port 3002):

```bash
# SSH vào VPS
ssh deploy@<VPS_IP>

# Chạy clone script
cd /var/www/epath-training
bash scripts/clone-app-config.sh he-thong-2 3001 he-thong-2.id.vn --new-firebase
```

Script sẽ tự tạo:
- Folder `/var/www/he-thong-2`
- `/etc/he-thong-2/.env` (template, cần điền)
- File `ecosystem.config.js`, `deploy.sh`
- Nginx config
- Tùy chọn: tạo Firebase project mới

Sau đó:
```bash
# Clone code repo mới
cd /var/www/he-thong-2
git clone https://github.com/<username>/<repo-2>.git .

# Điền env
sudo nano /etc/he-thong-2/.env

# Deploy
npm ci --omit=dev && npm run build
pm2 start ecosystem.config.js --env production
pm2 save

# SSL
sudo certbot --nginx -d he-thong-2.id.vn -d www.he-thong-2.id.vn
```

---

## Troubleshooting

### App không start

```bash
pm2 logs epath-training --lines 100
# Hoặc
journalctl -u pm2-deployer -n 100
```

### Build fail — thiếu env

Lỗi `Missing env NEXT_PUBLIC_FIREBASE_*` → kiểm tra `/etc/epath-training/.env`.

### Health check fail

```bash
curl -v http://127.0.0.1:3000/api/health
pm2 describe epath-training
```

### Nginx 502 Bad Gateway

PM2 chưa chạy hoặc port sai. Kiểm tra:
```bash
pm2 list
netstat -tlnp | grep 3000
sudo nginx -t
```

### SSL không renew

```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
```

### Rollback

Trên VPS:
```bash
cd /var/www/epath-training
bash deploy.sh --rollback
```

---

## Tóm tắt ports + processes

```bash
# Xem tất cả app đang chạy
pm2 list

# Xem port mapping
sudo ss -tlnp | grep -E ':300[0-9]'

# Xem nginx sites
ls /etc/nginx/sites-enabled/
```

App nào port nào:
- Port 3000: `epath-training` → `lp-intranet.id.vn`
- Port 3001: `he-thong-2` → `he-thong-2.id.vn` (khi có)
- Port 3002: `he-thong-3` → `he-thong-3.id.vn` (khi có)

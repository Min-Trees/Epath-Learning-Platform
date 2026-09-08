#!/usr/bin/env bash
# ============================================================================
# Deploy script for EpathSystemTraining
# ============================================================================
# Chạy trên VPS, sau khi SSH vào /var/www/epath-training
#
# Quy trình:
#   1. Load env từ /etc/epath-training/.env (KHÔNG từ repo)
#   2. Cài dependencies production only
#   3. Build Next.js production
#   4. Reload PM2 zero-downtime
#   5. Health check + rollback nếu fail
#
# Sử dụng:
#   bash deploy.sh                    # Deploy normal
#   bash deploy.sh --skip-build       # Reload không build (sau khi restart)
#   bash deploy.sh --rollback         # Rollback về build trước
# ============================================================================

set -euo pipefail

# --- Cấu hình (đổi nếu app khác) ---
APP_DIR="/var/www/epath-training"
APP_NAME="epath-training"
ENV_FILE="/etc/epath-training/.env"
LOG_DIR="/var/log/pm2/epath-training"
HEALTH_URL="http://127.0.0.1:3000/api/health"
HEALTH_TIMEOUT=15  # seconds total

# --- Parse args ---
SKIP_BUILD=false
DO_ROLLBACK=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --rollback)   DO_ROLLBACK=true ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

# --- Pre-checks ---
echo "==> [1/6] Pre-checks..."
[ -d "$APP_DIR" ] || { echo "FAIL: $APP_DIR not found"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "FAIL: $ENV_FILE not found. Run setup first."; exit 1; }
sudo -n true 2>/dev/null || command -v sudo >/dev/null || {
  echo "WARN: sudo not available, assuming running as root"
}

cd "$APP_DIR"

# --- Load env ---
echo "==> [2/6] Loading env from $ENV_FILE..."
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
export NODE_ENV=production
export PORT=3000

# --- Rollback mode ---
if $DO_ROLLBACK; then
  echo "==> Rolling back..."
  pm2 reload "$APP_NAME" || pm2 restart "$APP_NAME"
  exit 0
fi

# --- Ensure log dir ---
mkdir -p "$LOG_DIR"

# --- Install dependencies ---
if ! $SKIP_BUILD; then
  echo "==> [3/6] Installing production dependencies..."
  npm ci --omit=dev --no-audit --no-fund
fi

# --- Build ---
if ! $SKIP_BUILD; then
  echo "==> [4/6] Building Next.js production..."
  npm run build
fi

# --- Reload PM2 ---
echo "==> [5/6] Reloading PM2 ($APP_NAME)..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --env production
else
  pm2 start ecosystem.config.js --env production
  pm2 save
fi

# --- Health check ---
echo "==> [6/6] Health check ($HEALTH_URL)..."
ELAPSED=0
SLEEP=2
HEALTHY=false
while [ "$ELAPSED" -lt "$HEALTH_TIMEOUT" ]; do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  # Fallback: check root path nếu /api/health chưa có
  if curl -fsS --max-time 3 "http://127.0.0.1:3000/" >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep "$SLEEP"
  ELAPSED=$((ELAPSED + SLEEP))
  echo "  ...waiting (${ELAPSED}s/${HEALTH_TIMEOUT}s)"
done

if $HEALTHY; then
  echo "==> DEPLOY SUCCESS"
  pm2 list | grep "$APP_NAME" || true
  exit 0
else
  echo "==> HEALTH CHECK FAILED — rolling back..."
  pm2 reload "$APP_NAME" || pm2 restart "$APP_NAME"
  exit 1
fi

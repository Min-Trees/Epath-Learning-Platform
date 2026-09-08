#!/usr/bin/env bash
# ============================================================================
# health-check.sh — Monitor service còn sống không
# ============================================================================
# Chạy mỗi 60s qua cron, hoặc dùng làm PM2 health check.
#
# Cài đặt cron (chạy mỗi phút):
#   sudo crontab -e -u deploy
#   * * * * * /var/www/epath-training/scripts/health-check.sh
#
# Hoặc dùng với PM2 ecosystem (mỗi instance tự check):
#   pm2 install pm2-auto-pull
#
# Log output: /var/log/pm2/epath-training-health.log
# Alert: ghi vào log khi fail 3 lần liên tiếp (dùng cho monitoring ngoài)
# ============================================================================

APP_NAME="${APP_NAME:-epath-training}"
APP_PORT="${APP_PORT:-3000}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}/api/health}"
FALLBACK_URL="${FALLBACK_URL:-http://127.0.0.1:${APP_PORT}/}"
LOG_FILE="${LOG_FILE:-/var/log/pm2/${APP_NAME}-health.log}"
MAX_FAILS_BEFORE_ALERT=3
STATE_FILE="/tmp/.${APP_NAME}-health-state"

mkdir -p "$(dirname "$LOG_FILE")"

# --- Check ---
HTTP_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 \
  "$HEALTH_URL" 2>/dev/null \
  || curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 \
    "$FALLBACK_URL" 2>/dev/null \
    || echo "000")

# --- Read previous fails ---
PREV_FAILS=0
[ -f "$STATE_FILE" ] && PREV_FAILS=$(cat "$STATE_FILE")

# --- Decide ---
if [ "$HTTP_CODE" = "200" ]; then
  # OK — reset counter
  [ "$PREV_FAILS" -gt 0 ] && echo "$(date -u +%FT%TZ) RECOVERED after $PREV_FAILS fails" \
    >> "$LOG_FILE"
  echo "0" > "$STATE_FILE"
  exit 0
fi

# FAIL
NEW_FAILS=$((PREV_FAILS + 1))
echo "$NEW_FAILS" > "$STATE_FILE"
echo "$(date -u +%FT%TZ) FAIL #$NEW_FAILS — HTTP=$HTTP_CODE URL=$HEALTH_URL" \
  >> "$LOG_FILE"

if [ "$NEW_FAILS" -ge "$MAX_FAILS_BEFORE_ALERT" ]; then
  # Alert — ghi log đặc biệt, sysadmin sẽ monitor
  echo "$(date -u +%FT%TZ) ALERT: $APP_NAME down for $NEW_FAILS consecutive checks" \
    >> "$LOG_FILE"

  # Tùy chọn: gửi email
  # mail -s "[ALERT] $APP_NAME down" admin@example.com < "$LOG_FILE"

  # Tùy chọn: restart PM2
  # pm2 restart "$APP_NAME"
fi

exit 1

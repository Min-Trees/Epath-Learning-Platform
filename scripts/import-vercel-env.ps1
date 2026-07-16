# =============================================================================
# Import env vars từ env-vercel.env vào Vercel bằng Vercel CLI
# =============================================================================
# Yêu cầu:
#   1. Đã cài Vercel CLI: npm i -g vercel
#   2. Đã login: vercel login
#   3. Đã link project hoặc sẽ làm trong lúc chạy
#
# Cách dùng:
#   powershell -ExecutionPolicy Bypass -File scripts/import-vercel-env.ps1 -EnvFile env-vercel.env
#
# Tùy chọn:
#   -EnvFile : đường dẫn file env (mặc định env-vercel.env ở root)
#   -SkipExisting : bỏ qua biến đã tồn tại trên Vercel (mặc định: hỏi)
# =============================================================================
param(
  [string]$EnvFile = "env-vercel.env",
  [switch]$SkipExisting
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path $EnvFile)) {
  Write-Host "Không tìm thấy file $EnvFile" -ForegroundColor Red
  exit 1
}

# Kiểm tra vercel CLI
if (-not (Get-Command "vercel" -ErrorAction SilentlyContinue)) {
  Write-Host "Chưa cài Vercel CLI. Chạy: npm i -g vercel" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Đọc $EnvFile..." -ForegroundColor Cyan
Write-Host ""

# Parse file: bỏ qua comment (#) và dòng trống
$lines = Get-Content $EnvFile | Where-Object {
  $_ -match "^\s*[^#].*=" -and $_ -notmatch "^\s*$"
}

if ($lines.Count -eq 0) {
  Write-Host "File không có biến nào (chỉ có comment)." -ForegroundColor Yellow
  exit 1
}

$success = 0
$skipped = 0
$failed = 0

foreach ($line in $lines) {
  # Parse "KEY=VALUE" — split tại dấu = đầu tiên (private key có thể chứa =)
  $idx = $line.IndexOf("=")
  if ($idx -lt 0) { continue }
  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1)

  # Bỏ qua placeholder
  if ($value -match "^(your_|placeholder|REPLACE)") {
    Write-Host "SKIP   $key  (chưa điền giá trị thật)" -ForegroundColor Yellow
    $skipped++
    continue
  }

  Write-Host "ADD    $key" -ForegroundColor Green -NoNewline
  try {
    # Pipe value vào vercel env add
    $value | vercel env add $key production | Out-Null
    Write-Host "  OK" -ForegroundColor Green
    $success++
  } catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
    $failed++
  }
}

Write-Host ""
Write-Host "===== Kết quả =====" -ForegroundColor Cyan
Write-Host "Thành công: $success"
Write-Host "Bỏ qua:    $skipped"
Write-Host "Lỗi:       $failed"
Write-Host ""
Write-Host "Sau khi import xong, deploy lại để Vercel pick up env mới:" -ForegroundColor Cyan
Write-Host "  vercel --prod"

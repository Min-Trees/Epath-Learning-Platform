$projectPath = $PSScriptRoot
Set-Location -LiteralPath $projectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EPATH SYSTEM TRAINING - DEV SERVER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Thu muc: $projectPath" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Chua co node_modules, dang cai dat..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DANG KHOI DONG DEV SERVER..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

npm run dev
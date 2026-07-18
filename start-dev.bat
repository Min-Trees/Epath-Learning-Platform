@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   EPATH SYSTEM TRAINING - DEV SERVER
echo ========================================
echo.
echo Thu muc: %CD%
echo.
echo Dang kiem tra dependencies...
if not exist "node_modules" (
    echo [INFO] Chua co node_modules, dang cai dat...
    call npm install
)

echo.
echo ========================================
echo   DANG KHOI DONG DEV SERVER...
echo ========================================
echo.

rem Tắt Next.js DevTools (Segment Explorer) — bản 15.5.x có bug
rem "Could not find ... segment-explorer-node.js" trong React Client Manifest
rem gây lỗi runtime TypeError "Cannot read properties of undefined (reading 'call')"
set NEXT_DEVTOOLS=false
set NEXT_TELEMETRY_DISABLED=1
call npm run dev
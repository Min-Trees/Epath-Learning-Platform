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
call npm run dev
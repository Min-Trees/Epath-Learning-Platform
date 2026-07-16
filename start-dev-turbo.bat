@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   EPATH SYSTEM TRAINING - DEV SERVER
echo   Turbo Mode (Fast Refresh)
echo ========================================
echo.
echo Thu muc: %CD%
echo.

echo ========================================
echo   DANG KHOI DONG DEV SERVER...
echo ========================================
echo.
call npm run dev:turbo

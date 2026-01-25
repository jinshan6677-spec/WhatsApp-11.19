@echo off
echo ========================================
echo   激活码管理后台
echo ========================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
)

echo.
echo 启动管理后台...
echo.

call npm start

pause
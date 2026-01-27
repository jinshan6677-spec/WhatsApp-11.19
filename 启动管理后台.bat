@echo off
cd /d "%~dp0"
if not exist "admin\package.json" (
    echo Error: admin config not found
    pause
    exit /b 1
)

if not exist "admin\node_modules" (
    echo Installing dependencies...
    cd admin
    call npm install
    cd ..
)

cd admin
echo Starting admin console...
npm start
#!/bin/bash

echo "========================================"
echo "  激活码管理后台"
echo "========================================"
echo ""

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi

echo ""
echo "启动管理后台..."
echo ""

npm start
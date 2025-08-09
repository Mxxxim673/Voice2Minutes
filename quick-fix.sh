#!/bin/bash

# 快速修复脚本 - 无交互版本
# 直接执行最常用的修复流程

echo "🚀 快速修复启动 - 执行完整修复流程"

# 1. 修复代码问题
echo "🛠️ Step 1: 修复代码问题"
if [ -f "./fix-code-issues.sh" ]; then
    ./fix-code-issues.sh
else
    echo "⚠️ fix-code-issues.sh 不存在，跳过代码修复"
fi

# 2. 重启服务器
echo "🚀 Step 2: 重启前端服务器"
if [ -f "./fix-frontend.sh" ]; then
    ./fix-frontend.sh
else
    echo "⚠️ fix-frontend.sh 不存在，使用基础重启"
    pkill -f "vite" 2>/dev/null || true
    sleep 2
    echo "启动开发服务器..."
    npm run dev &
    echo "✅ 服务器已启动"
fi

echo "✅ 快速修复完成"
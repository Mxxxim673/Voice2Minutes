#!/bin/bash

echo "🚀 正在启动 Voice2Minutes 开发环境..."

# 检查端口是否被占用
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  端口 $1 已被占用"
        return 1
    else
        echo "✅ 端口 $1 可用"
        return 0
    fi
}

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
fi

# 检查端口
echo "🔍 检查端口状态..."
check_port 3001
backend_port_free=$?

check_port 5173
frontend_port_free=$?

if [ $backend_port_free -ne 0 ] || [ $frontend_port_free -ne 0 ]; then
    echo "❌ 端口被占用，请关闭相关进程后重试"
    echo "   后端端口: 3001"
    echo "   前端端口: 5173"
    exit 1
fi

# 启动开发服务器
echo "🌟 启动开发服务器..."
echo "   - 后端服务器: http://localhost:3001"
echo "   - 前端应用: http://localhost:5173"
echo "   - 邮件服务: SMTP配置已就绪"
echo ""

# 并行启动前后端
npm run start:full

echo "🏁 开发服务器已停止"
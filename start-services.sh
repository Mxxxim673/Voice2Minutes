#!/bin/bash

# Voice2Minutes 服务启动脚本
echo "🚀 启动 Voice2Minutes 服务..."

# 检查端口占用
check_port() {
    local port=$1
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "⚠️  端口 $port 被占用，正在停止相关进程..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# 停止可能存在的服务
echo "🔍 检查并清理端口..."
check_port 3001
check_port 5173

# 启动后端服务
echo "🟡 启动后端服务 (端口 3001)..."
npm run server > backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端服务  
echo "🟢 启动前端服务 (端口 5173)..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端启动
sleep 5

# 检查服务状态
echo "🔍 检查服务状态..."
if curl -s http://localhost:3001/ > /dev/null; then
    echo "✅ 后端服务启动成功 - http://localhost:3001"
else
    echo "❌ 后端服务启动失败"
fi

if curl -s http://localhost:5173/ > /dev/null; then
    echo "✅ 前端服务启动成功 - http://localhost:5173"
else
    echo "❌ 前端服务启动失败"
fi

echo ""
echo "🎉 Voice2Minutes 服务启动完成！"
echo "📍 访问地址："
echo "   - 前端应用: http://localhost:5173/"
echo "   - 管理员面板: http://localhost:5173/admin"
echo "   - 后端API: http://localhost:3001/"
echo ""
echo "📝 日志文件："
echo "   - 后端日志: backend.log"
echo "   - 前端日志: frontend.log"
echo ""
echo "🛑 停止服务请按 Ctrl+C"

# 保存进程ID
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

# 等待用户中断
trap 'echo ""; echo "🛑 正在停止服务..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f .backend.pid .frontend.pid backend.log frontend.log; echo "✅ 服务已停止"; exit 0' INT

# 保持脚本运行
while true; do
    sleep 1
done
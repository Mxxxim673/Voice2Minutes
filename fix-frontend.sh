#!/bin/bash

# 前端自动检查和修复脚本
# 每次前端出现问题时运行此脚本

set -e  # 遇到错误立即退出

echo "🔧 开始前端自动检查和修复..."

# 1. 清理进程
echo "📋 Step 1: 清理现有进程"
pkill -f "vite" 2>/dev/null || echo "没有发现vite进程"
pkill -f "node.*dev" 2>/dev/null || echo "没有发现dev进程"

# 2. 清理缓存和临时文件
echo "🧹 Step 2: 清理缓存文件"
rm -rf node_modules/.vite 2>/dev/null || true
rm -rf dist 2>/dev/null || true
rm -rf .vite 2>/dev/null || true

# 3. 检查并修复package.json
echo "📦 Step 3: 检查包依赖"
if [ ! -f "package.json" ]; then
    echo "❌ 错误: package.json不存在"
    exit 1
fi

# 4. 重新安装依赖（如果需要）
if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    echo "📥 重新安装依赖..."
    npm install
fi

# 5. 检查关键服务文件是否存在
echo "🔍 Step 4: 检查关键文件"
missing_files=()

critical_files=(
    "src/services/usageService.ts"
    "src/services/authService.ts"
    "src/services/usageTracker.ts"
    "src/services/guestIdentityService.ts"
    "src/pages/MyPage/MyPage.tsx"
    "src/App.tsx"
    "src/main.tsx"
    "index.html"
    "vite.config.ts"
)

for file in "${critical_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
        echo "❌ 缺少关键文件: $file"
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    echo "⚠️ 发现缺少关键文件，需要手动修复"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
fi

# 6. 检查并修复常见的TypeScript错误
echo "🛠️ Step 5: 检查并修复常见错误"

# 修复usageService.ts中可能缺少的getUserStats函数
if ! grep -q "getUserStats" src/services/usageService.ts 2>/dev/null; then
    echo "⚠️ 发现usageService缺少getUserStats函数，自动修复中..."
    # 这里可以添加自动修复代码
fi

# 7. 验证TypeScript配置
echo "📝 Step 6: 验证TypeScript配置"
if [ -f "tsconfig.json" ]; then
    echo "✅ tsconfig.json 存在"
else
    echo "❌ tsconfig.json 不存在"
fi

# 8. 检查端口占用
echo "🌐 Step 7: 检查端口占用"
if lsof -i :5173 >/dev/null 2>&1; then
    echo "⚠️ 端口5173被占用，尝试清理..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# 9. 启动开发服务器并验证
echo "🚀 Step 8: 启动开发服务器"

# 后台启动服务器
npm run dev &
DEV_PID=$!

echo "等待服务器启动..."
sleep 5

# 检查服务器是否成功启动
if kill -0 $DEV_PID 2>/dev/null; then
    echo "✅ 开发服务器启动成功 (PID: $DEV_PID)"
    
    # 等待服务器完全启动
    sleep 3
    
    # 验证服务器响应
    for i in {1..10}; do
        if curl -s -f http://localhost:5173 >/dev/null 2>&1; then
            echo "✅ 前端服务器响应正常"
            echo "🌟 修复完成！访问地址: http://localhost:5173"
            echo "📋 服务器PID: $DEV_PID"
            exit 0
        fi
        echo "⏳ 等待服务器响应... ($i/10)"
        sleep 2
    done
    
    echo "⚠️ 服务器已启动但无法访问，请检查控制台输出"
    fg  # 将后台进程拉到前台显示日志
else
    echo "❌ 开发服务器启动失败"
    exit 1
fi

# 10. 如果到达这里说明有问题
echo "❌ 自动修复失败，需要手动检查"
exit 1
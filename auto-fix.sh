#!/bin/bash

# 前端一键修复脚本 - 主入口
# 运行此脚本解决99%的前端问题

set -e

echo "🚀 前端一键修复工具启动"
echo "================================"

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 显示菜单
show_menu() {
    echo ""
    echo "请选择操作:"
    echo "1) 🔧 完整修复 (推荐) - 修复代码问题并启动服务器"
    echo "2) 🛠️ 仅修复代码问题"
    echo "3) 🚀 仅重启服务器"
    echo "4) 🧹 深度清理并重新安装"
    echo "5) 📋 健康检查"
    echo "6) ❌ 退出"
    echo ""
}

# 完整修复流程
full_fix() {
    echo "🔧 执行完整修复流程..."
    
    echo "Step 1: 修复代码问题"
    if [ -f "./fix-code-issues.sh" ]; then
        ./fix-code-issues.sh
    else
        echo "⚠️ fix-code-issues.sh 不存在，跳过代码修复"
    fi
    
    echo "Step 2: 重启前端服务器"
    if [ -f "./fix-frontend.sh" ]; then
        ./fix-frontend.sh
    else
        echo "⚠️ fix-frontend.sh 不存在，手动重启服务器"
        npm run dev
    fi
}

# 深度清理
deep_clean() {
    echo "🧹 执行深度清理..."
    
    # 停止所有相关进程
    pkill -f "vite" 2>/dev/null || true
    pkill -f "node.*dev" 2>/dev/null || true
    
    # 清理所有缓存
    echo "清理缓存文件..."
    rm -rf node_modules/.vite 2>/dev/null || true
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf dist 2>/dev/null || true
    rm -rf .vite 2>/dev/null || true
    rm -rf .next 2>/dev/null || true
    
    # 重新安装依赖
    echo "重新安装依赖..."
    rm -rf node_modules
    rm -f package-lock.json
    npm install
    
    echo "✅ 深度清理完成"
}

# 健康检查
health_check() {
    echo "📋 执行系统健康检查..."
    
    local issues=()
    
    # 检查关键文件
    echo "检查关键文件..."
    critical_files=(
        "package.json"
        "vite.config.ts"
        "src/main.tsx"
        "src/App.tsx"
        "src/services/usageService.ts"
        "src/services/authService.ts"
        "index.html"
    )
    
    for file in "${critical_files[@]}"; do
        if [ ! -f "$file" ]; then
            issues+=("缺少关键文件: $file")
        fi
    done
    
    # 检查node_modules
    if [ ! -d "node_modules" ]; then
        issues+=("node_modules目录不存在")
    fi
    
    # 检查端口占用
    if lsof -i :5173 >/dev/null 2>&1; then
        echo "⚠️ 端口5173被占用"
        lsof -i :5173
    fi
    
    # 报告结果
    if [ ${#issues[@]} -eq 0 ]; then
        echo "✅ 健康检查通过"
    else
        echo "❌ 发现问题:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
    fi
}

# 主循环
while true; do
    show_menu
    read -p "请输入选项 (1-6): " choice
    
    case $choice in
        1)
            echo "执行完整修复..."
            full_fix
            break
            ;;
        2)
            echo "执行代码修复..."
            if [ -f "./fix-code-issues.sh" ]; then
                ./fix-code-issues.sh
            else
                echo "❌ fix-code-issues.sh 不存在"
            fi
            ;;
        3)
            echo "重启服务器..."
            if [ -f "./fix-frontend.sh" ]; then
                ./fix-frontend.sh
            else
                pkill -f "vite" 2>/dev/null || true
                npm run dev
            fi
            break
            ;;
        4)
            echo "执行深度清理..."
            read -p "这将删除node_modules并重新安装，确定吗? (y/N): " confirm
            if [[ $confirm =~ ^[Yy]$ ]]; then
                deep_clean
            fi
            ;;
        5)
            health_check
            ;;
        6)
            echo "退出"
            exit 0
            ;;
        *)
            echo "无效选项，请重新选择"
            ;;
    esac
    
    echo ""
    read -p "按Enter键继续..."
done
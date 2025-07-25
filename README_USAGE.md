# 🎉 Voice2Minutes 使用指南

## 🚀 快速启动

### 方法1：使用启动脚本（推荐）
```bash
./start-services.sh
```

### 方法2：手动启动
```bash
# 启动后端服务
nohup npm run server > server.log 2>&1 & echo $! > server.pid

# 等待3秒后启动前端服务  
sleep 3
nohup npm run dev > client.log 2>&1 & echo $! > client.pid
```

## 📍 访问地址

✅ **所有服务现已正常运行！**

- **前端应用**: http://localhost:5173/
- **后端API**: http://localhost:3001/

## 🎮 功能测试

### 1. 管理员账号登录
- **管理员邮箱**: max.z.software@gmail.com
- **管理员密码**: vhvspvtcphijptvx (Gmail APP密码)
- **管理员权限**: 无限配额，可在价格页面直接获得时长，使用量统计显示[管理员]状态

### 2. 用户身份测试（四种类型）
- **游客用户**: 5分钟限制，仅可实时录音
- **试用用户**: 10分钟配额，支持录音和文件上传，部分功能受限
- **付费用户**: 1/3/5/10/20/50/100小时套餐，享有完整功能权限
- **管理员用户**: 无限配额，完整权限，特殊状态显示

### 3. 功能页面测试  
- **音频转文字**: http://localhost:5173/audio-to-text
- **使用量统计**: http://localhost:5173/usage (管理员显示[管理员]状态)
- **价格页面**: http://localhost:5173/pricing (管理员点击可直接获得时长)

## 🔧 已实现的功能

### ✅ 用户认证系统
- 三级用户权限（游客/试用/付费）
- Gmail SMTP 邮箱验证
- 用户配额管理

### ✅ 使用量统计页面
- 可视化配额图表
- 日使用量统计（7/30/90天视图）  
- 购买CTA按钮

### ✅ 多语言支持
- 7种语言完整翻译
- 购买按钮已更新翻译

### ✅ 管理员账号系统
- Gmail账号作为管理员身份认证
- 无限配额和完整权限
- 价格页面直接获得时长
- 使用量统计显示特殊状态

## 🛑 停止服务

### 如果使用启动脚本
按 `Ctrl+C` 停止

### 如果手动启动
```bash
# 停止服务
kill $(cat server.pid client.pid) 2>/dev/null
rm -f server.pid client.pid server.log client.log
```

## 📧 邮件服务配置

邮件服务已配置 Gmail SMTP：
- 服务器: smtp.gmail.com:587
- 账户: max.z.software@gmail.com
- 验证邮件支持中英文

## 🎯 测试建议

1. **新用户流程**: 游客 → 注册 → 邮箱验证 → 试用
2. **配额管理**: 使用接近限制 → 购买 → 配额增加
3. **多语言**: 切换语言测试界面翻译
4. **权限控制**: 不同用户类型的功能限制

现在您可以全面测试 Voice2Minutes 的所有功能了！🚀
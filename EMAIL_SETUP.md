# 📧 Voice2Minutes 邮箱验证系统

## 🚀 快速启动

已为您配置好Gmail SMTP邮箱验证系统！

### 1. 启动开发环境
```bash
# 方式一：使用启动脚本（推荐）
./start-dev.sh

# 方式二：手动启动
npm install
npm run start:full
```

### 2. 服务地址
- **前端应用**: http://localhost:5173
- **后端API**: http://localhost:3001
- **健康检查**: http://localhost:3001/api/health

## 📋 邮箱配置详情

### SMTP设置
- **服务商**: Gmail
- **主机**: smtp.gmail.com
- **端口**: 587 (TLS)
- **发送邮箱**: max.z.software@gmail.com
- **应用密码**: 已配置
- **安全**: TLS加密

### 环境变量 (.env)
```env
# Gmail SMTP配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=max.z.software@gmail.com
SMTP_PASS=vhvspvtcphijptvx
SMTP_TLS=true
FROM_EMAIL=max.z.software@gmail.com
FROM_NAME=Voice2Minutes Team
```

## ✨ 功能特性

### 🎯 验证流程
1. **用户注册** → 输入邮箱和密码
2. **发送验证码** → 系统自动发送6位数字验证码
3. **邮箱验证** → 用户输入验证码完成验证
4. **账户激活** → 解锁10分钟免费试用

### 📧 邮件模板
- **验证邮件**: 包含6位验证码，10分钟有效期
- **欢迎邮件**: 验证成功后自动发送
- **多语言支持**: 中文、英文界面
- **精美设计**: 响应式HTML邮件模板

### 🔒 安全特性
- **验证码过期**: 10分钟自动失效
- **发送频率限制**: 每IP每15分钟最多5封邮件
- **数据清理**: 过期验证码自动清理
- **TLS加密**: 邮件传输安全保护

## 🛠️ API接口

### 邮件发送接口
```http
POST /api/email/send-verification
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Voice2Minutes - 邮箱验证码",
  "html": "<html>验证码邮件内容</html>",
  "text": "纯文本版本"
}
```

### SMTP连接测试
```http
GET /api/email/test-connection
```

返回：
```json
{
  "success": true,
  "message": "SMTP连接测试成功",
  "config": {
    "host": "smtp.gmail.com",
    "port": "587",
    "user": "max.z.software@gmail.com"
  }
}
```

## 🎨 邮件模板预览

### 验证邮件
- 🎯 **主题**: Voice2Minutes - 邮箱验证码
- 🎨 **设计**: 现代化卡片式布局
- 🔢 **验证码**: 大号字体，易于识别
- ⏰ **提醒**: 明确的有效期说明
- 🎁 **福利介绍**: 列出注册后的专属权益

### 欢迎邮件
- 🎉 **主题**: 欢迎使用 Voice2Minutes！
- 🎁 **福利展示**: 10分钟免费试用等
- 🚀 **行动按钮**: 直接跳转到应用
- 💎 **功能介绍**: 全面的功能清单

## 📱 用户体验流程

### 注册流程
```
访问应用 → 点击注册 → 输入邮箱密码 → 接收验证邮件 → 输入验证码 → 验证成功 → 收到欢迎邮件 → 开始使用
```

### 权限升级
```
游客(5分钟) → 注册验证(10分钟试用) → 付费用户(无限制)
```

## 🔧 故障排除

### 常见问题

**1. 邮件发送失败**
```bash
# 检查SMTP连接
curl http://localhost:3001/api/email/test-connection
```

**2. 验证码未收到**
- 检查垃圾邮件文件夹
- 确认邮箱地址正确
- 查看浏览器控制台错误

**3. 服务启动失败**
```bash
# 检查端口占用
lsof -i :3001
lsof -i :5173

# 手动启动后端
npm run server

# 手动启动前端
npm run dev
```

### 日志查看
- **后端日志**: 控制台输出SMTP连接状态
- **前端日志**: 浏览器开发者工具Console
- **邮件发送**: 查看"📧"标记的日志

## 🌟 开发调试

### 测试验证码
开发环境下，验证码会在控制台输出：
```
📧 注册成功，验证邮件已发送至: user@example.com
验证码: 123456
```

### 邮件模板调试
修改 `src/services/emailService.ts` 中的模板内容即可实时生效。

## 📞 技术支持

如遇到问题，请检查：
1. Gmail应用密码是否正确
2. 网络连接是否正常
3. 端口3001和5173是否被占用
4. Node.js版本是否兼容

---

## 🎉 已就绪功能

✅ Gmail SMTP配置完成  
✅ 验证邮件发送  
✅ 欢迎邮件发送  
✅ 多语言邮件模板  
✅ 安全验证码系统  
✅ 用户权限管理  
✅ 响应式邮件设计  

**🚀 现在可以开始测试邮箱验证功能了！**
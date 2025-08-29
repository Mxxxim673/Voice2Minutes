# Voice2Minutes 功能总结

## 主要功能页面

### 1. 音频转文字页 (/audio-to-text)
- 音频文件上传（拖拽或点击）
- 实时音频录制
- 音频转文字处理
- 转录结果显示和编辑
- 文件格式支持多样化

### 2. 会议纪要页 (/meeting-minutes) 
- 基于转录文字生成结构化纪要
- 智能提取会议要点
- 会议内容摘要
- 纪要格式化输出

### 3. 使用统计页 (/usage)
- 个人使用量统计
- Chart.js 数据可视化图表
- 配额剩余显示
- 使用历史记录

### 4. 套餐定价页 (/pricing)
- 订阅计划展示
- 价格对比表
- 功能差异说明
- Stripe 付费入口

### 5. 个人中心页 (/mypage)
- 个人信息管理
- 账户设置
- 密码修改功能
- 账户状态查看

## 支付流程页面

### 6. 支付成功页 (/payment/success)
- 支付确认信息
- 订阅激活提示

### 7. 支付取消页 (/payment/cancel)
- 取消支付处理
- 重新选择引导

## 系统与合规功能

### 认证系统
- 用户注册/登录 (/auth)
- OAuth 认证回调 (/auth/callback)
- 游客身份支持
- Supabase 集成

### 多语言与主题
- 七种语言支持（中英日韩法德西）
- 明暗主题切换
- 响应式布局

### 防滥用机制
- 设备指纹识别
- 使用配额管理
- 访客时长限制
- 速率限制保护

### 法律合规页面
- 运营商信息 (/operator-info)
- 商业交易法 (/commercial-transaction-act)  
- 隐私政策 (/privacy-policy)
- 退款政策 (/refund-policy)

### 技术支撑
- 错误边界处理
- 安全头配置
- 文档导出（Word格式）
- 实时状态更新

## 技术架构

### 前端技术栈
- React 19.1.0 + TypeScript
- React Router 路由管理
- i18next 国际化
- Chart.js 数据可视化
- Vite 构建工具

### 后端集成
- Supabase 数据库和认证
- Stripe 支付处理
- Express.js 服务器
- 邮件服务集成

### 安全特性
- Helmet 安全头
- CORS 跨域处理
- 速率限制
- FingerprintJS 设备识别

---
*最后更新：2025-08-26*
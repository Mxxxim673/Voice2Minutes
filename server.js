// Node.js Express 服务器 - 处理邮件发送和用户认证
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(helmet()); // 安全头
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Vite 和其他本地端口
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// 邮件发送速率限制
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每个IP最多5封邮件
  message: {
    error: '邮件发送频率过高，请稍后再试',
    retryAfter: '15分钟'
  }
});

// Gmail SMTP 配置
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // 使用 STARTTLS
    auth: {
      user: process.env.SMTP_USER || 'max.z.software@gmail.com',
      pass: process.env.SMTP_PASS || 'vhvspvtcphijptvx'
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// 验证邮件发送端点
app.post('/api/email/send-verification', emailLimiter, async (req, res) => {
  try {
    const { to, subject, html, text, fromEmail, fromName } = req.body;
    
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['to', 'subject', 'html']
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    const transporter = createTransporter();
    
    // 验证SMTP连接
    await transporter.verify();
    console.log('✅ SMTP服务器连接成功');

    const mailOptions = {
      from: `"${fromName || 'Voice2Minutes Team'}" <${fromEmail || process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || '请使用支持HTML的邮件客户端查看此邮件。'
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('📧 验证邮件发送成功:', {
      messageId: info.messageId,
      to: to,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      messageId: info.messageId,
      message: '验证邮件发送成功'
    });

  } catch (error) {
    console.error('❌ 邮件发送失败:', error);
    
    let errorMessage = '邮件发送失败';
    if (error.code === 'EAUTH') {
      errorMessage = 'SMTP认证失败，请检查邮箱密码';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'SMTP服务器连接失败';
    } else if (error.responseCode === 550) {
      errorMessage = '邮箱地址不存在或被拒收';
    }

    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 欢迎邮件发送端点
app.post('/api/email/send-welcome', emailLimiter, async (req, res) => {
  try {
    const { to, subject, html, fromEmail, fromName } = req.body;
    
    if (!to || !subject || !html) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const transporter = createTransporter();
    await transporter.verify();

    const mailOptions = {
      from: `"${fromName || 'Voice2Minutes Team'}" <${fromEmail || process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('🎉 欢迎邮件发送成功:', {
      messageId: info.messageId,
      to: to,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      messageId: info.messageId,
      message: '欢迎邮件发送成功'
    });

  } catch (error) {
    console.error('❌ 欢迎邮件发送失败:', error);
    res.status(500).json({ error: '欢迎邮件发送失败' });
  }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      smtp: 'configured',
      rateLimit: 'active'
    }
  });
});

// SMTP连接测试端点
app.get('/api/email/test-connection', async (req, res) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    
    res.json({
      success: true,
      message: 'SMTP连接测试成功',
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        secure: false,
        tls: true
      }
    });
  } catch (error) {
    console.error('SMTP连接测试失败:', error);
    res.status(500).json({
      success: false,
      error: 'SMTP连接失败',
      details: error.message
    });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    error: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

// 根路径处理
app.get('/', (req, res) => {
  res.json({
    name: 'Voice2Minutes API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'POST /api/email/send-verification',
      'POST /api/email/send-welcome'
    ]
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.originalUrl
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
🚀 Voice2Minutes 邮件服务器启动成功！
📍 端口: ${PORT}
📧 SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}
👤 用户: ${process.env.SMTP_USER}
🌐 CORS: http://localhost:5173, http://localhost:3000
⚡ 准备就绪，等待邮件发送请求...
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('📴 收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});

export default app;
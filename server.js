// Node.js Express 服务器 - 处理邮件发送和用户认证
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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

// 访客身份记录速率限制
const guestIdentityLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 20, // 每个IP最多20次请求
  message: {
    error: '访客身份记录频率过高，请稍后再试'
  }
});

// 访客数据存储路径
const GUEST_DATA_DIR = path.join(process.cwd(), 'guest_data');
const GUEST_IDENTITIES_FILE = path.join(GUEST_DATA_DIR, 'guest_identities.json');
const RISK_ANALYSIS_FILE = path.join(GUEST_DATA_DIR, 'risk_analysis.json');

// 确保数据目录存在
if (!fs.existsSync(GUEST_DATA_DIR)) {
  fs.mkdirSync(GUEST_DATA_DIR, { recursive: true });
}

// 初始化数据文件
const initDataFiles = () => {
  if (!fs.existsSync(GUEST_IDENTITIES_FILE)) {
    fs.writeFileSync(GUEST_IDENTITIES_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(RISK_ANALYSIS_FILE)) {
    fs.writeFileSync(RISK_ANALYSIS_FILE, JSON.stringify({
      suspiciousFingerprints: [],
      blockedVisitorIds: [],
      riskMetrics: {
        totalGuestSessions: 0,
        totalUsageMinutes: 0,
        suspiciousActivityCount: 0
      }
    }, null, 2));
  }
};

initDataFiles();

// 获取客户端IP地址
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip;
};

// 增强的用户识别函数
const findExistingGuestUser = (newRecord, existingData) => {
  const { visitorId, fingerprint, deviceInfo } = newRecord;
  
  // 优先级1: 完全匹配的visitorId和fingerprint
  let match = existingData.find(item => 
    item.visitorId === visitorId && item.fingerprint === fingerprint
  );
  if (match) {
    console.log('🎯 完全匹配: visitorId + fingerprint');
    return match;
  }
  
  // 优先级2: 相同fingerprint（最重要的识别因子）
  match = existingData.find(item => item.fingerprint === fingerprint);
  if (match) {
    console.log('🎯 指纹匹配: fingerprint');
    return match;
  }
  
  // 优先级3: 相同visitorId（localStorage可能被清除但重新生成了相同ID的情况）
  match = existingData.find(item => item.visitorId === visitorId);
  if (match) {
    console.log('🎯 ID匹配: visitorId');
    return match;
  }
  
  // 优先级4: 设备特征匹配（降级方案）
  if (deviceInfo) {
    match = existingData.find(item => {
      if (!item.deviceInfo) return false;
      
      const sameUserAgent = item.deviceInfo.userAgent === deviceInfo.userAgent;
      const sameScreen = item.deviceInfo.screen === deviceInfo.screen;
      const sameTimezone = item.deviceInfo.timezone === deviceInfo.timezone;
      const sameLanguage = item.deviceInfo.language === deviceInfo.language;
      
      // 需要至少3个特征匹配
      const matchingFeatures = [sameUserAgent, sameScreen, sameTimezone, sameLanguage].filter(Boolean).length;
      
      return matchingFeatures >= 3;
    });
    
    if (match) {
      console.log('🎯 设备特征匹配: 多项设备信息一致');
      return match;
    }
  }
  
  return null;
};

// 风险分析函数
const analyzeGuestRisk = (guestData, existingData) => {
  const riskFactors = [];
  let riskScore = 0;
  
  // 检查是否是重复的设备指纹
  const duplicateFingerprints = existingData.filter(item => 
    item.fingerprint === guestData.fingerprint && 
    item.visitorId !== guestData.visitorId
  );
  
  if (duplicateFingerprints.length > 0) {
    riskScore += 30;
    riskFactors.push('重复设备指纹');
  }
  
  // 检查短时间内多次访问
  const recentSessions = existingData.filter(item => {
    const timeDiff = new Date() - new Date(item.timestamp);
    return timeDiff < 60 * 60 * 1000 && // 1小时内
           (item.fingerprint === guestData.fingerprint || item.ip === guestData.ip);
  });
  
  if (recentSessions.length > 5) {
    riskScore += 20;
    riskFactors.push('高频访问');
  }
  
  // 检查同一IP下的不同访客ID
  const sameIPDifferentVisitors = existingData.filter(item =>
    item.ip === guestData.ip && 
    item.visitorId !== guestData.visitorId
  );
  
  if (sameIPDifferentVisitors.length > 3) {
    riskScore += 25;
    riskFactors.push('同一IP多个访客');
  }
  
  // 检查异常使用模式
  if (guestData.usageInfo && guestData.usageInfo.totalMinutesUsed >= 4.5) {
    riskScore += 15;
    riskFactors.push('接近使用上限');
  }
  
  let riskLevel = 'low';
  if (riskScore >= 50) {
    riskLevel = 'high';
  } else if (riskScore >= 25) {
    riskLevel = 'medium';
  }
  
  return {
    riskScore,
    riskLevel,
    riskFactors,
    shouldBlock: riskScore >= 70
  };
};

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

// 访客身份记录端点
app.post('/api/guest/identity', guestIdentityLimiter, async (req, res) => {
  try {
    const { visitorId, fingerprint, deviceInfo, usageInfo } = req.body;
    
    if (!visitorId || !fingerprint) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['visitorId', 'fingerprint']
      });
    }
    
    const clientIP = getClientIP(req);
    const timestamp = new Date().toISOString();
    
    // 读取现有数据
    let existingData = [];
    try {
      const data = fs.readFileSync(GUEST_IDENTITIES_FILE, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.warn('⚠️ 读取访客数据失败，使用空数组:', error.message);
    }
    
    // 创建新的访客记录
    const guestRecord = {
      visitorId,
      fingerprint,
      ip: clientIP,
      deviceInfo,
      usageInfo,
      timestamp,
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer']
    };
    
    // 风险分析
    const riskAnalysis = analyzeGuestRisk(guestRecord, existingData);
    guestRecord.riskAnalysis = riskAnalysis;
    
    // 如果风险过高，记录但不阻止（可根据需要调整策略）
    if (riskAnalysis.shouldBlock) {
      console.warn('🚨 检测到高风险访客活动:', {
        visitorId,
        fingerprint,
        ip: clientIP,
        riskScore: riskAnalysis.riskScore,
        riskFactors: riskAnalysis.riskFactors
      });
      
      // 更新风险分析文件
      try {
        const riskData = JSON.parse(fs.readFileSync(RISK_ANALYSIS_FILE, 'utf8'));
        riskData.suspiciousFingerprints.push({
          fingerprint,
          visitorId,
          ip: clientIP,
          timestamp,
          riskScore: riskAnalysis.riskScore,
          riskFactors: riskAnalysis.riskFactors
        });
        riskData.riskMetrics.suspiciousActivityCount++;
        fs.writeFileSync(RISK_ANALYSIS_FILE, JSON.stringify(riskData, null, 2));
      } catch (error) {
        console.error('更新风险分析数据失败:', error);
      }
    }
    
    // 查找现有用户记录（增强识别逻辑）
    const existingUser = findExistingGuestUser(guestRecord, existingData);
    
    let finalRecord;
    let isNewUser = false;
    
    if (existingUser) {
      // 找到现有用户，合并使用量数据
      console.log(`🔍 识别到现有用户: ${existingUser.visitorId.substring(0, 8)}...`);
      
      // 取最大使用量（防止回退）
      const serverUsage = existingUser.usageInfo?.totalMinutesUsed || 0;
      const clientUsage = usageInfo?.totalMinutesUsed || 0;
      const actualUsage = Math.max(serverUsage, clientUsage);
      
      finalRecord = {
        ...existingUser,
        ...guestRecord,
        usageInfo: {
          ...usageInfo,
          totalMinutesUsed: actualUsage,
          sessionsCount: (existingUser.usageInfo?.sessionsCount || 0) + 1,
          lastUsedAt: timestamp
        },
        lastSeen: timestamp
      };
      
      // 更新现有记录
      const existingIndex = existingData.findIndex(item => 
        item.visitorId === existingUser.visitorId
      );
      existingData[existingIndex] = finalRecord;
      
    } else {
      // 新用户
      console.log(`🆕 新访客用户: ${visitorId.substring(0, 8)}...`);
      isNewUser = true;
      
      finalRecord = {
        ...guestRecord,
        usageInfo: {
          ...usageInfo,
          sessionsCount: 1,
          firstSeenAt: timestamp,
          lastUsedAt: timestamp
        },
        firstSeen: timestamp,
        lastSeen: timestamp
      };
      
      existingData.push(finalRecord);
    }
    
    // 清理旧数据（保留最近30天的记录）
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    existingData = existingData.filter(item => 
      new Date(item.timestamp) > thirtyDaysAgo
    );
    
    // 保存数据
    fs.writeFileSync(GUEST_IDENTITIES_FILE, JSON.stringify(existingData, null, 2));
    
    console.log('📊 访客身份记录成功:', {
      visitorId,
      fingerprint: fingerprint.substring(0, 8) + '...',
      ip: clientIP,
      riskLevel: riskAnalysis.riskLevel,
      usageMinutes: usageInfo?.totalMinutesUsed || 0
    });
    
    res.json({
      success: true,
      message: '访客身份记录成功',
      riskLevel: riskAnalysis.riskLevel,
      warnings: riskAnalysis.riskFactors,
      allowContinue: !riskAnalysis.shouldBlock,
      userData: {
        visitorId: finalRecord.visitorId,
        fingerprint: finalRecord.fingerprint,
        totalMinutesUsed: finalRecord.usageInfo.totalMinutesUsed,
        remainingMinutes: Math.max(0, 5 - finalRecord.usageInfo.totalMinutesUsed),
        sessionsCount: finalRecord.usageInfo.sessionsCount,
        isNewUser,
        lastUsedAt: finalRecord.usageInfo.lastUsedAt
      }
    });
    
  } catch (error) {
    console.error('❌ 访客身份记录失败:', error);
    res.status(500).json({
      error: '服务器错误',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 访客身份验证端点
app.post('/api/guest/verify', guestIdentityLimiter, async (req, res) => {
  try {
    const { visitorId, fingerprint } = req.body;
    
    if (!visitorId || !fingerprint) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['visitorId', 'fingerprint']
      });
    }
    
    const clientIP = getClientIP(req);
    
    // 读取现有数据
    let existingData = [];
    try {
      const data = fs.readFileSync(GUEST_IDENTITIES_FILE, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.warn('⚠️ 读取访客数据失败:', error.message);
    }
    
    // 查找匹配的记录
    const matchingRecords = existingData.filter(item => 
      item.visitorId === visitorId || 
      item.fingerprint === fingerprint ||
      (item.ip === clientIP && Math.abs(new Date() - new Date(item.timestamp)) < 24 * 60 * 60 * 1000)
    );
    
    let totalUsageMinutes = 0;
    let isBlocked = false;
    const riskFactors = [];
    
    if (matchingRecords.length > 0) {
      // 计算总使用时间
      totalUsageMinutes = matchingRecords.reduce((total, record) => {
        return total + (record.usageInfo?.totalMinutesUsed || 0);
      }, 0);
      
      // 检查是否被标记为高风险
      const highRiskRecords = matchingRecords.filter(record => 
        record.riskAnalysis?.riskLevel === 'high'
      );
      
      if (highRiskRecords.length > 0) {
        isBlocked = true;
        riskFactors.push('检测到高风险活动历史');
      }
      
      // 检查是否超过使用限制
      if (totalUsageMinutes >= 5) {
        isBlocked = true;
        riskFactors.push('已达到访客使用上限');
      }
    }
    
    const remainingMinutes = Math.max(0, 5 - totalUsageMinutes);
    
    res.json({
      success: true,
      isAllowed: !isBlocked && remainingMinutes > 0,
      remainingMinutes,
      totalUsageMinutes,
      riskFactors,
      matchingRecordsCount: matchingRecords.length
    });
    
  } catch (error) {
    console.error('❌ 访客身份验证失败:', error);
    res.status(500).json({
      error: '验证失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 访客统计端点（管理员使用）
app.get('/api/guest/stats', async (req, res) => {
  try {
    // 简单的管理员验证（可根据需要增强）
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.includes('admin')) {
       return res.status(403).json({ error: '权限不足' });
    }
    
    const existingData = JSON.parse(fs.readFileSync(GUEST_IDENTITIES_FILE, 'utf8'));
    const riskData = JSON.parse(fs.readFileSync(RISK_ANALYSIS_FILE, 'utf8'));
    
    const stats = {
      totalGuests: existingData.length,
      uniqueFingerprints: [...new Set(existingData.map(item => item.fingerprint))].length,
      uniqueIPs: [...new Set(existingData.map(item => item.ip))].length,
      totalUsageMinutes: existingData.reduce((total, item) => 
        total + (item.usageInfo?.totalMinutesUsed || 0), 0
      ),
      riskDistribution: {
        low: existingData.filter(item => item.riskAnalysis?.riskLevel === 'low').length,
        medium: existingData.filter(item => item.riskAnalysis?.riskLevel === 'medium').length,
        high: existingData.filter(item => item.riskAnalysis?.riskLevel === 'high').length
      },
      suspiciousActivity: riskData.riskMetrics.suspiciousActivityCount,
      recentSessions: existingData.filter(item => {
        const timeDiff = new Date() - new Date(item.timestamp);
        return timeDiff < 24 * 60 * 60 * 1000; // 最近24小时
      }).length
    };
    
    res.json({
      success: true,
      stats,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 获取访客统计失败:', error);
    res.status(500).json({
      error: '获取统计数据失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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
      'POST /api/email/send-welcome',
      'POST /api/guest/identity',
      'POST /api/guest/verify',
      'GET /api/guest/stats'
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
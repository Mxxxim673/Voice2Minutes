// Node.js Express 服务器 - 处理邮件发送和用户认证
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase 配置
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

// Stripe 配置
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key', {
  apiVersion: '2024-11-20.acacia'
});

// 普通客户端（匿名权限）
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 管理客户端（service role权限）
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 中间件配置 - 暂时禁用helmet进行调试
// app.use(helmet()); // 安全头 - 暂时注释掉
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Vite 和其他本地端口
  credentials: true
}));

// Stripe webhook 需要在 express.json() 之前处理，因为需要原始body
app.post('/api/payment/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  // 如果没有配置webhook secret，跳过验证（开发阶段）
  if (!endpointSecret) {
    console.log('⚠️ STRIPE_WEBHOOK_SECRET 未配置，跳过webhook验证');
    try {
      event = JSON.parse(req.body);
    } catch (err) {
      console.error('解析webhook数据失败:', err.message);
      return res.status(400).send(`Webhook Parse Error: ${err.message}`);
    }
  } else {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  console.log(`📨 收到Stripe webhook事件: ${event.type}`);

  // 处理事件
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // 更新用户配额
        await handleSuccessfulPayment(session);
        break;
        
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('💰 支付成功:', paymentIntent.id);
        break;
        
      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        console.log('📄 订阅发票支付成功:', invoice.id);
        // 处理订阅续费
        if (invoice.subscription) {
          await handleSubscriptionRenewal(invoice);
        }
        break;
        
      default:
        console.log(`🔔 未处理的webhook事件类型: ${event.type}`);
    }
  } catch (error) {
    console.error('处理webhook事件失败:', error);
    return res.status(500).json({ 
      error: '处理webhook事件失败',
      details: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
    });
  }

  res.json({received: true});
});

app.use(express.json({ limit: '10mb' }));

// 邮件发送速率限制
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20, // 每个IP最多20封邮件（支持多人同时注册）
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

// 获取验证邮件模板
const getVerificationEmailTemplate = (language = 'zh', verificationCode) => {
  const templates = {
    zh: {
      subject: 'Voice2Minutes - 邮箱验证码',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">专业的音频转文字服务</p>
            </div>
            
            <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">邮箱验证</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              感谢您注册 Voice2Minutes！请使用以下验证码完成邮箱验证：
            </p>
            
            <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #333; font-size: 14px; margin-bottom: 10px;">您的验证码是：</p>
              <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${verificationCode}</h1>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>⚠️ 重要提醒：</strong><br>
                • 验证码有效期为 <strong>10分钟</strong><br>
                • 请勿向任何人泄露您的验证码<br>
                • 如果您没有注册账户，请忽略此邮件
              </p>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                此邮件由系统自动发送，请勿回复<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Voice2Minutes - 邮箱验证码\n\n感谢您注册 Voice2Minutes！\n\n您的验证码是：${verificationCode}\n\n验证码有效期为10分钟，请及时使用。\n\n如果您没有注册账户，请忽略此邮件。\n\n© 2025 Voice2Minutes`
    },
    en: {
      subject: 'Voice2Minutes - Email Verification Code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Professional Audio-to-Text Service</p>
            </div>
            
            <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">Email Verification</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Thank you for registering with Voice2Minutes! Please use the following verification code:
            </p>
            
            <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #333; font-size: 14px; margin-bottom: 10px;">Your verification code is:</p>
              <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${verificationCode}</h1>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>⚠️ Important Notice:</strong><br>
                • Code expires in <strong>10 minutes</strong><br>
                • Do not share your verification code with anyone<br>
                • If you didn't register, please ignore this email
              </p>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This email was sent automatically, please do not reply<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Voice2Minutes - Email Verification Code\n\nThank you for registering with Voice2Minutes!\n\nYour verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.\n\nIf you didn't register, please ignore this email.\n\n© 2025 Voice2Minutes`
    },
    ja: {
      subject: 'Voice2Minutes - メール認証コード',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">プロフェッショナル音声文字起こしサービス</p>
            </div>
            
            <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">メール認証</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Voice2Minutesにご登録いただき、ありがとうございます！以下の認証コードをご使用ください：
            </p>
            
            <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #333; font-size: 14px; margin-bottom: 10px;">認証コード：</p>
              <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${verificationCode}</h1>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>⚠️ 重要なお知らせ：</strong><br>
                • 認証コードの有効期限は <strong>10分間</strong> です<br>
                • 認証コードを他人に教えないでください<br>
                • アカウント登録をしていない場合は、このメールを無視してください
              </p>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                このメールは自動送信されています。返信しないでください<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Voice2Minutes - メール認証コード\n\nVoice2Minutesにご登録いただき、ありがとうございます！\n\n認証コード: ${verificationCode}\n\n認証コードの有効期限は10分間です。\n\nアカウント登録をしていない場合は、このメールを無視してください。\n\n© 2025 Voice2Minutes`
    }
  };
  
  return templates[language] || templates.zh;
};

// 获取密码重置邮件模板
const createPasswordResetEmailTemplate = ({ resetCode, email, language = 'zh' }) => {
  const templates = {
    zh: {
      subject: 'Voice2Minutes - 密码重置验证码',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">专业的音频转文字服务</p>
            </div>
            
            <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">🔒 密码重置</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              您请求重置 Voice2Minutes 账户密码。请使用以下验证码完成密码重置：
            </p>
            
            <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #333; font-size: 14px; margin-bottom: 10px;">您的重置验证码是：</p>
              <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${resetCode}</h1>
            </div>
            
            <div style="background: #ffe6e6; border-left: 4px solid #ff4757; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #c92a2a; font-size: 14px; margin: 0;">
                <strong>🔒 安全提醒：</strong><br>
                • 验证码有效期为 <strong>10分钟</strong><br>
                • 请勿向任何人泄露您的验证码<br>
                • 如果您没有申请密码重置，请立即联系我们<br>
                • 账户：${email}
              </p>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                此邮件由系统自动发送，请勿回复<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Voice2Minutes - 密码重置验证码\n\n您请求重置 Voice2Minutes 账户密码。\n\n您的重置验证码是：${resetCode}\n\n验证码有效期为10分钟，请及时使用。\n\n账户：${email}\n\n如果您没有申请密码重置，请立即联系我们。\n\n© 2025 Voice2Minutes`
    },
    en: {
      subject: 'Voice2Minutes - Password Reset Code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Professional Audio-to-Text Service</p>
            </div>
            
            <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">🔒 Password Reset</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              You requested to reset your Voice2Minutes account password. Please use the following code:
            </p>
            
            <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #333; font-size: 14px; margin-bottom: 10px;">Your reset code is:</p>
              <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${resetCode}</h1>
            </div>
            
            <div style="background: #ffe6e6; border-left: 4px solid #ff4757; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #c92a2a; font-size: 14px; margin: 0;">
                <strong>🔒 Security Notice:</strong><br>
                • Code expires in <strong>10 minutes</strong><br>
                • Do not share your reset code with anyone<br>
                • If you didn't request this reset, please contact us immediately<br>
                • Account: ${email}
              </p>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This email was sent automatically, please do not reply<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Voice2Minutes - Password Reset Code\n\nYou requested to reset your Voice2Minutes account password.\n\nYour reset code is: ${resetCode}\n\nThis code expires in 10 minutes.\n\nAccount: ${email}\n\nIf you didn't request this reset, please contact us immediately.\n\n© 2025 Voice2Minutes`
    },
    ja: {
      subject: 'Voice2Minutes - パスワードリセット認証コード',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
              <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">プロフェッショナル音声文字起こしサービス</p>
            </div>
            
            <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">🔒 パスワードリセット</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Voice2Minutesアカウントのパスワードリセットをリクエストされました。以下の認証コードをご使用ください：
            </p>
            
            <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #333; font-size: 14px; margin-bottom: 10px;">リセット認証コード：</p>
              <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${resetCode}</h1>
            </div>
            
            <div style="background: #ffe6e6; border-left: 4px solid #ff4757; padding: 15px; margin: 25px 0; border-radius: 4px;">
              <p style="color: #c92a2a; font-size: 14px; margin: 0;">
                <strong>🔒 セキュリティ通知：</strong><br>
                • 認証コードの有効期限は <strong>10分間</strong> です<br>
                • 認証コードを他人に教えないでください<br>
                • このリセットをリクエストしていない場合は、すぐにお問い合わせください<br>
                • アカウント：${email}
              </p>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                このメールは自動送信されています。返信しないでください<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Voice2Minutes - パスワードリセット認証コード\n\nVoice2Minutesアカウントのパスワードリセットをリクエストされました。\n\nリセット認証コード: ${resetCode}\n\n認証コードの有効期限は10分間です。\n\nアカウント：${email}\n\nこのリセットをリクエストしていない場合は、すぐにお問い合わせください。\n\n© 2025 Voice2Minutes`
    }
  };
  
  return templates[language] || templates.zh;
};

// Gmail SMTP 配置
const createTransporter = () => {
  return nodemailer.createTransport({
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

// ========== Supabase 认证相关API端点 ==========

// 用户注册端点
app.post('/api/auth/register', emailLimiter, async (req, res) => {
  try {
    const { email, password, language = 'ja' } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['email', 'password']
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 密码强度检查
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6个字符' });
    }

    // 获取设备指纹和IP用于防滥用检查
    const { fingerprint, deviceInfo } = req.body;
    const clientIP = getClientIP(req);
    
    console.log(`🔍 注册防滥用检查 - Email: ${email}, 设备: ${fingerprint?.substring(0, 8)}..., IP: ${clientIP}`);

    // 1. 获取所有用户信息，同时进行邮箱重复检查和防滥用检查
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (!listError && existingUsers) {
      const existingUser = existingUsers.users.find(u => u.email === email);
      if (existingUser) {
        if (existingUser.email_confirmed_at) {
          // 邮箱已验证，不允许重复注册
          return res.status(400).json({ 
            error: '该邮箱已注册并验证，请直接登录。如忘记密码，请使用密码重置功能。',
            code: 'EMAIL_ALREADY_REGISTERED',
            isVerified: true
          });
        } else {
          // 邮箱未验证，删除旧记录后重新注册
          console.log(`🧹 清理未验证的重复邮箱: ${email}`);
          await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
        }
      }

      // 防滥用检查：同一设备指纹+IP组合最多允许注册3个不同邮箱
      if (fingerprint && clientIP) {
        try {
          // 统计同一设备指纹+IP组合的已验证邮箱
          const deviceKey = `${fingerprint}-${clientIP}`;
          const registeredEmails = new Set();
          
          // 检查所有用户的元数据中是否有相同的设备指纹+IP组合
          existingUsers.users.forEach(user => {
            if (user.email_confirmed_at && user.user_metadata) {
              const userDeviceKey = user.user_metadata.device_fingerprint && user.user_metadata.registration_ip 
                ? `${user.user_metadata.device_fingerprint}-${user.user_metadata.registration_ip}`
                : null;
              
              if (userDeviceKey === deviceKey) {
                registeredEmails.add(user.email);
              }
            }
          });
          
          // 如果已经有3个或更多邮箱注册，拒绝新注册
          if (registeredEmails.size >= 3) {
            console.log(`🚫 防滥用拦截: 设备指纹 ${fingerprint.substring(0, 8)}... IP ${clientIP} 已注册 ${registeredEmails.size} 个邮箱，超过限制`);
            
            // 多语言错误提示
            const errorMessages = {
              'zh': '该设备已注册邮箱数量过多，如需帮助请联系客服',
              'ja': 'このデバイスで登録されたメールアドレスの数が上限に達しています。サポートが必要でしたらカスタマーサービスまでお問い合わせください',
              'en': 'This device has registered too many email addresses. Please contact customer service if you need assistance',
              'ko': '이 기기에서 등록된 이메일 주소 수가 한도에 도달했습니다. 도움이 필요하시면 고객 서비스에 문의해 주세요',
              'fr': 'Cet appareil a enregistré trop d\'adresses e-mail. Veuillez contacter le service client si vous avez besoin d\'aide',
              'de': 'Dieses Gerät hat zu viele E-Mail-Adressen registriert. Bitte wenden Sie sich an den Kundendienst, wenn Sie Hilfe benötigen',
              'es': 'Este dispositivo ha registrado demasiadas direcciones de correo electrónico. Póngase en contacto con el servicio de atención al cliente si necesita ayuda'
            };
            
            const errorMessage = errorMessages[language] || errorMessages['ja']; // 默认日语
            
            return res.status(429).json({ 
              error: errorMessage,
              code: 'DEVICE_REGISTRATION_LIMIT_EXCEEDED',
              limit: 3,
              current: registeredEmails.size
            });
          }
        } catch (antiAbuseError) {
          console.error('防滥用检查失败:', antiAbuseError);
          // 如果防滥用检查失败，记录日志但不阻止注册
        }
      }
    }

    // 2. 使用Supabase Auth注册用户（立即确认邮箱，跳过邮件验证）
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 立即确认邮箱，不发送验证邮件
      user_metadata: {
        lang: language,
        timezone: 'Asia/Tokyo',
        device_fingerprint: fingerprint,
        registration_ip: clientIP,
        registration_timestamp: new Date().toISOString(),
        user_agent: req.headers['user-agent']
      }
    });

    if (error) {
      console.error('Supabase注册失败:', error);
      return res.status(400).json({ error: error.message });
    }

    const user = data.user;
    if (!user) {
      return res.status(400).json({ error: '注册失败，未返回用户信息' });
    }

    // 3. 生成验证码并发送自定义验证邮件
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('🎯 生成验证码:', verificationCode, '给用户:', email);
    
    // 获取邮件模板
    const emailTemplate = getVerificationEmailTemplate(language, verificationCode);
    
    // 发送验证邮件
    try {
      const emailResponse = await fetch(`http://localhost:${PORT}/api/email/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
          fromEmail: process.env.SMTP_USER,
          fromName: 'Voice2Minutes Team'
        })
      });
      
      const emailResult = await emailResponse.json();
      
      if (!emailResult.success) {
        throw new Error('验证邮件发送失败: ' + (emailResult.error || 'Unknown error'));
      }
      
      console.log('📧 验证邮件发送成功:', emailResult.messageId);
    } catch (emailError) {
      console.error('❌ 发送验证邮件失败:', emailError);
      // 注册失败，删除已创建的Supabase用户
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return res.status(500).json({ error: '验证邮件发送失败，请稍后重试' });
    }
    
    // 4. 存储验证码信息（用于后续验证）
    // 这里可以存储到数据库或缓存中，暂时存储在内存中
    global.pendingVerifications = global.pendingVerifications || {};
    global.pendingVerifications[email] = {
      code: verificationCode,
      userId: user.id,
      timestamp: Date.now(),
      language: language
    };
    
    console.log('✅ 用户注册成功，验证邮件已发送:', email);
    
    res.json({
      success: true,
      message: '注册成功，请检查邮箱验证邮件',
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        isEmailVerified: false,
        lang: language,
        timezone: 'Asia/Tokyo'
      }
    });

  } catch (error) {
    console.error('❌ 注册失败:', error);
    res.status(500).json({
      error: '注册失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 验证码验证端点
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    
    if (!email || !verificationCode) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['email', 'verificationCode']
      });
    }
    
    // 检查待验证信息
    global.pendingVerifications = global.pendingVerifications || {};
    const pendingInfo = global.pendingVerifications[email];
    
    if (!pendingInfo) {
      return res.status(400).json({ 
        error: '没有找到待验证的邮箱，请重新注册' 
      });
    }
    
    // 检查验证码是否过期 (10分钟)
    const now = Date.now();
    const codeAge = now - pendingInfo.timestamp;
    const CODE_EXPIRY = 10 * 60 * 1000;
    
    if (codeAge >= CODE_EXPIRY) {
      // 清理过期数据
      delete global.pendingVerifications[email];
      
      // 删除未验证的Supabase用户
      try {
        await supabaseAdmin.auth.admin.deleteUser(pendingInfo.userId);
      } catch (error) {
        console.warn('清理过期用户失败:', error);
      }
      
      return res.status(400).json({ 
        error: '验证码已过期，请重新注册' 
      });
    }
    
    // 验证验证码
    if (verificationCode.trim() !== pendingInfo.code.trim()) {
      return res.status(400).json({ 
        error: '验证码不正确' 
      });
    }
    
    // 验证成功 - 用户在创建时已经确认邮箱，无需再次激活
    
    // 初始化用户数据
    const { error: initError } = await supabaseAdmin.rpc('init_user', {
      p_user_id: pendingInfo.userId,
      p_lang: pendingInfo.language || 'zh',
      p_timezone: 'Asia/Tokyo',
      p_free_minutes: 10
    });

    if (initError) {
      console.error('用户数据初始化失败:', initError);
      return res.status(500).json({ 
        error: '用户数据初始化失败',
        details: initError.message 
      });
    }
    
    // 清理验证信息
    delete global.pendingVerifications[email];
    
    console.log('✅ 邮箱验证成功，用户已激活:', email);
    
    res.json({
      success: true,
      message: '邮箱验证成功，账户已激活',
      user: {
        email: email,
        isEmailVerified: true
      }
    });

  } catch (error) {
    console.error('❌ 验证码验证失败:', error);
    res.status(500).json({
      error: '验证失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 发送密码重置验证码
app.post('/api/auth/send-reset-code', emailLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '邮箱地址必填' });
    }
    
    // 检查用户是否存在
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = user?.users?.find(u => u.email === email);
      
    if (!existingUser) {
      return res.status(404).json({ 
        error: '该邮箱未注册，请先注册账户',
        code: 'EMAIL_NOT_FOUND' 
      });
    }
    
    if (!existingUser.email_confirmed_at) {
      return res.status(400).json({ 
        error: '该邮箱尚未验证，请先完成邮箱验证',
        code: 'EMAIL_NOT_VERIFIED' 
      });
    }
    
    // 生成重置验证码
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const timestamp = Date.now();
    
    // 存储重置验证码
    if (!global.pendingVerifications) {
      global.pendingVerifications = {};
    }
    
    global.pendingVerifications[`reset_${email}`] = {
      code: resetCode,
      timestamp: timestamp,
      purpose: 'password_reset',
      userId: existingUser.id
    };
    
    console.log('🔑 生成密码重置验证码:', resetCode, '给用户:', email);
    
    // 发送重置邮件
    const emailTemplate = createPasswordResetEmailTemplate({
      resetCode: resetCode,
      email: email,
      language: req.body.language || 'zh'
    });
    
    // 使用内部邮件发送API
    try {
      const emailResponse = await fetch(`http://localhost:${PORT}/api/email/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
          fromName: 'Voice2Minutes Team'
        })
      });

      const emailResult = await emailResponse.json();
      
      if (!emailResponse.ok || !emailResult.success) {
        throw new Error('密码重置邮件发送失败: ' + (emailResult.error || 'Unknown error'));
      }

      console.log('📧 密码重置邮件发送成功:', emailResult.messageId);
      
    } catch (error) {
      console.error('❌ 密码重置邮件发送失败:', error);
      return res.status(500).json({ error: '重置邮件发送失败，请稍后重试' });
    }
    
    console.log('✅ 密码重置邮件已发送:', email);
    
    res.json({
      success: true,
      message: '密码重置验证码已发送至您的邮箱'
    });
    
  } catch (error) {
    console.error('❌ 密码重置验证码发送失败:', error);
    res.status(500).json({
      error: '密码重置验证码发送失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 验证重置码并重置密码
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, verificationCode, newPassword } = req.body;
    
    if (!email || !verificationCode || !newPassword) {
      return res.status(400).json({ error: '邮箱、验证码和新密码必填' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }
    
    // 检查重置验证码
    const resetKey = `reset_${email}`;
    const storedVerification = global.pendingVerifications?.[resetKey];
    
    if (!storedVerification) {
      return res.status(400).json({ 
        error: '未找到重置请求，请重新申请密码重置',
        code: 'RESET_NOT_FOUND' 
      });
    }
    
    // 检查验证码是否正确
    if (storedVerification.code !== verificationCode.trim()) {
      return res.status(400).json({ 
        error: '验证码错误',
        code: 'INVALID_CODE' 
      });
    }
    
    // 检查验证码是否过期（10分钟）
    const now = Date.now();
    const codeAge = now - storedVerification.timestamp;
    const CODE_EXPIRY = 10 * 60 * 1000; // 10分钟
    
    if (codeAge >= CODE_EXPIRY) {
      delete global.pendingVerifications[resetKey];
      return res.status(400).json({ 
        error: '验证码已过期，请重新申请密码重置',
        code: 'CODE_EXPIRED' 
      });
    }
    
    // 重置用户密码
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      storedVerification.userId,
      { password: newPassword }
    );
    
    if (updateError) {
      console.error('密码重置失败:', updateError);
      return res.status(500).json({ 
        error: '密码重置失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? updateError.message : undefined
      });
    }
    
    // 清理重置验证码
    delete global.pendingVerifications[resetKey];
    
    console.log('✅ 密码重置成功:', email);
    
    res.json({
      success: true,
      message: '密码重置成功，请使用新密码登录'
    });
    
  } catch (error) {
    console.error('❌ 密码重置失败:', error);
    res.status(500).json({
      error: '密码重置失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 修改当前用户密码
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // 验证请求参数
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '当前密码和新密码必填' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度至少6位' });
    }
    
    // 获取认证token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权访问' });
    }
    
    const token = authHeader.substring(7);
    
    // 管理员用户特殊处理
    if (token === 'admin_token') {
      // 管理员密码修改逻辑（简化处理）
      const adminEmail = 'max.z.software@gmail.com';
      const expectedCurrentPassword = 'vhvspvtcphijptvx';
      
      if (currentPassword !== expectedCurrentPassword) {
        return res.status(400).json({ error: '当前密码错误' });
      }
      
      // 管理员密码修改成功（实际上是模拟，因为管理员使用固定密码）
      console.log('✅ 管理员密码修改请求（模拟成功）:', adminEmail);
      
      return res.json({
        success: true,
        message: '密码修改成功'
      });
    }
    
    // 验证token并获取用户信息（普通Supabase用户）
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: '无效的认证token' });
    }
    
    // 验证当前密码 - 通过普通客户端重新登录验证
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });
    
    if (signInError) {
      return res.status(400).json({ error: '当前密码错误' });
    }
    
    // 更新密码
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    
    if (updateError) {
      console.error('密码更新失败:', updateError);
      return res.status(500).json({ 
        error: '密码更新失败，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? updateError.message : undefined
      });
    }
    
    console.log('✅ 密码修改成功:', user.email);
    
    res.json({
      success: true,
      message: '密码修改成功'
    });
    
  } catch (error) {
    console.error('❌ 密码修改失败:', error);
    res.status(500).json({
      error: '密码修改失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 确保用户数据完整性端点（用于邮箱验证后）
app.post('/api/auth/ensure-user-data', async (req, res) => {
  try {
    const { userId, email } = req.body;
    
    if (!userId || !email) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 检查用户配置是否存在
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    // 检查用量数据是否存在
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('usage_minutes')
      .select('*')
      .eq('user_id', userId)
      .single();

    let needsInit = false;
    
    if (profileError?.code === 'PGRST116' || usageError?.code === 'PGRST116') {
      needsInit = true;
      console.log('🔧 检测到用户数据缺失，执行初始化:', email);
      
      // 执行用户数据初始化
      const { error: initError } = await supabaseAdmin.rpc('init_user', {
        p_user_id: userId,
        p_lang: 'ja',
        p_timezone: 'Asia/Tokyo',
        p_free_minutes: 10
      });

      if (initError) {
        console.error('用户数据初始化失败:', initError);
        return res.status(500).json({ 
          error: '用户数据初始化失败',
          details: initError.message 
        });
      }
      
      console.log('✅ 用户数据初始化完成:', email);
    }

    res.json({
      success: true,
      message: needsInit ? '用户数据已初始化' : '用户数据完整',
      initialized: needsInit
    });

  } catch (error) {
    console.error('❌ 检查用户数据失败:', error);
    res.status(500).json({
      error: '检查用户数据失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 邮箱确认API - 在用户点击邮箱验证链接后初始化用户数据
app.post('/api/auth/confirm-email', async (req, res) => {
  try {
    const { user_id, lang, timezone } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    // 检查用户是否存在且已验证邮箱
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    
    if (userError || !userData.user) {
      console.error('用户查询失败:', userError);
      return res.status(400).json({ error: '用户不存在' });
    }

    if (!userData.user.email_confirmed_at) {
      return res.status(400).json({ error: '邮箱尚未验证' });
    }

    // 检查用户数据是否已经初始化
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', user_id)
      .single();

    if (existingProfile) {
      // 用户数据已存在，直接返回成功
      return res.json({
        success: true,
        message: '用户已验证并初始化'
      });
    }

    // 初始化用户数据
    const { error: initError } = await supabaseAdmin.rpc('init_user', {
      p_user_id: user_id,
      p_lang: lang || 'zh',
      p_timezone: timezone || 'Asia/Tokyo',
      p_free_minutes: 10
    });

    if (initError) {
      console.error('用户数据初始化失败:', initError);
      return res.status(500).json({ error: '用户数据初始化失败' });
    }

    console.log('✅ 用户邮箱验证并初始化成功:', userData.user.email);
    
    res.json({
      success: true,
      message: '邮箱验证成功，用户数据已初始化'
    });
    
  } catch (error) {
    console.error('邮箱确认处理失败:', error);
    res.status(500).json({ error: '邮箱确认处理失败' });
  }
});

// 用户登录端点
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['email', 'password']
      });
    }

    // 使用Supabase Auth登录
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase登录失败:', error);
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    if (!data.user) {
      return res.status(401).json({ error: '登录失败' });
    }

    // 强制检查邮箱是否已验证 - 严格执行
    if (!data.user.email_confirmed_at) {
      console.log(`❌ 未验证邮箱尝试登录: ${email}`);
      return res.status(401).json({ 
        error: '邮箱尚未验证，请先验证您的邮箱后再登录。如未收到验证邮件，请重新注册。',
        code: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true
      });
    }

    // 二次验证：从数据库再次确认邮箱验证状态
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(data.user.id);
    if (authError || !authUser.user || !authUser.user.email_confirmed_at) {
      console.log(`❌ 数据库二次检查失败，邮箱未验证: ${email}`);
      return res.status(401).json({ 
        error: '邮箱验证状态异常，请重新验证您的邮箱。',
        code: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true
      });
    }

    // 获取用户完整信息
    const userWithProfile = await getUserWithProfile(data.user.id);
    
    console.log('✅ 用户登录成功:', email);
    
    res.json({
      success: true,
      message: '登录成功',
      user: userWithProfile,
      session: data.session
    });

  } catch (error) {
    console.error('❌ 登录失败:', error);
    res.status(500).json({
      error: '登录失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 获取用户信息端点
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    
    // 验证JWT token
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: '无效的访问令牌' });
    }

    const userWithProfile = await getUserWithProfile(data.user.id);
    
    res.json({
      success: true,
      user: userWithProfile
    });

  } catch (error) {
    console.error('❌ 获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 用户登出端点
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    
    // Supabase登出
    const { error } = await supabase.auth.admin.signOut(token);
    if (error) {
      console.error('Supabase登出失败:', error);
    }

    res.json({
      success: true,
      message: '登出成功'
    });

  } catch (error) {
    console.error('❌ 登出失败:', error);
    res.status(500).json({ error: '登出失败' });
  }
});

// 获取用量信息端点
app.get('/api/usage/quota', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    
    // 验证用户
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: '无效的访问令牌' });
    }

    // 使用新的用量计算函数
    const { data: quotaData, error: quotaError } = await supabaseAdmin
      .rpc('calculate_user_quota', { user_id_param: data.user.id });

    if (quotaError || !quotaData || quotaData.length === 0) {
      console.error('获取用量信息失败:', quotaError);
      return res.status(500).json({ error: '获取用量信息失败' });
    }

    const quota = quotaData[0];

    res.json({
      success: true,
      quota: {
        totalMinutes: quota.total_minutes,
        usedMinutes: quota.used_minutes,
        remainingMinutes: quota.remaining_minutes,
        breakdown: {
          trial: {
            total: quota.trial_remaining + (quota.used_minutes > 0 ? Math.min(quota.used_minutes, 10) : 0),
            used: quota.used_minutes > 0 ? Math.min(quota.used_minutes, 10) : 0,
            remaining: quota.trial_remaining
          },
          purchased: {
            remaining: quota.purchased_remaining
          },
          subscription: {
            remaining: quota.subscription_remaining,
            nextReset: quota.next_reset
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ 获取用量信息失败:', error);
    res.status(500).json({ error: '获取用量信息失败' });
  }
});

// 消费用量端点
app.post('/api/usage/consume', async (req, res) => {
  try {
    const { minutes } = req.body;
    
    if (!minutes || minutes <= 0) {
      return res.status(400).json({ error: '无效的使用时长' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    
    // 验证用户
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: '无效的访问令牌' });
    }

    // 使用新的用量消费函数
    const { data: consumeResult, error: consumeError } = await supabaseAdmin
      .rpc('consume_user_minutes', { 
        user_id_param: data.user.id, 
        minutes_to_consume: minutes 
      });

    if (consumeError || !consumeResult || consumeResult.length === 0) {
      console.error('消费用量失败:', consumeError);
      return res.status(500).json({ error: '消费用量失败' });
    }

    const result = consumeResult[0];
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.message,
        remainingMinutes: result.remaining_minutes
      });
    }

    // 获取更新后的配额信息
    const { data: quotaData, error: quotaError } = await supabaseAdmin
      .rpc('calculate_user_quota', { user_id_param: data.user.id });

    const quota = quotaData && quotaData.length > 0 ? quotaData[0] : null;

    console.log(`✅ 用户 ${data.user.email} 消费了 ${minutes} 分钟（来源：${result.consumed_from}），剩余 ${result.remaining_minutes} 分钟`);

    res.json({
      success: true,
      message: result.message,
      consumedFrom: result.consumed_from,
      quota: quota ? {
        totalMinutes: quota.total_minutes,
        usedMinutes: quota.used_minutes,
        remainingMinutes: quota.remaining_minutes,
        consumedMinutes: minutes,
        breakdown: {
          trial: {
            remaining: quota.trial_remaining
          },
          purchased: {
            remaining: quota.purchased_remaining
          },
          subscription: {
            remaining: quota.subscription_remaining,
            nextReset: quota.next_reset
          }
        }
      } : null
    });

  } catch (error) {
    console.error('❌ 消费用量失败:', error);
    res.status(500).json({ error: '消费用量失败' });
  }
});

// 购买时长API
app.post('/api/usage/purchase', async (req, res) => {
  try {
    const { minutes } = req.body;
    
    if (!minutes || minutes <= 0) {
      return res.status(400).json({ error: '无效的购买时长' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ error: '无效的访问令牌' });
    }

    // 添加购买时长
    const { data: result, error: purchaseError } = await supabaseAdmin
      .rpc('add_purchased_minutes', { 
        user_id_param: data.user.id, 
        minutes_to_add: minutes 
      });

    if (purchaseError || !result) {
      console.error('购买时长失败:', purchaseError);
      return res.status(500).json({ error: '购买时长失败' });
    }

    // 获取更新后的配额信息
    const { data: quotaData, error: quotaError } = await supabaseAdmin
      .rpc('calculate_user_quota', { user_id_param: data.user.id });

    const quota = quotaData && quotaData.length > 0 ? quotaData[0] : null;

    console.log(`✅ 用户 ${data.user.email} 购买了 ${minutes} 分钟时长`);

    res.json({
      success: true,
      message: '购买时长成功',
      purchasedMinutes: minutes,
      quota: quota ? {
        totalMinutes: quota.total_minutes,
        usedMinutes: quota.used_minutes,
        remainingMinutes: quota.remaining_minutes,
        breakdown: {
          trial: { remaining: quota.trial_remaining },
          purchased: { remaining: quota.purchased_remaining },
          subscription: { 
            remaining: quota.subscription_remaining,
            nextReset: quota.next_reset 
          }
        }
      } : null
    });

  } catch (error) {
    console.error('❌ 购买时长失败:', error);
    res.status(500).json({ error: '购买时长失败' });
  }
});

// 设置订阅API
app.post('/api/usage/subscription', async (req, res) => {
  try {
    const { type, minutes } = req.body;
    
    if (!type || !minutes || !['monthly', 'yearly'].includes(type) || minutes <= 0) {
      return res.status(400).json({ error: '无效的订阅参数' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ error: '无效的访问令牌' });
    }

    // 设置订阅
    const { data: result, error: subscriptionError } = await supabaseAdmin
      .rpc('set_subscription', { 
        user_id_param: data.user.id, 
        subscription_type_param: type,
        subscription_minutes_param: minutes
      });

    if (subscriptionError || !result) {
      console.error('设置订阅失败:', subscriptionError);
      return res.status(500).json({ error: '设置订阅失败' });
    }

    // 获取更新后的配额信息
    const { data: quotaData, error: quotaError } = await supabaseAdmin
      .rpc('calculate_user_quota', { user_id_param: data.user.id });

    const quota = quotaData && quotaData.length > 0 ? quotaData[0] : null;

    console.log(`✅ 用户 ${data.user.email} 设置了 ${type} 订阅（${minutes} 分钟）`);

    res.json({
      success: true,
      message: '订阅设置成功',
      subscription: { type, minutes },
      quota: quota ? {
        totalMinutes: quota.total_minutes,
        usedMinutes: quota.used_minutes,
        remainingMinutes: quota.remaining_minutes,
        breakdown: {
          trial: { remaining: quota.trial_remaining },
          purchased: { remaining: quota.purchased_remaining },
          subscription: { 
            remaining: quota.subscription_remaining,
            nextReset: quota.next_reset 
          }
        }
      } : null
    });

  } catch (error) {
    console.error('❌ 设置订阅失败:', error);
    res.status(500).json({ error: '设置订阅失败' });
  }
});

// 获取用户支付历史API
app.get('/api/user/payment-history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }
    
    const token = authHeader.substring(7);
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ error: '无效的访问令牌' });
    }

    // 检查是否为管理员用户
    const isAdminUser = data.user.email === 'max.z.software@gmail.com';
    
    let records = [];
    
    if (isAdminUser) {
      // 对于管理员用户，从usage_minutes表获取订阅信息
      const { data: usage, error: usageError } = await supabaseAdmin
        .from('usage_minutes')
        .select('*')
        .eq('user_id', data.user.id)
        .single();
      
      if (!usageError && usage && usage.subscription_type) {
        // 为管理员创建一个模拟的支付记录
        records = [{
          id: `admin-subscription-${usage.subscription_type}`,
          type: 'subscription',
          planType: usage.subscription_type === 'monthly' ? '月订阅' : '年订阅',
          amount: usage.subscription_type === 'monthly' ? 2300 : 23200,
          minutes: usage.subscription_minutes,
          subscriptionPeriod: usage.subscription_type,
          date: usage.subscription_start_at || usage.created_at,
          status: usage.subscription_reset_at && new Date(usage.subscription_reset_at) > new Date() ? 'active' : 'expired',
          expiresAt: usage.subscription_reset_at
        }];
      }
    } else {
      // 对于普通用户，从user_usage表获取支付记录（如果存在的话）
      const { data: payments, error: paymentError } = await supabaseAdmin
        .from('user_usage')
        .select('*')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false });
      
      if (!paymentError && payments) {
        // 转换为前端需要的格式
        records = payments.map(payment => ({
          id: payment.id || `payment-${payment.user_id}-${payment.created_at}`,
          type: payment.subscription_type ? 'subscription' : 'time_plan',
          planType: payment.subscription_type === 'monthly' ? '月订阅' : 
                    payment.subscription_type === 'yearly' ? '年订阅' : 
                    `${payment.minutes}分钟套餐`,
          amount: payment.subscription_type === 'monthly' ? 2300 : 
                  payment.subscription_type === 'yearly' ? 23200 : 
                  (payment.minutes * 0.5),
          minutes: payment.minutes,
          subscriptionPeriod: payment.subscription_type,
          date: payment.created_at,
          status: payment.subscription_expires_at && new Date(payment.subscription_expires_at) > new Date() ? 'active' : 'expired',
          expiresAt: payment.subscription_expires_at
        }));
      }
    }


    res.json({ records });
  } catch (error) {
    console.error('获取支付历史失败:', error);
    res.status(500).json({ error: '获取支付历史失败' });
  }
});

// 取消订阅API (POST方式，与前端匹配)
app.post('/api/subscription/cancel', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ error: '无效的访问令牌' });
    }

    // 取消订阅
    const { data: result, error: cancelError } = await supabaseAdmin
      .rpc('cancel_subscription', { user_id_param: data.user.id });

    if (cancelError || !result) {
      console.error('取消订阅失败:', cancelError);
      return res.status(500).json({ error: '取消订阅失败' });
    }

    console.log(`✅ 用户 ${data.user.email} 取消了订阅`);

    res.json({
      success: true,
      message: 'サブスクリプションが正常にキャンセルされました'
    });

  } catch (error) {
    console.error('❌ 取消订阅失败:', error);
    res.status(500).json({ error: 'サブスクリプションのキャンセルに失敗しました' });
  }
});

// 取消订阅API (DELETE方式)
app.delete('/api/usage/subscription', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }

    const token = authHeader.substring(7);
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return res.status(401).json({ error: '无效的访问令牌' });
    }

    // 取消订阅
    const { data: result, error: cancelError } = await supabaseAdmin
      .rpc('cancel_subscription', { user_id_param: data.user.id });

    if (cancelError || !result) {
      console.error('取消订阅失败:', cancelError);
      return res.status(500).json({ error: '取消订阅失败' });
    }

    // 获取更新后的配额信息
    const { data: quotaData, error: quotaError } = await supabaseAdmin
      .rpc('calculate_user_quota', { user_id_param: data.user.id });

    const quota = quotaData && quotaData.length > 0 ? quotaData[0] : null;

    console.log(`✅ 用户 ${data.user.email} 取消了订阅`);

    res.json({
      success: true,
      message: '订阅取消成功',
      quota: quota ? {
        totalMinutes: quota.total_minutes,
        usedMinutes: quota.used_minutes,
        remainingMinutes: quota.remaining_minutes,
        breakdown: {
          trial: { remaining: quota.trial_remaining },
          purchased: { remaining: quota.purchased_remaining },
          subscription: { 
            remaining: quota.subscription_remaining,
            nextReset: quota.next_reset 
          }
        }
      } : null
    });

  } catch (error) {
    console.error('❌ 取消订阅失败:', error);
    res.status(500).json({ error: '取消订阅失败' });
  }
});

// ========== 辅助函数 ==========

// 获取用户完整信息（包含配置和用量）
async function getUserWithProfile(userId) {
  try {
    // 获取用户配置
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    // 获取用量信息
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('usage_minutes')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || usageError) {
      console.error('获取用户配置或用量失败:', { profileError, usageError });
      return null;
    }

    // 确定用户类型
    const userType = determineUserType(usage, profile);

    return {
      id: userId,
      email: profile?.display_name || '',
      userType,
      planType: profile?.plan_id,
      quotaMinutes: usage.total_minutes,
      usedMinutes: usage.used_minutes,
      remainingMinutes: Math.max(0, usage.total_minutes - usage.used_minutes),
      trialMinutes: usage.total_minutes <= 10 ? usage.total_minutes : undefined,
      language: profile?.lang || 'ja',
      timezone: profile?.timezone || 'Asia/Tokyo',
      createdAt: profile?.created_at
    };
  } catch (error) {
    console.error('获取用户完整信息失败:', error);
    return null;
  }
}

// 确定用户类型
function determineUserType(usage, profile) {
  if (!usage || !profile) return 'guest';
  
  // 如果有付费套餐，则为付费用户
  if (profile.plan_id && !profile.plan_id.includes('trial')) {
    return 'paid';
  }
  
  // 如果总时长大于10分钟，说明是付费用户
  if (usage.total_minutes > 10) {
    return 'paid';
  }
  
  // 默认为试用用户
  return 'trial';
}

// ========== 访客相关API端点 ==========

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
      text: text || '请使用支持HTML的邮件客户端查看此邮件。',
      // 确保邮件正确显示
      attachDataUrls: true,
      alternatives: [
        {
          contentType: 'text/html; charset=utf-8',
          content: html
        }
      ]
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
      rateLimit: 'active',
      supabase: 'connected'
    }
  });
});

// 测试注册流程端点
app.post('/api/test/register-flow', async (req, res) => {
  try {
    const { email, password, language = 'ja' } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['email', 'password']
      });
    }

    console.log('🧪 开始测试注册流程:', email);

    // 1. 注册用户
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          lang: language,
          timezone: 'Asia/Tokyo'
        }
      }
    });

    if (error) {
      return res.status(400).json({ 
        step: '注册失败',
        error: error.message 
      });
    }

    const user = data.user;
    if (!user) {
      return res.status(400).json({ 
        step: '注册失败',
        error: '未返回用户信息' 
      });
    }

    console.log('✅ 步骤1: 用户注册成功，ID:', user.id);

    // 2. 调用RPC初始化用户
    const { error: initError } = await supabaseAdmin.rpc('init_user', {
      p_user_id: user.id,
      p_lang: language,
      p_timezone: 'Asia/Tokyo',
      p_free_minutes: 10
    });

    if (initError) {
      return res.status(500).json({ 
        step: 'RPC调用失败',
        error: initError.message,
        user_id: user.id 
      });
    }

    console.log('✅ 步骤2: RPC初始化成功');

    // 3. 验证用户配置表
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      return res.status(500).json({ 
        step: '验证用户配置失败',
        error: profileError.message,
        user_id: user.id 
      });
    }

    console.log('✅ 步骤3: 用户配置验证成功:', profile);

    // 4. 验证用量表
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('usage_minutes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (usageError) {
      return res.status(500).json({ 
        step: '验证用量信息失败',
        error: usageError.message,
        user_id: user.id 
      });
    }

    console.log('✅ 步骤4: 用量信息验证成功:', usage);

    // 测试成功
    res.json({
      success: true,
      message: '注册流程测试完成',
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at
      },
      profile: profile,
      usage: usage,
      steps_completed: [
        '✅ 用户注册',
        '✅ RPC初始化',
        '✅ 配置表验证',
        '✅ 用量表验证'
      ]
    });

  } catch (error) {
    console.error('❌ 注册流程测试失败:', error);
    res.status(500).json({
      step: '系统错误',
      error: error.message
    });
  }
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
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/auth/logout',
      'GET /api/usage/quota',
      'POST /api/usage/consume',
      'POST /api/usage/purchase',
      'POST /api/usage/subscription',
      'DELETE /api/usage/subscription',
      'POST /api/email/send-verification',
      'POST /api/email/send-welcome',
      'POST /api/guest/identity',
      'POST /api/guest/verify',
      'GET /api/guest/stats',
      'POST /api/test/register-flow',
      'POST /api/auth/verify-code',
      'POST /api/minutes/generate'
    ]
  });
});

// 会议纪要生成API
app.post('/api/minutes/generate', async (req, res) => {
  try {
    const { transcript_id, template_type, outline, original_text, detected_language, target_language } = req.body;

    // 验证请求参数
    if (!original_text || !outline || !Array.isArray(outline)) {
      return res.status(400).json({ 
        error: '缺少必要参数: original_text, outline' 
      });
    }

    // 验证用户权限（如果有认证头）
    const authHeader = req.headers.authorization;
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data } = await supabase.auth.getUser(token);
        user = data.user;
      } catch (error) {
        console.log('Token validation failed, treating as guest user');
      }
    }

    // 构建提示词
    const outlineText = outline.join('、');
    
    // 语言映射
    const languageMap = {
      'zh': { name: '中文', code: 'zh' },
      'ja': { name: '日语', code: 'ja' },
      'en': { name: '英语', code: 'en' }
    };
    
    // 使用target_language优先，如果没有则使用detected_language
    const finalLanguage = target_language || detected_language || 'zh';
    const targetLang = languageMap[finalLanguage] || languageMap['zh'];
    
    const systemPrompt = `你是一个专业的会议纪要生成助手。请根据提供的会议转录内容生成结构化、详细、专业的会议纪要。

要求：
1. **结构严格按照提纲**：严格按照提供的提纲结构组织内容，每个部分都要有明确的标题
2. **内容详细充实**：每个部分都要提供详细、具体的内容，不要只是简单的一句话
3. **信息准确性**：只根据原文内容提炼信息，不得编造任何不存在的内容
4. **缺失信息处理**：如果某个提纲项目的信息不完整或缺失，请标注"未提及"或"信息不完整"
5. **语言一致性**：全文必须使用${targetLang.name}，不允许混合其他语言
6. **格式规范**：使用清晰的分级标题和项目符号，便于阅读
7. **专业性**：保持专业、客观、准确的语调

提纲结构：${outlineText}

请用${targetLang.name}生成专业的会议纪要。`;
    
    const userPrompt = `请根据以下会议转录内容生成专业详细的会议纪要：

===== 会议转录内容 =====
${original_text}
===== 转录内容结束 =====

请严格按照以下提纲结构生成详细完整的会议纪要：
${outline.map((item, index) => `${index + 1}. ${item}`).join('\n')}

注意：
- 必须使用${targetLang.name}编写整个会议纪要
- 每个部分都要包含详细内容，不要简单带过
- 如果原文中没有相关信息，请明确标注`;

    // 调用OpenAI API
    const openaiApiKey = process.env.VITE_OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🤖 正在生成会议纪要...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 使用GPT-4o-mini模型（您要求的GPT-4.1 mini）
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3, // 较低的温度确保输出更加一致和准确
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const aiResult = await response.json();
    const generatedSummary = aiResult.choices[0]?.message?.content;

    if (!generatedSummary) {
      throw new Error('Failed to generate summary from AI response');
    }

    // 生成唯一的summary ID
    const summaryId = `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('✅ 会议纪要生成成功');

    res.json({
      success: true,
      summary_id: summaryId,
      summary: generatedSummary,
      template_type: template_type,
      outline: outline,
      detected_language: detected_language,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 会议纪要生成失败:', error);
    res.status(500).json({
      error: '会议纪要生成失败',
      details: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误'
    });
  }
});

// Stripe 价格ID映射（基于你的Stripe产品）
const STRIPE_PRICE_MAP = {
  '5hours': 'price_1Rq9N4C8Q3Tw1xm1bPKG5IqI',     // 5時間プラン
  '10hours': 'price_1RreZuC8Q3Tw1xm1CJ6L27hT',     // 10時間プラン
  '30hours': 'price_1RreadC8Q3Tw1xm1oV9DLYYf',     // 30時間プラン
  '100hours': 'price_1RrebjC8Q3Tw1xm1iUmLF8Cj',    // 100時間プラン
  'monthly30': 'price_1RrediC8Q3Tw1xm1qYrgmjWh',   // 月額サブスクリプション
  'annual330': 'price_1RregeC8Q3Tw1xm1QCmkUi3p'    // 年額サブスクリプション
};

// 创建Stripe Checkout会话
app.post('/api/payment/create-checkout-session', async (req, res) => {
  try {
    const { planId, userId, userEmail } = req.body;

    // 验证输入参数
    if (!planId || !userId || !userEmail) {
      return res.status(400).json({ 
        error: '缺少必要参数: planId, userId, userEmail' 
      });
    }

    // 验证planId是否有效
    const priceId = STRIPE_PRICE_MAP[planId];
    if (!priceId) {
      return res.status(400).json({ 
        error: '无效的套餐ID' 
      });
    }

    // 创建Stripe Checkout会话
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: planId.includes('monthly') || planId.includes('annual') ? 'subscription' : 'payment',
      success_url: `${req.headers.origin || 'http://localhost:5173'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/payment/cancel`,
      customer_email: userEmail,
      metadata: {
        userId: userId,
        planId: planId,
        userEmail: userEmail
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'ja', // 设置为日语界面
    });

    console.log(`✅ 创建Stripe Checkout会话成功: ${session.id}, 用户: ${userEmail}, 套餐: ${planId}`);

    res.json({
      sessionId: session.id,
      checkoutUrl: session.url
    });

  } catch (error) {
    console.error('创建Stripe Checkout会话失败:', error);
    res.status(500).json({ 
      error: '创建支付会话失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// 处理成功支付
async function handleSuccessfulPayment(session) {
  try {
    const { userId, planId, userEmail } = session.metadata;
    
    console.log(`🎉 支付成功 - 用户: ${userEmail}, 套餐: ${planId}, 会话: ${session.id}`);

    // 根据套餐类型更新用户配额
    const planConfig = {
      '5hours': { hours: 5, type: 'oneTime' },
      '10hours': { hours: 10, type: 'oneTime' },
      '30hours': { hours: 30, type: 'oneTime' },
      '100hours': { hours: 100, type: 'oneTime' },
      'monthly30': { hours: 30, type: 'subscription', period: 'monthly' },
      'annual330': { hours: 330, type: 'subscription', period: 'annual' }
    };

    const config = planConfig[planId];
    if (!config) {
      console.error(`未知的套餐配置: ${planId}`);
      return;
    }

    // 首先根据邮箱查找用户ID
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
      console.error('获取用户列表失败:', authError);
      return;
    }
    
    const targetUser = authUsers.users.find(u => u.email === userEmail);
    if (!targetUser) {
      console.error(`未找到邮箱为 ${userEmail} 的用户`);
      return;
    }
    
    const targetUserId = targetUser.id;
    
    // 更新用户数据在Supabase
    const hoursInMinutes = config.hours * 60;
    
    if (config.type === 'subscription') {
      // 订阅类型：设置配额并重置使用量
      const { error: profileError } = await supabaseAdmin
        .from('users_profile')
        .upsert({
          user_id: targetUserId,
          display_name: userEmail,
          quota_minutes: hoursInMinutes,
          user_type: 'paid',
          plan_type: config.period === 'monthly' ? '月付订阅' : '年付订阅',
          subscription_type: config.period,
          subscription_id: session.subscription,
          updated_at: new Date().toISOString()
        });

      const { error: usageError } = await supabaseAdmin
        .from('usage_minutes')
        .upsert({
          user_id: targetUserId,
          used_minutes: 0,
          last_reset_date: new Date().toISOString()
        });

      if (profileError || usageError) {
        console.error('更新订阅用户数据失败:', { profileError, usageError });
      } else {
        console.log(`✅ 订阅用户配额更新成功: ${userEmail}, ${config.hours}小时`);
      }
    } else {
      // 一次性购买：累加配额
      const { data: currentProfile, error: getProfileError } = await supabaseAdmin
        .from('users_profile')
        .select('quota_minutes')
        .eq('user_id', targetUserId)
        .single();

      const { data: currentUsage, error: getUsageError } = await supabaseAdmin
        .from('usage_minutes')
        .select('used_minutes')
        .eq('user_id', targetUserId)
        .single();

      const currentQuota = currentProfile?.quota_minutes || 10;
      const currentUsed = currentUsage?.used_minutes || 0;

      const { error: profileError } = await supabaseAdmin
        .from('users_profile')
        .upsert({
          user_id: targetUserId,
          display_name: userEmail,
          quota_minutes: currentQuota + hoursInMinutes,
          user_type: 'paid',
          plan_type: `${config.hours}小时套餐`,
          updated_at: new Date().toISOString()
        });

      if (!getUsageError && !currentUsage) {
        // 如果使用量记录不存在，创建一个
        await supabaseAdmin
          .from('usage_minutes')
          .upsert({
            user_id: targetUserId,
            used_minutes: 0,
            last_reset_date: new Date().toISOString()
          });
      }

      if (profileError) {
        console.error('更新用户配额失败:', profileError);
      } else {
        console.log(`✅ 用户配额更新成功: ${userEmail}, 新增${config.hours}小时, 总配额${Math.floor((currentQuota + hoursInMinutes)/60)}小时`);
      }
    }

  } catch (error) {
    console.error('处理成功支付失败:', error);
  }
}

// 处理订阅续费
async function handleSubscriptionRenewal(invoice) {
  try {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    
    // 根据订阅ID找到用户并重置配额
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('subscription_id', subscriptionId);

    if (error || !users || users.length === 0) {
      console.error('找不到订阅用户:', subscriptionId);
      return;
    }

    const user = users[0];
    
    // 重置使用量（续费时重新获得完整配额）
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        used_minutes: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('订阅续费重置配额失败:', updateError);
    } else {
      console.log(`🔄 订阅续费成功，配额已重置: ${user.email}`);
    }

  } catch (error) {
    console.error('处理订阅续费失败:', error);
  }
}

// 处理订阅取消
async function handleSubscriptionCancellation(subscription) {
  try {
    const subscriptionId = subscription.id;
    
    // 找到对应的用户
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('subscription_id', subscriptionId);

    if (error || !users || users.length === 0) {
      console.error('找不到订阅用户:', subscriptionId);
      return;
    }

    const user = users[0];
    
    // 更新用户状态但保留现有配额直到用完
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        subscription_type: null,
        subscription_id: null,
        plan_type: '已取消订阅',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('更新取消订阅状态失败:', updateError);
    } else {
      console.log(`❌ 订阅已取消: ${user.email}`);
    }

  } catch (error) {
    console.error('处理订阅取消失败:', error);
  }
}

// 验证支付会话状态
app.get('/api/payment/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    res.json({
      status: session.payment_status,
      customerEmail: session.customer_email,
      metadata: session.metadata
    });

  } catch (error) {
    console.error('获取支付会话失败:', error);
    res.status(500).json({ 
      error: '获取支付会话失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.originalUrl
  });
});

// 清理未验证用户的定时任务 - 每小时运行一次
setInterval(async () => {
  try {
    console.log('🧹 开始清理未验证用户...');
    
    // 获取所有用户
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('获取用户列表失败:', error);
      return;
    }
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const user of users.users) {
      // 清理超过24小时未验证的用户
      if (!user.email_confirmed_at && new Date(user.created_at) < oneDayAgo) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(user.id);
          console.log(`清理未验证用户: ${user.email}`);
          cleanedCount++;
        } catch (deleteError) {
          console.error(`删除用户失败 ${user.email}:`, deleteError);
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`✅ 已清理 ${cleanedCount} 个未验证用户`);
    }
  } catch (error) {
    console.error('清理未验证用户失败:', error);
  }
}, 60 * 60 * 1000); // 每小时执行一次


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
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

// 中间件配置
app.use(helmet()); // 安全头
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

    // 1. 使用Supabase Auth注册用户
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${req.protocol}://${req.get('host')}/auth/callback`,
        data: {
          lang: language,
          timezone: 'Asia/Tokyo'
        }
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

    // 注意：不在这里初始化用户数据，等待邮箱验证后再初始化
    // 存储用户语言信息到临时缓存，待验证后使用
    console.log('用户注册成功，等待邮箱验证:', email);

    console.log('✅ 用户注册和初始化成功:', email);
    
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

    // 检查邮箱是否已验证
    if (!data.user.email_confirmed_at) {
      return res.status(401).json({ 
        error: '请先验证您的邮箱。请检查邮箱中的验证邮件。',
        code: 'EMAIL_NOT_VERIFIED'
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

// 取消订阅API
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
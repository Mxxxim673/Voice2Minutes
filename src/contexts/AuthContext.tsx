import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { sendVerificationEmail, generateVerificationCode, sendWelcomeEmail } from '../services/emailService';
import { useTranslation } from 'react-i18next';
import { guestIdentityService, type GuestValidationResult } from '../services/guestIdentityService';

export interface User {
  id: string;
  email: string;
  isEmailVerified: boolean;
  userType: 'guest' | 'trial' | 'paid';
  planType?: string;
  quotaMinutes: number;
  usedMinutes: number;
  trialMinutes?: number;
  subscriptionType?: 'monthly' | 'yearly' | 'one-time';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string) => Promise<User>;
  logout: () => void;
  continueAsGuest: () => void;
  verifyEmail: (token: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  updateUserQuota: (usedMinutes: number) => void;
  checkQuotaLimit: (requiredMinutes: number) => boolean;
  // 管理员功能
  setUser: (user: User | null) => void;
  setIsGuest: (isGuest: boolean) => void;
  // 访客身份验证
  validateGuestAccess: () => Promise<GuestValidationResult>;
  isGuestAccessAllowed: boolean;
  guestValidationResult: GuestValidationResult | null;
  // 确保访客模式初始化
  ensureGuestMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    code: string;
    timestamp: number;
  } | null>(null);
  const [isGuestAccessAllowed, setIsGuestAccessAllowed] = useState(true);
  const [guestValidationResult, setGuestValidationResult] = useState<GuestValidationResult | null>(null);

  useEffect(() => {
    // Check for existing authentication on app load
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const guestMode = localStorage.getItem('guestMode');
      const userData = localStorage.getItem('userData');
      const pendingVerification = localStorage.getItem('pendingVerification');
      
      if (guestMode === 'true') {
        setIsGuest(true);
        
        // 验证访客身份和使用限制
        await validateGuestAccess();
        
        // Create a guest user object
        setUser({
          id: 'guest',
          email: '',
          isEmailVerified: false,
          userType: 'guest',
          quotaMinutes: 5, // 5 minutes for guests
          usedMinutes: Number(localStorage.getItem('guestUsedMinutes') || '0'),
          createdAt: new Date().toISOString()
        });
      } else if (token && userData) {
        // 恢复已验证的用户会话
        const user = JSON.parse(userData);
        setUser(user);
        setIsGuest(false);
      } else if (pendingVerification) {
        // 恢复待验证状态
        const verificationData = JSON.parse(pendingVerification);
        
        // 检查验证码是否还在有效期内
        const now = Date.now();
        const codeAge = now - verificationData.timestamp;
        const CODE_EXPIRY = 10 * 60 * 1000; // 10分钟
        
        if (codeAge < CODE_EXPIRY) {
          setPendingVerification(verificationData);
          console.log('📧 检测到待验证的注册，请完成邮箱验证');
        } else {
          // 清理过期的验证数据
          localStorage.removeItem('pendingVerification');
          localStorage.removeItem('pendingUser');
          console.log('⏰ 验证码已过期，请重新注册');
          // 过期后保持未登录状态，不自动初始化访客模式
          setUser(null);
          setIsGuest(false);
        }
      } else {
        // 未登录用户，检查是否有访客使用记录
        const guestUsedMinutes = localStorage.getItem('guestUsedMinutes');
        const visitorId = localStorage.getItem('visitor_id');
        
        if (guestUsedMinutes && visitorId) {
          // 有访客使用记录，但保持未登录状态，不创建临时用户对象
          console.log('🔍 检测到未登录用户有访客使用记录，保持未登录状态');
          // 不设置用户对象，保持未登录状态
          setUser(null);
          setIsGuest(false);
        } else {
          // 完全的新用户
          console.log('🔍 检测到全新用户，保持未认证状态');
          setUser(null);
          setIsGuest(false);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // 出现错误时保持未认证状态
      setUser(null);
      setIsGuest(false);
    } finally {
      setLoading(false);
    }
  };

  // 初始化访客模式的函数
  const initializeGuestMode = async () => {
    try {
      localStorage.setItem('guestMode', 'true');
      setIsGuest(true);
      
      // 记录新的访客会话
      guestIdentityService.recordSession();
      
      // 获取访客身份信息（会自动从localStorage读取现有使用量）
      const identity = await guestIdentityService.getGuestIdentity();
      
      // 验证访客身份和使用限制
      const validationResult = await validateGuestAccess();
      
      // 同步localStorage中的使用量数据
      const existingUsage = Number(localStorage.getItem('guestUsedMinutes') || '0');
      const identityUsage = identity.usageInfo.totalMinutesUsed;
      const actualUsage = Math.max(existingUsage, identityUsage);
      
      // 更新使用量到最新值
      localStorage.setItem('guestUsedMinutes', actualUsage.toString());
      
      const guestUser = {
        id: 'guest',
        email: '',
        isEmailVerified: false,
        userType: 'guest' as const,
        quotaMinutes: 5, // 5 minutes for guests
        usedMinutes: actualUsage,
        createdAt: new Date().toISOString()
      };
      
      // 设置用户数据
      localStorage.setItem('userData', JSON.stringify(guestUser));
      setUser(guestUser);
      
      console.log('✅ 访客模式初始化完成');
      console.log(`📊 访客ID: ${identity.visitorId.substring(0, 8)}...`);
      console.log(`📊 设备指纹: ${identity.fingerprint.substring(0, 8)}...`);
      console.log(`📊 已用时长: ${actualUsage.toFixed(1)}分钟`);
      console.log(`📊 剩余时长: ${validationResult.remainingMinutes.toFixed(1)}分钟`);
      
    } catch (error) {
      console.error('❌ 访客模式初始化失败:', error);
    }
  };

  // 确保访客模式已初始化（供组件主动调用）
  const ensureGuestMode = async () => {
    // 如果已经是认证用户，不需要初始化访客模式
    if (user && !isGuest && localStorage.getItem('authToken')) {
      return;
    }
    
    // 如果已经是访客模式且有用户数据，只需更新配额信息
    if (isGuest && user && localStorage.getItem('guestMode') === 'true') {
      try {
        // 重新验证访客身份和配额
        const validationResult = await validateGuestAccess();
        const updatedGuestUser = {
          ...user,
          usedMinutes: validationResult.identity.usageInfo.totalMinutesUsed
        };
        setUser(updatedGuestUser);
        localStorage.setItem('userData', JSON.stringify(updatedGuestUser));
        console.log('✅ 访客配额信息已更新，剩余时长:', validationResult.remainingMinutes.toFixed(1), '分钟');
      } catch (error) {
        console.error('❌ 访客配额更新失败:', error);
      }
      return;
    }
    
    // 如果不是访客模式或没有用户数据，初始化访客模式
    console.log('🔄 主动初始化访客模式...');
    await initializeGuestMode();
  };

  const validateToken = async (token: string): Promise<User | null> => {
    try {
      const response = await fetch('/api/auth/validate', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  };

  const login = async (email: string, password: string): Promise<User> => {
    try {
      // 检查是否为管理员账号
      const adminEmail = 'max.z.software@gmail.com';
      const adminPassword = 'vhvspvtcphijptvx'; // Gmail APP密码
      
      if (email === adminEmail && password === adminPassword) {
        // 管理员账户始终使用标准的初始状态（10分钟试用，0分钟使用）
        // 检查是否已有管理员账户数据，如果有则保留其使用记录和购买记录
        const existingAdminData = localStorage.getItem('adminUserData');
        let adminUser: User;
        
        if (existingAdminData) {
          // 使用已存在的管理员数据，但确保基础配置正确
          const existingUser = JSON.parse(existingAdminData);
          adminUser = {
            id: 'admin',
            email: adminEmail,
            isEmailVerified: true,
            userType: existingUser.userType || 'trial', // 保持现有的用户类型（可能是paid）
            quotaMinutes: existingUser.quotaMinutes || 10, // 保持现有配额（可能已购买时长）
            usedMinutes: existingUser.usedMinutes || 0, // 保持现有使用记录
            trialMinutes: 10,
            planType: existingUser.planType, // 保持计划类型
            subscriptionType: existingUser.subscriptionType, // 保持订阅类型
            createdAt: existingUser.createdAt || new Date().toISOString()
          };
        } else {
          // 创建新的管理员用户（初始配额为0）
          adminUser = {
            id: 'admin',
            email: adminEmail,
            isEmailVerified: true,
            userType: 'trial', // 按注册用户规则，先是试用状态
            quotaMinutes: 0, // 管理员初始配额设为0
            usedMinutes: 0, // 从0开始统计
            trialMinutes: 0,
            createdAt: new Date().toISOString()
          };
        }
        
        // 保存管理员数据
        localStorage.setItem('adminUserData', JSON.stringify(adminUser));
        
        // 存储管理员认证信息
        localStorage.setItem('authToken', 'admin_token');
        localStorage.setItem('userData', JSON.stringify(adminUser));
        localStorage.removeItem('guestMode');
        localStorage.removeItem('guestUsedMinutes');
        
        setUser(adminUser);
        setIsGuest(false);
        
        console.log('🔑 管理员登录成功 - 遵循注册用户规则');
        return adminUser;
      }
      
      // 普通用户登录逻辑 - 模拟后端API调用
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const { user: userData, token } = await response.json();
      
      // Store token and clear guest mode
      localStorage.setItem('authToken', token);
      localStorage.removeItem('guestMode');
      localStorage.removeItem('guestUsedMinutes');
      
      setUser(userData);
      setIsGuest(false);
      
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string): Promise<User> => {
    try {
      // 生成验证码
      const verificationCode = generateVerificationCode();
      const currentLanguage = i18n.language || 'zh';
      
      // 发送验证邮件
      const emailSent = await sendVerificationEmail({
        email,
        verificationCode,
        language: currentLanguage
      });
      
      if (!emailSent) {
        throw new Error('验证邮件发送失败，请检查邮箱地址或稍后重试');
      }
      
      // 模拟用户注册（在实际应用中这里应该调用后端API）
      const userData: User = {
        id: `user_${Date.now()}`,
        email,
        isEmailVerified: false,
        userType: 'trial',
        quotaMinutes: 10, // 注册用户获得10分钟试用
        usedMinutes: 0,
        trialMinutes: 10,
        createdAt: new Date().toISOString()
      };
      
      // 存储待验证信息
      setPendingVerification({
        email,
        code: verificationCode,
        timestamp: Date.now()
      });
      
      // 临时存储用户数据（验证后正式激活）
      localStorage.setItem('pendingUser', JSON.stringify(userData));
      localStorage.setItem('pendingVerification', JSON.stringify({
        email,
        code: verificationCode,
        timestamp: Date.now()
      }));
      
      console.log('📧 注册成功，验证邮件已发送至:', email);
      return userData;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    // 清除所有认证相关数据
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('adminUserData');
    localStorage.removeItem('pendingVerification');
    localStorage.removeItem('pendingUser');
    
    // 只清除访客登录标识，保留访客身份数据以防重置配额
    localStorage.removeItem('guestMode');
    // 保留这些数据以维持同一用户识别：
    // - visitor_id (UUID)
    // - guest_identity (设备指纹等)
    // - guest_sessions (会话记录)
    // - guestUsedMinutes (使用量)
    
    // 清除其他应用数据
    localStorage.removeItem('transcriptionResult');
    
    // 重置状态到未登录状态
    setUser(null);
    setIsGuest(false);
    setPendingVerification(null);
    setGuestValidationResult(null);
    setIsGuestAccessAllowed(true);
    
    console.log('🚪 用户已登出，访客身份数据已保留');
  };

  const continueAsGuest = async () => {
    // 清除认证信息但保留访客数据
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('adminUserData');
    
    // 初始化访客模式（会读取现有使用量）
    await initializeGuestMode();
    
    console.log('👤 用户选择以访客身份继续');
  };

  const verifyEmail = async (inputCode: string): Promise<boolean> => {
    try {
      // 检查本地存储的验证信息
      const storedVerification = localStorage.getItem('pendingVerification');
      const storedUser = localStorage.getItem('pendingUser');
      
      if (!storedVerification || !storedUser) {
        console.error('没有找到待验证的用户信息');
        return false;
      }
      
      const verificationData = JSON.parse(storedVerification);
      const userData = JSON.parse(storedUser);
      
      // 检查验证码是否过期（10分钟）
      const now = Date.now();
      const codeAge = now - verificationData.timestamp;
      const CODE_EXPIRY = 10 * 60 * 1000; // 10分钟
      
      if (codeAge > CODE_EXPIRY) {
        console.error('验证码已过期');
        // 清理过期数据
        localStorage.removeItem('pendingVerification');
        localStorage.removeItem('pendingUser');
        setPendingVerification(null);
        return false;
      }
      
      // 验证码匹配检查
      if (inputCode !== verificationData.code) {
        console.error('验证码不正确');
        return false;
      }
      
      // 验证成功，激活用户账户
      const activatedUser: User = {
        ...userData,
        isEmailVerified: true,
        userType: 'trial' // 邮箱验证后转为试用用户
      };
      
      // 生成认证令牌（简化版）
      const authToken = `token_${activatedUser.id}_${Date.now()}`;
      
      // 保存用户信息和令牌
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userData', JSON.stringify(activatedUser));
      
      // 清理待验证数据
      localStorage.removeItem('pendingVerification');
      localStorage.removeItem('pendingUser');
      localStorage.removeItem('guestMode');
      localStorage.removeItem('guestUsedMinutes');
      
      // 更新状态
      setUser(activatedUser);
      setIsGuest(false);
      setPendingVerification(null);
      
      // 发送欢迎邮件
      const currentLanguage = i18n.language || 'zh';
      await sendWelcomeEmail(activatedUser.email, '', currentLanguage);
      
      console.log('✅ 邮箱验证成功，账户已激活:', activatedUser.email);
      return true;
    } catch (error) {
      console.error('Email verification failed:', error);
      return false;
    }
  };

  const resendVerificationEmail = async (): Promise<boolean> => {
    try {
      const storedVerification = localStorage.getItem('pendingVerification');
      if (!storedVerification) {
        console.error('没有找到待验证的邮箱信息');
        return false;
      }
      
      const verificationData = JSON.parse(storedVerification);
      const email = verificationData.email;
      
      // 生成新的验证码
      const newVerificationCode = generateVerificationCode();
      const currentLanguage = i18n.language || 'zh';
      
      // 发送新的验证邮件
      const emailSent = await sendVerificationEmail({
        email,
        verificationCode: newVerificationCode,
        language: currentLanguage
      });
      
      if (!emailSent) {
        throw new Error('验证邮件发送失败');
      }
      
      // 更新存储的验证信息
      const updatedVerification = {
        email,
        code: newVerificationCode,
        timestamp: Date.now()
      };
      
      localStorage.setItem('pendingVerification', JSON.stringify(updatedVerification));
      setPendingVerification(updatedVerification);
      
      console.log('📧 验证邮件已重新发送至:', email);
      return true;
    } catch (error) {
      console.error('Resend verification failed:', error);
      return false;
    }
  };

  const validateGuestAccess = async (): Promise<GuestValidationResult> => {
    try {
      console.log('🔍 开始验证访客身份...');
      
      const validationResult = await guestIdentityService.validateGuestAccess();
      setGuestValidationResult(validationResult);
      setIsGuestAccessAllowed(validationResult.isAllowed);
      
      // 强制上报身份信息到后端获取权威数据
      try {
        const serverResult = await guestIdentityService.reportGuestIdentity(validationResult.identity);
        console.log('🌐 服务器验证结果:', serverResult);
        
        // 使用服务器返回的权威数据更新验证结果
        if (serverResult.userData) {
          validationResult.identity.usageInfo.totalMinutesUsed = serverResult.userData.totalMinutesUsed;
          validationResult.remainingMinutes = serverResult.userData.remainingMinutes;
          validationResult.isAllowed = serverResult.userData.remainingMinutes > 0;
          
          console.log('🔄 使用服务器权威数据更新验证结果:', {
            totalMinutesUsed: validationResult.identity.usageInfo.totalMinutesUsed,
            remainingMinutes: validationResult.remainingMinutes,
            isAllowed: validationResult.isAllowed
          });
        }
      } catch (error) {
        console.warn('⚠️ 服务器验证失败，使用本地数据:', error);
        // 继续使用本地验证结果，但记录警告
      }
      
      // 如果有风险警告，在控制台输出
      if (validationResult.warnings.length > 0) {
        console.warn('⚠️ 访客使用风险警告:', validationResult.warnings);
      }
      
      console.log('✅ 访客身份验证完成:', {
        isAllowed: validationResult.isAllowed,
        remainingMinutes: validationResult.remainingMinutes,
        riskLevel: validationResult.riskLevel,
        warnings: validationResult.warnings
      });
      
      return validationResult;
    } catch (error) {
      console.error('❌ 访客身份验证失败:', error);
      
      // 如果验证失败，出于安全考虑，不允许访问
      const fallbackResult: GuestValidationResult = {
        isAllowed: false,
        remainingMinutes: 0,
        identity: {
          visitorId: 'unknown',
          fingerprint: 'unknown',
          usageInfo: {
            totalMinutesUsed: 5,
            sessionsCount: 0,
            lastUsedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          }
        },
        riskLevel: 'high',
        warnings: ['身份验证失败']
      };
      
      setGuestValidationResult(fallbackResult);
      setIsGuestAccessAllowed(false);
      
      return fallbackResult;
    }
  };

  const updateUserQuota = async (usedMinutes: number) => {
    // 检查是否为游客用户（无论登录状态如何）
    const isGuestUser = isGuest || !user || user.userType === 'guest';
    
    if (isGuestUser) {
      // 对于所有游客用户（包括未登录），统一使用访客身份服务
      const currentUsage = Number(localStorage.getItem('guestUsedMinutes') || '0');
      const minutesToAdd = usedMinutes - currentUsage;
      
      // 更新localStorage
      localStorage.setItem('guestUsedMinutes', usedMinutes.toString());
      
      // 更新访客身份服务中的使用量
      if (minutesToAdd > 0) {
        guestIdentityService.updateUsage(minutesToAdd);
        console.log(`🎵 访客使用量更新: +${minutesToAdd}分钟, 总计: ${usedMinutes}分钟`);
      }
      
      // 重新验证访客访问权限
      await validateGuestAccess();
      
      // 更新或创建游客用户对象
      const guestUser = {
        id: 'guest',
        email: '',
        isEmailVerified: false,
        userType: 'guest' as const,
        quotaMinutes: 5,
        usedMinutes: usedMinutes,
        createdAt: new Date().toISOString()
      };
      
      if (!user) {
        // 未登录用户：只更新使用量，不改变登录状态
        // 不设置 guestMode，保持未登录状态
        console.log('🔄 未登录用户使用配额，保持未登录状态');
        // 完全不设置用户状态，保持 user = null
        // setUser(guestUser); // 注释掉，避免自动登录
      } else if (isGuest) {
        // 已登录的访客用户，更新其使用量
        setUser(guestUser);
        localStorage.setItem('userData', JSON.stringify(guestUser));
        console.log('🔄 访客用户使用量已更新');
      }
      
    } else if (user) {
      // 认证用户（试用或付费用户）
      const updatedUser = { ...user, usedMinutes };
      setUser(updatedUser);
      
      // 同步更新 localStorage 中的用户数据
      localStorage.setItem('userData', JSON.stringify(updatedUser));
      
      // 如果是管理员，也同步更新 adminUserData
      if (user.email === 'max.z.software@gmail.com') {
        localStorage.setItem('adminUserData', JSON.stringify(updatedUser));
      }
      
      // Also sync with backend
      syncUsageWithBackend(usedMinutes);
    }
  };

  const syncUsageWithBackend = async (usedMinutes: number) => {
    try {
      await fetch('/api/usage/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ usedMinutes })
      });
    } catch (error) {
      console.error('Failed to sync usage:', error);
    }
  };

  const checkQuotaLimit = (requiredMinutes: number): boolean => {
    if (!user) return false;
    
    const remainingMinutes = user.quotaMinutes - user.usedMinutes;
    return remainingMinutes >= requiredMinutes;
  };

  const value: AuthContextType = {
    user,
    isGuest,
    isAuthenticated: !!user && !isGuest,
    login,
    register,
    logout,
    continueAsGuest,
    verifyEmail,
    resendVerificationEmail,
    updateUserQuota,
    checkQuotaLimit,
    // 管理员功能
    setUser,
    setIsGuest,
    // 访客身份验证
    validateGuestAccess,
    isGuestAccessAllowed,
    guestValidationResult,
    // 确保访客模式初始化
    ensureGuestMode
  };

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
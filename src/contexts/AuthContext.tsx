import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { sendVerificationEmail, generateVerificationCode, sendWelcomeEmail } from '../services/emailService';
import { useTranslation } from 'react-i18next';

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
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
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
          // 创建新的管理员用户（遵循注册账户规则）
          adminUser = {
            id: 'admin',
            email: adminEmail,
            isEmailVerified: true,
            userType: 'trial', // 按注册用户规则，先是试用状态
            quotaMinutes: 10, // 试用配额10分钟
            usedMinutes: 0, // 从0开始统计
            trialMinutes: 10,
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
    localStorage.removeItem('authToken');
    localStorage.removeItem('guestMode');
    localStorage.removeItem('guestUsedMinutes');
    setUser(null);
    setIsGuest(false);
  };

  const continueAsGuest = () => {
    localStorage.setItem('guestMode', 'true');
    localStorage.removeItem('authToken');
    
    setIsGuest(true);
    setUser({
      id: 'guest',
      email: '',
      isEmailVerified: false,
      userType: 'guest',
      quotaMinutes: 5, // 5 minutes for guests
      usedMinutes: Number(localStorage.getItem('guestUsedMinutes') || '0'),
      createdAt: new Date().toISOString()
    });
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

  const updateUserQuota = (usedMinutes: number) => {
    if (isGuest) {
      localStorage.setItem('guestUsedMinutes', usedMinutes.toString());
      setUser(prev => prev ? { ...prev, usedMinutes } : null);
    } else if (user) {
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
    setIsGuest
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
// 修复脚本：替换注册和验证函数
const fs = require('fs');

const authContextPath = '/Users/maxzhang/Documents/Voice2Minutes_claude/src/contexts/AuthContext.tsx';

// 读取文件
let content = fs.readFileSync(authContextPath, 'utf8');

// 替换register函数
const newRegisterFunction = `  const register = async (email: string, password: string): Promise<User> => {
    try {
      const currentLanguage = i18n.language || 'ja';
      
      // 使用后端API注册（包含自定义验证邮件发送）
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          language: currentLanguage
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '注册失败');
      }

      // 创建前端用户对象
      const userData: User = {
        id: result.user.id,
        email: result.user.email,
        isEmailVerified: false, // 需要邮件验证
        userType: 'trial',
        quotaMinutes: 10, // 注册用户获得10分钟试用
        usedMinutes: 0,
        trialMinutes: 10,
        createdAt: result.user.createdAt || new Date().toISOString()
      };
      
      // 存储待验证信息（后端已处理验证码发送）
      setPendingVerification({
        email,
        code: '', // 后端处理验证码，前端不需要存储
        timestamp: Date.now(),
        language: currentLanguage
      });
      
      // 临时存储用户数据（验证后正式激活）
      localStorage.setItem('pendingUser', JSON.stringify(userData));
      localStorage.setItem('pendingVerification', JSON.stringify({
        email,
        code: '',
        timestamp: Date.now(),
        language: currentLanguage
      }));
      
      console.log('📧 注册成功，验证邮件已发送至:', email);
      return userData;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };`;

// 替换verifyEmail函数
const newVerifyEmailFunction = `  const verifyEmail = async (inputCode: string): Promise<boolean> => {
    try {
      const storedVerification = localStorage.getItem('pendingVerification');
      const pendingUser = localStorage.getItem('pendingUser');
      
      if (!storedVerification || !pendingUser) {
        console.error('没有找到待验证的信息');
        return false;
      }
      
      const verificationData = JSON.parse(storedVerification);
      const userData = JSON.parse(pendingUser);
      
      // 检查验证码是否过期
      const now = Date.now();
      const codeAge = now - verificationData.timestamp;
      const CODE_EXPIRY = 10 * 60 * 1000; // 10分钟
      
      if (codeAge >= CODE_EXPIRY) {
        console.error('验证码已过期');
        // 清理过期数据
        localStorage.removeItem('pendingVerification');
        localStorage.removeItem('pendingUser');
        return false;
      }
      
      // 使用后端验证码验证API
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: verificationData.email,
          verificationCode: inputCode.trim()
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('验证码验证失败:', result.error);
        return false;
      }
      
      // 验证成功，激活用户账户
      const verifiedUser: User = {
        ...userData,
        isEmailVerified: true
      };
      
      // 存储用户数据并登录
      localStorage.setItem('authToken', 'supabase_session');
      localStorage.setItem('userData', JSON.stringify(verifiedUser));
      
      // 清理待验证数据
      localStorage.removeItem('pendingVerification');
      localStorage.removeItem('pendingUser');
      localStorage.removeItem('guestMode');
      
      // 设置用户状态
      setUser(verifiedUser);
      setIsGuest(false);
      setPendingVerification(null);
      
      console.log('✅ 邮箱验证成功，用户已登录:', verifiedUser.email);
      return true;
      
    } catch (error) {
      console.error('邮箱验证过程出错:', error);
      return false;
    }
  };`;

// 查找并替换register函数
const registerPattern = /const register = async[\s\S]*?catch \(error\) \{[\s\S]*?throw error;[\s\S]*?\};/;
content = content.replace(registerPattern, newRegisterFunction);

// 查找并替换verifyEmail函数
const verifyEmailPattern = /const verifyEmail = async[\s\S]*?catch \(error\) \{[\s\S]*?return false;[\s\S]*?\};/;
content = content.replace(verifyEmailPattern, newVerifyEmailFunction);

// 写回文件
fs.writeFileSync(authContextPath, content, 'utf8');

console.log('✅ AuthContext.tsx 已更新完成');
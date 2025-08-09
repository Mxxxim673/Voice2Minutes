// New register function for AuthContext.tsx
const register = async (email: string, password: string): Promise<User> => {
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
    
    // 存储待验证信息（不需要验证码，因为后端已经处理）
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
};
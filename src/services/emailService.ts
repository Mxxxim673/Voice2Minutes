// 邮箱服务 - 处理邮箱验证和通知
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface VerificationEmailData {
  email: string;
  verificationCode: string;
  userName?: string;
  language: string;
}

// Gmail SMTP 配置
const SMTP_CONFIG = {
  host: import.meta.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(import.meta.env.SMTP_PORT || '587'),
  user: import.meta.env.SMTP_USER || 'max.z.software@gmail.com',
  pass: import.meta.env.SMTP_PASS || 'vhvspvtcphijptvx',
  secure: import.meta.env.SMTP_SECURE === 'true',
  tls: import.meta.env.SMTP_TLS !== 'false',
  fromEmail: import.meta.env.FROM_EMAIL || 'max.z.software@gmail.com',
  fromName: import.meta.env.FROM_NAME || 'Voice2Minutes Team'
};

// 邮箱验证码生成
export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 邮箱模板 - 支持多语言
const getEmailTemplates = (language: string = 'zh') => {
  const templates = {
    zh: {
      verification: {
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
                <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">{{VERIFICATION_CODE}}</h1>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>⚠️ 重要提醒：</strong><br>
                  • 验证码有效期为 <strong>10分钟</strong><br>
                  • 请勿向任何人泄露您的验证码<br>
                  • 如果您没有注册账户，请忽略此邮件
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                验证成功后，您将获得：
              </p>
              
              <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                <li>🎯 <strong>10分钟免费试用时长</strong></li>
                <li>📁 音频文件上传功能</li>
                <li>📋 文本复制和导出功能</li>
                <li>📊 详细使用量统计</li>
                <li>🌍 多语言支持</li>
              </ul>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  此邮件由系统自动发送，请勿回复<br>
                  © 2025 Voice2Minutes. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Voice2Minutes - 邮箱验证码\n\n感谢您注册 Voice2Minutes！\n\n您的验证码是：{{VERIFICATION_CODE}}\n\n验证码有效期为10分钟，请及时使用。\n\n如果您没有注册账户，请忽略此邮件。\n\n© 2025 Voice2Minutes`
      }
    },
    en: {
      verification: {
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
                <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">{{VERIFICATION_CODE}}</h1>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>⚠️ Important Notice:</strong><br>
                  • Code expires in <strong>10 minutes</strong><br>
                  • Do not share your verification code with anyone<br>
                  • If you didn't register, please ignore this email
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                After verification, you'll get:
              </p>
              
              <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                <li>🎯 <strong>10 minutes free trial</strong></li>
                <li>📁 Audio file upload feature</li>
                <li>📋 Text copy and export functions</li>
                <li>📊 Detailed usage statistics</li>
                <li>🌍 Multi-language support</li>
              </ul>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  This email was sent automatically, please do not reply<br>
                  © 2025 Voice2Minutes. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Voice2Minutes - Email Verification Code\n\nThank you for registering with Voice2Minutes!\n\nYour verification code is: {{VERIFICATION_CODE}}\n\nThis code expires in 10 minutes.\n\nIf you didn't register, please ignore this email.\n\n© 2025 Voice2Minutes`
      }
    }
  };
  
  return templates[language as keyof typeof templates] || templates.zh;
};

// 发送验证邮件的函数（前端调用，实际发送在后端）
export const sendVerificationEmail = async (data: VerificationEmailData): Promise<boolean> => {
  try {
    const template = getEmailTemplates(data.language).verification;
    
    // 替换模板变量
    const emailData = {
      to: data.email,
      subject: template.subject,
      html: template.html.replace(/\{\{VERIFICATION_CODE\}\}/g, data.verificationCode),
      text: template.text.replace(/\{\{VERIFICATION_CODE\}\}/g, data.verificationCode),
      fromEmail: SMTP_CONFIG.fromEmail,
      fromName: SMTP_CONFIG.fromName
    };

    // 调用后端API发送邮件
    const response = await fetch('/api/email/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error(`邮件发送失败: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('邮件发送成功:', result);
    return true;
  } catch (error) {
    console.error('邮件发送失败:', error);
    return false;
  }
};

// 验证邮箱格式
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// 生成欢迎邮件模板
export const getWelcomeEmailTemplate = (language: string = 'zh', userName: string = '') => {
  const templates = {
    zh: {
      subject: '欢迎使用 Voice2Minutes！🎉',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 32px; margin: 0;">🎉 欢迎加入 Voice2Minutes！</h1>
            </div>
            
            <p style="color: #555; font-size: 18px; line-height: 1.6; margin-bottom: 25px;">
              ${userName ? `亲爱的 ${userName}，` : '您好！'}
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              感谢您完成邮箱验证！您的账户现已激活，可以开始享受我们的专业音频转文字服务了。
            </p>
            
            <div style="background: linear-gradient(135deg, #4a90e2, #357abd); border-radius: 8px; padding: 25px; margin: 30px 0; color: white;">
              <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎁 您的专属福利：</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>10分钟</strong> 免费试用时长</li>
                <li>支持多种音频格式上传</li>
                <li>一键复制和导出功能</li>
                <li>详细的使用量统计分析</li>
                <li>7种语言界面支持</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/audio-to-text" style="background: #4a90e2; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                🚀 立即开始使用
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                如有任何问题，请联系我们的客服团队<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `
    },
    en: {
      subject: 'Welcome to Voice2Minutes! 🎉',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 32px; margin: 0;">🎉 Welcome to Voice2Minutes!</h1>
            </div>
            
            <p style="color: #555; font-size: 18px; line-height: 1.6; margin-bottom: 25px;">
              ${userName ? `Dear ${userName},` : 'Hello!'}
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Thank you for completing email verification! Your account is now active and ready to use our professional audio-to-text service.
            </p>
            
            <div style="background: linear-gradient(135deg, #4a90e2, #357abd); border-radius: 8px; padding: 25px; margin: 30px 0; color: white;">
              <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎁 Your Exclusive Benefits:</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>10 minutes</strong> free trial quota</li>
                <li>Multiple audio format support</li>
                <li>One-click copy and export features</li>
                <li>Detailed usage analytics</li>
                <li>7 language interface support</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/audio-to-text" style="background: #4a90e2; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                🚀 Start Using Now
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                If you have any questions, please contact our support team<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `
    }
  };
  
  return templates[language as keyof typeof templates] || templates.zh;
};

// 发送欢迎邮件
export const sendWelcomeEmail = async (email: string, userName: string = '', language: string = 'zh'): Promise<boolean> => {
  try {
    const template = getWelcomeEmailTemplate(language, userName);
    
    const emailData = {
      to: email,
      subject: template.subject,
      html: template.html,
      fromEmail: SMTP_CONFIG.fromEmail,
      fromName: SMTP_CONFIG.fromName
    };

    const response = await fetch('/api/email/send-welcome', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    return response.ok;
  } catch (error) {
    console.error('欢迎邮件发送失败:', error);
    return false;
  }
};

export default {
  generateVerificationCode,
  sendVerificationEmail,
  validateEmail,
  sendWelcomeEmail,
  getWelcomeEmailTemplate,
  SMTP_CONFIG
};
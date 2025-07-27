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
    },
    ja: {
      verification: {
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
                <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">{{VERIFICATION_CODE}}</h1>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>⚠️ 重要なお知らせ：</strong><br>
                  • 認証コードの有効期限は <strong>10分間</strong> です<br>
                  • 認証コードを他人に教えないでください<br>
                  • アカウント登録をしていない場合は、このメールを無視してください
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                認証完了後に利用できる機能：
              </p>
              
              <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                <li>🎯 <strong>10分間の無料試用</strong></li>
                <li>📁 音声ファイルアップロード機能</li>
                <li>📋 テキストコピー・エクスポート機能</li>
                <li>📊 詳細な使用量統計</li>
                <li>🌍 多言語サポート</li>
              </ul>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  このメールは自動送信されています。返信しないでください<br>
                  © 2025 Voice2Minutes. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Voice2Minutes - メール認証コード\n\nVoice2Minutesにご登録いただき、ありがとうございます！\n\n認証コード: {{VERIFICATION_CODE}}\n\n認証コードの有効期限は10分間です。\n\nアカウント登録をしていない場合は、このメールを無視してください。\n\n© 2025 Voice2Minutes`
      }
    },
    ar: {
      verification: {
        subject: 'Voice2Minutes - رمز التحقق من البريد الإلكتروني',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; direction: rtl;">
            <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
                <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">خدمة تحويل الصوت إلى نص المهنية</p>
              </div>
              
              <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">التحقق من البريد الإلكتروني</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                شكراً لك على التسجيل في Voice2Minutes! يرجى استخدام رمز التحقق التالي:
              </p>
              
              <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: #333; font-size: 14px; margin-bottom: 10px;">رمز التحقق الخاص بك:</p>
                <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">{{VERIFICATION_CODE}}</h1>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>⚠️ إشعار مهم:</strong><br>
                  • الرمز صالح لمدة <strong>10 دقائق</strong><br>
                  • لا تشارك رمز التحقق مع أي شخص<br>
                  • إذا لم تقم بالتسجيل، يرجى تجاهل هذا البريد الإلكتروني
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                بعد التحقق، ستحصل على:
              </p>
              
              <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-right: 20px;">
                <li>🎯 <strong>10 دقائق</strong> تجربة مجانية</li>
                <li>📁 ميزة رفع الملفات الصوتية</li>
                <li>📋 وظائف النسخ والتصدير</li>
                <li>📊 إحصائيات الاستخدام التفصيلية</li>
                <li>🌍 دعم متعدد اللغات</li>
              </ul>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  تم إرسال هذا البريد الإلكتروني تلقائياً، يرجى عدم الرد عليه<br>
                  © 2025 Voice2Minutes. جميع الحقوق محفوظة.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Voice2Minutes - رمز التحقق من البريد الإلكتروني\n\nشكراً لك على التسجيل في Voice2Minutes!\n\nرمز التحقق: {{VERIFICATION_CODE}}\n\nالرمز صالح لمدة 10 دقائق.\n\nإذا لم تقم بالتسجيل، يرجى تجاهل هذا البريد الإلكتروني.\n\n© 2025 Voice2Minutes`
      }
    },
    es: {
      verification: {
        subject: 'Voice2Minutes - Código de Verificación por Email',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
                <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Servicio Profesional de Audio a Texto</p>
              </div>
              
              <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">Verificación de Email</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                ¡Gracias por registrarte en Voice2Minutes! Por favor usa el siguiente código de verificación:
              </p>
              
              <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: #333; font-size: 14px; margin-bottom: 10px;">Tu código de verificación es:</p>
                <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">{{VERIFICATION_CODE}}</h1>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>⚠️ Aviso Importante:</strong><br>
                  • El código expira en <strong>10 minutos</strong><br>
                  • No compartas tu código de verificación con nadie<br>
                  • Si no te registraste, ignora este email
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Después de la verificación, obtendrás:
              </p>
              
              <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                <li>🎯 <strong>10 minutos</strong> de prueba gratuita</li>
                <li>📁 Función de subida de archivos de audio</li>
                <li>📋 Funciones de copia y exportación de texto</li>
                <li>📊 Estadísticas detalladas de uso</li>
                <li>🌍 Soporte multiidioma</li>
              </ul>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  Este email fue enviado automáticamente, por favor no respondas<br>
                  © 2025 Voice2Minutes. Todos los derechos reservados.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Voice2Minutes - Código de Verificación por Email\n\n¡Gracias por registrarte en Voice2Minutes!\n\nTu código de verificación es: {{VERIFICATION_CODE}}\n\nEste código expira en 10 minutos.\n\nSi no te registraste, ignora este email.\n\n© 2025 Voice2Minutes`
      }
    },
    fr: {
      verification: {
        subject: 'Voice2Minutes - Code de Vérification Email',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
                <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Service Professionnel Audio vers Texte</p>
              </div>
              
              <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">Vérification Email</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                Merci de vous être inscrit à Voice2Minutes ! Veuillez utiliser le code de vérification suivant :
              </p>
              
              <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: #333; font-size: 14px; margin-bottom: 10px;">Votre code de vérification est :</p>
                <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">{{VERIFICATION_CODE}}</h1>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>⚠️ Avis Important :</strong><br>
                  • Le code expire dans <strong>10 minutes</strong><br>
                  • Ne partagez pas votre code de vérification<br>
                  • Si vous ne vous êtes pas inscrit, ignorez cet email
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Après vérification, vous obtiendrez :
              </p>
              
              <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                <li>🎯 <strong>10 minutes</strong> d'essai gratuit</li>
                <li>📁 Fonction de téléchargement de fichiers audio</li>
                <li>📋 Fonctions de copie et d'exportation de texte</li>
                <li>📊 Statistiques d'utilisation détaillées</li>
                <li>🌍 Support multilingue</li>
              </ul>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  Cet email a été envoyé automatiquement, veuillez ne pas répondre<br>
                  © 2025 Voice2Minutes. Tous droits réservés.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Voice2Minutes - Code de Vérification Email\n\nMerci de vous être inscrit à Voice2Minutes !\n\nVotre code de vérification est : {{VERIFICATION_CODE}}\n\nCe code expire dans 10 minutes.\n\nSi vous ne vous êtes pas inscrit, ignorez cet email.\n\n© 2025 Voice2Minutes`
      }
    },
    ru: {
      verification: {
        subject: 'Voice2Minutes - Код Подтверждения Email',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #4a90e2; font-size: 28px; margin: 0;">Voice2Minutes</h1>
                <p style="color: #666; font-size: 16px; margin: 10px 0 0 0;">Профессиональный Сервис Аудио в Текст</p>
              </div>
              
              <h2 style="color: #333; font-size: 22px; margin-bottom: 20px;">Подтверждение Email</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                Спасибо за регистрацию в Voice2Minutes! Пожалуйста, используйте следующий код подтверждения:
              </p>
              
              <div style="background: #f1f5f9; border: 2px dashed #4a90e2; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: #333; font-size: 14px; margin-bottom: 10px;">Ваш код подтверждения:</p>
                <h1 style="color: #4a90e2; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">{{VERIFICATION_CODE}}</h1>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>⚠️ Важное Уведомление:</strong><br>
                  • Код действителен в течение <strong>10 минут</strong><br>
                  • Не делитесь кодом подтверждения ни с кем<br>
                  • Если вы не регистрировались, проигнорируйте это письмо
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                После подтверждения вы получите:
              </p>
              
              <ul style="color: #555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
                <li>🎯 <strong>10 минут</strong> бесплатного пробного периода</li>
                <li>📁 Функцию загрузки аудиофайлов</li>
                <li>📋 Функции копирования и экспорта текста</li>
                <li>📊 Подробную статистику использования</li>
                <li>🌍 Поддержку нескольких языков</li>
              </ul>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  Это письмо отправлено автоматически, пожалуйста, не отвечайте на него<br>
                  © 2025 Voice2Minutes. Все права защищены.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Voice2Minutes - Код Подтверждения Email\n\nСпасибо за регистрацию в Voice2Minutes!\n\nВаш код подтверждения: {{VERIFICATION_CODE}}\n\nКод действителен в течение 10 минут.\n\nЕсли вы не регистрировались, проигнорируйте это письмо.\n\n© 2025 Voice2Minutes`
      }
    }
  };
  
  // 优化的语言回退机制 - 验证码邮件
  
  // 1. 优先使用用户选择的语言
  if (language && templates[language as keyof typeof templates]) {
    return templates[language as keyof typeof templates];
  }
  
  // 2. 如果用户语言不支持，尝试使用语言的主要部分（如 en-US -> en）
  const primaryLanguage = language ? language.split('-')[0] : 'zh';
  if (primaryLanguage && templates[primaryLanguage as keyof typeof templates]) {
    return templates[primaryLanguage as keyof typeof templates];
  }
  
  // 3. 最终回退到中文
  return templates.zh;
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
    },
    ja: {
      subject: 'Voice2Minutesへようこそ！🎉',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 32px; margin: 0;">🎉 Voice2Minutesへようこそ！</h1>
            </div>
            
            <p style="color: #555; font-size: 18px; line-height: 1.6; margin-bottom: 25px;">
              ${userName ? `${userName}様、` : 'こんにちは！'}
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              メール認証の完了、ありがとうございます！アカウントが有効化され、プロフェッショナルな音声文字起こしサービスをご利用いただけます。
            </p>
            
            <div style="background: linear-gradient(135deg, #4a90e2, #357abd); border-radius: 8px; padding: 25px; margin: 30px 0; color: white;">
              <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎁 専用特典：</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>10分間</strong>の無料試用時間</li>
                <li>多種音声フォーマットアップロード対応</li>
                <li>ワンクリックコピー・エクスポート機能</li>
                <li>詳細な使用量統計分析</li>
                <li>7言語インターフェース対応</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/audio-to-text" style="background: #4a90e2; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                🚀 今すぐ始める
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                ご質問がございましたら、サポートチームまでお気軽にお問い合わせください<br>
                © 2025 Voice2Minutes. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `
    },
    ar: {
      subject: 'مرحباً بك في Voice2Minutes! 🎉',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; direction: rtl;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 32px; margin: 0;">🎉 مرحباً بك في Voice2Minutes!</h1>
            </div>
            
            <p style="color: #555; font-size: 18px; line-height: 1.6; margin-bottom: 25px;">
              ${userName ? `عزيزي ${userName}،` : 'مرحباً!'}
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              شكراً لك على إكمال التحقق من البريد الإلكتروني! تم تفعيل حسابك ويمكنك الآن الاستمتاع بخدمة تحويل الصوت إلى نص المهنية.
            </p>
            
            <div style="background: linear-gradient(135deg, #4a90e2, #357abd); border-radius: 8px; padding: 25px; margin: 30px 0; color: white;">
              <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎁 مزاياك الحصرية:</h3>
              <ul style="margin: 0; padding-right: 20px; line-height: 1.8;">
                <li><strong>10 دقائق</strong> تجربة مجانية</li>
                <li>دعم رفع ملفات صوتية متعددة الأشكال</li>
                <li>وظائف النسخ والتصدير بنقرة واحدة</li>
                <li>تحليل إحصائيات الاستخدام التفصيلية</li>
                <li>دعم واجهة بـ 7 لغات</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/audio-to-text" style="background: #4a90e2; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                🚀 ابدأ الآن
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                إذا كان لديك أي أسئلة، يرجى التواصل مع فريق الدعم<br>
                © 2025 Voice2Minutes. جميع الحقوق محفوظة.
              </p>
            </div>
          </div>
        </div>
      `
    },
    es: {
      subject: '¡Bienvenido a Voice2Minutes! 🎉',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 32px; margin: 0;">🎉 ¡Bienvenido a Voice2Minutes!</h1>
            </div>
            
            <p style="color: #555; font-size: 18px; line-height: 1.6; margin-bottom: 25px;">
              ${userName ? `Estimado ${userName},` : '¡Hola!'}
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              ¡Gracias por completar la verificación de email! Tu cuenta está ahora activa y lista para usar nuestro servicio profesional de audio a texto.
            </p>
            
            <div style="background: linear-gradient(135deg, #4a90e2, #357abd); border-radius: 8px; padding: 25px; margin: 30px 0; color: white;">
              <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎁 Tus Beneficios Exclusivos:</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>10 minutos</strong> de prueba gratuita</li>
                <li>Soporte para múltiples formatos de audio</li>
                <li>Funciones de copia y exportación con un clic</li>
                <li>Análisis detallado de estadísticas de uso</li>
                <li>Soporte de interfaz en 7 idiomas</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/audio-to-text" style="background: #4a90e2; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                🚀 Empezar Ahora
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Si tienes alguna pregunta, contacta a nuestro equipo de soporte<br>
                © 2025 Voice2Minutes. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </div>
      `
    },
    fr: {
      subject: 'Bienvenue à Voice2Minutes ! 🎉',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 32px; margin: 0;">🎉 Bienvenue à Voice2Minutes !</h1>
            </div>
            
            <p style="color: #555; font-size: 18px; line-height: 1.6; margin-bottom: 25px;">
              ${userName ? `Cher ${userName},` : 'Bonjour !'}
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Merci d'avoir complété la vérification email ! Votre compte est maintenant activé et prêt à utiliser notre service professionnel audio vers texte.
            </p>
            
            <div style="background: linear-gradient(135deg, #4a90e2, #357abd); border-radius: 8px; padding: 25px; margin: 30px 0; color: white;">
              <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎁 Vos Avantages Exclusifs :</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>10 minutes</strong> d'essai gratuit</li>
                <li>Support de multiples formats audio</li>
                <li>Fonctions de copie et d'exportation en un clic</li>
                <li>Analyse détaillée des statistiques d'utilisation</li>
                <li>Support d'interface en 7 langues</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/audio-to-text" style="background: #4a90e2; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                🚀 Commencer Maintenant
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Si vous avez des questions, contactez notre équipe de support<br>
                © 2025 Voice2Minutes. Tous droits réservés.
              </p>
            </div>
          </div>
        </div>
      `
    },
    ru: {
      subject: 'Добро пожаловать в Voice2Minutes! 🎉',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4a90e2; font-size: 32px; margin: 0;">🎉 Добро пожаловать в Voice2Minutes!</h1>
            </div>
            
            <p style="color: #555; font-size: 18px; line-height: 1.6; margin-bottom: 25px;">
              ${userName ? `Уважаемый ${userName},` : 'Привет!'}
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Спасибо за завершение подтверждения email! Ваш аккаунт активирован и готов к использованию нашего профессионального сервиса аудио в текст.
            </p>
            
            <div style="background: linear-gradient(135deg, #4a90e2, #357abd); border-radius: 8px; padding: 25px; margin: 30px 0; color: white;">
              <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎁 Ваши Эксклюзивные Преимущества:</h3>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>10 минут</strong> бесплатного пробного периода</li>
                <li>Поддержка множественных аудиоформатов</li>
                <li>Функции копирования и экспорта одним кликом</li>
                <li>Детальная аналитика статистики использования</li>
                <li>Поддержка интерфейса на 7 языках</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/audio-to-text" style="background: #4a90e2; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                🚀 Начать Сейчас
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Если у вас есть вопросы, свяжитесь с нашей службой поддержки<br>
                © 2025 Voice2Minutes. Все права защищены.
              </p>
            </div>
          </div>
        </div>
      `
    }
  };
  
  // 优化的语言回退机制 - 欢迎邮件
  
  // 1. 优先使用用户选择的语言
  if (language && templates[language as keyof typeof templates]) {
    return templates[language as keyof typeof templates];
  }
  
  // 2. 如果用户语言不支持，尝试使用语言的主要部分（如 en-US -> en）
  const primaryLanguage = language ? language.split('-')[0] : 'zh';
  if (primaryLanguage && templates[primaryLanguage as keyof typeof templates]) {
    return templates[primaryLanguage as keyof typeof templates];
  }
  
  // 3. 最终回退到中文
  return templates.zh;
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
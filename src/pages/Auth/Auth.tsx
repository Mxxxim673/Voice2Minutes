import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/config';
import { useAuth } from '../../hooks/useAuth';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import LanguageSelector from '../../components/LanguageSelector/LanguageSelector';
import './Auth.css';

type AuthMode = 'login' | 'register' | 'verify' | 'reset-password' | 'reset-verify';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, register, continueAsGuest, verifyEmail, resendVerificationEmail } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    verificationCode: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        navigate('/', { replace: true });
      } else if (mode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error(t('auth.passwordMismatch'));
        }
        if (formData.password.length < 6) {
          throw new Error(t('auth.passwordTooShort'));
        }
        
        await register(formData.email, formData.password);
        setSuccess(t('auth.registerSuccess'));
        setMode('verify');
      } else if (mode === 'verify') {
        const success = await verifyEmail(formData.verificationCode);
        if (success) {
          setSuccess(t('auth.verifySuccess'));
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 2000);
        } else {
          throw new Error(t('auth.verifyFailed'));
        }
      } else if (mode === 'reset-password') {
        // 发送密码重置验证码
        const currentLanguage = i18n.language || 'ja';
        const response = await fetch('/api/auth/send-reset-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: formData.email,
            language: currentLanguage
          })
        });
        
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || t('auth.resetCodeSendFailed'));
        }
        
        setSuccess(t('auth.resetCodeSent'));
        setMode('reset-verify');
      } else if (mode === 'reset-verify') {
        // 验证重置码并重置密码
        if (formData.newPassword !== formData.confirmNewPassword) {
          throw new Error(t('auth.passwordMismatch'));
        }
        if (formData.newPassword.length < 6) {
          throw new Error(t('auth.passwordTooShort'));
        }
        
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            verificationCode: formData.verificationCode,
            newPassword: formData.newPassword
          })
        });
        
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || t('auth.resetFailed'));
        }
        
        setSuccess(t('auth.resetSuccess'));
        setTimeout(() => {
          setMode('login');
          setFormData(prev => ({ ...prev, password: '', newPassword: '', confirmNewPassword: '', verificationCode: '' }));
        }, 2000);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const success = await resendVerificationEmail();
      if (success) {
        setSuccess(t('auth.verificationResent'));
      } else {
        setError(t('auth.resendFailed'));
      }
    } catch {
      setError(t('auth.resendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    continueAsGuest();
    navigate('/', { replace: true });
  };

  const renderLoginForm = () => (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="form-group">
        <label htmlFor="email">{t('auth.email')}</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          required
          className="form-input"
          placeholder={t('auth.emailPlaceholder')}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="password">{t('auth.password')}</label>
        <div className="password-input-container">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            className="form-input"
            placeholder={t('auth.passwordPlaceholder')}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
      </div>
      
      <button type="submit" className="button button-primary auth-submit" disabled={loading}>
        {loading ? t('common.loading') : t('auth.login')}
      </button>
      
      <div className="auth-footer">
        <p>
          {t('auth.noAccount')}{' '}
          <button type="button" className="link-button" onClick={() => setMode('register')}>
            {t('auth.register')}
          </button>
        </p>
        <p>
          <button type="button" className="link-button" onClick={() => setMode('reset-password')}>
            {t('auth.forgotPassword')}
          </button>
        </p>
      </div>
    </form>
  );

  const renderRegisterForm = () => (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="form-group">
        <label htmlFor="email">{t('auth.email')}</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          required
          className="form-input"
          placeholder={t('auth.emailPlaceholder')}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="password">{t('auth.password')}</label>
        <div className="password-input-container">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            className="form-input"
            placeholder={t('auth.passwordPlaceholder')}
            minLength={6}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
        <div className="form-hint">
          {t('auth.passwordHint')}
        </div>
      </div>
      
      <div className="form-group">
        <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
        <div className="password-input-container">
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
            className="form-input"
            placeholder={t('auth.confirmPasswordPlaceholder')}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
      </div>
      
      <button type="submit" className="button button-primary auth-submit" disabled={loading}>
        {loading ? t('common.loading') : t('auth.register')}
      </button>
      
      <div className="auth-footer">
        <p>
          {t('auth.hasAccount')}{' '}
          <button type="button" className="link-button" onClick={() => setMode('login')}>
            {t('auth.login')}
          </button>
        </p>
      </div>
    </form>
  );

  const renderVerifyForm = () => (
    <div className="auth-form">
      <div className="verify-notice">
        <div className="verify-icon">📧</div>
        <h3>{t('auth.verifyTitle')}</h3>
        <p>{t('auth.verifyDescription', { email: formData.email })}</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="verificationCode">{t('auth.verificationCode')}</label>
          <input
            type="text"
            id="verificationCode"
            name="verificationCode"
            value={formData.verificationCode}
            onChange={handleInputChange}
            required
            className="form-input verification-input"
            placeholder="123456"
            maxLength={6}
          />
        </div>
        
        <button type="submit" className="button button-primary auth-submit" disabled={loading}>
          {loading ? t('common.loading') : t('auth.verify')}
        </button>
      </form>
      
      <div className="auth-footer">
        <p>
          {t('auth.noVerificationEmail')}{' '}
          <button type="button" className="link-button" onClick={handleResendVerification} disabled={loading}>
            {t('auth.resendVerification')}
          </button>
        </p>
      </div>
    </div>
  );

  const renderResetPasswordForm = () => (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="form-group">
        <label htmlFor="email">{t('auth.email')}</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          required
          className="form-input"
          placeholder={t('auth.emailPlaceholder')}
        />
      </div>
      
      <button type="submit" className="button button-primary auth-submit" disabled={loading}>
        {loading ? t('common.loading') : t('auth.sendResetCode')}
      </button>
      
      <div className="auth-footer">
        <p>
          <button type="button" className="link-button" onClick={() => setMode('login')}>
            {t('auth.backToLogin')}
          </button>
        </p>
      </div>
    </form>
  );

  const renderResetVerifyForm = () => (
    <div className="auth-form">
      <div className="verify-notice">
        <div className="verify-icon">🔒</div>
        <h3>{t('auth.resetPasswordTitle')}</h3>
        <p>{t('auth.resetPasswordDescription', { email: formData.email })}</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="verificationCode">{t('auth.verificationCode')}</label>
          <input
            type="text"
            id="verificationCode"
            name="verificationCode"
            value={formData.verificationCode}
            onChange={handleInputChange}
            required
            className="form-input verification-input"
            placeholder="123456"
            maxLength={6}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="newPassword">{t('auth.newPassword')}</label>
          <div className="password-input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder={t('auth.newPasswordPlaceholder')}
              minLength={6}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <div className="form-hint">
            {t('auth.passwordHint')}
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmNewPassword">{t('auth.confirmNewPassword')}</label>
          <div className="password-input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmNewPassword"
              name="confirmNewPassword"
              value={formData.confirmNewPassword}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder={t('auth.confirmPasswordPlaceholder')}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>
        
        <button type="submit" className="button button-primary auth-submit" disabled={loading}>
          {loading ? t('common.loading') : t('auth.resetPassword')}
        </button>
      </form>
      
      <div className="auth-footer">
        <p>
          <button type="button" className="link-button" onClick={() => setMode('login')}>
            {t('auth.backToLogin')}
          </button>
        </p>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      {/* 左侧品牌区域 */}
      <div className="auth-brand-section">
        <div className="brand-content">
          <h1 className="brand-title">Voice2Minutes</h1>
          <p className="brand-subtitle">{t('auth.brandSubtitle')}</p>
          <div className="brand-features">
            <div className="feature-item">
              <span className="feature-icon">🎯</span>
              <span>{t('auth.brandFeature1')}</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span>{t('auth.brandFeature2')}</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🌍</span>
              <span>{t('auth.brandFeature3')}</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✨</span>
              <span>{t('auth.brandFeature4')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 中央登录区域 */}
      <div className="auth-main-section">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">
              {mode === 'login' && t('auth.welcomeBack')}
              {mode === 'register' && t('auth.createAccount')}
              {mode === 'verify' && t('auth.verifyEmail')}
              {mode === 'reset-password' && t('auth.resetPasswordTitle')}
              {mode === 'reset-verify' && t('auth.resetPasswordTitle')}
            </h1>
            {!['verify', 'reset-verify'].includes(mode) && (
              <p className="auth-subtitle">
                {mode === 'login' && t('auth.loginSubtitle')}
                {mode === 'register' && t('auth.registerSubtitle')}
                {mode === 'reset-password' && t('auth.resetPasswordSubtitle')}
              </p>
            )}
          </div>

          <div className="auth-content">
            {error && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                {error}
              </div>
            )}
            
            {success && (
              <div className="alert alert-success">
                <span className="alert-icon">✅</span>
                {success}
              </div>
            )}

            {mode === 'login' && renderLoginForm()}
            {mode === 'register' && renderRegisterForm()}
            {mode === 'verify' && renderVerifyForm()}
            {mode === 'reset-password' && renderResetPasswordForm()}
            {mode === 'reset-verify' && renderResetVerifyForm()}

            {!['verify', 'reset-password', 'reset-verify'].includes(mode) && (
              <>
                <div className="auth-divider">
                  <span>{t('auth.dividerOr')}</span>
                </div>

                <button onClick={handleGuestMode} className="button button-secondary guest-button">
                  <span className="guest-icon">👤</span>
                  {t('auth.continueAsGuest')}
                </button>

                <div className="guest-simple-notice">
                  <p>{t('auth.guestSimpleNotice')}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右侧控制区域 */}
      <div className="auth-controls-section">
        <div className="controls-content">
          <div className="control-group">
            <div className="control-label">{t('auth.themeControl')}</div>
            <ThemeToggle />
          </div>
          <div className="control-group">
            <div className="control-label">{t('auth.languageControl')}</div>
            <LanguageSelector />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
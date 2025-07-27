import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import './AuthCallback.css';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { checkExistingAuth } = useAuth();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 处理邮箱验证回调...');
        
        // 使用 exchangeCodeForSession 处理回调
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        
        if (error) {
          console.error('❌ 邮箱验证失败:', error);
          setStatus('error');
          setMessage(error.message || '邮箱验证失败');
          return;
        }

        if (data.user) {
          console.log('✅ 邮箱验证成功:', data.user.email);
          setStatus('success');
          setMessage('邮箱验证成功！正在跳转...');
          
          // 确保用户数据完整性
          try {
            const response = await fetch('/api/auth/ensure-user-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userId: data.user.id,
                email: data.user.email
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('✅ 用户数据检查完成:', result.message);
            } else {
              console.warn('⚠️ 用户数据检查失败');
            }
          } catch (error) {
            console.warn('⚠️ 用户数据检查出错:', error);
          }
          
          // 等待认证上下文更新
          setTimeout(async () => {
            await checkExistingAuth();
            navigate('/', { replace: true });
          }, 2000);
        } else {
          setStatus('error');
          setMessage('验证过程中未获取到用户信息');
        }
      } catch (error) {
        console.error('❌ 处理回调时发生错误:', error);
        setStatus('error');
        setMessage('处理验证时发生错误');
      }
    };

    handleAuthCallback();
  }, [navigate, checkExistingAuth]);

  return (
    <div className="auth-callback">
      <div className="auth-callback-container">
        <div className="auth-callback-content">
          {status === 'loading' && (
            <>
              <div className="loading-spinner"></div>
              <h2>{t('auth.verifying')}</h2>
              <p>{t('auth.verifyingDescription')}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="success-icon">✅</div>
              <h2>{t('auth.verifySuccess')}</h2>
              <p>{message}</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="error-icon">❌</div>
              <h2>{t('auth.verifyError')}</h2>
              <p>{message}</p>
              <button 
                className="retry-button"
                onClick={() => navigate('/auth', { replace: true })}
              >
                {t('auth.backToLogin')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
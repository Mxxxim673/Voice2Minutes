import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { getUserQuota } from '../../services/usageService';
import { supabase } from '../../lib/supabase';
import './MyPage.css';

interface UserInfo {
  email: string;
  userType: string;
  quotaMinutes: number;
  usedMinutes: number;
  createdAt: string;
}

interface PaymentRecord {
  id: string;
  type: 'time_plan' | 'subscription';
  planType: string;
  amount: number;
  minutes?: number;
  subscriptionPeriod?: 'monthly' | 'yearly';
  date: string;
  status: 'active' | 'cancelled' | 'expired';
  expiresAt?: string;
}

const MyPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isGuest, setUser } = useAuth();

  // 获取真实的认证token
  const getAuthToken = async (): Promise<string | null> => {
    // 管理员用户特殊处理
    if (user?.email === 'max.z.software@gmail.com') {
      return 'admin_token';
    }
    
    // Supabase用户获取真实JWT token
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return session.access_token;
      }
    } catch (error) {
      console.error('获取Supabase token失败:', error);
    }
    
    // 回退到localStorage中的token（可能是假token）
    return localStorage.getItem('authToken');
  };
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      if (user && !isGuest) {
        // Load user quota info
        const quota = await getUserQuota();
        
        // 检查是否为管理员
        const isAdmin = user.email === 'max.z.software@gmail.com';
        const actualUserType = isAdmin ? 'admin' : user.userType;
        
        setUserInfo({
          email: user.email,
          userType: actualUserType,
          quotaMinutes: quota.totalMinutes,
          usedMinutes: quota.usedMinutes,
          createdAt: user.createdAt || new Date().toISOString()
        });

        // Load payment records from server or localStorage for admin
        try {
          if (isAdmin) {
            // 管理员用户从 localStorage 读取模拟记录
            const adminRecords = JSON.parse(localStorage.getItem('adminPaymentRecords') || '[]');
            setPaymentRecords(adminRecords);
          } else {
            // 普通用户从服务器获取
            const token = await getAuthToken();
            if (token) {
              const response = await fetch('/api/user/payment-history', {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
                const paymentData = await response.json();
                setPaymentRecords(paymentData.records || []);
              } else {
                setPaymentRecords([]);
              }
            } else {
              setPaymentRecords([]);
            }
          }
        } catch (error) {
          console.log('Payment history not available yet');
          setPaymentRecords([]);
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert(t('myPage.passwordMismatch'));
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      alert(t('myPage.passwordTooShort'));
      return;
    }

    try {
      // 获取真实的认证token
      const token = await getAuthToken();
      if (!token) {
        throw new Error('无法获取认证token，请重新登录');
      }

      // 调用API修改密码
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '密码修改失败');
      }

      alert(t('myPage.passwordChangeSuccess'));
      setShowPasswordChangeModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Password change failed:', error);
      alert(error.message || t('myPage.passwordChangeError'));
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    const confirmMessage = t('myPage.cancelSubscriptionConfirm', {
      details: t('myPage.cancelSubscriptionDetails')
    });
    
    if (confirm(confirmMessage)) {
      try {
        const isAdmin = user?.email === 'max.z.software@gmail.com';
        
        if (isAdmin) {
          // 管理员用户：更新localStorage中的记录状态
          const adminRecords = JSON.parse(localStorage.getItem('adminPaymentRecords') || '[]');
          const updatedRecords = adminRecords.map((record: any) => 
            record.id === subscriptionId ? { ...record, status: 'cancelled' } : record
          );
          localStorage.setItem('adminPaymentRecords', JSON.stringify(updatedRecords));
          
          // 更新用户类型为普通用户（取消订阅后）
          if (user) {
            const updatedUser = { ...user, userType: 'trial' as const, planType: undefined, subscriptionType: undefined };
            setUser(updatedUser);
            localStorage.setItem('userData', JSON.stringify(updatedUser));
            localStorage.setItem('adminUserData', JSON.stringify(updatedUser));
          }
          
          alert(t('myPage.subscriptionCancelSuccess'));
          loadUserData();
        } else {
          // 普通用户：调用API
          const token = await getAuthToken();
          if (!token) {
            throw new Error('无法获取认证token，请重新登录');
          }

          const response = await fetch('/api/subscription/cancel', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subscriptionId: subscriptionId
            })
          });

          if (!response.ok) {
            throw new Error('Failed to cancel subscription');
          }

          const result = await response.json();
          
          if (result.success) {
            alert(t('myPage.subscriptionCancelSuccess'));
            loadUserData();
          } else {
            throw new Error(result.message || 'Cancellation failed');
          }
        }
      } catch (error) {
        console.error('Subscription cancellation failed:', error);
        alert(t('myPage.subscriptionCancelError'));
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  const calculateRemainingDays = (expiresAt: string) => {
    const now = new Date();
    const expireDate = new Date(expiresAt);
    const diffTime = expireDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const formatExpiryInfo = (record: PaymentRecord) => {
    if (record.type !== 'subscription' || !record.expiresAt) return null;
    
    const remainingDays = calculateRemainingDays(record.expiresAt);
    const expireDate = formatDate(record.expiresAt);
    
    if (record.status === 'active') {
      return t('myPage.subscriptionExpiry.continuesUntil', { date: expireDate }) + 
             '（' + t('myPage.subscriptionExpiry.autoRenewalIn', { days: remainingDays }) + '）';
    }
    return t('myPage.subscriptionExpiry.validUntil', { date: expireDate });
  };

  const getUserTypeText = (userType: string) => {
    switch (userType) {
      case 'guest': return t('myPage.userTypes.guest');
      case 'trial': return t('myPage.userTypes.trial');
      case 'paid': return t('myPage.userTypes.paid');
      case 'subscription': return t('myPage.userTypes.subscription');
      case 'admin': return t('myPage.userTypes.admin');
      default: return t('myPage.userTypes.unknown');
    }
  };

  if (!user || isGuest) {
    return (
      <div className="mypage-page">
        <div className="container">
          <div className="mypage-blur-overlay">
            <div className="mypage-blur-content">
              <div className="page-header">
                <h1 className="page-title">{t('myPage.title')}</h1>
              </div>
              
              <div className="mypage-sections blurred">
                <div className="mypage-card">
                  <h3>{t('myPage.userInfo')}</h3>
                  <div className="user-email">****@****.***</div>
                  <div className="user-type">**** {t('myPage.user')}</div>
                </div>
                
                <div className="mypage-actions blurred">
                  <button className="button button-primary" disabled>
                    {t('myPage.goToUsage')}
                  </button>
                  <button className="button button-primary" disabled>
                    {t('myPage.goToPricing')}
                  </button>
                  <button className="button button-secondary" disabled>
                    {t('myPage.changePassword')}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="guest-notice">
              <h2>{t('myPage.loginToUnlock')}</h2>
              <button 
                onClick={() => window.location.href = '/auth'}
                className="button button-primary"
              >
                {t('auth.login')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mypage-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mypage-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{t('myPage.title')}</h1>
        </div>

        {/* User Information */}
        <div className="mypage-card">
          <h3>{t('myPage.userInfo')}</h3>
          <div className="user-info-grid">
            <div className="info-item">
              <label>{t('myPage.email')}</label>
              <div className="info-value">{userInfo?.email}</div>
            </div>
            <div className="info-item">
              <label>{t('myPage.userType')}</label>
              <div className="info-value">{getUserTypeText(userInfo?.userType || 'unknown')}</div>
            </div>
            <div className="info-item">
              <label>{t('myPage.memberSince')}</label>
              <div className="info-value">{formatDate(userInfo?.createdAt || '')}</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mypage-actions">
          <button 
            onClick={() => window.location.href = '/usage'}
            className="button button-primary"
          >
            <span className="button-icon">📊</span>
            {t('myPage.goToUsage')}
          </button>
          <button 
            onClick={() => window.location.href = '/pricing'}
            className="button button-primary"
          >
            <span className="button-icon">💎</span>
            {t('myPage.goToPricing')}
          </button>
          <button 
            onClick={() => setShowPasswordChangeModal(true)}
            className="button button-secondary"
          >
            <span className="button-icon">🔒</span>
            {t('myPage.changePassword')}
          </button>
        </div>

        {/* Payment Records */}
        <div className="mypage-card">
          <h3>{t('myPage.paymentHistory')}</h3>
          {paymentRecords.length === 0 ? (
            <div className="empty-records">
              <p>{t('myPage.noPaymentRecords')}</p>
              <button 
                className="button button-warning button-small disabled"
                disabled={true}
                title={t('myPage.noActiveSubscription')}
              >
                {t('myPage.cancelSubscription')}
              </button>
            </div>
          ) : (
            <div className="payment-records">
              {paymentRecords.map((record) => (
                <div key={record.id} className="payment-record">
                  <div className="record-main">
                    <div className="record-type">
                      {record.type === 'time_plan' ? t('myPage.timePlan') : t('myPage.subscription')}
                    </div>
                    <div className="record-plan">{record.planType}</div>
                    {record.minutes && <div className="record-minutes">{record.minutes} {t('common.timeUnits.minutes')}</div>}
                    {formatExpiryInfo(record) && (
                      <div className="record-expiry-info">
                        {formatExpiryInfo(record)}
                      </div>
                    )}
                  </div>
                  <div className="record-details">
                    <div className="record-date">{formatDate(record.date)}</div>
                    <div className="record-amount">¥{record.amount}</div>
                    <div className={`record-status ${record.status}`}>
                      {record.status === 'active' && t('myPage.status.active')}
                      {record.status === 'cancelled' && t('myPage.status.cancelled')}
                      {record.status === 'expired' && t('myPage.status.expired')}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCancelSubscription(record.id)}
                    className={`button button-warning button-small ${
                      !(record.type === 'subscription' && record.status === 'active') ? 'disabled' : ''
                    }`}
                    disabled={!(record.type === 'subscription' && record.status === 'active')}
                    title={
                      record.type !== 'subscription' 
                        ? t('myPage.onlySubscriptionCanCancel')
                        : record.status !== 'active'
                        ? t('myPage.subscriptionAlreadyCancelled')
                        : t('myPage.cancelSubscription')
                    }
                  >
                    {t('myPage.cancelSubscription')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Password Change Modal */}
        {showPasswordChangeModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{t('myPage.changePassword')}</h3>
                <button 
                  onClick={() => setShowPasswordChangeModal(false)}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('myPage.currentPassword')}</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>{t('myPage.newPassword')}</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>{t('myPage.confirmPassword')}</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  onClick={handlePasswordChange}
                  className="button button-primary"
                >
                  {t('common.save')}
                </button>
                <button 
                  onClick={() => setShowPasswordChangeModal(false)}
                  className="button button-secondary"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPage;
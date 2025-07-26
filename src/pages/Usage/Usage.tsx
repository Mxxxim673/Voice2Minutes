import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { getUsageStats, getUserQuota } from '../../services/usageService';
import './Usage.css';

interface UsageData {
  date: string;
  duration: number;
  files: string[];
}

interface QuotaInfo {
  totalMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  status: 'guest' | 'trial' | 'paid' | 'subscription' | 'admin';
  planType?: string;
  subscriptionPeriod?: 'monthly' | 'yearly';
}

const Usage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isGuest, updateUserQuota, setUser } = useAuth();
  const [editingQuota, setEditingQuota] = useState(false);
  const [tempQuotaMinutes, setTempQuotaMinutes] = useState(0);
  const [tempUsedMinutes, setTempUsedMinutes] = useState(0);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(7); // Default 7 days
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<{
    data: UsageData;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    loadUsageData();
  }, [selectedPeriod, user]);

  const loadUsageData = async () => {
    setLoading(true);
    try {
      if (isGuest) {
        // Guests can't access usage data
        setUsageData([]);
        setQuotaInfo({
          totalMinutes: 5,
          usedMinutes: 0,
          remainingMinutes: 5,
          status: 'guest'
        });
      } else {
        const usage = await getUsageStats(selectedPeriod);
        const quota = await getUserQuota();
        setUsageData(usage);
        
        // Check if current user is admin
        const isAdmin = user?.email === 'max.z.software@gmail.com';
        
        setQuotaInfo({
          ...quota,
          status: isAdmin ? 'admin' : quota.status
        });
      }
    } catch (error) {
      console.error('Failed to load usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    
    if (hours > 0) {
      return `${hours}${t('usage.hours')}${mins}${t('usage.minutes')}`;
    } else if (mins > 0) {
      return `${mins}${t('usage.minutes')}${secs > 0 ? secs + t('usage.seconds') : ''}`;
    } else {
      return `${secs}${t('usage.seconds')}`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'admin':
        return '🛡️';
      case 'paid':
      case 'subscription':
        return '👑';
      case 'trial':
        return '🎯';
      default:
        return '👤';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'admin':
        return t('usage.status.admin');
      case 'guest':
        return t('usage.status.guest');
      case 'trial':
        return t('usage.status.trial');
      case 'paid':
        return t('usage.status.paid');
      case 'subscription':
        return t('usage.status.subscription');
      default:
        return t('usage.status.unknown');
    }
  };

  const maxUsage = Math.max(...usageData.map(d => d.duration), 1);

  const handleBarHover = (data: UsageData, event: React.MouseEvent) => {
    setHoveredBar({
      data,
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleBarLeave = () => {
    setHoveredBar(null);
  };

  const navigateToPricing = () => {
    window.location.href = '/pricing';
  };

  const handleClearUsage = async () => {
    // 管理员专用功能：重置所有时间数据到初始状态
    if (user?.email === 'max.z.software@gmail.com') {
      if (confirm('确定要重置所有时间数据吗？这将清空使用量并重置配额为初始的0分钟状态。')) {
        try {
          // 创建全新的初始状态用户数据
          const resetUser = {
            id: 'admin',
            email: 'max.z.software@gmail.com',
            isEmailVerified: true,
            userType: 'trial' as const,
            quotaMinutes: 0, // 重置为初始的0分钟
            usedMinutes: 0,   // 清空已使用时间
            trialMinutes: 0,
            createdAt: user.createdAt || new Date().toISOString()
          };
          
          // 通过 AuthContext 更新用户状态
          setUser(resetUser);
          
          // 同步更新所有 localStorage 数据
          localStorage.setItem('userData', JSON.stringify(resetUser));
          localStorage.setItem('adminUserData', JSON.stringify(resetUser));
          
          // 强制刷新页面数据
          await loadUsageData();
          
          // 显示成功消息
          alert('✅ 所有时间数据已重置为初始状态！\n总配额：0分钟\n已使用：0分钟\n用户类型：试用用户');
          
          console.log('🔄 管理员时间数据已完全重置:', resetUser);
        } catch (error) {
          console.error('重置时间数据失败:', error);
          alert('❌ 重置失败，请刷新页面重试');
        }
      }
    }
  };

  const handleStartEditQuota = () => {
    if (user?.email === 'max.z.software@gmail.com') {
      setTempQuotaMinutes(quotaInfo?.totalMinutes || 0);
      setTempUsedMinutes(quotaInfo?.usedMinutes || 0);
      setEditingQuota(true);
    }
  };

  const handleSaveQuota = async () => {
    if (user?.email === 'max.z.software@gmail.com') {
      try {
        // 更新用户数据
        const updatedUser = {
          ...user,
          quotaMinutes: tempQuotaMinutes,
          usedMinutes: tempUsedMinutes
        };
        
        // 通过 AuthContext 更新用户状态
        setUser(updatedUser);
        
        // 同步更新所有 localStorage 数据
        localStorage.setItem('userData', JSON.stringify(updatedUser));
        localStorage.setItem('adminUserData', JSON.stringify(updatedUser));
        
        // 强制刷新页面数据
        await loadUsageData();
        
        setEditingQuota(false);
        console.log('📊 管理员配额已更新:', { 
          quotaMinutes: tempQuotaMinutes, 
          usedMinutes: tempUsedMinutes 
        });
      } catch (error) {
        console.error('更新配额失败:', error);
        alert('❌ 更新失败，请重试');
      }
    }
  };

  const handleCancelEditQuota = () => {
    setEditingQuota(false);
    setTempQuotaMinutes(0);
    setTempUsedMinutes(0);
  };

  if (!user || isGuest) {
    return (
      <div className="usage-page">
        <div className="container">
          <div className="usage-blur-overlay">
            <div className="usage-blur-content">
              <div className="page-header">
                <h1 className="page-title">{t('usage.title')}</h1>
              </div>
              
              <div className="usage-stats-grid blurred">
                <div className="usage-card">
                  <h3>{t('usage.totalQuota')}</h3>
                  <div className="usage-number">-- {t('usage.minutes')}</div>
                </div>
                <div className="usage-card">
                  <h3>{t('usage.usedTime')}</h3>
                  <div className="usage-number">-- {t('usage.minutes')}</div>
                </div>
                <div className="usage-card">
                  <h3>{t('usage.remainingTime')}</h3>
                  <div className="usage-number">-- {t('usage.minutes')}</div>
                </div>
              </div>

              <div className="usage-chart-container blurred">
                <div className="chart-header">
                  <h3>{t('usage.dailyUsage')}</h3>
                </div>
                <div className="mock-chart">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="mock-bar" style={{ height: `${Math.random() * 100 + 20}px` }} />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="guest-notice">
              <h2>{t('usage.loginToUnlock')}</h2>
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
      <div className="usage-page">
        <div className="container">
          <div className="loading-spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="usage-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{t('usage.title')}</h1>
        </div>

        {/* Status Info */}
        <div className="status-info">
          <div className={`status-badge ${quotaInfo?.status === 'admin' ? 'admin' : ''}`}>
            <span className="status-icon">{getStatusIcon(quotaInfo?.status || 'guest')}</span>
            <span className="status-text">{getStatusText(quotaInfo?.status || 'guest')}</span>
          </div>
          {quotaInfo?.planType && (
            <div className="plan-info">
              <span>{quotaInfo.planType}</span>
              {quotaInfo.subscriptionPeriod && (
                <span className="subscription-period">
                  ({quotaInfo.subscriptionPeriod === 'monthly' ? t('usage.monthly') : t('usage.yearly')})
                </span>
              )}
            </div>
          )}
          {/* 管理员专用按钮 */}
          {user?.email === 'max.z.software@gmail.com' && (
            <div style={{ marginLeft: '12px', display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleStartEditQuota}
                className="button button-secondary"
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '12px',
                  backgroundColor: '#007acc',
                  color: 'white'
                }}
                disabled={editingQuota}
              >
                ✏️ 编辑配额
              </button>
              <button 
                onClick={handleClearUsage}
                className="button button-warning"
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '12px',
                  backgroundColor: '#ff6b35',
                  color: 'white'
                }}
              >
                🔄 重置所有时间
              </button>
            </div>
          )}
        </div>

        {/* Usage Statistics */}
        <div className="usage-stats-grid">
          <div className="usage-card">
            <h3>{t('usage.totalQuota')}</h3>
            {editingQuota && user?.email === 'max.z.software@gmail.com' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={tempQuotaMinutes}
                  onChange={(e) => setTempQuotaMinutes(Number(e.target.value))}
                  style={{
                    width: '80px',
                    padding: '4px 8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>分钟</span>
              </div>
            ) : (
              <div className="usage-number">
                {formatDuration(quotaInfo?.totalMinutes || 0)}
              </div>
            )}
          </div>
          <div className="usage-card">
            <h3>{t('usage.usedTime')}</h3>
            {editingQuota && user?.email === 'max.z.software@gmail.com' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={tempUsedMinutes}
                  onChange={(e) => setTempUsedMinutes(Number(e.target.value))}
                  style={{
                    width: '80px',
                    padding: '4px 8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>分钟</span>
              </div>
            ) : (
              <div className="usage-number used">
                {formatDuration(quotaInfo?.usedMinutes || 0)}
              </div>
            )}
          </div>
          <div className="usage-card">
            <h3>{t('usage.remainingTime')}</h3>
            <div className="usage-number remaining">
              {editingQuota ? 
                formatDuration(Math.max(0, tempQuotaMinutes - tempUsedMinutes)) :
                formatDuration(quotaInfo?.remainingMinutes || 0)
              }
            </div>
          </div>
        </div>

        {/* 管理员编辑配额操作按钮 */}
        {editingQuota && user?.email === 'max.z.software@gmail.com' && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '12px', 
            marginTop: '12px',
            marginBottom: '12px'
          }}>
            <button 
              onClick={handleSaveQuota}
              className="button button-primary"
              style={{ 
                padding: '8px 16px', 
                fontSize: '14px'
              }}
            >
              ✅ 保存
            </button>
            <button 
              onClick={handleCancelEditQuota}
              className="button button-secondary"
              style={{ 
                padding: '8px 16px', 
                fontSize: '14px'
              }}
            >
              ❌ 取消
            </button>
          </div>
        )}

        {/* Usage Progress Bar */}
        <div className="usage-progress-container">
          <div className="usage-progress-bar">
            <div 
              className="usage-progress-fill"
              style={{ 
                width: `${((quotaInfo?.usedMinutes || 0) / (quotaInfo?.totalMinutes || 1)) * 100}%` 
              }}
            />
          </div>
          <div className="usage-progress-text">
            {((quotaInfo?.usedMinutes || 0) / (quotaInfo?.totalMinutes || 1) * 100).toFixed(1)}% {t('usage.used')}
          </div>
        </div>

        {/* Trial Usage Note */}
        {quotaInfo?.status === 'trial' && (
          <div className="trial-notice">
            <p>{t('usage.trialNote')}</p>
          </div>
        )}

        {/* Usage Chart */}
        <div className="usage-chart-container">
          <div className="chart-header">
            <h3>{t('usage.dailyUsage')}</h3>
            <div className="period-selector">
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                className="period-select"
              >
                <option value={7}>{t('usage.periods.week')}</option>
                <option value={30}>{t('usage.periods.month')}</option>
                <option value={90}>{t('usage.periods.quarter')}</option>
              </select>
            </div>
          </div>
          
          <div className="chart-container">
            {usageData.length > 0 ? (
              <div className="bar-chart">
                {usageData.map((data, index) => (
                  <div key={index} className="bar-item">
                    <div 
                      className="bar"
                      style={{ 
                        height: `${(data.duration / maxUsage) * 200}px`,
                        backgroundColor: data.duration > 0 ? 'var(--primary-blue)' : 'var(--light-gray)'
                      }}
                      onMouseEnter={(e) => handleBarHover(data, e)}
                      onMouseLeave={handleBarLeave}
                    />
                    <div className="bar-label">
                      {new Date(data.date).toLocaleDateString('zh-CN', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">
                <p>{t('usage.noData')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Hover Tooltip */}
        {hoveredBar && (
          <div 
            className="usage-tooltip"
            style={{
              left: hoveredBar.x + 10,
              top: hoveredBar.y - 10,
            }}
          >
            <div className="tooltip-date">
              {new Date(hoveredBar.data.date).toLocaleDateString()}
            </div>
            <div className="tooltip-duration">
              {t('usage.duration')}: {formatDuration(hoveredBar.data.duration)}
            </div>
            {hoveredBar.data.files.length > 0 && (
              <div className="tooltip-files">
                <strong>{t('usage.files')}:</strong>
                {hoveredBar.data.files.map((file, i) => (
                  <div key={i} className="tooltip-file">{file}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Purchase CTA */}
        <div className="purchase-cta">
          <button 
            onClick={navigateToPricing}
            className="button button-primary button-large purchase-button"
          >
            <span className="cta-icon">💎</span>
            {t('usage.purchaseCTA')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Usage;
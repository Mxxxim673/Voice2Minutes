import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import './PaymentSuccess.css';

interface PaymentSession {
  status: string;
  customerEmail: string;
  metadata: {
    userId: string;
    planId: string;
    userEmail: string;
  };
}

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [sessionData, setSessionData] = useState<PaymentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setError('缺少支付会话ID');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/payment/session/${sessionId}`);
        
        if (!response.ok) {
          throw new Error('验证支付状态失败');
        }

        const data = await response.json();
        setSessionData(data);
        
        // 注意：用户配额会通过Stripe webhook自动更新到数据库
        // 页面刷新后会自动获取最新的用户信息
        
      } catch (err) {
        console.error('验证支付失败:', err);
        setError(err instanceof Error ? err.message : '验证支付失败');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId]);

  const getPlanInfo = (planId: string) => {
    const planMap: Record<string, { name: string; type: string }> = {
      '5hours': { name: '5小时套餐', type: '一次性购买' },
      '10hours': { name: '10小时套餐', type: '一次性购买' },
      '30hours': { name: '30小时套餐', type: '一次性购买' },
      '100hours': { name: '100小时套餐', type: '一次性购买' },
      'monthly30': { name: '30小时月付套餐', type: '月度订阅' },
      'annual330': { name: '330小时年付套餐', type: '年度订阅' }
    };
    
    return planMap[planId] || { name: '未知套餐', type: '未知类型' };
  };

  const handleGoToUsage = () => {
    navigate('/usage');
  };

  const handleGoToPricing = () => {
    navigate('/pricing');
  };

  const handleGoToAudioToText = () => {
    navigate('/audio-to-text');
  };

  if (loading) {
    return (
      <div className="payment-success-page">
        <div className="container">
          <div className="success-card loading">
            <div className="loading-spinner"></div>
            <h2>正在验证支付状态...</h2>
            <p>请稍候，我们正在确认您的支付信息</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payment-success-page">
        <div className="container">
          <div className="success-card error">
            <div className="icon error-icon">❌</div>
            <h2>支付验证失败</h2>
            <p>{error}</p>
            <div className="actions">
              <button onClick={handleGoToPricing} className="btn btn-primary">
                返回定价页面
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionData || sessionData.status !== 'paid') {
    return (
      <div className="payment-success-page">
        <div className="container">
          <div className="success-card error">
            <div className="icon error-icon">⚠️</div>
            <h2>支付未完成</h2>
            <p>您的支付可能未成功完成，请检查您的支付状态或重新尝试</p>
            <div className="actions">
              <button onClick={handleGoToPricing} className="btn btn-primary">
                返回定价页面
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const planInfo = getPlanInfo(sessionData.metadata.planId);

  return (
    <div className="payment-success-page">
      <div className="container">
        <div className="success-card">
          <div className="icon success-icon">🎉</div>
          <h1>支付成功！</h1>
          <p className="success-message">
            恭喜您成功购买了 <strong>{planInfo.name}</strong>
          </p>
          
          <div className="payment-details">
            <div className="detail-item">
              <span className="label">套餐类型：</span>
              <span className="value">{planInfo.type}</span>
            </div>
            <div className="detail-item">
              <span className="label">购买邮箱：</span>
              <span className="value">{sessionData.customerEmail}</span>
            </div>
            <div className="detail-item">
              <span className="label">支付状态：</span>
              <span className="value success">已完成</span>
            </div>
          </div>

          {user && (
            <div className="quota-info">
              <h3>当前配额信息</h3>
              <div className="quota-stats">
                <div className="stat">
                  <span className="stat-label">总配额</span>
                  <span className="stat-value">{Math.floor((user.quotaMinutes || 0) / 60)} 小时</span>
                </div>
                <div className="stat">
                  <span className="stat-label">已使用</span>
                  <span className="stat-value">{Math.floor((user.usedMinutes || 0) / 60)} 小时</span>
                </div>
                <div className="stat">
                  <span className="stat-label">剩余</span>
                  <span className="stat-value highlight">
                    {Math.floor(((user.quotaMinutes || 0) - (user.usedMinutes || 0)) / 60)} 小时
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="actions">
            <button onClick={handleGoToAudioToText} className="btn btn-primary">
              开始使用音频转文字
            </button>
            <button onClick={handleGoToUsage} className="btn btn-outline">
              查看使用统计
            </button>
            <button onClick={handleGoToPricing} className="btn btn-outline">
              购买更多套餐
            </button>
          </div>

          <div className="support-info">
            <p>如有任何问题，请联系客服支持</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
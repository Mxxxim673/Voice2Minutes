import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './PaymentCancel.css';

const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleGoToPricing = () => {
    navigate('/pricing');
  };

  const handleGoToAudioToText = () => {
    navigate('/audio-to-text');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="payment-cancel-page">
      <div className="container">
        <div className="cancel-card">
          <div className="icon cancel-icon">😔</div>
          <h1>支付已取消</h1>
          <p className="cancel-message">
            您已取消了此次支付。如果这是一个意外，您可以重新尝试购买套餐。
          </p>
          
          <div className="info-box">
            <h3>💡 温馨提示</h3>
            <ul>
              <li>您的账户信息未受到任何影响</li>
              <li>取消支付不会产生任何费用</li>
              <li>您可以随时重新选择套餐进行购买</li>
              <li>如有疑问，请联系我们的客服团队</li>
            </ul>
          </div>

          <div className="actions">
            <button onClick={handleGoToPricing} className="btn btn-primary">
              重新选择套餐
            </button>
            <button onClick={handleGoToAudioToText} className="btn btn-outline">
              继续使用免费额度
            </button>
            <button onClick={handleGoHome} className="btn btn-outline">
              返回首页
            </button>
          </div>

          <div className="support-info">
            <p>如需帮助，请随时联系我们的客服支持</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
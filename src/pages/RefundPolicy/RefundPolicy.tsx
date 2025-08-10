import React from 'react';
import { useTranslation } from 'react-i18next';
import './RefundPolicy.css';

const RefundPolicy: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="compliance-page">
      <div className="compliance-container">
        <h1 className="compliance-title">{t('refundPolicy.title')}</h1>
        <div className="compliance-content">
          <div className="info-item">
            <h3>{t('refundPolicy.timePlan')}</h3>
            <p>{t('refundPolicy.timePlanValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('refundPolicy.subscription')}</h3>
            <p>{t('refundPolicy.subscriptionValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('refundPolicy.systemOutages')}</h3>
            <p>{t('refundPolicy.systemOutagesValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('refundPolicy.contactInfo')}</h3>
            <p>{t('refundPolicy.contactInfoValue')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
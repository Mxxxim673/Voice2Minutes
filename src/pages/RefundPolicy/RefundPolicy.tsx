import React from 'react';
import { useTranslation } from 'react-i18next';
import './RefundPolicy.css';

const RefundPolicy: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="compliance-page">
      <div className="letter-container">
        <h1 className="letter-title">{t('refundPolicy.title')}</h1>
        
        <div className="letter-content">
          <p className="letter-paragraph">
            <span className="letter-label">{t('refundPolicy.timePlan')}：</span>
            <span className="letter-text">{t('refundPolicy.timePlanValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('refundPolicy.subscription')}：</span>
            <span className="letter-text">{t('refundPolicy.subscriptionValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('refundPolicy.systemOutages')}：</span>
            <span className="letter-text">{t('refundPolicy.systemOutagesValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('refundPolicy.contactInfo')}：</span>
            <span className="letter-text">{t('refundPolicy.contactInfoValue')}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
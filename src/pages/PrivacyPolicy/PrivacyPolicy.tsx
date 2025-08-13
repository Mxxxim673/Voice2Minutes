import React from 'react';
import { useTranslation } from 'react-i18next';
import './PrivacyPolicy.css';

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="compliance-page">
      <div className="letter-container">
        <h1 className="letter-title">{t('privacyPolicy.title')}</h1>
        
        <div className="letter-content">
          <p className="letter-paragraph">
            <span className="letter-label">{t('privacyPolicy.personalInfoCollected')}：</span>
            <span className="letter-text">{t('privacyPolicy.personalInfoCollectedValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('privacyPolicy.purposeOfUse')}：</span>
            <span className="letter-text">{t('privacyPolicy.purposeOfUseValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('privacyPolicy.thirdPartyDisclosure')}：</span>
            <span className="letter-text">{t('privacyPolicy.thirdPartyDisclosureValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('privacyPolicy.securityMeasures')}：</span>
            <span className="letter-text">{t('privacyPolicy.securityMeasuresValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('privacyPolicy.requestsDisclosure')}：</span>
            <span className="letter-text">{t('privacyPolicy.requestsDisclosureValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('privacyPolicy.policyChanges')}：</span>
            <span className="letter-text">{t('privacyPolicy.policyChangesValue')}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
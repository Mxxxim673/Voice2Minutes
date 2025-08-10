import React from 'react';
import { useTranslation } from 'react-i18next';
import './PrivacyPolicy.css';

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="compliance-page">
      <div className="compliance-container">
        <h1 className="compliance-title">{t('privacyPolicy.title')}</h1>
        <div className="compliance-content">
          <div className="info-item">
            <h3>{t('privacyPolicy.personalInfoCollected')}</h3>
            <p>{t('privacyPolicy.personalInfoCollectedValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('privacyPolicy.purposeOfUse')}</h3>
            <p>{t('privacyPolicy.purposeOfUseValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('privacyPolicy.thirdPartyDisclosure')}</h3>
            <p>{t('privacyPolicy.thirdPartyDisclosureValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('privacyPolicy.securityMeasures')}</h3>
            <p>{t('privacyPolicy.securityMeasuresValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('privacyPolicy.requestsDisclosure')}</h3>
            <p>{t('privacyPolicy.requestsDisclosureValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('privacyPolicy.policyChanges')}</h3>
            <p>{t('privacyPolicy.policyChangesValue')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
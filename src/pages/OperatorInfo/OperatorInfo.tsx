import React from 'react';
import { useTranslation } from 'react-i18next';
import './OperatorInfo.css';

const OperatorInfo: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="compliance-page">
      <div className="compliance-container">
        <h1 className="compliance-title">{t('operatorInfo.title')}</h1>
        <div className="compliance-content">
          <div className="info-item">
            <h3>{t('operatorInfo.name')}</h3>
            <p>{t('operatorInfo.nameValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('operatorInfo.address')}</h3>
            <p>{t('operatorInfo.addressValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('operatorInfo.phone')}</h3>
            <p>{t('operatorInfo.phoneValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('operatorInfo.contact')}</h3>
            <p>{t('operatorInfo.contactValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('operatorInfo.businessHours')}</h3>
            <p>{t('operatorInfo.businessHoursValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('operatorInfo.operator')}</h3>
            <p>{t('operatorInfo.operatorValue')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperatorInfo;
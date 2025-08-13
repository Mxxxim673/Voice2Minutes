import React from 'react';
import { useTranslation } from 'react-i18next';
import './OperatorInfo.css';

const OperatorInfo: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="compliance-page">
      <div className="letter-container">
        <h1 className="letter-title">{t('operatorInfo.title')}</h1>
        
        <div className="letter-content">
          <p className="letter-paragraph">
            <span className="letter-label">{t('operatorInfo.name')}：</span>
            <span className="letter-text">{t('operatorInfo.nameValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('operatorInfo.address')}：</span>
            <span className="letter-text">{t('operatorInfo.addressValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('operatorInfo.phone')}：</span>
            <span className="letter-text">{t('operatorInfo.phoneValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('operatorInfo.contact')}：</span>
            <span className="letter-text">{t('operatorInfo.contactValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('operatorInfo.businessHours')}：</span>
            <span className="letter-text">{t('operatorInfo.businessHoursValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('operatorInfo.operator')}：</span>
            <span className="letter-text">{t('operatorInfo.operatorValue')}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OperatorInfo;
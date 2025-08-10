import React from 'react';
import { useTranslation } from 'react-i18next';
import './CommercialTransactionAct.css';

const CommercialTransactionAct: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="compliance-page">
      <div className="compliance-container">
        <h1 className="compliance-title">{t('commercialTransactionAct.title')}</h1>
        <div className="compliance-content">
          <div className="info-item">
            <h3>{t('commercialTransactionAct.salesPrice')}</h3>
            <p>{t('commercialTransactionAct.salesPriceValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('commercialTransactionAct.additionalFees')}</h3>
            <p>{t('commercialTransactionAct.additionalFeesValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('commercialTransactionAct.paymentMethods')}</h3>
            <p>{t('commercialTransactionAct.paymentMethodsValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('commercialTransactionAct.deliveryTiming')}</h3>
            <p>{t('commercialTransactionAct.deliveryTimingValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('commercialTransactionAct.returnsAndCancellations')}</h3>
            <p>{t('commercialTransactionAct.returnsAndCancellationsValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('commercialTransactionAct.systemRequirements')}</h3>
            <p>{t('commercialTransactionAct.systemRequirementsValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('commercialTransactionAct.importantNotes')}</h3>
            <p>{t('commercialTransactionAct.importantNotesValue')}</p>
          </div>
          
          <div className="info-item">
            <h3>{t('commercialTransactionAct.termsOfUse')}</h3>
            <div className="sub-items">
              <p><strong>{t('commercialTransactionAct.application')}</strong></p>
              <p><strong>{t('commercialTransactionAct.userRegistration')}</strong></p>
              <p><strong>{t('commercialTransactionAct.serviceFees')}</strong></p>
              <p><strong>{t('commercialTransactionAct.prohibitedActs')}</strong></p>
              <p><strong>{t('commercialTransactionAct.serviceSuspension')}</strong></p>
              <p><strong>{t('commercialTransactionAct.intellectualProperty')}</strong></p>
              <p><strong>{t('commercialTransactionAct.disclaimer')}</strong></p>
              <p><strong>{t('commercialTransactionAct.amendments')}</strong></p>
              <p><strong>{t('commercialTransactionAct.governingLaw')}</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommercialTransactionAct;
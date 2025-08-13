import React from 'react';
import { useTranslation } from 'react-i18next';
import './CommercialTransactionAct.css';

const CommercialTransactionAct: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="compliance-page">
      <div className="letter-container">
        <h1 className="letter-title">{t('commercialTransactionAct.title')}</h1>
        
        <div className="letter-content">
          <p className="letter-paragraph">
            <span className="letter-label">{t('commercialTransactionAct.salesPrice')}：</span>
            <span className="letter-text">{t('commercialTransactionAct.salesPriceValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('commercialTransactionAct.additionalFees')}：</span>
            <span className="letter-text">{t('commercialTransactionAct.additionalFeesValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('commercialTransactionAct.paymentMethods')}：</span>
            <span className="letter-text">{t('commercialTransactionAct.paymentMethodsValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('commercialTransactionAct.deliveryTiming')}：</span>
            <span className="letter-text">{t('commercialTransactionAct.deliveryTimingValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('commercialTransactionAct.returnsAndCancellations')}：</span>
            <span className="letter-text">{t('commercialTransactionAct.returnsAndCancellationsValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('commercialTransactionAct.systemRequirements')}：</span>
            <span className="letter-text">{t('commercialTransactionAct.systemRequirementsValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('commercialTransactionAct.importantNotes')}：</span>
            <span className="letter-text">{t('commercialTransactionAct.importantNotesValue')}</span>
          </p>
          
          <p className="letter-paragraph">
            <span className="letter-label">{t('commercialTransactionAct.termsOfUse')}：</span>
            <span className="letter-text">
              {t('commercialTransactionAct.application')} {t('commercialTransactionAct.userRegistration')} {t('commercialTransactionAct.serviceFees')} {t('commercialTransactionAct.prohibitedActs')} {t('commercialTransactionAct.serviceSuspension')} {t('commercialTransactionAct.intellectualProperty')} {t('commercialTransactionAct.disclaimer')} {t('commercialTransactionAct.amendments')} {t('commercialTransactionAct.governingLaw')}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CommercialTransactionAct;
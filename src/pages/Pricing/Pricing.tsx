import React from 'react';
import { useTranslation } from 'react-i18next';
import './Pricing.css';

interface PricingPlan {
  id: string;
  type: 'oneTime' | 'subscription';
  hours: number;
  price: number;
  currency: string;
  period?: string;
  popular?: boolean;
}

const Pricing: React.FC = () => {
  const { t } = useTranslation();

  const pricingPlans: PricingPlan[] = [
    // One-time purchases
    {
      id: '5hours',
      type: 'oneTime',
      hours: 5,
      price: 500,
      currency: '¥'
    },
    {
      id: '10hours',
      type: 'oneTime',
      hours: 10,
      price: 950,
      currency: '¥'
    },
    {
      id: '30hours',
      type: 'oneTime',
      hours: 30,
      price: 2400,
      currency: '¥',
      popular: true
    },
    {
      id: '100hours',
      type: 'oneTime',
      hours: 100,
      price: 6900,
      currency: '¥'
    },
    // Subscriptions
    {
      id: 'monthly30',
      type: 'subscription',
      hours: 30,
      price: 2200,
      currency: '¥',
      period: 'monthly'
    },
    {
      id: 'annual360',
      type: 'subscription',
      hours: 360,
      price: 24900,
      currency: '¥',
      period: 'annual'
    }
  ];

  const handleSelectPlan = (plan: PricingPlan) => {
    // In a real implementation, this would integrate with Stripe
    alert(`Selected: ${plan.hours} hours for ${plan.currency}${plan.price.toLocaleString()}`);
  };

  const formatPrice = (price: number, currency: string) => {
    return `${currency}${price.toLocaleString()}`;
  };

  const getPricePerHour = (plan: PricingPlan) => {
    return Math.round(plan.price / plan.hours);
  };

  const oneTimePlans = pricingPlans.filter(plan => plan.type === 'oneTime');
  const subscriptionPlans = pricingPlans.filter(plan => plan.type === 'subscription');

  return (
    <div className="pricing-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{t('pricing.title')}</h1>
          <p className="page-subtitle">{t('pricing.subtitle')}</p>
        </div>

        {/* One-time Purchases */}
        <div className="pricing-section">
          <h2 className="section-title">{t('pricing.oneTimePurchases')}</h2>
          <div className="pricing-grid">
            {oneTimePlans.map((plan) => (
              <div 
                key={plan.id} 
                className={`pricing-card ${plan.popular ? 'popular' : ''}`}
              >
                {plan.popular && (
                  <div className="popular-badge">{t('pricing.mostPopular')}</div>
                )}
                
                <div className="plan-header">
                  <div className="plan-hours">
                    {plan.hours} <span className="hours-label">{t('pricing.hours')}</span>
                  </div>
                  <div className="plan-price">
                    {formatPrice(plan.price, plan.currency)}
                  </div>
                  <div className="price-per-hour">
                    {formatPrice(getPricePerHour(plan), plan.currency)} {t('pricing.perHour')}
                  </div>
                </div>


                <button
                  onClick={() => handleSelectPlan(plan)}
                  className="button button-primary plan-button"
                >
                  {t('pricing.selectPlan')}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Subscriptions */}
        <div className="pricing-section">
          <h2 className="section-title">{t('pricing.subscriptions')}</h2>
          <div className="pricing-grid subscription-grid">
            {subscriptionPlans.map((plan) => (
              <div key={plan.id} className="pricing-card subscription-card">
                <div className="plan-header">
                  <div className="plan-type">
                    {plan.period === 'monthly' ? t('pricing.monthly') : t('pricing.annual')}
                  </div>
                  <div className="plan-hours">
                    {plan.hours} <span className="hours-label">{t('pricing.hours')}</span>
                  </div>
                  <div className="plan-price">
                    {formatPrice(plan.price, plan.currency)}
                    <span className="price-period">/{plan.period === 'monthly' ? 'month' : 'year'}</span>
                  </div>
                  <div className="price-per-hour">
                    {formatPrice(getPricePerHour(plan), plan.currency)} {t('pricing.perHour')}
                  </div>
                </div>


                <button
                  onClick={() => handleSelectPlan(plan)}
                  className="button button-primary plan-button"
                >
                  {t('pricing.selectPlan')}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Notice */}
        <div className="pricing-info card">
          <h3>{t('pricing.paymentNotice')}</h3>
          <ul>
            <li>{t('pricing.paymentInfo.currency')}</li>
            <li>{t('pricing.paymentInfo.security')}</li>
            <li>{t('pricing.paymentInfo.oneTime')}</li>
            <li>{t('pricing.paymentInfo.cancellation')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
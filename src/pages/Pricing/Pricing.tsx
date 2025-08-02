import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import './Pricing.css';

interface PricingPlan {
  id: string;
  type: 'oneTime' | 'subscription';
  hours: number;
  price: number;
  currency: string;
  period?: string;
  popular?: boolean;
  badge?: 'mostPopular' | 'bestDeal' | 'bestValue';
}

const Pricing: React.FC = () => {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();

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
      currency: '¥',
      popular: true,
      badge: 'mostPopular'
    },
    {
      id: '30hours',
      type: 'oneTime',
      hours: 30,
      price: 2490,
      currency: '¥'
    },
    {
      id: '100hours',
      type: 'oneTime',
      hours: 100,
      price: 7550,
      currency: '¥'
    },
    // Subscriptions
    {
      id: 'monthly30',
      type: 'subscription',
      hours: 30,
      price: 2300,
      currency: '¥',
      period: 'monthly',
      popular: true,
      badge: 'bestDeal'
    },
    {
      id: 'annual330',
      type: 'subscription',
      hours: 330,
      price: 23200,
      currency: '¥',
      period: 'annual',
      badge: 'bestValue'
    }
  ];

  const handleSelectPlan = async (plan: PricingPlan) => {
    if (!user) {
      alert('请先登录后再购买套餐');
      return;
    }
    
    // 检查是否为管理员用户（通过邮箱判断）
    const isAdminUser = user.email === 'max.z.software@gmail.com';
    
    if (isAdminUser) {
      // 管理员可以直接获得时长
      const hoursInMinutes = plan.hours * 60;
      
      // 确保当前用户数据正确（防止异常数据）
      const currentQuotaMinutes = (user.quotaMinutes && user.quotaMinutes < 100000) ? user.quotaMinutes : 10;
      const currentUsedMinutes = (user.usedMinutes && user.usedMinutes < 100000) ? user.usedMinutes : 0;
      
      let updatedUser: typeof user;
      
      if (plan.type === 'subscription') {
        // 订阅类型：设置为订阅用户，重置配额
        updatedUser = {
          ...user,
          userType: 'paid',
          quotaMinutes: hoursInMinutes,
          usedMinutes: 0, // 订阅时重置使用量
          planType: plan.period === 'monthly' ? '月付订阅' : '年付订阅',
          subscriptionType: plan.period as 'monthly' | 'yearly'
        };
      } else {
        // 一次性购买：累加到现有配额
        updatedUser = {
          ...user,
          userType: 'paid',
          quotaMinutes: currentQuotaMinutes + hoursInMinutes,
          usedMinutes: currentUsedMinutes, // 保持现有使用量
          planType: `${plan.hours}小时套餐`
        };
      }
      
      setUser(updatedUser);
      localStorage.setItem('userData', JSON.stringify(updatedUser));
      localStorage.setItem('adminUserData', JSON.stringify(updatedUser)); // 同步管理员数据
      
      const totalHours = Math.floor(updatedUser.quotaMinutes / 60);
      const remainingHours = Math.floor((updatedUser.quotaMinutes - updatedUser.usedMinutes) / 60);
      
      if (plan.type === 'subscription') {
        alert(`✅ 已成功订阅 ${plan.hours} 小时${plan.period === 'monthly' ? '月付' : '年付'}套餐！\n总配额：${totalHours} 小时\n剩余时长：${remainingHours} 小时`);
      } else {
        alert(`✅ 已成功购买 ${plan.hours} 小时时长！\n总配额：${totalHours} 小时\n剩余时长：${remainingHours} 小时`);
      }
      
      console.log(`🔑 管理员获得时长: ${plan.hours} 小时 (${plan.type})`);
      return;
    }
    
    // 普通用户的付费流程 - 调用Stripe Checkout
    try {
      console.log(`🛒 开始创建支付会话 - 套餐: ${plan.id}, 用户: ${user.email}`);
      
      const response = await fetch('/api/payment/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.id,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建支付会话失败');
      }

      const { checkoutUrl } = await response.json();
      
      console.log(`✅ 支付会话创建成功，跳转到Stripe Checkout`);
      
      // 跳转到Stripe Checkout页面
      window.location.href = checkoutUrl;
      
    } catch (error) {
      console.error('创建支付会话失败:', error);
      alert(`支付初始化失败：${error.message}\n\n请稍后重试或联系客服`);
    }
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
                {plan.badge === 'mostPopular' && (
                  <div className="popular-badge">{t('pricing.mostPopular')}</div>
                )}
                {plan.badge === 'bestDeal' && (
                  <div className="popular-badge">{t('pricing.bestDeal')}</div>
                )}
                {plan.badge === 'bestValue' && (
                  <div className="popular-badge best-value">{t('pricing.bestValue')}</div>
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
              <div 
                key={plan.id} 
                className={`pricing-card subscription-card ${plan.popular ? 'popular' : ''}`}
              >
                {plan.badge === 'mostPopular' && (
                  <div className="popular-badge">{t('pricing.mostPopular')}</div>
                )}
                {plan.badge === 'bestDeal' && (
                  <div className="popular-badge">{t('pricing.bestDeal')}</div>
                )}
                {plan.badge === 'bestValue' && (
                  <div className="popular-badge best-value">{t('pricing.bestValue')}</div>
                )}
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
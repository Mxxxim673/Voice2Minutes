-- Voice2Minutes 数据库初始化脚本
-- 基于Supabase Auth，创建业务相关表

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 用户配置表
CREATE TABLE users_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    lang TEXT DEFAULT 'ja',
    timezone TEXT DEFAULT 'Asia/Tokyo',
    plan_id TEXT,
    privacy_policy_version TEXT,
    terms_version TEXT,
    consent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用量管理表
CREATE TABLE usage_minutes (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_minutes INTEGER DEFAULT 10, -- 新用户默认10分钟试用
    used_minutes INTEGER DEFAULT 0,
    reset_at TIMESTAMPTZ, -- 订阅用户的重置时间
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 方案表
CREATE TABLE plans (
    plan_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    minutes INTEGER NOT NULL, -- 购买后增加的分钟数
    price_jpy INTEGER NOT NULL,
    type TEXT CHECK (type IN ('time_pack', 'subscription')),
    ios_sku TEXT,
    web_price_id TEXT, -- Stripe price_id 预留
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 订单表
CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES plans(plan_id),
    platform TEXT CHECK (platform IN ('ios', 'web')),
    amount_jpy INTEGER NOT NULL,
    status TEXT CHECK (status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- 创建索引
CREATE INDEX idx_users_profile_user_id ON users_profile(user_id);
CREATE INDEX idx_usage_minutes_user_id ON usage_minutes(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- 启用行级安全 (RLS)
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS 策略
-- 用户只能访问自己的数据
CREATE POLICY "Users can view own profile" ON users_profile
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON users_profile
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON users_profile
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON usage_minutes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);

-- plans表对所有认证用户可读
CREATE POLICY "Plans are viewable by authenticated users" ON plans
    FOR SELECT USING (auth.role() = 'authenticated');

-- 创建触发器用于自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_profile_updated_at BEFORE UPDATE ON users_profile
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_minutes_updated_at BEFORE UPDATE ON usage_minutes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- 升级用量管理系统，支持试用、购买、订阅时长的独立管理
-- 迁移脚本：003_upgrade_usage_system.sql

-- 1. 备份现有数据
CREATE TABLE usage_minutes_backup AS SELECT * FROM usage_minutes;

-- 2. 删除旧表（保留外键约束）
DROP TABLE usage_minutes;

-- 3. 创建新的用量管理表
CREATE TABLE usage_minutes (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 试用时长 (10分钟，优先消耗)
    trial_minutes INTEGER DEFAULT 10,
    trial_used_minutes INTEGER DEFAULT 0,
    
    -- 购买时长 (累积，试用后消耗)
    purchased_minutes INTEGER DEFAULT 0,
    purchased_used_minutes INTEGER DEFAULT 0,
    
    -- 订阅时长 (定期重置，最后消耗)
    subscription_minutes INTEGER DEFAULT 0,
    subscription_used_minutes INTEGER DEFAULT 0,
    subscription_type VARCHAR(20), -- 'monthly', 'yearly', null
    subscription_start_at TIMESTAMPTZ, -- 订阅开始时间
    subscription_reset_at TIMESTAMPTZ, -- 下次重置时间
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 从备份恢复数据并转换格式
INSERT INTO usage_minutes (
    user_id, 
    trial_minutes, 
    trial_used_minutes,
    purchased_minutes,
    purchased_used_minutes,
    created_at,
    updated_at
)
SELECT 
    user_id,
    CASE 
        WHEN total_minutes <= 10 THEN total_minutes
        ELSE 10
    END as trial_minutes,
    CASE 
        WHEN total_minutes <= 10 THEN used_minutes
        WHEN used_minutes <= 10 THEN used_minutes
        ELSE 10
    END as trial_used_minutes,
    CASE 
        WHEN total_minutes > 10 THEN total_minutes - 10
        ELSE 0
    END as purchased_minutes,
    CASE 
        WHEN total_minutes > 10 AND used_minutes > 10 THEN used_minutes - 10
        ELSE 0
    END as purchased_used_minutes,
    created_at,
    updated_at
FROM usage_minutes_backup;

-- 5. 创建索引
CREATE INDEX idx_usage_minutes_user_id ON usage_minutes(user_id);
CREATE INDEX idx_usage_minutes_subscription ON usage_minutes(subscription_type, subscription_reset_at);

-- 6. 启用行级安全
ALTER TABLE usage_minutes ENABLE ROW LEVEL SECURITY;

-- 7. 创建RLS策略
CREATE POLICY "Users can view own usage" ON usage_minutes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON usage_minutes
    FOR UPDATE USING (auth.uid() = user_id);

-- 8. 创建用量计算函数
CREATE OR REPLACE FUNCTION calculate_user_quota(user_id_param UUID)
RETURNS TABLE (
    total_minutes INTEGER,
    used_minutes INTEGER,
    remaining_minutes INTEGER,
    trial_remaining INTEGER,
    purchased_remaining INTEGER,
    subscription_remaining INTEGER,
    next_reset TIMESTAMPTZ
) AS $$
DECLARE
    usage_record RECORD;
BEGIN
    -- 获取用户用量记录
    SELECT * INTO usage_record FROM usage_minutes WHERE user_id = user_id_param;
    
    IF NOT FOUND THEN
        -- 用户不存在，返回默认值
        RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;
    
    -- 检查订阅是否需要重置
    IF usage_record.subscription_type IS NOT NULL 
       AND usage_record.subscription_reset_at IS NOT NULL 
       AND NOW() >= usage_record.subscription_reset_at THEN
        
        -- 重置订阅用量
        UPDATE usage_minutes 
        SET 
            subscription_used_minutes = 0,
            subscription_reset_at = CASE 
                WHEN subscription_type = 'monthly' THEN subscription_reset_at + INTERVAL '1 month'
                WHEN subscription_type = 'yearly' THEN subscription_reset_at + INTERVAL '1 year'
                ELSE subscription_reset_at
            END,
            updated_at = NOW()
        WHERE user_id = user_id_param;
        
        -- 重新获取更新后的记录
        SELECT * INTO usage_record FROM usage_minutes WHERE user_id = user_id_param;
    END IF;
    
    -- 计算各类型剩余时长
    RETURN QUERY SELECT 
        (usage_record.trial_minutes + usage_record.purchased_minutes + usage_record.subscription_minutes) as total_minutes,
        (usage_record.trial_used_minutes + usage_record.purchased_used_minutes + usage_record.subscription_used_minutes) as used_minutes,
        (usage_record.trial_minutes - usage_record.trial_used_minutes + 
         usage_record.purchased_minutes - usage_record.purchased_used_minutes + 
         usage_record.subscription_minutes - usage_record.subscription_used_minutes) as remaining_minutes,
        (usage_record.trial_minutes - usage_record.trial_used_minutes) as trial_remaining,
        (usage_record.purchased_minutes - usage_record.purchased_used_minutes) as purchased_remaining,
        (usage_record.subscription_minutes - usage_record.subscription_used_minutes) as subscription_remaining,
        usage_record.subscription_reset_at as next_reset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 创建用量消费函数
CREATE OR REPLACE FUNCTION consume_user_minutes(user_id_param UUID, minutes_to_consume INTEGER)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    consumed_from TEXT,
    remaining_minutes INTEGER
) AS $$
DECLARE
    usage_record RECORD;
    trial_available INTEGER;
    purchased_available INTEGER;
    subscription_available INTEGER;
    remaining_consumption INTEGER;
BEGIN
    -- 获取最新用量信息
    SELECT * FROM calculate_user_quota(user_id_param) INTO usage_record;
    
    -- 检查总余额是否足够
    IF usage_record.remaining_minutes < minutes_to_consume THEN
        RETURN QUERY SELECT FALSE, '余额不足', '', usage_record.remaining_minutes;
        RETURN;
    END IF;
    
    -- 按优先级消费：试用 > 购买 > 订阅
    remaining_consumption := minutes_to_consume;
    
    -- 1. 优先消费试用时长
    trial_available := usage_record.trial_remaining;
    IF trial_available > 0 AND remaining_consumption > 0 THEN
        DECLARE
            trial_consume INTEGER := LEAST(trial_available, remaining_consumption);
        BEGIN
            UPDATE usage_minutes 
            SET trial_used_minutes = trial_used_minutes + trial_consume,
                updated_at = NOW()
            WHERE user_id = user_id_param;
            
            remaining_consumption := remaining_consumption - trial_consume;
            
            IF remaining_consumption = 0 THEN
                RETURN QUERY SELECT TRUE, '消费成功', '试用时长', usage_record.remaining_minutes - minutes_to_consume;
                RETURN;
            END IF;
        END;
    END IF;
    
    -- 2. 消费购买时长
    purchased_available := usage_record.purchased_remaining;
    IF purchased_available > 0 AND remaining_consumption > 0 THEN
        DECLARE
            purchased_consume INTEGER := LEAST(purchased_available, remaining_consumption);
        BEGIN
            UPDATE usage_minutes 
            SET purchased_used_minutes = purchased_used_minutes + purchased_consume,
                updated_at = NOW()
            WHERE user_id = user_id_param;
            
            remaining_consumption := remaining_consumption - purchased_consume;
            
            IF remaining_consumption = 0 THEN
                RETURN QUERY SELECT TRUE, '消费成功', 
                    CASE WHEN trial_available > 0 THEN '试用+购买时长' ELSE '购买时长' END,
                    usage_record.remaining_minutes - minutes_to_consume;
                RETURN;
            END IF;
        END;
    END IF;
    
    -- 3. 最后消费订阅时长
    subscription_available := usage_record.subscription_remaining;
    IF subscription_available > 0 AND remaining_consumption > 0 THEN
        DECLARE
            subscription_consume INTEGER := LEAST(subscription_available, remaining_consumption);
        BEGIN
            UPDATE usage_minutes 
            SET subscription_used_minutes = subscription_used_minutes + subscription_consume,
                updated_at = NOW()
            WHERE user_id = user_id_param;
            
            RETURN QUERY SELECT TRUE, '消费成功', 
                CASE 
                    WHEN trial_available > 0 AND purchased_available > 0 THEN '试用+购买+订阅时长'
                    WHEN trial_available > 0 THEN '试用+订阅时长' 
                    WHEN purchased_available > 0 THEN '购买+订阅时长'
                    ELSE '订阅时长'
                END,
                usage_record.remaining_minutes - minutes_to_consume;
            RETURN;
        END;
    END IF;
    
    -- 如果到这里说明有逻辑错误
    RETURN QUERY SELECT FALSE, '消费逻辑错误', '', usage_record.remaining_minutes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 创建购买时长函数
CREATE OR REPLACE FUNCTION add_purchased_minutes(user_id_param UUID, minutes_to_add INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE usage_minutes 
    SET purchased_minutes = purchased_minutes + minutes_to_add,
        updated_at = NOW()
    WHERE user_id = user_id_param;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 创建订阅管理函数
CREATE OR REPLACE FUNCTION set_subscription(
    user_id_param UUID, 
    subscription_type_param VARCHAR(20),
    subscription_minutes_param INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    reset_interval INTERVAL;
BEGIN
    -- 确定重置间隔
    IF subscription_type_param = 'monthly' THEN
        reset_interval := INTERVAL '1 month';
    ELSIF subscription_type_param = 'yearly' THEN
        reset_interval := INTERVAL '1 year';
    ELSE
        RETURN FALSE; -- 无效的订阅类型
    END IF;
    
    -- 更新订阅信息
    UPDATE usage_minutes 
    SET 
        subscription_type = subscription_type_param,
        subscription_minutes = subscription_minutes_param,
        subscription_used_minutes = 0,
        subscription_start_at = NOW(),
        subscription_reset_at = NOW() + reset_interval,
        updated_at = NOW()
    WHERE user_id = user_id_param;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. 创建取消订阅函数
CREATE OR REPLACE FUNCTION cancel_subscription(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE usage_minutes 
    SET 
        subscription_type = NULL,
        subscription_minutes = 0,
        subscription_used_minutes = 0,
        subscription_start_at = NULL,
        subscription_reset_at = NULL,
        updated_at = NOW()
    WHERE user_id = user_id_param;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. 更新用户初始化函数
CREATE OR REPLACE FUNCTION init_user(user_id UUID, display_name TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- 创建用户配置
    INSERT INTO users_profile (user_id, display_name)
    VALUES (user_id, display_name)
    ON CONFLICT (user_id) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, users_profile.display_name),
        updated_at = NOW();
    
    -- 创建用量记录，新用户获得10分钟试用
    INSERT INTO usage_minutes (user_id, trial_minutes, trial_used_minutes)
    VALUES (user_id, 10, 0)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. 清理备份表
DROP TABLE usage_minutes_backup;

COMMENT ON FUNCTION calculate_user_quota(UUID) IS '计算用户配额，自动处理订阅重置';
COMMENT ON FUNCTION consume_user_minutes(UUID, INTEGER) IS '按优先级消费用户时长：试用 > 购买 > 订阅';
COMMENT ON FUNCTION add_purchased_minutes(UUID, INTEGER) IS '增加用户购买时长';
COMMENT ON FUNCTION set_subscription(UUID, VARCHAR, INTEGER) IS '设置用户订阅';
COMMENT ON FUNCTION cancel_subscription(UUID) IS '取消用户订阅';
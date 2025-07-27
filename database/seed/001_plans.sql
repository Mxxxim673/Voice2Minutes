-- Voice2Minutes 方案数据
-- 插入基础套餐方案

INSERT INTO plans (plan_id, name, minutes, price_jpy, type) VALUES
-- 时长包
('pack_5h', '5小时时长包', 300, 500, 'time_pack'),
('pack_10h', '10小时时长包', 600, 950, 'time_pack'),
('pack_30h', '30小时时长包', 1800, 2490, 'time_pack'),
('pack_100h', '100小时时长包', 6000, 7550, 'time_pack'),

-- 订阅方案
('sub_monthly', '月订阅（30小时）', 1800, 2300, 'subscription'),
('sub_yearly', '年订阅（330小时）', 19800, 23200, 'subscription');

-- 示例：为新用户创建默认配置的函数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 创建用户配置
    INSERT INTO users_profile (user_id, lang, timezone)
    VALUES (NEW.id, 'ja', 'Asia/Tokyo');
    
    -- 创建用量记录，新用户获得10分钟试用
    INSERT INTO usage_minutes (user_id, total_minutes, used_minutes)
    VALUES (NEW.id, 10, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：用户注册时自动创建配置和用量记录
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
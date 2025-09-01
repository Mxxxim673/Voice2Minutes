-- 验证码存储表
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'registration', -- 'registration' 或 'password_reset'
    user_id UUID,
    language VARCHAR(10) DEFAULT 'zh',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- 索引
    INDEX idx_verification_codes_email (email),
    INDEX idx_verification_codes_code (code),
    INDEX idx_verification_codes_expires (expires_at)
);

-- 自动清理过期验证码的函数
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM verification_codes 
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- RLS 策略（行级安全）
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- 允许系统操作（通过service role）
CREATE POLICY "Allow system operations" ON verification_codes
    FOR ALL USING (true);
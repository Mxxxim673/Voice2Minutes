-- Voice2Minutes 会议纪要功能数据库表
-- 在现有schema基础上添加会议纪要相关表

-- 1. 转录记录表
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- 访客用户使用guest_identity_id而不是user_id
    guest_identity_id TEXT, -- 访客用户标识
    text TEXT NOT NULL,
    audio_file_name TEXT,
    audio_file_size BIGINT,
    duration_seconds INTEGER, -- 音频时长（秒）
    language TEXT DEFAULT 'zh', -- 检测到的语言
    summary_generated BOOLEAN DEFAULT FALSE, -- 是否已生成会议纪要
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 会议纪要表
CREATE TABLE meeting_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    guest_identity_id TEXT, -- 访客用户标识，与transcript对应
    template_type TEXT CHECK (template_type IN ('standard', 'custom')) DEFAULT 'standard',
    outline JSONB NOT NULL, -- 提纲数组，例如: ["会议主题", "日期", "参会者"]
    summary_text TEXT NOT NULL,
    is_editable BOOLEAN DEFAULT TRUE, -- 是否可编辑
    edit_count INTEGER DEFAULT 0, -- 编辑次数
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 自定义模板表（可选，用于保存用户常用的自定义模板）
CREATE TABLE custom_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    outline JSONB NOT NULL, -- 提纲数组
    language TEXT DEFAULT 'zh',
    usage_count INTEGER DEFAULT 0, -- 使用次数
    is_default BOOLEAN DEFAULT FALSE, -- 是否为用户默认模板
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 使用量记录表（扩展现有功能，记录详细的使用记录）
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    guest_identity_id TEXT, -- 访客用户标识
    transcript_id UUID REFERENCES transcripts(id) ON DELETE SET NULL,
    action_type TEXT CHECK (action_type IN ('transcription', 'summary_generation', 'export')) NOT NULL,
    duration_seconds INTEGER, -- 消耗的时长（秒）
    audio_file_name TEXT,
    audio_file_size BIGINT,
    transcription_length INTEGER, -- 转录文本长度
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_transcripts_user_id ON transcripts(user_id);
CREATE INDEX idx_transcripts_guest_identity_id ON transcripts(guest_identity_id);
CREATE INDEX idx_transcripts_created_at ON transcripts(created_at);
CREATE INDEX idx_transcripts_summary_generated ON transcripts(summary_generated);

CREATE INDEX idx_meeting_summaries_transcript_id ON meeting_summaries(transcript_id);
CREATE INDEX idx_meeting_summaries_user_id ON meeting_summaries(user_id);
CREATE INDEX idx_meeting_summaries_guest_identity_id ON meeting_summaries(guest_identity_id);
CREATE INDEX idx_meeting_summaries_created_at ON meeting_summaries(created_at);

CREATE INDEX idx_custom_templates_user_id ON custom_templates(user_id);
CREATE INDEX idx_custom_templates_is_default ON custom_templates(is_default);

CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_guest_identity_id ON usage_records(guest_identity_id);
CREATE INDEX idx_usage_records_created_at ON usage_records(created_at);
CREATE INDEX idx_usage_records_action_type ON usage_records(action_type);

-- 启用行级安全 (RLS)
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- RLS 策略
-- 转录记录：用户只能访问自己的记录
CREATE POLICY "Users can view own transcripts" ON transcripts
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

CREATE POLICY "Users can insert own transcripts" ON transcripts
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

CREATE POLICY "Users can update own transcripts" ON transcripts
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

CREATE POLICY "Users can delete own transcripts" ON transcripts
    FOR DELETE USING (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

-- 会议纪要：用户只能访问自己的记录
CREATE POLICY "Users can view own summaries" ON meeting_summaries
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

CREATE POLICY "Users can insert own summaries" ON meeting_summaries
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

CREATE POLICY "Users can update own summaries" ON meeting_summaries
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

CREATE POLICY "Users can delete own summaries" ON meeting_summaries
    FOR DELETE USING (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

-- 自定义模板：用户只能访问自己的模板
CREATE POLICY "Users can view own templates" ON custom_templates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" ON custom_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON custom_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON custom_templates
    FOR DELETE USING (auth.uid() = user_id);

-- 使用记录：用户只能访问自己的记录
CREATE POLICY "Users can view own usage records" ON usage_records
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

CREATE POLICY "Users can insert own usage records" ON usage_records
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        (user_id IS NULL AND guest_identity_id IS NOT NULL)
    );

-- 添加更新时间触发器
CREATE TRIGGER update_transcripts_updated_at BEFORE UPDATE ON transcripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_summaries_updated_at BEFORE UPDATE ON meeting_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_templates_updated_at BEFORE UPDATE ON custom_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 添加约束
-- 确保每个转录记录最多只能有一个会议纪要
ALTER TABLE meeting_summaries 
ADD CONSTRAINT unique_transcript_summary 
UNIQUE (transcript_id);

-- 确保每个用户每种语言最多只能有一个默认自定义模板
CREATE UNIQUE INDEX idx_custom_templates_user_default_language 
ON custom_templates(user_id, language) 
WHERE is_default = TRUE;

-- 添加有用的函数
-- 获取用户总使用时长（秒）
CREATE OR REPLACE FUNCTION get_user_total_usage_seconds(p_user_id UUID, p_guest_identity_id TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
BEGIN
    IF p_user_id IS NOT NULL THEN
        RETURN COALESCE((
            SELECT SUM(duration_seconds) 
            FROM usage_records 
            WHERE user_id = p_user_id
        ), 0);
    ELSIF p_guest_identity_id IS NOT NULL THEN
        RETURN COALESCE((
            SELECT SUM(duration_seconds) 
            FROM usage_records 
            WHERE guest_identity_id = p_guest_identity_id
        ), 0);
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 检查转录是否已生成纪要
CREATE OR REPLACE FUNCTION check_summary_generated(p_transcript_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM meeting_summaries 
        WHERE transcript_id = p_transcript_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 标记转录已生成纪要
CREATE OR REPLACE FUNCTION mark_transcript_summary_generated(p_transcript_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE transcripts 
    SET summary_generated = TRUE, updated_at = NOW()
    WHERE id = p_transcript_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重置转录的纪要生成标记
CREATE OR REPLACE FUNCTION reset_transcript_summary_generated(p_transcript_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE transcripts 
    SET summary_generated = FALSE, updated_at = NOW()
    WHERE id = p_transcript_id;
    
    -- 同时删除相关的会议纪要记录
    DELETE FROM meeting_summaries 
    WHERE transcript_id = p_transcript_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
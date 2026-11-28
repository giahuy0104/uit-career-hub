-- Nền tảng AI chung: bật/tắt và hạn mức riêng từng chức năng, đánh giá hữu ích của người dùng.
-- Công tắc chung trong ai_settings vẫn là công tắc tổng: tắt nó thì mọi chức năng đều tắt.
CREATE TABLE ai_feature_settings (
    feature text PRIMARY KEY CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH', 'JOB_RANKER', 'INTERNSHIP_RISK')),
    enabled boolean NOT NULL DEFAULT true,
    daily_limit_per_user integer CHECK (daily_limit_per_user IS NULL OR daily_limit_per_user BETWEEN 1 AND 1000),
    updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_feature_settings (feature) VALUES ('PLAN_REVIEW'), ('WEEKLY_LOG_SUMMARY'), ('JOB_MATCH'), ('JOB_RANKER'), ('INTERNSHIP_RISK')
ON CONFLICT (feature) DO NOTHING;

-- Lượt gọi Gemini theo từng chức năng (ngoài hạn mức chung trong ai_daily_usage).
CREATE TABLE ai_feature_daily_usage (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature text NOT NULL CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH', 'JOB_RANKER', 'INTERNSHIP_RISK')),
    usage_date date NOT NULL,
    provider_calls integer NOT NULL CHECK (provider_calls > 0),
    PRIMARY KEY (user_id, feature, usage_date)
);

-- Một đánh giá cho mỗi người / chức năng / đối tượng; bấm lại thì ghi đè.
-- subject_id: id gợi ý (chức năng Gemini), id tin (xếp hạng việc làm) hoặc id kỳ thực tập (cảnh báo sớm).
CREATE TABLE ai_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_role text NOT NULL CHECK (user_role IN ('STUDENT', 'UIT_ADMIN', 'COMPANY')),
    feature text NOT NULL CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH', 'JOB_RANKER', 'INTERNSHIP_RISK')),
    subject_id uuid NOT NULL,
    model_version text,
    helpful boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, feature, subject_id)
);

CREATE INDEX idx_ai_feedback_feature ON ai_feedback (feature, updated_at DESC);

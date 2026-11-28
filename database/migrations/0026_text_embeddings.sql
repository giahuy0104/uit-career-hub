-- Đợt B: embedding văn bản (Gemini) cho gợi ý kỹ năng khi viết tin và tìm kiếm theo nghĩa.
-- Vector lưu dạng real[] (768 chiều, đã chuẩn hóa) để chạy được cả trên PostgreSQL không có pgvector.
CREATE TABLE text_embeddings (
    kind text NOT NULL CHECK (kind IN ('JOB_DOCUMENT', 'SKILL', 'CATEGORY')),
    ref_id uuid NOT NULL,
    model text NOT NULL,
    content_hash text NOT NULL,
    vector real[] NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kind, ref_id)
);

ALTER TABLE ai_call_logs DROP CONSTRAINT ai_call_logs_feature_check;
ALTER TABLE ai_call_logs ADD CONSTRAINT ai_call_logs_feature_check CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH', 'SKILL_SUGGEST', 'SEMANTIC_SEARCH'));
ALTER TABLE ai_feature_settings DROP CONSTRAINT ai_feature_settings_feature_check;
ALTER TABLE ai_feature_settings ADD CONSTRAINT ai_feature_settings_feature_check CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH', 'JOB_RANKER', 'INTERNSHIP_RISK', 'SKILL_SUGGEST', 'SEMANTIC_SEARCH'));
ALTER TABLE ai_feature_daily_usage DROP CONSTRAINT ai_feature_daily_usage_feature_check;
ALTER TABLE ai_feature_daily_usage ADD CONSTRAINT ai_feature_daily_usage_feature_check CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH', 'JOB_RANKER', 'INTERNSHIP_RISK', 'SKILL_SUGGEST', 'SEMANTIC_SEARCH'));
ALTER TABLE ai_feedback DROP CONSTRAINT ai_feedback_feature_check;
ALTER TABLE ai_feedback ADD CONSTRAINT ai_feedback_feature_check CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH', 'JOB_RANKER', 'INTERNSHIP_RISK', 'SKILL_SUGGEST', 'SEMANTIC_SEARCH'));

INSERT INTO ai_feature_settings (feature) VALUES ('SKILL_SUGGEST'), ('SEMANTIC_SEARCH') ON CONFLICT (feature) DO NOTHING;

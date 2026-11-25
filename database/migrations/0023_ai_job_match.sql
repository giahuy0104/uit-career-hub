-- AI3: gợi ý việc phù hợp. Điểm do hệ thống tính từ kỹ năng/nhóm ngành/loại cơ hội; AI chỉ viết lời giải thích.
-- Số 0022 để dành cho nhánh thông báo realtime đang làm song song.
CREATE TABLE student_skills (
    student_profile_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (student_profile_id, skill_id)
);

CREATE TABLE student_preferred_categories (
    student_profile_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (student_profile_id, category_id)
);

ALTER TABLE student_profiles
    ADD COLUMN preferred_opportunity_types text[] NOT NULL DEFAULT '{}'
    CHECK (preferred_opportunity_types <@ ARRAY['INTERNSHIP', 'PART_TIME', 'FULL_TIME', 'FRESHER']);

ALTER TABLE ai_call_logs DROP CONSTRAINT ai_call_logs_feature_check;
ALTER TABLE ai_call_logs ADD CONSTRAINT ai_call_logs_feature_check
    CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH'));
ALTER TABLE ai_suggestions DROP CONSTRAINT ai_suggestions_feature_check;
ALTER TABLE ai_suggestions ADD CONSTRAINT ai_suggestions_feature_check
    CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY', 'JOB_MATCH'));

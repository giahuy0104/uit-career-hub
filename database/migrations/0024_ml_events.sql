-- Hành vi của sinh viên với tin tuyển dụng, để huấn luyện lại mô hình xếp hạng bằng dữ liệu thật
-- (nhãn "ứng tuyển" lấy từ bảng applications). Không lưu nội dung gì ngoài loại sự kiện và vị trí hiển thị.
CREATE TABLE job_interaction_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_profile_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    job_post_id uuid NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('IMPRESSION', 'VIEW', 'RECOMMENDATION_CLICK')),
    source text NOT NULL CHECK (source IN ('RECOMMENDATIONS', 'JOB_LIST')),
    position integer CHECK (position IS NULL OR position BETWEEN 0 AND 100),
    model_version text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_interaction_events_student ON job_interaction_events (student_profile_id, created_at DESC);
CREATE INDEX idx_job_interaction_events_job ON job_interaction_events (job_post_id, created_at DESC);

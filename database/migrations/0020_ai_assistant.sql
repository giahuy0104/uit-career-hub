-- Trợ lý AI (AI1 góp ý kế hoạch, AI2 tóm tắt nhật ký).
-- AI chỉ đưa gợi ý: không có bảng nào ở đây ghi ngược vào kế hoạch/nhật ký.

-- Công tắc toàn hệ thống do UIT điều khiển. Luôn có đúng một dòng (id = 1).
CREATE TABLE ai_settings (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled boolean NOT NULL DEFAULT true,
    updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_settings (id, enabled) VALUES (1, true) ON CONFLICT (id) DO NOTHING;

-- Nhật ký mỗi lần gọi AI để đo độ trễ, token và giới hạn số lần gọi.
-- Không lưu prompt hay nội dung trả về để tránh giữ dữ liệu nhạy cảm.
CREATE TABLE ai_call_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    user_role text NOT NULL CHECK (user_role IN ('STUDENT', 'UIT_ADMIN', 'COMPANY')),
    feature text NOT NULL CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY')),
    target_id uuid,
    status text NOT NULL CHECK (status IN (
        'SUCCESS', 'CACHED', 'FAILED', 'DISABLED', 'NOT_CONFIGURED', 'RATE_LIMITED'
    )),
    model text,
    latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
    prompt_tokens integer CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
    output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_call_logs_user_day ON ai_call_logs (user_id, created_at DESC);
CREATE INDEX idx_ai_call_logs_created ON ai_call_logs (created_at DESC, feature);

-- Kết quả đã tạo, khóa theo hash nội dung đã gửi: nội dung không đổi thì không gọi lại AI.
CREATE TABLE ai_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feature text NOT NULL CHECK (feature IN ('PLAN_REVIEW', 'WEEKLY_LOG_SUMMARY')),
    target_id uuid NOT NULL,
    content_hash text NOT NULL,
    model text NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (feature, target_id, content_hash)
);

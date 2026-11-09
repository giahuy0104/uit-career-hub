-- Giới hạn lượt gọi AI mỗi người/ngày phải là giới hạn cứng.
-- Đếm ai_call_logs rồi mới gọi AI không an toàn khi có request đồng thời: hai request cùng thấy
-- còn một lượt đều gọi được Gemini. Bảng này giữ lượt bằng một câu upsert có điều kiện
-- (INSERT ... ON CONFLICT DO UPDATE ... WHERE provider_calls < limit), khóa dòng trong lúc kiểm tra.
CREATE TABLE ai_daily_usage (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date date NOT NULL,
    provider_calls integer NOT NULL CHECK (provider_calls > 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, usage_date)
);

-- Đưa số lượt đã dùng hôm nay (giờ Việt Nam) từ nhật ký gọi AI sang, để việc nâng cấp không cấp thêm lượt.
INSERT INTO ai_daily_usage (user_id, usage_date, provider_calls)
SELECT user_id, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, count(*)
FROM ai_call_logs
WHERE user_id IS NOT NULL AND status IN ('SUCCESS', 'FAILED')
  AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')
GROUP BY 1, 2
ON CONFLICT (user_id, usage_date) DO NOTHING;

-- Trước đây mang số 0020 trên nhánh realtime; IF NOT EXISTS để chạy được cả trên database đã có index này.
CREATE INDEX IF NOT EXISTS idx_notifications_realtime_snapshot
    ON notifications (recipient_user_id, created_at DESC, id DESC);

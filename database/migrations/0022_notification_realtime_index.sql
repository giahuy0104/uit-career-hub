CREATE INDEX idx_notifications_realtime_snapshot
    ON notifications (recipient_user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_applications_uit_review_queue
    ON applications (submitted_at ASC, id ASC)
    WHERE status = 'UIT_REVIEWING';

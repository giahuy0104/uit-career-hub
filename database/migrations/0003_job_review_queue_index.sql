CREATE INDEX IF NOT EXISTS idx_job_posts_uit_review_queue
    ON job_posts (submitted_at ASC, id ASC)
    WHERE status = 'PENDING_UIT_REVIEW';


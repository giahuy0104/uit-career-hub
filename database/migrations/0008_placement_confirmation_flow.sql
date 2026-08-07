CREATE INDEX idx_applications_uit_placement_queue
    ON applications (last_transition_at, id)
    WHERE status = 'ACCEPTED_PENDING_UIT_CONFIRMATION';

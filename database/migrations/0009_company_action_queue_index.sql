CREATE INDEX idx_applications_company_action_required
    ON applications (job_post_id, last_transition_at, id)
    WHERE status IN ('FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED');

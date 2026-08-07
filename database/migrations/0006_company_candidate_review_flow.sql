ALTER TABLE interviews ADD COLUMN command_id uuid;

UPDATE interviews SET command_id = gen_random_uuid() WHERE command_id IS NULL;

ALTER TABLE interviews
    ALTER COLUMN command_id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN command_id SET NOT NULL;

CREATE UNIQUE INDEX uq_interviews_application_command
    ON interviews (application_id, command_id);

CREATE INDEX idx_applications_company_processing
    ON applications (job_post_id, last_transition_at DESC, id)
    WHERE status IN (
        'FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED',
        'NOT_SUITABLE', 'INTERVIEW_FAILED', 'OFFER_PENDING_STUDENT',
        'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED', 'OFFER_DECLINED', 'WITHDRAWN'
    );

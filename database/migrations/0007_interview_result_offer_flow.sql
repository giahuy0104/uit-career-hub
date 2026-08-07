ALTER TABLE recruitment_results ADD COLUMN command_id uuid;

UPDATE recruitment_results SET command_id = gen_random_uuid() WHERE command_id IS NULL;

ALTER TABLE recruitment_results
    ALTER COLUMN command_id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN command_id SET NOT NULL;

CREATE UNIQUE INDEX uq_recruitment_results_application_command
    ON recruitment_results (application_id, command_id);

CREATE INDEX idx_applications_student_offer_response
    ON applications (student_profile_id, last_transition_at DESC, id)
    WHERE status = 'OFFER_PENDING_STUDENT';

DROP INDEX IF EXISTS uq_applications_active_student_job;

CREATE UNIQUE INDEX uq_applications_active_student_job
    ON applications (student_profile_id, job_post_id)
    WHERE status IN (
        'UIT_REVIEWING', 'NEEDS_SUPPLEMENT', 'FORWARDED_TO_COMPANY',
        'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'OFFER_PENDING_STUDENT',
        'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED'
    );

ALTER TABLE application_documents
    DROP CONSTRAINT IF EXISTS application_documents_application_id_document_type_source_version_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_application_documents_source_snapshot
    ON application_documents (application_id, source_document_id)
    WHERE source_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_history_command
    ON application_status_history (command_id, application_id);

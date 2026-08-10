CREATE TABLE student_document_uploads (
    id uuid PRIMARY KEY,
    student_profile_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE RESTRICT,
    student_document_id uuid UNIQUE REFERENCES student_documents(id) ON DELETE SET NULL,
    document_type text NOT NULL
        CHECK (document_type IN ('CV', 'TRANSCRIPT', 'STUDENT_CONFIRMATION', 'OTHER')),
    file_name text NOT NULL,
    mime_type text NOT NULL CHECK (mime_type = 'application/pdf'),
    file_size_bytes bigint NOT NULL
        CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
    storage_key text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED', 'EXPIRED')),
    etag text,
    expires_at timestamptz NOT NULL,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (status = 'COMPLETED' AND student_document_id IS NOT NULL AND completed_at IS NOT NULL)
        OR (status <> 'COMPLETED' AND student_document_id IS NULL AND completed_at IS NULL)
    )
);

CREATE INDEX idx_student_document_uploads_owner_pending
    ON student_document_uploads (student_profile_id, expires_at DESC)
    WHERE status = 'PENDING';

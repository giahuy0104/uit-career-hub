CREATE TABLE offer_document_uploads (
    id uuid PRIMARY KEY,
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name text NOT NULL,
    mime_type text NOT NULL CHECK (mime_type = 'application/pdf'),
    file_size_bytes bigint NOT NULL
        CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
    storage_key text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CONSUMED')),
    etag text,
    expires_at timestamptz NOT NULL,
    completed_at timestamptz,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (status = 'PENDING' AND completed_at IS NULL AND consumed_at IS NULL)
        OR (status IN ('REJECTED', 'EXPIRED') AND completed_at IS NULL AND consumed_at IS NULL)
        OR (status = 'COMPLETED' AND completed_at IS NOT NULL AND consumed_at IS NULL)
        OR (status = 'CONSUMED' AND completed_at IS NOT NULL AND consumed_at IS NOT NULL)
    )
);

ALTER TABLE recruitment_results
    ADD COLUMN offer_upload_id uuid UNIQUE
        REFERENCES offer_document_uploads(id) ON DELETE RESTRICT;

CREATE INDEX idx_offer_document_uploads_company_pending
    ON offer_document_uploads (company_id, application_id, expires_at DESC)
    WHERE status = 'PENDING';

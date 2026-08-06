CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('STUDENT', 'UIT_ADMIN', 'COMPANY')),
    status text NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'LOCKED')),
    password_hash text,
    email_verified_at timestamptz,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (email = lower(email))
);

CREATE UNIQUE INDEX uq_users_email_normalized ON users (lower(email));

CREATE TABLE student_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    student_code text NOT NULL UNIQUE,
    full_name text NOT NULL,
    faculty text NOT NULL,
    major text NOT NULL,
    cohort text NOT NULL,
    gpa numeric(3, 2) CHECK (gpa IS NULL OR (gpa >= 0 AND gpa <= 4)),
    phone text,
    academic_status text NOT NULL DEFAULT 'ACTIVE'
        CHECK (academic_status IN ('ACTIVE', 'SUSPENDED', 'GRADUATED', 'INACTIVE')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE uit_staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    full_name text NOT NULL,
    department text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    legal_name text,
    industry text,
    company_size text,
    description text,
    website text,
    address text,
    partner_status text NOT NULL DEFAULT 'ACTIVE'
        CHECK (partner_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED')),
    verified_at timestamptz,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    full_name text NOT NULL,
    title text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_company_users_one_primary
    ON company_users (company_id)
    WHERE is_primary;
CREATE INDEX idx_company_users_company ON company_users (company_id);

CREATE TABLE student_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_profile_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE RESTRICT,
    document_type text NOT NULL CHECK (document_type IN ('CV', 'TRANSCRIPT', 'STUDENT_CONFIRMATION', 'OTHER')),
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),
    storage_key text NOT NULL UNIQUE,
    checksum text,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    is_default boolean NOT NULL DEFAULT false,
    verification_status text NOT NULL DEFAULT 'PENDING'
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_student_documents_default_cv
    ON student_documents (student_profile_id)
    WHERE document_type = 'CV' AND is_default;
CREATE INDEX idx_student_documents_owner ON student_documents (student_profile_id, document_type);

CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    title text NOT NULL,
    opportunity_type text NOT NULL CHECK (opportunity_type IN ('INTERNSHIP', 'PART_TIME', 'FULL_TIME', 'FRESHER')),
    work_mode text NOT NULL CHECK (work_mode IN ('ONSITE', 'REMOTE', 'HYBRID')),
    location text NOT NULL,
    description text NOT NULL,
    requirements text NOT NULL,
    benefits text,
    positions integer NOT NULL DEFAULT 1 CHECK (positions > 0),
    deadline date NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN (
            'DRAFT', 'PENDING_UIT_REVIEW', 'REVISION_REQUIRED', 'RECRUITING',
            'PAUSED', 'EXPIRED', 'REJECTED', 'CLOSED'
        )),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    submitted_at timestamptz,
    reviewed_at timestamptz,
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_posts_public_search ON job_posts (status, deadline, created_at DESC);
CREATE INDEX idx_job_posts_company_status ON job_posts (company_id, status, updated_at DESC);

CREATE TABLE job_post_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_post_id uuid NOT NULL REFERENCES job_posts(id) ON DELETE RESTRICT,
    command_id uuid NOT NULL,
    from_status text CHECK (from_status IS NULL OR from_status IN (
        'DRAFT', 'PENDING_UIT_REVIEW', 'REVISION_REQUIRED', 'RECRUITING',
        'PAUSED', 'EXPIRED', 'REJECTED', 'CLOSED'
    )),
    to_status text NOT NULL CHECK (to_status IN (
        'DRAFT', 'PENDING_UIT_REVIEW', 'REVISION_REQUIRED', 'RECRUITING',
        'PAUSED', 'EXPIRED', 'REJECTED', 'CLOSED'
    )),
    actor_type text NOT NULL CHECK (actor_type IN ('UIT_ADMIN', 'COMPANY', 'SYSTEM')),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    reason_code text,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_post_id, command_id),
    CHECK (from_status IS NULL OR from_status <> to_status),
    CHECK (
        to_status NOT IN ('REVISION_REQUIRED', 'REJECTED', 'CLOSED')
        OR reason_code IS NOT NULL
    ),
    CHECK (
        (actor_type = 'SYSTEM' AND actor_user_id IS NULL)
        OR (actor_type <> 'SYSTEM' AND actor_user_id IS NOT NULL)
    )
);

CREATE INDEX idx_job_history_timeline ON job_post_status_history (job_post_id, created_at);

CREATE TABLE job_post_categories (
    job_post_id uuid NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (job_post_id, category_id)
);

CREATE TABLE job_post_skills (
    job_post_id uuid NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
    is_required boolean NOT NULL DEFAULT true,
    PRIMARY KEY (job_post_id, skill_id)
);

CREATE TABLE applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_profile_id uuid NOT NULL REFERENCES student_profiles(id) ON DELETE RESTRICT,
    job_post_id uuid NOT NULL REFERENCES job_posts(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'UIT_REVIEWING'
        CHECK (status IN (
            'UIT_REVIEWING', 'NEEDS_SUPPLEMENT', 'FORWARDED_TO_COMPANY',
            'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'NOT_SUITABLE',
            'INTERVIEW_FAILED', 'OFFER_PENDING_STUDENT',
            'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED', 'OFFER_DECLINED',
            'UIT_REJECTED', 'WITHDRAWN'
        )),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    consented_at timestamptz NOT NULL,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    last_transition_at timestamptz NOT NULL DEFAULT now(),
    withdrawn_at timestamptz,
    accepted_at timestamptz,
    placement_confirmed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_applications_active_student_job
    ON applications (student_profile_id, job_post_id)
    WHERE status IN (
        'UIT_REVIEWING', 'NEEDS_SUPPLEMENT', 'FORWARDED_TO_COMPANY',
        'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'OFFER_PENDING_STUDENT',
        'ACCEPTED_PENDING_UIT_CONFIRMATION'
    );

CREATE UNIQUE INDEX uq_applications_single_placement
    ON applications (student_profile_id)
    WHERE status IN ('ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED');

CREATE INDEX idx_applications_student_timeline
    ON applications (student_profile_id, submitted_at DESC);
CREATE INDEX idx_applications_job_pipeline
    ON applications (job_post_id, status, last_transition_at);

CREATE TABLE application_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
    source_document_id uuid REFERENCES student_documents(id) ON DELETE SET NULL,
    document_type text NOT NULL CHECK (document_type IN ('CV', 'TRANSCRIPT', 'STUDENT_CONFIRMATION', 'OTHER')),
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),
    storage_key text NOT NULL,
    checksum text,
    source_version integer NOT NULL CHECK (source_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (application_id, document_type, source_version)
);

CREATE INDEX idx_application_documents_application ON application_documents (application_id);

CREATE TABLE application_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
    command_id uuid NOT NULL,
    from_status text CHECK (from_status IS NULL OR from_status IN (
        'UIT_REVIEWING', 'NEEDS_SUPPLEMENT', 'FORWARDED_TO_COMPANY',
        'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'NOT_SUITABLE',
        'INTERVIEW_FAILED', 'OFFER_PENDING_STUDENT',
        'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED', 'OFFER_DECLINED',
        'UIT_REJECTED', 'WITHDRAWN'
    )),
    to_status text NOT NULL CHECK (to_status IN (
        'UIT_REVIEWING', 'NEEDS_SUPPLEMENT', 'FORWARDED_TO_COMPANY',
        'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'NOT_SUITABLE',
        'INTERVIEW_FAILED', 'OFFER_PENDING_STUDENT',
        'ACCEPTED_PENDING_UIT_CONFIRMATION', 'HIRED', 'OFFER_DECLINED',
        'UIT_REJECTED', 'WITHDRAWN'
    )),
    actor_type text NOT NULL CHECK (actor_type IN ('STUDENT', 'UIT_ADMIN', 'COMPANY', 'SYSTEM')),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    reason_code text,
    note text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (application_id, command_id),
    CHECK (from_status IS NULL OR from_status <> to_status),
    CHECK (
        to_status NOT IN (
            'NEEDS_SUPPLEMENT', 'NOT_SUITABLE', 'INTERVIEW_FAILED',
            'OFFER_DECLINED', 'UIT_REJECTED', 'WITHDRAWN'
        ) OR reason_code IS NOT NULL
    ),
    CHECK (
        (actor_type = 'SYSTEM' AND actor_user_id IS NULL)
        OR (actor_type <> 'SYSTEM' AND actor_user_id IS NOT NULL)
    )
);

CREATE INDEX idx_application_history_timeline
    ON application_status_history (application_id, created_at);

CREATE TABLE interviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
    created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    scheduled_at timestamptz NOT NULL,
    time_zone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    mode text NOT NULL CHECK (mode IN ('ONSITE', 'ONLINE', 'PHONE')),
    location text,
    meeting_url text,
    interviewer_name text,
    status text NOT NULL DEFAULT 'PENDING_STUDENT_CONFIRMATION'
        CHECK (status IN (
            'PENDING_STUDENT_CONFIRMATION', 'CONFIRMED', 'RESCHEDULE_REQUESTED',
            'CANCELLED', 'COMPLETED', 'NO_SHOW'
        )),
    cancellation_reason text,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (mode <> 'ONLINE' OR meeting_url IS NOT NULL),
    CHECK (mode <> 'ONSITE' OR location IS NOT NULL)
);

CREATE INDEX idx_interviews_application ON interviews (application_id, scheduled_at DESC);
CREATE INDEX idx_interviews_upcoming ON interviews (scheduled_at, status);

CREATE TABLE recruitment_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL UNIQUE REFERENCES applications(id) ON DELETE RESTRICT,
    decided_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    outcome text NOT NULL CHECK (outcome IN ('PASS', 'FAIL')),
    student_decision text CHECK (student_decision IS NULL OR student_decision IN ('ACCEPTED', 'DECLINED')),
    offered_at timestamptz,
    responded_at timestamptz,
    start_date date,
    offer_storage_key text,
    internal_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (outcome = 'PASS' OR student_decision IS NULL)
);

CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type text NOT NULL,
    channel text NOT NULL DEFAULT 'IN_APP' CHECK (channel = 'IN_APP'),
    title text NOT NULL,
    body text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    deep_link text NOT NULL,
    dedupe_key text NOT NULL UNIQUE,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_inbox
    ON notifications (recipient_user_id, read_at, created_at DESC);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_target ON audit_logs (target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_student_profiles_updated_at BEFORE UPDATE ON student_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_uit_staff_updated_at BEFORE UPDATE ON uit_staff
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_company_users_updated_at BEFORE UPDATE ON company_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_student_documents_updated_at BEFORE UPDATE ON student_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_skills_updated_at BEFORE UPDATE ON skills
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_job_posts_updated_at BEFORE UPDATE ON job_posts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_interviews_updated_at BEFORE UPDATE ON interviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_recruitment_results_updated_at BEFORE UPDATE ON recruitment_results
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

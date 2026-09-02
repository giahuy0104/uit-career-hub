CREATE TABLE internship_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placement_id uuid NOT NULL UNIQUE REFERENCES internship_placements(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN (
            'DRAFT',
            'PENDING_COMPANY_REVIEW',
            'COMPANY_REVISION_REQUIRED',
            'PENDING_UIT_REVIEW',
            'UIT_REVISION_REQUIRED',
            'APPROVED',
            'CANCELLED'
        )),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    title text,
    department text,
    company_supervisor_name text,
    company_supervisor_email text,
    objectives text,
    expected_tasks text,
    expected_skills text,
    start_date date,
    end_date date,
    current_submission_no integer NOT NULL DEFAULT 0 CHECK (current_submission_no >= 0),
    latest_reason_code text,
    latest_note text,
    submitted_at timestamptz,
    company_reviewed_at timestamptz,
    uit_reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_internship_plans_review_queue
    ON internship_plans (status, updated_at, id);

CREATE TABLE internship_plan_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES internship_plans(id) ON DELETE RESTRICT,
    submission_no integer NOT NULL CHECK (submission_no > 0),
    submitted_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, submission_no)
);

CREATE INDEX idx_internship_plan_submissions_timeline
    ON internship_plan_submissions (plan_id, submission_no DESC);

CREATE TABLE internship_plan_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES internship_plans(id) ON DELETE RESTRICT,
    command_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN (
        'SUBMIT',
        'COMPANY_CONFIRM',
        'COMPANY_REQUEST_REVISION',
        'UIT_APPROVE',
        'UIT_REQUEST_REVISION',
        'CANCEL'
    )),
    from_status text CHECK (from_status IS NULL OR from_status IN (
        'DRAFT',
        'PENDING_COMPANY_REVIEW',
        'COMPANY_REVISION_REQUIRED',
        'PENDING_UIT_REVIEW',
        'UIT_REVISION_REQUIRED',
        'APPROVED',
        'CANCELLED'
    )),
    to_status text NOT NULL CHECK (to_status IN (
        'DRAFT',
        'PENDING_COMPANY_REVIEW',
        'COMPANY_REVISION_REQUIRED',
        'PENDING_UIT_REVIEW',
        'UIT_REVISION_REQUIRED',
        'APPROVED',
        'CANCELLED'
    )),
    actor_type text NOT NULL CHECK (actor_type IN ('STUDENT', 'COMPANY', 'UIT_ADMIN', 'SYSTEM')),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    reason_code text,
    note text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, command_id),
    CHECK (from_status IS NULL OR from_status <> to_status),
    CHECK (
        (actor_type = 'SYSTEM' AND actor_user_id IS NULL)
        OR (actor_type <> 'SYSTEM' AND actor_user_id IS NOT NULL)
    )
);

CREATE INDEX idx_internship_plan_history_timeline
    ON internship_plan_history (plan_id, created_at, id);

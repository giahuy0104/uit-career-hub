CREATE TABLE internship_weekly_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placement_id uuid NOT NULL REFERENCES internship_placements(id) ON DELETE RESTRICT,
    week_number integer NOT NULL CHECK (week_number > 0),
    period_start date NOT NULL,
    period_end date NOT NULL,
    due_date date NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'COMPANY_REVISION_REQUIRED', 'COMPANY_CONFIRMED', 'CANCELLED')),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    current_submission_no integer NOT NULL DEFAULT 0 CHECK (current_submission_no >= 0),
    work_summary text,
    outcomes text,
    difficulties text,
    next_plan text,
    latest_reason_code text,
    latest_note text,
    submitted_at timestamptz,
    company_reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (placement_id, week_number),
    UNIQUE (placement_id, period_start, period_end),
    CHECK (period_end >= period_start),
    CHECK (due_date >= period_end)
);

CREATE INDEX idx_internship_weekly_logs_placement_timeline
    ON internship_weekly_logs (placement_id, week_number DESC);

CREATE INDEX idx_internship_weekly_logs_deadline_queue
    ON internship_weekly_logs (status, due_date, id);

CREATE TABLE internship_weekly_log_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    weekly_log_id uuid NOT NULL REFERENCES internship_weekly_logs(id) ON DELETE RESTRICT,
    submission_no integer NOT NULL CHECK (submission_no > 0),
    submitted_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (weekly_log_id, submission_no)
);

CREATE INDEX idx_internship_weekly_log_submissions_timeline
    ON internship_weekly_log_submissions (weekly_log_id, submission_no DESC);

CREATE TABLE internship_weekly_log_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    weekly_log_id uuid NOT NULL REFERENCES internship_weekly_logs(id) ON DELETE RESTRICT,
    command_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('SUBMIT', 'COMPANY_CONFIRM', 'COMPANY_REQUEST_REVISION', 'CANCEL')),
    from_status text CHECK (from_status IS NULL OR from_status IN ('DRAFT', 'SUBMITTED', 'COMPANY_REVISION_REQUIRED', 'COMPANY_CONFIRMED', 'CANCELLED')),
    to_status text NOT NULL CHECK (to_status IN ('DRAFT', 'SUBMITTED', 'COMPANY_REVISION_REQUIRED', 'COMPANY_CONFIRMED', 'CANCELLED')),
    actor_type text NOT NULL CHECK (actor_type IN ('STUDENT', 'COMPANY', 'SYSTEM')),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    reason_code text,
    note text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (weekly_log_id, command_id),
    CHECK (from_status IS NULL OR from_status <> to_status),
    CHECK (
        (actor_type = 'SYSTEM' AND actor_user_id IS NULL)
        OR (actor_type <> 'SYSTEM' AND actor_user_id IS NOT NULL)
    )
);

CREATE INDEX idx_internship_weekly_log_history_timeline
    ON internship_weekly_log_history (weekly_log_id, created_at, id);

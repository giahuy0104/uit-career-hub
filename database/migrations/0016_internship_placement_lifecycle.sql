CREATE TABLE internship_placements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL UNIQUE REFERENCES applications(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'HIRED'
        CHECK (status IN ('HIRED', 'STARTED', 'COMPLETED')),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    expected_start_date date NOT NULL,
    actual_start_date date,
    completed_date date,
    hired_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (status = 'HIRED' OR actual_start_date IS NOT NULL),
    CHECK (status <> 'COMPLETED' OR completed_date IS NOT NULL),
    CHECK (completed_date IS NULL OR actual_start_date IS NULL OR completed_date >= actual_start_date)
);

CREATE INDEX idx_internship_placements_status_dates
    ON internship_placements (status, expected_start_date, id);

CREATE TABLE internship_placement_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placement_id uuid NOT NULL REFERENCES internship_placements(id) ON DELETE RESTRICT,
    command_id uuid NOT NULL,
    from_status text CHECK (from_status IS NULL OR from_status IN ('HIRED', 'STARTED', 'COMPLETED')),
    to_status text NOT NULL CHECK (to_status IN ('HIRED', 'STARTED', 'COMPLETED')),
    actor_type text NOT NULL CHECK (actor_type IN ('UIT_ADMIN', 'SYSTEM')),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    effective_date date NOT NULL,
    note text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (placement_id, command_id),
    CHECK (from_status IS NULL OR from_status <> to_status),
    CHECK (
        (actor_type = 'SYSTEM' AND actor_user_id IS NULL)
        OR (actor_type = 'UIT_ADMIN' AND actor_user_id IS NOT NULL)
    )
);

CREATE INDEX idx_internship_placement_history_timeline
    ON internship_placement_history (placement_id, created_at, id);

INSERT INTO internship_placements
    (application_id, status, expected_start_date, hired_at, created_at, updated_at)
SELECT a.id,
       'HIRED',
       COALESCE(rr.start_date, a.placement_confirmed_at::date, a.updated_at::date),
       COALESCE(a.placement_confirmed_at, a.updated_at),
       COALESCE(a.placement_confirmed_at, a.updated_at),
       COALESCE(a.placement_confirmed_at, a.updated_at)
FROM applications a
JOIN recruitment_results rr ON rr.application_id = a.id
WHERE a.status = 'HIRED'
ON CONFLICT (application_id) DO NOTHING;

INSERT INTO internship_placement_history
    (placement_id, command_id, from_status, to_status, actor_type, actor_user_id,
     effective_date, note, metadata, created_at)
SELECT ip.id,
       ah.command_id,
       NULL,
       'HIRED',
       CASE WHEN ah.actor_user_id IS NULL THEN 'SYSTEM' ELSE 'UIT_ADMIN' END,
       ah.actor_user_id,
       ip.expected_start_date,
       ah.note,
       jsonb_build_object('applicationId', ip.application_id::text, 'source', 'APPLICATION_HIRED_BACKFILL'),
       ah.created_at
FROM internship_placements ip
JOIN LATERAL (
    SELECT command_id, actor_user_id, note, created_at
    FROM application_status_history
    WHERE application_id = ip.application_id AND to_status = 'HIRED'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
) ah ON true
ON CONFLICT (placement_id, command_id) DO NOTHING;

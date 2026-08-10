CREATE TABLE internship_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placement_id uuid NOT NULL REFERENCES internship_placements(id) ON DELETE RESTRICT,
    respondent_role text NOT NULL CHECK (respondent_role IN ('STUDENT', 'COMPANY')),
    submitted_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    command_id uuid NOT NULL,
    work_quality_rating integer NOT NULL CHECK (work_quality_rating BETWEEN 1 AND 5),
    collaboration_rating integer NOT NULL CHECK (collaboration_rating BETWEEN 1 AND 5),
    professionalism_rating integer NOT NULL CHECK (professionalism_rating BETWEEN 1 AND 5),
    overall_rating integer NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    recommendation boolean NOT NULL,
    strengths text NOT NULL CHECK (length(btrim(strengths)) BETWEEN 10 AND 2000),
    improvements text CHECK (improvements IS NULL OR length(btrim(improvements)) BETWEEN 5 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (placement_id, respondent_role),
    UNIQUE (placement_id, command_id)
);

CREATE INDEX idx_internship_evaluations_placement_created
    ON internship_evaluations (placement_id, created_at, id);

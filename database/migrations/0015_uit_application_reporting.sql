CREATE INDEX idx_applications_uit_reporting_period
    ON applications (submitted_at DESC, status, student_profile_id, job_post_id);

CREATE INDEX idx_student_profiles_uit_reporting_dimensions
    ON student_profiles (faculty, major, cohort, id);

CREATE INDEX idx_job_posts_uit_reporting_dimensions
    ON job_posts (company_id, opportunity_type, work_mode, id);

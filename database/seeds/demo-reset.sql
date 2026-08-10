-- Xóa duy nhất dữ liệu gắn với các định danh demo cố định.
-- File này chỉ được chạy qua db:demo:reset sau khi đã qua chốt ALLOW_DEMO_RESET.

CREATE TEMP TABLE demo_user_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO demo_user_ids (id) VALUES
    ('00000000-0000-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000011'),
    ('00000000-0000-4000-8000-000000000012'),
    ('00000000-0000-4000-8000-000000000013'),
    ('00000000-0000-4000-8000-000000000101'),
    ('00000000-0000-4000-8000-000000000102'),
    ('00000000-0000-4000-8000-000000000103');

CREATE TEMP TABLE demo_company_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO demo_company_ids (id) VALUES
    ('00000000-0000-4000-8000-000000001001'),
    ('00000000-0000-4000-8000-000000001002');

CREATE TEMP TABLE demo_student_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO demo_student_ids (id)
SELECT id
FROM student_profiles
WHERE user_id IN (SELECT id FROM demo_user_ids)
   OR id IN (
       '00000000-0000-4000-8000-000000002001',
       '00000000-0000-4000-8000-000000002002',
       '00000000-0000-4000-8000-000000002003'
   );

CREATE TEMP TABLE demo_job_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO demo_job_ids (id)
SELECT id
FROM job_posts
WHERE created_by_user_id IN (SELECT id FROM demo_user_ids)
   OR company_id IN (SELECT id FROM demo_company_ids)
   OR id IN (
       '00000000-0000-4000-8000-000000007001',
       '00000000-0000-4000-8000-000000007002',
       '00000000-0000-4000-8000-000000007003',
       '00000000-0000-4000-8000-000000007004',
       '00000000-0000-4000-8000-000000007005'
   );

CREATE TEMP TABLE demo_application_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO demo_application_ids (id)
SELECT id
FROM applications
WHERE student_profile_id IN (SELECT id FROM demo_student_ids)
   OR job_post_id IN (SELECT id FROM demo_job_ids)
   OR id IN (
       '00000000-0000-4000-8000-000000008001',
       '00000000-0000-4000-8000-000000008002',
       '00000000-0000-4000-8000-000000008003'
   );

CREATE TEMP TABLE demo_placement_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO demo_placement_ids (id)
SELECT id
FROM internship_placements
WHERE application_id IN (SELECT id FROM demo_application_ids);

DELETE FROM notifications
WHERE recipient_user_id IN (SELECT id FROM demo_user_ids)
   OR resource_id IN (SELECT id FROM demo_application_ids)
   OR resource_id IN (SELECT id FROM demo_job_ids)
   OR resource_id IN (SELECT id FROM demo_placement_ids);

DELETE FROM audit_logs
WHERE actor_user_id IN (SELECT id FROM demo_user_ids)
   OR target_id IN (SELECT id FROM demo_application_ids)
   OR target_id IN (SELECT id FROM demo_job_ids)
   OR target_id IN (SELECT id FROM demo_company_ids)
   OR target_id IN (SELECT id FROM demo_student_ids)
   OR target_id IN (SELECT id FROM demo_user_ids)
   OR target_id IN (SELECT id FROM demo_placement_ids);

DELETE FROM internship_evaluations
WHERE placement_id IN (SELECT id FROM demo_placement_ids);

DELETE FROM internship_placement_history
WHERE placement_id IN (SELECT id FROM demo_placement_ids);

DELETE FROM internship_placements
WHERE id IN (SELECT id FROM demo_placement_ids);

DELETE FROM recruitment_results
WHERE application_id IN (SELECT id FROM demo_application_ids)
   OR decided_by_user_id IN (SELECT id FROM demo_user_ids);

DELETE FROM offer_document_uploads
WHERE application_id IN (SELECT id FROM demo_application_ids)
   OR created_by_user_id IN (SELECT id FROM demo_user_ids)
   OR company_id IN (SELECT id FROM demo_company_ids);

DELETE FROM interviews
WHERE application_id IN (SELECT id FROM demo_application_ids)
   OR created_by_user_id IN (SELECT id FROM demo_user_ids);

DELETE FROM application_status_history
WHERE application_id IN (SELECT id FROM demo_application_ids);

DELETE FROM application_documents
WHERE application_id IN (SELECT id FROM demo_application_ids);

DELETE FROM applications
WHERE id IN (SELECT id FROM demo_application_ids);

DELETE FROM job_post_status_history
WHERE job_post_id IN (SELECT id FROM demo_job_ids);

DELETE FROM job_posts
WHERE id IN (SELECT id FROM demo_job_ids);

DELETE FROM student_documents
WHERE student_profile_id IN (SELECT id FROM demo_student_ids);

DELETE FROM company_users
WHERE user_id IN (SELECT id FROM demo_user_ids)
   OR company_id IN (SELECT id FROM demo_company_ids);

DELETE FROM uit_staff
WHERE user_id IN (SELECT id FROM demo_user_ids);

DELETE FROM student_profiles
WHERE id IN (SELECT id FROM demo_student_ids);

DELETE FROM companies
WHERE id IN (SELECT id FROM demo_company_ids);

DELETE FROM refresh_tokens
WHERE user_id IN (SELECT id FROM demo_user_ids);

DELETE FROM account_activation_tokens
WHERE user_id IN (SELECT id FROM demo_user_ids);

DELETE FROM users
WHERE id IN (SELECT id FROM demo_user_ids);

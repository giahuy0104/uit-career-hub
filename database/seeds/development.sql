-- Dữ liệu demo phục vụ thiết kế và kịch bản bảo vệ.
-- Mật khẩu chỉ dùng trong development; không sao chép sang production.

INSERT INTO users (id, email, role, status, email_verified_at) VALUES
    ('00000000-0000-4000-8000-000000000001', 'admin.career@uit.edu.vn', 'UIT_ADMIN', 'ACTIVE', now()),
    ('00000000-0000-4000-8000-000000000011', '20521067@student.uit.edu.vn', 'STUDENT', 'ACTIVE', now()),
    ('00000000-0000-4000-8000-000000000012', '21520881@student.uit.edu.vn', 'STUDENT', 'ACTIVE', now()),
    ('00000000-0000-4000-8000-000000000013', '21520943@student.uit.edu.vn', 'STUDENT', 'ACTIVE', now()),
    ('00000000-0000-4000-8000-000000000101', 'recruiter@vng.example', 'COMPANY', 'ACTIVE', now()),
    ('00000000-0000-4000-8000-000000000102', 'talent@vng.example', 'COMPANY', 'ACTIVE', now()),
    ('00000000-0000-4000-8000-000000000103', 'recruiter@fpt.example', 'COMPANY', 'ACTIVE', now())
ON CONFLICT DO NOTHING;

UPDATE users
SET password_hash = CASE
        WHEN role = 'UIT_ADMIN' THEN '$2b$12$dZ579xZ3bzIdl09zS81zBuKVptkltdNcd91SMl8Pf73WyXOOCZ//W'
        WHEN role = 'STUDENT' THEN '$2b$12$YZNYL5mmr3wfgZVUWL8xV.eTjKfFT2SGeB3CJV/AoL0ejezDJNVHO'
        WHEN role = 'COMPANY' THEN '$2b$12$bpeb3YUbDmyTJzxS1is7/u43JFCSLjXIMmj2FNT0OwXcqoJDdOFcy'
    END,
    password_changed_at = COALESCE(password_changed_at, now())
WHERE id IN (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103'
)
AND password_hash IS NULL;

INSERT INTO uit_staff (id, user_id, full_name, department) VALUES
    ('00000000-0000-4000-8000-000000003001', '00000000-0000-4000-8000-000000000001', 'Trần Hoàng Anh', 'Phòng Quan hệ Doanh nghiệp')
ON CONFLICT DO NOTHING;

INSERT INTO student_profiles (
    id, user_id, student_code, full_name, faculty, major, cohort, gpa, academic_status
) VALUES
    ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000000011', '20521067', 'Nguyễn Minh Khoa', 'Công nghệ phần mềm', 'Kỹ thuật phần mềm', '2020', 3.42, 'ACTIVE'),
    ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000000012', '21520881', 'Phạm Gia Huy', 'Khoa học và Kỹ thuật thông tin', 'Khoa học dữ liệu', '2021', 3.18, 'ACTIVE'),
    ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000000013', '21520943', 'Trần Khánh Linh', 'Hệ thống thông tin', 'Hệ thống thông tin', '2021', 3.67, 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO companies (
    id, code, name, legal_name, industry, company_size, description, website, address,
    partner_status, verified_at, created_by_user_id
) VALUES
    (
        '00000000-0000-4000-8000-000000001001', 'VNG', 'VNG Corporation',
        'Công ty Cổ phần VNG', 'Công nghệ sản phẩm', '1000-5000',
        'Doanh nghiệp công nghệ phát triển sản phẩm và nền tảng số.',
        'https://vng.com.vn', 'Quận 7, TP. Hồ Chí Minh', 'ACTIVE', now(),
        '00000000-0000-4000-8000-000000000001'
    ),
    (
        '00000000-0000-4000-8000-000000001002', 'FPTSOFT', 'FPT Software',
        'Công ty TNHH Phần mềm FPT', 'Dịch vụ phần mềm', '5000+',
        'Doanh nghiệp cung cấp dịch vụ và giải pháp phần mềm toàn cầu.',
        'https://fptsoftware.com', 'TP. Thủ Đức, TP. Hồ Chí Minh', 'ACTIVE', now(),
        '00000000-0000-4000-8000-000000000001'
    )
ON CONFLICT DO NOTHING;

INSERT INTO company_users (id, user_id, company_id, full_name, title, is_primary) VALUES
    ('00000000-0000-4000-8000-000000004001', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000001001', 'Lê Thu Hà', 'Quản trị viên tuyển dụng', true),
    ('00000000-0000-4000-8000-000000004002', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000001001', 'Nguyễn Hoàng Nam', 'Nhà tuyển dụng', false),
    ('00000000-0000-4000-8000-000000004003', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000001002', 'Phan Minh Anh', 'Nhà tuyển dụng', true)
ON CONFLICT DO NOTHING;

INSERT INTO student_documents (
    id, student_profile_id, document_type, file_name, mime_type, file_size_bytes,
    storage_key, checksum, version, is_default, verification_status
) VALUES
    (
        '00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-000000002001',
        'CV', 'CV_Backend_NguyenMinhKhoa_2026.pdf', 'application/pdf', 421888,
        'demo/students/20521067/cv-backend-v1.pdf', 'demo-checksum-cv-20521067-v1', 1, true, 'VERIFIED'
    ),
    (
        '00000000-0000-4000-8000-000000005002', '00000000-0000-4000-8000-000000002001',
        'TRANSCRIPT', 'Bang_diem_20521067.pdf', 'application/pdf', 315392,
        'demo/students/20521067/transcript-v1.pdf', 'demo-checksum-transcript-20521067-v1', 1, false, 'VERIFIED'
    )
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, code, name) VALUES
    ('00000000-0000-4000-8000-000000006001', 'SOFTWARE_ENGINEERING', 'Kỹ thuật phần mềm'),
    ('00000000-0000-4000-8000-000000006002', 'DATA_ENGINEERING', 'Khoa học dữ liệu'),
    ('00000000-0000-4000-8000-000000006003', 'INFORMATION_SYSTEMS', 'Hệ thống thông tin')
ON CONFLICT DO NOTHING;

INSERT INTO skills (id, slug, name) VALUES
    ('00000000-0000-4000-8000-000000006101', 'java', 'Java'),
    ('00000000-0000-4000-8000-000000006102', 'spring-boot', 'Spring Boot'),
    ('00000000-0000-4000-8000-000000006103', 'postgresql', 'PostgreSQL'),
    ('00000000-0000-4000-8000-000000006104', 'react', 'React'),
    ('00000000-0000-4000-8000-000000006105', 'python', 'Python')
ON CONFLICT DO NOTHING;

INSERT INTO job_posts (
    id, company_id, created_by_user_id, reviewed_by_user_id, title, opportunity_type,
    work_mode, location, description, requirements, benefits, positions, deadline,
    status, submitted_at, reviewed_at
) VALUES
    (
        '00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000001001',
        '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001',
        'Thực tập sinh Backend', 'INTERNSHIP', 'HYBRID', 'Quận 7, TP. Hồ Chí Minh',
        'Phát triển và bảo trì REST API cho sản phẩm.',
        'Sinh viên CNTT có nền tảng backend và cơ sở dữ liệu.',
        'Mentor, phụ cấp và xác nhận thực tập.', 10, current_date + 45,
        'RECRUITING', now() - interval '10 days', now() - interval '9 days'
    ),
    (
        '00000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-000000001002',
        '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001',
        'Thực tập sinh Data Engineer', 'INTERNSHIP', 'ONSITE', 'TP. Thủ Đức, TP. Hồ Chí Minh',
        'Tham gia xây dựng pipeline dữ liệu.',
        'Biết SQL, Python và kiến thức cơ bản về dữ liệu.',
        'Đào tạo và hỗ trợ báo cáo thực tập.', 6, current_date + 50,
        'RECRUITING', now() - interval '8 days', now() - interval '7 days'
    ),
    (
        '00000000-0000-4000-8000-000000007003', '00000000-0000-4000-8000-000000001001',
        '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001',
        'Thực tập sinh Frontend', 'INTERNSHIP', 'HYBRID', 'Quận 7, TP. Hồ Chí Minh',
        'Phát triển giao diện React cho nền tảng sản phẩm.',
        'Biết JavaScript, React và Git.',
        'Mentor và phụ cấp thực tập.', 5, current_date + 40,
        'RECRUITING', now() - interval '6 days', now() - interval '5 days'
    ),
    (
        '00000000-0000-4000-8000-000000007005', '00000000-0000-4000-8000-000000001002',
        '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001',
        'Thực tập sinh QA Automation', 'INTERNSHIP', 'HYBRID', 'TP. Thủ Đức, TP. Hồ Chí Minh',
        'Tham gia xây dựng kịch bản kiểm thử tự động cho ứng dụng web và API.',
        'Biết kiểm thử phần mềm, Git và có kiến thức cơ bản về JavaScript hoặc Java.',
        'Được hướng dẫn bởi mentor, hỗ trợ báo cáo thực tập và phụ cấp.', 4, current_date + 55,
        'RECRUITING', now() - interval '4 days', now() - interval '3 days'
    ),
    (
        '00000000-0000-4000-8000-000000007004', '00000000-0000-4000-8000-000000001002',
        '00000000-0000-4000-8000-000000000103', NULL,
        'Fresher Software Engineer', 'FRESHER', 'ONSITE', 'TP. Thủ Đức, TP. Hồ Chí Minh',
        'Tham gia dự án phần mềm cho khách hàng quốc tế.',
        'Nắm vững lập trình hướng đối tượng và Git.',
        'Đào tạo fresher.', 8, current_date + 60,
        'PENDING_UIT_REVIEW', now() - interval '1 day', NULL
    )
ON CONFLICT DO NOTHING;

INSERT INTO job_post_categories (job_post_id, category_id) VALUES
    ('00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000006001'),
    ('00000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-000000006002'),
    ('00000000-0000-4000-8000-000000007003', '00000000-0000-4000-8000-000000006003'),
    ('00000000-0000-4000-8000-000000007005', '00000000-0000-4000-8000-000000006001'),
    ('00000000-0000-4000-8000-000000007004', '00000000-0000-4000-8000-000000006001')
ON CONFLICT DO NOTHING;

INSERT INTO job_post_skills (job_post_id, skill_id, is_required) VALUES
    ('00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000006101', true),
    ('00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000006103', true),
    ('00000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-000000006105', true),
    ('00000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-000000006103', true),
    ('00000000-0000-4000-8000-000000007003', '00000000-0000-4000-8000-000000006104', true),
    ('00000000-0000-4000-8000-000000007005', '00000000-0000-4000-8000-000000006101', false)
ON CONFLICT DO NOTHING;

INSERT INTO job_post_status_history (
    id, job_post_id, command_id, from_status, to_status, actor_type, actor_user_id, reason_code, note, created_at
) VALUES
    ('10000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000007001', '11000000-0000-4000-8000-000000007001', NULL, 'DRAFT', 'COMPANY', '00000000-0000-4000-8000-000000000101', NULL, 'Khởi tạo dữ liệu demo', now() - interval '11 days'),
    ('10000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-000000007001', '11000000-0000-4000-8000-000000007002', 'DRAFT', 'PENDING_UIT_REVIEW', 'COMPANY', '00000000-0000-4000-8000-000000000101', NULL, NULL, now() - interval '10 days'),
    ('10000000-0000-4000-8000-000000007003', '00000000-0000-4000-8000-000000007001', '11000000-0000-4000-8000-000000007003', 'PENDING_UIT_REVIEW', 'RECRUITING', 'UIT_ADMIN', '00000000-0000-4000-8000-000000000001', NULL, NULL, now() - interval '9 days'),
    ('10000000-0000-4000-8000-000000007006', '00000000-0000-4000-8000-000000007005', '11000000-0000-4000-8000-000000007006', NULL, 'DRAFT', 'COMPANY', '00000000-0000-4000-8000-000000000103', NULL, 'Khởi tạo dữ liệu demo', now() - interval '5 days'),
    ('10000000-0000-4000-8000-000000007007', '00000000-0000-4000-8000-000000007005', '11000000-0000-4000-8000-000000007007', 'DRAFT', 'PENDING_UIT_REVIEW', 'COMPANY', '00000000-0000-4000-8000-000000000103', NULL, NULL, now() - interval '4 days'),
    ('10000000-0000-4000-8000-000000007008', '00000000-0000-4000-8000-000000007005', '11000000-0000-4000-8000-000000007008', 'PENDING_UIT_REVIEW', 'RECRUITING', 'UIT_ADMIN', '00000000-0000-4000-8000-000000000001', NULL, NULL, now() - interval '3 days'),
    ('10000000-0000-4000-8000-000000007004', '00000000-0000-4000-8000-000000007004', '11000000-0000-4000-8000-000000007004', NULL, 'DRAFT', 'COMPANY', '00000000-0000-4000-8000-000000000103', NULL, 'Khởi tạo dữ liệu demo', now() - interval '2 days'),
    ('10000000-0000-4000-8000-000000007005', '00000000-0000-4000-8000-000000007004', '11000000-0000-4000-8000-000000007005', 'DRAFT', 'PENDING_UIT_REVIEW', 'COMPANY', '00000000-0000-4000-8000-000000000103', NULL, NULL, now() - interval '1 day')
ON CONFLICT DO NOTHING;

INSERT INTO applications (
    id, student_profile_id, job_post_id, status, consented_at, submitted_at, last_transition_at
) VALUES
    (
        '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000002001',
        '00000000-0000-4000-8000-000000007001', 'OFFER_PENDING_STUDENT',
        now() - interval '7 days', now() - interval '7 days', now() - interval '2 hours'
    ),
    (
        '00000000-0000-4000-8000-000000008002', '00000000-0000-4000-8000-000000002001',
        '00000000-0000-4000-8000-000000007002', 'COMPANY_REVIEWING',
        now() - interval '5 days', now() - interval '5 days', now() - interval '2 days'
    ),
    (
        '00000000-0000-4000-8000-000000008003', '00000000-0000-4000-8000-000000002001',
        '00000000-0000-4000-8000-000000007003', 'UIT_REVIEWING',
        now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
    )
ON CONFLICT DO NOTHING;

INSERT INTO application_documents (
    id, application_id, source_document_id, document_type, file_name, mime_type,
    file_size_bytes, storage_key, checksum, source_version
) VALUES
    ('00000000-0000-4000-8000-000000009001', '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000005001', 'CV', 'CV_Backend_NguyenMinhKhoa_2026.pdf', 'application/pdf', 421888, 'demo/snapshots/application-8001/cv-v1.pdf', 'demo-checksum-cv-20521067-v1', 1),
    ('00000000-0000-4000-8000-000000009002', '00000000-0000-4000-8000-000000008002', '00000000-0000-4000-8000-000000005001', 'CV', 'CV_Backend_NguyenMinhKhoa_2026.pdf', 'application/pdf', 421888, 'demo/snapshots/application-8002/cv-v1.pdf', 'demo-checksum-cv-20521067-v1', 1),
    ('00000000-0000-4000-8000-000000009003', '00000000-0000-4000-8000-000000008003', '00000000-0000-4000-8000-000000005001', 'CV', 'CV_Backend_NguyenMinhKhoa_2026.pdf', 'application/pdf', 421888, 'demo/snapshots/application-8003/cv-v1.pdf', 'demo-checksum-cv-20521067-v1', 1)
ON CONFLICT DO NOTHING;

INSERT INTO application_status_history (
    id, application_id, command_id, from_status, to_status, actor_type,
    actor_user_id, reason_code, note, created_at
) VALUES
    ('20000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001', '21000000-0000-4000-8000-000000008001', NULL, 'UIT_REVIEWING', 'STUDENT', '00000000-0000-4000-8000-000000000011', NULL, NULL, now() - interval '7 days'),
    ('20000000-0000-4000-8000-000000008002', '00000000-0000-4000-8000-000000008001', '21000000-0000-4000-8000-000000008002', 'UIT_REVIEWING', 'FORWARDED_TO_COMPANY', 'UIT_ADMIN', '00000000-0000-4000-8000-000000000001', NULL, NULL, now() - interval '6 days'),
    ('20000000-0000-4000-8000-000000008003', '00000000-0000-4000-8000-000000008001', '21000000-0000-4000-8000-000000008003', 'FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'COMPANY', '00000000-0000-4000-8000-000000000101', NULL, NULL, now() - interval '5 days'),
    ('20000000-0000-4000-8000-000000008004', '00000000-0000-4000-8000-000000008001', '21000000-0000-4000-8000-000000008004', 'COMPANY_REVIEWING', 'INTERVIEW_INVITED', 'COMPANY', '00000000-0000-4000-8000-000000000101', NULL, NULL, now() - interval '3 days'),
    ('20000000-0000-4000-8000-000000008005', '00000000-0000-4000-8000-000000008001', '21000000-0000-4000-8000-000000008005', 'INTERVIEW_INVITED', 'OFFER_PENDING_STUDENT', 'COMPANY', '00000000-0000-4000-8000-000000000101', NULL, NULL, now() - interval '2 hours'),
    ('20000000-0000-4000-8000-000000008006', '00000000-0000-4000-8000-000000008002', '21000000-0000-4000-8000-000000008006', NULL, 'UIT_REVIEWING', 'STUDENT', '00000000-0000-4000-8000-000000000011', NULL, NULL, now() - interval '5 days'),
    ('20000000-0000-4000-8000-000000008007', '00000000-0000-4000-8000-000000008002', '21000000-0000-4000-8000-000000008007', 'UIT_REVIEWING', 'FORWARDED_TO_COMPANY', 'UIT_ADMIN', '00000000-0000-4000-8000-000000000001', NULL, NULL, now() - interval '3 days'),
    ('20000000-0000-4000-8000-000000008008', '00000000-0000-4000-8000-000000008002', '21000000-0000-4000-8000-000000008008', 'FORWARDED_TO_COMPANY', 'COMPANY_REVIEWING', 'COMPANY', '00000000-0000-4000-8000-000000000103', NULL, NULL, now() - interval '2 days'),
    ('20000000-0000-4000-8000-000000008009', '00000000-0000-4000-8000-000000008003', '21000000-0000-4000-8000-000000008009', NULL, 'UIT_REVIEWING', 'STUDENT', '00000000-0000-4000-8000-000000000011', NULL, NULL, now() - interval '1 day')
ON CONFLICT DO NOTHING;

INSERT INTO interviews (
    id, application_id, created_by_user_id, scheduled_at, time_zone, mode,
    meeting_url, interviewer_name, status
) VALUES
    (
        '00000000-0000-4000-8000-000000010001', '00000000-0000-4000-8000-000000008001',
        '00000000-0000-4000-8000-000000000101', now() - interval '1 day',
        'Asia/Ho_Chi_Minh', 'ONLINE', 'https://meet.example/demo-vng-8001',
        'Nguyễn Hoàng Nam', 'COMPLETED'
    )
ON CONFLICT DO NOTHING;

INSERT INTO recruitment_results (
    id, application_id, decided_by_user_id, outcome, offered_at, start_date, internal_note
) VALUES
    (
        '00000000-0000-4000-8000-000000011001', '00000000-0000-4000-8000-000000008001',
        '00000000-0000-4000-8000-000000000101', 'PASS', now() - interval '2 hours',
        current_date + 30, 'Dữ liệu demo nội bộ; không hiển thị cho sinh viên.'
    )
ON CONFLICT DO NOTHING;

INSERT INTO notifications (
    id, recipient_user_id, type, title, body, resource_type, resource_id, deep_link, dedupe_key
) VALUES
    (
        '00000000-0000-4000-8000-000000012001', '00000000-0000-4000-8000-000000000011',
        'OFFER_AVAILABLE', 'Bạn có kết quả tuyển dụng mới',
        'Vui lòng xem và phản hồi offer cho vị trí Thực tập sinh Backend.',
        'APPLICATION', '00000000-0000-4000-8000-000000008001',
        '/applications/00000000-0000-4000-8000-000000008001',
        'demo:application:8001:offer-available'
    ),
    (
        '00000000-0000-4000-8000-000000012002', '00000000-0000-4000-8000-000000000001',
        'APPLICATION_SUBMITTED', 'Có hồ sơ sinh viên cần xử lý',
        'Một hồ sơ mới đang chờ UIT kiểm duyệt.',
        'APPLICATION', '00000000-0000-4000-8000-000000008003',
        '/uit/applications/00000000-0000-4000-8000-000000008003',
        'demo:application:8003:submitted'
    ),
    (
        '00000000-0000-4000-8000-000000012003', '00000000-0000-4000-8000-000000000103',
        'APPLICATION_RECEIVED', 'Có hồ sơ ứng viên cần tiếp tục xử lý',
        'Hồ sơ Thực tập sinh Data Engineer đang ở bước doanh nghiệp sàng lọc.',
        'APPLICATION', '00000000-0000-4000-8000-000000008002',
        '/company/candidates/00000000-0000-4000-8000-000000008002',
        'demo:application:8002:company-reviewing'
    )
ON CONFLICT DO NOTHING;

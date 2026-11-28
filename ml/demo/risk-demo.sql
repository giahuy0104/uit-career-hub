-- CHỈ DÙNG CHO DATABASE LOCAL ĐỂ DEMO CẢNH BÁO SỚM. Không chạy trên database public.
-- 4 sinh viên đang thực tập tại VNG từ 5 tuần trước, với nhật ký tốt / trung bình / đáng lo / mới bắt đầu.
-- Chạy lại nhiều lần không sao (ON CONFLICT DO NOTHING).
BEGIN;

INSERT INTO users (id, email, role, status, email_verified_at) VALUES
  ('00000000-0000-4000-8000-000000090001', '22520101@student.uit.edu.vn', 'STUDENT', 'ACTIVE', now()),
  ('00000000-0000-4000-8000-000000090002', '22520102@student.uit.edu.vn', 'STUDENT', 'ACTIVE', now()),
  ('00000000-0000-4000-8000-000000090003', '22520103@student.uit.edu.vn', 'STUDENT', 'ACTIVE', now()),
  ('00000000-0000-4000-8000-000000090004', '22520104@student.uit.edu.vn', 'STUDENT', 'ACTIVE', now())
ON CONFLICT DO NOTHING;

INSERT INTO student_profiles (id, user_id, student_code, full_name, faculty, major, cohort, gpa) VALUES
  ('00000000-0000-4000-8000-000000091001', '00000000-0000-4000-8000-000000090001', '22520101', 'Trần Thu Hà', 'Công nghệ Phần mềm', 'Kỹ thuật phần mềm', 'K17', 3.40),
  ('00000000-0000-4000-8000-000000091002', '00000000-0000-4000-8000-000000090002', '22520102', 'Lê Quốc Bảo', 'Công nghệ Phần mềm', 'Kỹ thuật phần mềm', 'K17', 3.05),
  ('00000000-0000-4000-8000-000000091003', '00000000-0000-4000-8000-000000090003', '22520103', 'Phạm Gia Minh', 'Hệ thống Thông tin', 'Hệ thống thông tin', 'K17', 2.70),
  ('00000000-0000-4000-8000-000000091004', '00000000-0000-4000-8000-000000090004', '22520104', 'Võ Anh Thư', 'Khoa học Máy tính', 'Khoa học máy tính', 'K17', 3.60)
ON CONFLICT DO NOTHING;

INSERT INTO applications (id, student_profile_id, job_post_id, status, consented_at, submitted_at, placement_confirmed_at)
SELECT ('00000000-0000-4000-8000-00000009200' || n)::uuid, ('00000000-0000-4000-8000-00000009100' || n)::uuid,
       '00000000-0000-4000-8000-000000007006', 'HIRED', now() - interval '60 days', now() - interval '60 days', now() - interval '40 days'
FROM generate_series(1, 4) n
ON CONFLICT DO NOTHING;

INSERT INTO internship_placements (id, application_id, status, expected_start_date, actual_start_date, hired_at, started_at)
SELECT ('00000000-0000-4000-8000-00000009300' || n)::uuid, ('00000000-0000-4000-8000-00000009200' || n)::uuid, 'STARTED',
       current_date - CASE WHEN n = 4 THEN 9 ELSE 36 END, current_date - CASE WHEN n = 4 THEN 9 ELSE 36 END,
       now() - interval '40 days', now() - (CASE WHEN n = 4 THEN 9 ELSE 36 END) * interval '1 day'
FROM generate_series(1, 4) n
ON CONFLICT DO NOTHING;

-- (student, week, late?, submitted?, work summary, outcomes, difficulties)
CREATE TEMP TABLE demo_logs (n int, week int, late boolean, submitted boolean, work text, outcomes text, difficulties text) ON COMMIT DROP;
INSERT INTO demo_logs VALUES
  (1, 1, false, true, 'Tìm hiểu kiến trúc hệ thống thanh toán, cài môi trường, đọc tài liệu API nội bộ và quy trình review code của nhóm', 'Chạy được dự án trên máy, hoàn thành bài tập onboarding', ''),
  (1, 2, false, true, 'Thiết kế bảng dữ liệu cho module đối soát, viết migration và seed dữ liệu mẫu, trao đổi với mentor về chỉ mục', 'Merge 2 pull request, được duyệt thiết kế', ''),
  (1, 3, false, true, 'Xây dựng API đối soát giao dịch theo ngày, viết kiểm thử đơn vị và kiểm thử tích hợp với PostgreSQL', 'API chạy đúng trên môi trường staging, coverage 82%', ''),
  (1, 4, false, true, 'Tối ưu truy vấn đối soát bằng index và phân trang, đo hiệu năng trước và sau, cập nhật tài liệu', 'Thời gian phản hồi giảm từ 1,2 giây xuống 180ms', ''),
  (1, 5, false, true, 'Làm màn hình báo cáo đối soát bằng React, thêm bộ lọc và xuất CSV, demo cho team sản phẩm', 'Được góp ý giao diện, đã sửa xong 4/5 góp ý', ''),
  (2, 1, false, true, 'Cài môi trường, đọc tài liệu dự án và làm quen quy trình Git của nhóm', 'Chạy được dự án', ''),
  (2, 2, false, true, 'Sửa một số lỗi giao diện nhỏ trong trang quản trị', 'Sửa xong 3 lỗi', 'Chưa quen codebase lớn nên mất nhiều thời gian tìm chỗ cần sửa'),
  (2, 3, true, true, 'Viết API lấy danh sách giao dịch có phân trang', 'Xong phần backend', ''),
  (2, 4, false, false, '', '', ''),
  (2, 5, false, true, 'Viết kiểm thử cho API giao dịch và sửa lỗi theo góp ý review', 'Đã merge', ''),
  (3, 1, true, true, 'Học Docker, đọc tài liệu', 'Cài được Docker', 'Máy yếu, Docker chạy chậm và hay bị treo khi build image nên chưa làm được nhiều'),
  (3, 2, true, true, 'Học Docker, đọc tài liệu', 'Chưa xong', 'Máy vẫn yếu, chưa build được image của dự án, cần hỗ trợ cấu hình'),
  (3, 3, false, false, '', '', ''),
  (3, 4, true, true, 'Học docker đọc tài liệu', '', ''),
  (3, 5, false, false, '', '', ''),
  (4, 1, false, true, 'Nhận máy, cài môi trường và đọc tài liệu kiến trúc', 'Chạy được dự án', '');

INSERT INTO internship_weekly_logs (id, placement_id, week_number, period_start, period_end, due_date, status, current_submission_no,
  work_summary, outcomes, difficulties, next_plan, submitted_at, company_reviewed_at)
SELECT md5('ml-demo-log-' || d.n || '-' || d.week)::uuid, ('00000000-0000-4000-8000-00000009300' || d.n)::uuid, d.week,
       p.actual_start_date + 7 * (d.week - 1), p.actual_start_date + 7 * d.week - 1, p.actual_start_date + 7 * d.week + 1,
       CASE WHEN d.submitted THEN 'COMPANY_CONFIRMED' ELSE 'DRAFT' END, CASE WHEN d.submitted THEN 1 ELSE 0 END,
       nullif(d.work, ''), nullif(d.outcomes, ''), nullif(d.difficulties, ''), 'Tiếp tục công việc tuần sau',
       CASE WHEN d.submitted THEN (p.actual_start_date + 7 * d.week + CASE WHEN d.late THEN 4 ELSE 0 END)::timestamp END,
       CASE WHEN d.submitted THEN (p.actual_start_date + 7 * d.week + CASE WHEN d.late THEN 5 ELSE 1 END)::timestamp END
FROM demo_logs d JOIN internship_placements p ON p.id = ('00000000-0000-4000-8000-00000009300' || d.n)::uuid
WHERE d.week * 7 <= current_date - p.actual_start_date + 7
ON CONFLICT DO NOTHING;

INSERT INTO internship_weekly_log_submissions (weekly_log_id, submission_no, submitted_by_user_id, snapshot)
SELECT md5('ml-demo-log-' || d.n || '-' || d.week)::uuid, 1, ('00000000-0000-4000-8000-00000009000' || d.n)::uuid,
       jsonb_build_object('weekNumber', d.week, 'workSummary', d.work, 'outcomes', d.outcomes, 'difficulties', d.difficulties,
                          'nextPlan', 'Tiếp tục công việc tuần sau')
FROM demo_logs d
WHERE d.submitted AND EXISTS (SELECT 1 FROM internship_weekly_logs l WHERE l.id = md5('ml-demo-log-' || d.n || '-' || d.week)::uuid)
ON CONFLICT DO NOTHING;

-- Lê Quốc Bảo bị doanh nghiệp yêu cầu sửa nhật ký tuần 3.
INSERT INTO internship_weekly_log_history (weekly_log_id, command_id, action, from_status, to_status, actor_type, actor_user_id, note)
VALUES (md5('ml-demo-log-2-3')::uuid, md5('ml-demo-revision')::uuid, 'COMPANY_REQUEST_REVISION', 'SUBMITTED', 'COMPANY_REVISION_REQUIRED',
        'COMPANY', '00000000-0000-4000-8000-000000000101', 'Bổ sung kết quả cụ thể')
ON CONFLICT DO NOTHING;

COMMIT;

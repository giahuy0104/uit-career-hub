# ERD MVP

## Sơ đồ quan hệ

```mermaid
erDiagram
    USERS ||--o| STUDENT_PROFILES : has
    USERS ||--o| UIT_STAFF : has
    USERS ||--o| COMPANY_USERS : has
    COMPANIES ||--o{ COMPANY_USERS : grants_access
    COMPANIES ||--o{ JOB_POSTS : owns
    USERS ||--o{ JOB_POSTS : creates
    JOB_POSTS ||--o{ JOB_POST_STATUS_HISTORY : records
    USERS ||--o{ JOB_POST_STATUS_HISTORY : acts
    JOB_POSTS ||--o{ JOB_POST_CATEGORIES : classified
    CATEGORIES ||--o{ JOB_POST_CATEGORIES : groups
    JOB_POSTS ||--o{ JOB_POST_SKILLS : requires
    SKILLS ||--o{ JOB_POST_SKILLS : labels
    STUDENT_PROFILES ||--o{ STUDENT_DOCUMENTS : owns
    STUDENT_PROFILES ||--o{ APPLICATIONS : submits
    JOB_POSTS ||--o{ APPLICATIONS : receives
    APPLICATIONS ||--o{ APPLICATION_DOCUMENTS : snapshots
    STUDENT_DOCUMENTS o|--o{ APPLICATION_DOCUMENTS : source
    APPLICATIONS ||--o{ APPLICATION_STATUS_HISTORY : records
    USERS o|--o{ APPLICATION_STATUS_HISTORY : acts
    APPLICATIONS ||--o{ INTERVIEWS : schedules
    APPLICATIONS ||--o| RECRUITMENT_RESULTS : concludes
    APPLICATIONS ||--o| INTERNSHIP_PLACEMENTS : creates
    INTERNSHIP_PLACEMENTS ||--o{ INTERNSHIP_PLACEMENT_HISTORY : records
    INTERNSHIP_PLACEMENTS ||--o{ INTERNSHIP_EVALUATIONS : receives
    USERS ||--o{ INTERNSHIP_EVALUATIONS : submits
    USERS ||--o{ NOTIFICATIONS : receives
    USERS o|--o{ AUDIT_LOGS : performs

    USERS {
      uuid id PK
      text email UK
      text role
      text status
      text password_hash
      timestamptz last_login_at
    }
    STUDENT_PROFILES {
      uuid id PK
      uuid user_id FK
      text student_code UK
      text full_name
      text faculty
      text major
      text cohort
      numeric gpa
      text academic_status
    }
    UIT_STAFF {
      uuid id PK
      uuid user_id FK
      text full_name
      text department
    }
    COMPANIES {
      uuid id PK
      text code UK
      text name
      text partner_status
      text industry
      timestamptz verified_at
    }
    COMPANY_USERS {
      uuid id PK
      uuid user_id FK
      uuid company_id FK
      text title
      boolean is_primary
    }
    STUDENT_DOCUMENTS {
      uuid id PK
      uuid student_profile_id FK
      text document_type
      text file_name
      text storage_key UK
      integer version
      boolean is_default
    }
    JOB_POSTS {
      uuid id PK
      uuid company_id FK
      uuid created_by_user_id FK
      text title
      text opportunity_type
      text work_mode
      date deadline
      text status
      integer version
    }
    JOB_POST_STATUS_HISTORY {
      uuid id PK
      uuid job_post_id FK
      text from_status
      text to_status
      uuid actor_user_id FK
      text reason_code
      text note
    }
    CATEGORIES {
      uuid id PK
      text code UK
      text name
      boolean is_active
      integer version
    }
    SKILLS {
      uuid id PK
      text slug UK
      text name
      boolean is_active
      integer version
    }
    JOB_POST_CATEGORIES {
      uuid job_post_id PK,FK
      uuid category_id PK,FK
    }
    JOB_POST_SKILLS {
      uuid job_post_id PK,FK
      uuid skill_id PK,FK
      boolean is_required
    }
    APPLICATIONS {
      uuid id PK
      uuid student_profile_id FK
      uuid job_post_id FK
      text status
      integer version
      timestamptz submitted_at
      timestamptz accepted_at
      timestamptz placement_confirmed_at
    }
    APPLICATION_DOCUMENTS {
      uuid id PK
      uuid application_id FK
      uuid source_document_id FK
      text storage_key
      text checksum
      integer source_version
    }
    APPLICATION_STATUS_HISTORY {
      uuid id PK
      uuid application_id FK
      uuid command_id UK
      text from_status
      text to_status
      text actor_type
      uuid actor_user_id FK
      text reason_code
      text note
    }
    INTERVIEWS {
      uuid id PK
      uuid application_id FK
      timestamptz scheduled_at
      text time_zone
      text mode
      text status
      integer version
    }
    RECRUITMENT_RESULTS {
      uuid id PK
      uuid application_id FK,UK
      text outcome
      text student_decision
      date start_date
      text offer_storage_key
    }
    INTERNSHIP_PLACEMENTS {
      uuid id PK
      uuid application_id FK,UK
      text status
      integer version
      date expected_start_date
      date actual_start_date
      date completed_date
      timestamptz hired_at
      timestamptz started_at
      timestamptz completed_at
    }
    INTERNSHIP_PLACEMENT_HISTORY {
      uuid id PK
      uuid placement_id FK
      uuid command_id UK
      text from_status
      text to_status
      text actor_type
      uuid actor_user_id FK
      date effective_date
      text note
    }
    INTERNSHIP_EVALUATIONS {
      uuid id PK
      uuid placement_id FK
      text respondent_role
      uuid submitted_by_user_id FK
      uuid command_id UK
      integer work_quality_rating
      integer collaboration_rating
      integer professionalism_rating
      integer overall_rating
      boolean recommendation
      text strengths
      text improvements
      timestamptz created_at
    }
    NOTIFICATIONS {
      uuid id PK
      uuid recipient_user_id FK
      text type
      text resource_type
      uuid resource_id
      text dedupe_key UK
      timestamptz read_at
    }
    AUDIT_LOGS {
      uuid id PK
      uuid actor_user_id FK
      text action
      text target_type
      uuid target_id
      jsonb metadata
      inet ip_address
    }
```

## Ownership và quyền dữ liệu

- Student chỉ đọc/sửa `student_profiles`, `student_documents` và `applications` của chính mình.
- Company chỉ đọc/sửa `companies`, `job_posts` thuộc company và chỉ thấy application sau khi UIT chuyển đến.
- UIT_ADMIN quản lý đối tác, duyệt job/application và xác nhận placement; không tự gán kết quả tuyển dụng khi chưa có căn cứ.
- UIT_ADMIN theo dõi kỳ thực tập sau `HIRED`; mỗi transition có version, command id, actor history, audit và notification.
- Student và Company chỉ gửi một `internship_evaluations` cho placement thuộc mình sau `COMPLETED`; UIT đọc đủ hai phía, còn Company không đọc nội dung phản hồi Student.
- UIT_ADMIN là vai trò duy nhất được tạo, đổi tên, ngừng hoặc kích hoạt lại category/skill; khóa nghiệp vụ không đổi và bản ghi không bị xóa cứng.
- UIT_ADMIN là vai trò duy nhất được tổng hợp và xuất báo cáo toàn trường; export chỉ đọc các quan hệ hiện có và ghi một `AUDIT_LOGS` với `target_type = REPORT`.
- `application_documents` là snapshot độc lập; thay đổi tài liệu gốc không làm đổi hồ sơ đã gửi.
- `application_status_history`, `job_post_status_history`, `internship_evaluations` và `audit_logs` không có API cập nhật/xóa.
- `notifications` chỉ chứa metadata/deep link, không chứa CV hay internal note.

## Quyết định schema

- Trạng thái dùng `text + CHECK constraint` thay vì PostgreSQL enum để bổ sung trạng thái qua migration dễ hơn. Mọi giá trị vẫn được khóa ở database và đồng bộ với tài liệu domain.
- UUID dùng `gen_random_uuid()`.
- Các bảng mutable có `updated_at`; history/audit chỉ có `created_at`.
- Partial unique index xử lý quy tắc “một đơn đang hoạt động” và “một nơi nhận việc”.

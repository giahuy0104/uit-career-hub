# Database

PostgreSQL schema được quản lý bằng SQL migration; không sửa trực tiếp schema development/production qua Neon Console.

## Thư mục

```text
database/
├── migrations/
│   ├── 0001_initial_mvp_schema.sql
│   └── 0002_authentication_rbac.sql
└── seeds/
    └── development.sql
```

Migration runner lưu version, checksum và thời gian áp dụng trong `schema_migrations`. File migration đã áp dụng không được chỉnh sửa; hãy tạo version mới.

## Lệnh

```powershell
pnpm db:migrate
pnpm db:seed
pnpm db:setup
```

- `db:migrate` yêu cầu `DATABASE_URL_DIRECT` khi runtime URL là Neon pooler.
- `db:seed` chỉ dành cho development và dùng dữ liệu cố định với `ON CONFLICT DO NOTHING`.
- `DATABASE_URL_TEST` phải là branch/database riêng; không dùng URL production cho test.

## Tài khoản/định danh demo

| Vai trò | Email | Mật khẩu development | Ghi chú |
|---|---|---|---|
| UIT Admin | `admin.career@uit.edu.vn` | `Admin@12345` | Phòng Quan hệ Doanh nghiệp |
| Sinh viên chính | `20521067@student.uit.edu.vn` | `Student@12345` | Có ba đơn ở ba công việc |
| Sinh viên | `21520881@student.uit.edu.vn` | `Student@12345` | Dữ liệu bổ sung |
| Sinh viên | `21520943@student.uit.edu.vn` | `Student@12345` | Dữ liệu bổ sung |
| VNG recruiter | `recruiter@vng.example` | `Company@12345` | Tài khoản chính |
| VNG recruiter | `talent@vng.example` | `Company@12345` | Tài khoản phụ |
| FPT recruiter | `recruiter@fpt.example` | `Company@12345` | Tài khoản chính |

Các mật khẩu trên chỉ phục vụ seed development, được lưu trong database dưới dạng bcrypt hash. Không chạy seed và không dùng các thông tin này ở production.

## Kịch bản ba đơn

Sinh viên `20521067` có:

- VNG Backend: `OFFER_PENDING_STUDENT`.
- FPT Data Engineer: `COMPANY_REVIEWING`.
- VNG Frontend: `UIT_REVIEWING`.

Kịch bản tiếp theo sẽ cho sinh viên accept offer VNG, UIT confirm placement, sau đó hai đơn đang hoạt động còn lại chuyển `WITHDRAWN` với `reason_code = ACCEPTED_OTHER_JOB` trong cùng transaction.

# Database

PostgreSQL schema được quản lý bằng SQL migration; không sửa trực tiếp schema development/production qua Neon Console.

## Thư mục

```text
database/
├── migrations/
│   └── 0001_initial_mvp_schema.sql
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

| Vai trò | Email | Ghi chú |
|---|---|---|
| UIT Admin | `admin.career@uit.edu.vn` | Phòng Quan hệ Doanh nghiệp |
| Sinh viên chính | `20521067@student.uit.edu.vn` | Có ba đơn ở ba công việc |
| Sinh viên | `21520881@student.uit.edu.vn` | Dữ liệu bổ sung |
| Sinh viên | `21520943@student.uit.edu.vn` | Dữ liệu bổ sung |
| VNG recruiter | `recruiter@vng.example` | Tài khoản chính |
| VNG recruiter | `talent@vng.example` | Tài khoản phụ |
| FPT recruiter | `recruiter@fpt.example` | Tài khoản chính |

Seed hiện chưa đặt password vì Authentication + RBAC là lát cắt kế tiếp. Không dùng các email/mật khẩu demo cho môi trường thật.

## Kịch bản ba đơn

Sinh viên `20521067` có:

- VNG Backend: `OFFER_PENDING_STUDENT`.
- FPT Data Engineer: `COMPANY_REVIEWING`.
- VNG Frontend: `UIT_REVIEWING`.

Kịch bản tiếp theo sẽ cho sinh viên accept offer VNG, UIT confirm placement, sau đó hai đơn đang hoạt động còn lại chuyển `WITHDRAWN` với `reason_code = ACCEPTED_OTHER_JOB` trong cùng transaction.

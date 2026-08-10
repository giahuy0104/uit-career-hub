# Database

PostgreSQL schema được quản lý bằng SQL migration; không sửa trực tiếp schema development/production qua Neon Console.

## Thư mục

```text
database/
├── migrations/
│   ├── 0001_initial_mvp_schema.sql
│   ├── ...
│   ├── 0010_email_delivery_outbox.sql
│   └── 0016_internship_placement_lifecycle.sql
└── seeds/
    ├── development.sql
    └── demo-reset.sql
```

Migration runner lưu version, checksum và thời gian áp dụng trong `schema_migrations`. File migration đã áp dụng không được chỉnh sửa; hãy tạo version mới.

Migration `0010` tạo transactional outbox `email_deliveries`. Chỉ các notification thuộc phạm vi
email hiện tại được trigger enqueue; dữ liệu notification cũ không được backfill để tránh gửi email
lịch sử ngoài ý muốn khi bật provider lần đầu.

Migration `0011` bổ sung mã số thuế duy nhất, optimistic version cho doanh nghiệp và nguyên nhân tạm
ngưng tài khoản. Đây là nền tảng cho UIT quản lý đối tác, tạo link kích hoạt một lần và khôi phục đúng
các tài khoản bị tạm ngưng theo doanh nghiệp mà không mở nhầm tài khoản đã bị UIT khóa riêng.

Migration `0015` chỉ bổ sung các index phục vụ báo cáo hồ sơ theo thời gian, khoa/ngành/khóa và
doanh nghiệp/loại cơ hội. Migration không đổi enum, constraint hoặc state machine hiện có.

Migration `0016` tạo aggregate `internship_placements` và history riêng cho vòng đời
`HIRED → STARTED → COMPLETED`. Application vẫn giữ `HIRED` terminal; dữ liệu `HIRED` cũ được backfill
an toàn từ offer và application history, không reset hoặc ghi đè dữ liệu production.

## Lệnh

```powershell
pnpm db:migrate
pnpm db:seed
pnpm db:setup
pnpm db:demo:check
```

- `db:migrate` yêu cầu `DATABASE_URL_DIRECT` khi runtime URL là Neon pooler.
- `db:seed` chỉ dành cho development và dùng dữ liệu cố định với `ON CONFLICT DO NOTHING`.
- `DATABASE_URL_TEST` phải là branch/database riêng; không dùng URL production cho test.

## Khôi phục checkpoint demo

`db:seed` chỉ bổ sung bản ghi còn thiếu và không đưa các trạng thái đã thay đổi về ban đầu. Trước buổi bảo vệ, dùng lệnh reset có chốt an toàn:

```powershell
$env:ALLOW_DEMO_RESET = "true"
pnpm db:demo:reset
$env:ALLOW_DEMO_RESET = "false"
pnpm db:demo:check
```

- Lệnh reset bị chặn trong `NODE_ENV=production` và khi chưa bật `ALLOW_DEMO_RESET`.
- Reset chỉ tác động đến các tài khoản, doanh nghiệp, tin và hồ sơ có định danh demo cố định; không dùng `TRUNCATE` hoặc `DROP`.
- Reset xóa refresh token của tài khoản demo, nên cần đăng nhập lại trên các cửa sổ trình bày.
- `db:demo:check` là lệnh chỉ đọc, kiểm tra tài khoản, tin, ba đơn, offer và thông báo có đúng checkpoint hay không.
- Kịch bản trình bày nằm tại `docs/demo/e2e-defense-script.md`.

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

Kịch bản demo cho sinh viên accept offer VNG, UIT confirm placement, sau đó hai đơn đang hoạt động còn lại chuyển `WITHDRAWN` với `reason_code = ACCEPTED_OTHER_JOB` trong cùng transaction.

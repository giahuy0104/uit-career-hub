# Observability, recovery và production readiness

Tài liệu này là runbook cho lát cắt Giai đoạn 4 sau threat model. Mục tiêu là truy vết lỗi mà không lộ credential/PII, chứng minh backup có thể restore và chặn release khi demo/secrets/hạ tầng chưa an toàn.

## 1. Structured error events

Mọi lỗi không dự kiến và `AppError` có HTTP status từ 500 trở lên được ghi thành một JSON line. Event chỉ có:

- timestamp, environment, service và `traceId`;
- HTTP method, path không có query string;
- response status/error code;
- error name, message và stack đã giới hạn/redaction.

Không thu thập request body, query, Authorization, Cookie, user email, storage key hoặc presigned URL. Logger tự redaction key nhạy cảm, Bearer/JWT, credential trong URL PostgreSQL/HTTPS và chữ ký presigned URL. `x-request-id` do client gửi chỉ được chấp nhận khi khớp allow-list ký tự; giá trị không an toàn được thay bằng UUID.

Cấu hình webhook monitor HTTPS:

```dotenv
ERROR_MONITOR_WEBHOOK_URL=https://monitor.example.edu/events
ERROR_MONITOR_TIMEOUT_MS=1500
```

Webhook phải trả `2xx`. Nếu webhook timeout/lỗi, API vẫn trả response gốc và ghi event `error_monitor_delivery_failed`; không retry ngay trong request. Trên production nên cấu hình alert tối thiểu cho:

- một `traceId` xuất hiện nhiều lần hoặc spike `request_error`;
- `AUTH_*` 401/423/429 tăng bất thường từ cùng IP/account (metric này là bước tiếp theo, không gửi PII vào webhook);
- `error_monitor_delivery_failed` hoặc email outbox retry tăng;
- database/storage 503.

## 2. Backup/restore drill

Script `pnpm db:backup:restore:drill` dùng logical backup custom format của `pg_dump`, restore bằng `pg_restore --clean --if-exists` và so sánh:

- checksum/version của tất cả migration trong repo với source;
- migration source với target sau restore;
- row count của tất cả table public;
- SHA-256 và kích thước archive.

Guard bắt buộc:

- `NODE_ENV` không được là `production`;
- `ALLOW_BACKUP_RESTORE_DRILL=true`;
- source label phải nói rõ test/staging/preview/E2E/demo/nonprod;
- target label và database local phải chứa `restore` hoặc `drill`;
- target phải khác source và không trùng runtime/direct/test/E2E URL;
- archive chứa dữ liệu không được commit hay giữ lại; script xóa archive temp sau verify.

Ví dụ dùng PostgreSQL client native:

```powershell
$env:NODE_ENV = "test"
$env:BACKUP_RESTORE_SOURCE_URL = "<Neon test branch direct URL>"
$env:BACKUP_RESTORE_TARGET_URL = "<dedicated restore database URL>"
$env:BACKUP_RESTORE_SOURCE_LABEL = "neon-test-branch"
$env:BACKUP_RESTORE_TARGET_LABEL = "neon-restore-drill"
$env:ALLOW_BACKUP_RESTORE_DRILL = "true"
pnpm db:backup:restore:drill
$env:ALLOW_BACKUP_RESTORE_DRILL = "false"
```

Khi máy không có `pg_dump` đúng major version, dùng image công cụ cùng major với Neon:

```powershell
$env:POSTGRES_TOOLS_DOCKER_IMAGE = "postgres:17-alpine"
pnpm db:backup:restore:drill
```

Không dùng pooled URL để migration. Không restore vào production. Nếu source schema chậm migration, drill dừng trước khi dump và yêu cầu đưa test branch về đúng contract.

Bằng chứng đã chạy: [`evidence/2026-08-11-neon-test-backup-restore.md`](./evidence/2026-08-11-neon-test-backup-restore.md).

## 3. Production readiness gate

Chạy từ máy quản trị đã nạp environment production:

```powershell
pnpm security:production:check
```

Gate chỉ query `users` để tìm demo account `ACTIVE`; không mutation. Gate yêu cầu:

- production mode, HTTPS origin/public URL, cookie Secure;
- demo/E2E reset tắt và frontend không bật demo accounts;
- JWT/Cron secret mạnh, khác nhau và có `PRODUCTION_SECRETS_ROTATED_AT` trong 90 ngày;
- remote PostgreSQL an toàn, không có test/E2E URL trên production;
- error monitor HTTPS và private R2 đã cấu hình;
- nếu bật email: Resend/sender an toàn, không dùng `onboarding@resend.dev`, public URL HTTPS;
- evidence restore Neon non-production trong 30 ngày;
- không còn demo account `ACTIVE` trong production DB.

Production bundle luôn ẩn demo picker kể cả khi biến Vite bị gán nhầm. Build gate quét JavaScript output và fail nếu còn demo email/password.

## 4. Trình tự rotate trước go-live

1. Tạo credential mới cho Neon, JWT, Cron, R2 và Resend; không tái sử dụng giữa dịch vụ.
2. Cập nhật credential mới trong Vercel Sensitive Environment Variables và redeploy preview.
3. Smoke login/refresh, private upload/download, cron và email trên preview/test branch.
4. Thu hồi credential cũ tại nhà cung cấp; ghi timestamp vào `PRODUCTION_SECRETS_ROTATED_AT`.
5. Suspend hoặc xóa demo users trong production theo quy trình có audit; không chạy `db:demo:reset`.
6. Chạy production readiness gate, full E2E trên E2E DB và review monitoring dashboard trước release candidate.

Secret rotation và thay đổi demo users trên production là external operation có ảnh hưởng thật; không được tự động hóa từ PR/CI này.

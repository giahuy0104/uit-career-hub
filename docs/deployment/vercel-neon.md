# Triển khai Vercel và Neon

## Môi trường production hiện tại

| Thành phần | Project | URL production |
|---|---|---|
| Frontend Vite | `uit-career-hub-web-041204` | `https://uit-career-hub-web-041204.vercel.app` |
| Backend Express | `uit-career-hub-api-041204` | `https://uit-career-hub-api-041204.vercel.app` |
| Database | Neon PostgreSQL | Kết nối bằng pooled `DATABASE_URL` |

Backend function chạy tại region `sin1`. Frontend gọi API qua đường dẫn cùng origin `/api/v1`; Vercel rewrite request sang backend. Nhờ vậy refresh cookie vẫn là first-party cookie trên domain frontend.

```text
Browser
  -> uit-career-hub-web-041204.vercel.app
     -> static Vite assets
     -> /api/* rewrite
        -> uit-career-hub-api-041204.vercel.app
           -> Express function
              -> Neon pooled connection
```

## Biến môi trường Vercel

### Backend production

- `NODE_ENV=production`
- `CORS_ORIGIN=https://uit-career-hub-web-041204.vercel.app`
- `DATABASE_URL`: Neon pooled connection string, lưu dạng Sensitive.
- `DATABASE_POOL_MAX=2`: giới hạn kết nối cho mỗi serverless instance.
- `JWT_ACCESS_SECRET`: secret ngẫu nhiên tối thiểu 32 ký tự, lưu dạng Sensitive.
- `JWT_ISSUER`, `JWT_AUDIENCE`.
- `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`.
- `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=lax`.
- `UIT_EMAIL_DOMAINS`.
- `ALLOW_DEMO_RESET=false`.
- `CRON_SECRET`: secret ngẫu nhiên tối thiểu 32 ký tự, lưu dạng Sensitive. Vercel tự gửi
  `Authorization: Bearer <CRON_SECRET>` khi gọi cron.
- `EMAIL_ENABLED=true` sau khi đã cấu hình Resend và sender hợp lệ.
- `RESEND_API_KEY`: API key bắt đầu bằng `re_`, lưu dạng Sensitive.
- `EMAIL_FROM`: sender hiển thị, ví dụ `UIT Career Hub <notifications@careers.example.edu.vn>`.
- `PUBLIC_APP_URL=https://uit-career-hub-web-041204.vercel.app`: base URL để tạo link trong email.
- `EMAIL_BATCH_SIZE=10`, `EMAIL_MAX_ATTEMPTS=5`.
- `ERROR_MONITOR_WEBHOOK_URL`: webhook HTTPS nhận event 5xx đã redaction.
- `ERROR_MONITOR_TIMEOUT_MS=1500`.
- `PRODUCTION_SECRETS_ROTATED_AT`: ISO timestamp của lần rotate Neon/JWT/Cron/R2/Resend gần nhất.

Không đưa `DATABASE_URL_DIRECT`, `DATABASE_URL_TEST` hoặc secret vào frontend.

## Cron tổng hợp hồ sơ chờ xử lý

Backend khai báo một Vercel Cron trong `backend/vercel.json`:

- Endpoint: `GET /api/v1/cron/daily-pending-notifications`.
- Lịch: `15 1 * * *`, tương ứng 08:15 hằng ngày theo giờ Việt Nam (UTC+7).
- Gói Hobby chỉ chạy tối đa một lần mỗi ngày; lịch này đáp ứng giới hạn đó.
- Cron chỉ chạy trên Production Deployment, không chạy trên Preview Deployment.

Mỗi lần chạy, hệ thống:

1. Đếm hồ sơ `UIT_REVIEWING` và gửi tổng hợp cho UIT Admin đang hoạt động.
2. Đếm theo từng doanh nghiệp các hồ sơ `FORWARDED_TO_COMPANY`, `COMPANY_REVIEWING`
   và `INTERVIEW_INVITED`, sau đó gửi cho recruiter đang hoạt động của đúng doanh nghiệp.
3. Không gửi khi hàng đợi tương ứng bằng 0.
4. Dùng `dedupe_key` gồm ngày và người nhận nên retry cùng ngày không tạo bản trùng.
5. Gửi email tổng hợp và retry các email sự kiện trước đó đang đến hạn.

## Email transactional qua Resend

Email Phase 2 áp dụng cho bốn loại notification:

- `APPLICATION_SUBMITTED`: sinh viên nộp đơn, báo UIT Admin.
- `APPLICATION_RECEIVED`: UIT chuyển hồ sơ, báo recruiter của đúng doanh nghiệp.
- `DAILY_UIT_PENDING_APPLICATIONS`: tổng hợp hằng ngày cho UIT.
- `DAILY_COMPANY_PENDING_APPLICATIONS`: tổng hợp hằng ngày cho doanh nghiệp.

Migration `0010_email_delivery_outbox.sql` tạo outbox và trigger enqueue trong cùng transaction
với in-app notification. API gọi Resend sau khi transaction nghiệp vụ đã commit. Nếu provider lỗi,
đơn ứng tuyển vẫn thành công; delivery chuyển `FAILED`, lưu lỗi và được retry với backoff. Mỗi delivery
dùng idempotency key theo UUID để chống gửi lặp khi request được retry.

`EMAIL_BATCH_SIZE` là kích thước mỗi lượt claim trong database; một lần chạy sẽ tiếp tục lấy các batch
đến khi hết email đang đến hạn. Khi `EMAIL_ENABLED=false`, trigger vẫn ghi outbox nhưng backend không
gọi provider. Nếu để tắt lâu trên production, cần kiểm tra các bản ghi `PENDING` trước khi bật lại để
tránh gửi hàng loạt email cũ ngoài ý muốn.

Thiết lập production:

1. Cài Resend trong Vercel Marketplace hoặc tạo API key trong Resend Dashboard.
2. Xác minh domain gửi bằng SPF và DKIM. Nên dùng subdomain riêng cho email hệ thống.
3. Thêm các biến `EMAIL_*`, `RESEND_API_KEY` và `PUBLIC_APP_URL` vào Backend project.
4. Chạy migration `0010` trên Neon production trước khi bật `EMAIL_ENABLED=true`.
5. Redeploy backend, tạo một đơn test và kiểm tra trạng thái trong Resend Dashboard.

`onboarding@resend.dev` chỉ phù hợp thử nghiệm và bị giới hạn gửi tới email của chính tài khoản
Resend. Muốn gửi cho sinh viên và doanh nghiệp thật phải dùng domain đã xác minh.

Tài liệu chính thức: [Resend với Express](https://resend.com/docs/send-with-express/),
[idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) và
[xác minh domain](https://resend.com/docs/dashboard/domains/introduction).

### Frontend production

- `VITE_API_BASE_URL=/api/v1`
- `VITE_SHOW_DEMO_ACCOUNTS=false`. Production bundle hard-disable demo picker và build sẽ fail nếu còn demo credential/identity trong JavaScript.

Biến có tiền tố `VITE_` được đóng gói vào JavaScript và có thể được người dùng xem; chỉ đặt cấu hình công khai ở đây.

## Neon production

Runtime backend dùng pooled URL để tránh vượt giới hạn kết nối. Migration và seed không chạy trong Vercel Function. Khi cần cập nhật schema:

1. Cấu hình `DATABASE_URL` và `DATABASE_URL_DIRECT` đúng branch Neon trên máy quản trị.
2. Chạy `pnpm db:migrate`.
3. Kiểm tra `pnpm db:demo:check` nếu đây là môi trường demo.
4. Deploy backend rồi kiểm tra `/api/health/database`.

`NODE_ENV=production` chặn development seed và demo reset. Không bật `ALLOW_DEMO_RESET` trên Vercel.

## Lệnh deploy thủ công

```powershell
pnpm dlx vercel@58.7.1 deploy . --prod --yes --project uit-career-hub-api-041204
pnpm dlx vercel@58.7.1 deploy . --prod --yes --project uit-career-hub-web-041204
```

Chạy các lệnh này tại thư mục gốc repository. Deploy backend trước frontend nếu thay đổi URL hoặc hợp đồng API. Hai thư mục `.vercel` chỉ lưu liên kết project trên máy và không được commit.

## Bật tự động deploy từ GitHub

Hai project đã kết nối repository `kgiahuy0412/uit-career-hub`:

- Backend Root Directory: `backend`.
- Frontend Root Directory: `frontend`.
- Push nhánh hoặc pull request tạo Preview Deployment.
- Merge/push `main` tạo Production Deployment.

Nếu cần kết nối lại từ đầu:

1. Đưa Root Directory của hai project về `Auto`.
2. Chạy:

```powershell
pnpm dlx vercel@58.7.1 git connect https://github.com/kgiahuy0412/uit-career-hub.git --cwd backend
pnpm dlx vercel@58.7.1 git connect https://github.com/kgiahuy0412/uit-career-hub.git --cwd frontend
```

3. Sau khi kết nối thành công, cấu hình lại Root Directory:
   - Backend project: `backend`.
   - Frontend project: `frontend`.

Không đặt Root Directory trước khi chạy hai lệnh `git connect --cwd`, vì CLI sẽ ghép đường dẫn thành `backend/backend` hoặc `frontend/frontend`.

## Gate trước release candidate

Nạp environment production trên máy quản trị, trỏ `BACKUP_RESTORE_EVIDENCE_PATH` tới report Neon test drill gần nhất và chạy:

```powershell
pnpm security:production:check
```

Gate là read-only đối với production database. Chi tiết logging, restore drill, demo account và rotation tại [`../security/observability-and-recovery.md`](../security/observability-and-recovery.md).

## Kiểm tra sau deploy

```powershell
Invoke-RestMethod https://uit-career-hub-api-041204.vercel.app/api/health
Invoke-RestMethod https://uit-career-hub-api-041204.vercel.app/api/health/database
Invoke-RestMethod https://uit-career-hub-web-041204.vercel.app/api/health/database
```

Sau đó kiểm tra bằng trình duyệt:

1. Mở frontend production.
2. Đăng nhập tài khoản demo.
3. Làm mới trang để xác nhận refresh cookie khôi phục phiên.
4. Mở danh sách việc làm và ba đơn ứng tuyển.
5. Đăng xuất.

Quét lỗi runtime:

```powershell
pnpm dlx vercel@58.7.1 logs https://uit-career-hub-api-041204.vercel.app --level error --since 1h --cwd backend
```

## Rollback

Nếu deployment mới lỗi, mở Vercel Dashboard để chọn deployment ổn định gần nhất hoặc dùng:

```powershell
pnpm dlx vercel@58.7.1 rollback --cwd backend
pnpm dlx vercel@58.7.1 rollback --cwd frontend
```

Rollback ứng dụng không rollback database. Migration production phải tương thích ngược hoặc có kế hoạch khôi phục riêng.

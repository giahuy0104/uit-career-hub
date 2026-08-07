# UIT Career Hub

Hệ thống kết nối việc làm và quản lý thực tập cho một trường UIT, gồm ba vai trò: Sinh viên, Bộ phận phụ trách UIT và Doanh nghiệp đối tác.

Tài liệu nghiệp vụ hiện tại: `docs/specification/UIT-Career-Hub-dac-ta-V2.docx`.

## Cấu trúc project

```text
uit-career-hub/
├── frontend/        React + Vite, kế thừa prototype đã duyệt
├── backend/         Express + TypeScript
├── database/        SQL migration và seed
├── docs/domain/     ERD và state machine
├── docs/api/        OpenAPI 3.1
└── docker-compose.yml (PostgreSQL local tùy chọn)
```

## Yêu cầu môi trường

- Node.js 20 trở lên.
- pnpm 10 trở lên.
- Git.
- Một project Neon PostgreSQL. Docker Desktop không bắt buộc.

## Cấu hình Neon

1. Tạo project/branch development trên Neon.
2. Trong cửa sổ **Connect**, sao chép pooled connection string vào `DATABASE_URL`.
3. Sao chép direct connection string vào `DATABASE_URL_DIRECT`.
4. Tạo branch/database test riêng và đặt direct URL vào `DATABASE_URL_TEST` nếu muốn chạy integration test database.
5. Connection string Neon phải có `sslmode=require` hoặc `sslmode=verify-full`.

Tạo file môi trường trên Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
```

Điền URL thật vào `.env`. Không đặt URL database trong `frontend/.env.local` và không commit `.env`.

Trong production, phải đặt `JWT_ACCESS_SECRET` bằng chuỗi ngẫu nhiên tối thiểu 32 ký tự. `UIT_EMAIL_DOMAINS` quy định miền email được chấp nhận cho tài khoản sinh viên. Local development dùng cookie `SameSite=Lax`; nếu frontend/backend production khác site, dùng HTTPS và cấu hình `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=none`.

## Cài đặt và dựng database

```powershell
pnpm install
pnpm db:migrate
pnpm db:seed
```

Hoặc chạy migration và seed liên tiếp:

```powershell
pnpm db:setup
```

Migration dùng `DATABASE_URL_DIRECT`; backend runtime dùng pooled `DATABASE_URL`. Seed development bị chặn khi `NODE_ENV=production`.

## Chạy ứng dụng

Mở hai cửa sổ terminal:

```powershell
pnpm dev:backend
```

```powershell
pnpm dev:frontend
```

Địa chỉ mặc định:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000/api
- Auth API: http://localhost:3000/api/v1/auth
- Health check: http://localhost:3000/api/health
- Database health: http://localhost:3000/api/health/database

## Kiểm tra

```powershell
pnpm typecheck
pnpm build
pnpm test
pnpm openapi:validate
```

Nếu `DATABASE_URL_TEST` để trống, các integration test cần database sẽ được skip có chủ đích; unit test và health route test vẫn chạy.

## PostgreSQL local bằng Docker (tùy chọn)

Docker chỉ dùng khi thành viên muốn chạy PostgreSQL local:

```powershell
pnpm db:up
```

Khi dùng local, sửa URL trong `.env`:

```env
DATABASE_URL=postgresql://uit_user:uit_local_password@localhost:5432/uit_career_hub
DATABASE_URL_DIRECT=postgresql://uit_user:uit_local_password@localhost:5432/uit_career_hub
DATABASE_URL_TEST=
```

Các lệnh Docker còn lại:

```powershell
pnpm db:logs
pnpm db:down
```

## Tài liệu kỹ thuật

- `docs/domain/erd.md`
- `docs/domain/job-state-machine.md`
- `docs/domain/application-state-machine.md`
- `docs/api/openapi.yaml`
- `docs/decisions/001-modular-monolith-neon.md`
- `docs/decisions/002-jwt-refresh-rbac.md`
- `database/README.md`

## Quy ước nhánh

- `main`: phiên bản ổn định, dùng để demo hoặc triển khai.
- `develop`: nhánh tích hợp chung của nhóm.
- `feature/<ten-chuc-nang>`: phát triển chức năng mới từ `develop`.
- `fix/<ten-loi>`: sửa lỗi.
- `docs/<noi-dung>`: cập nhật tài liệu.

Không đẩy trực tiếp vào `main`. Mỗi chức năng mở pull request quay lại `develop`.

## Phạm vi hiện tại

Lát cắt nền tảng, Authentication/RBAC và quy trình tin tuyển dụng đã hoàn thành: doanh nghiệp tạo/lưu nháp/gửi tin, UIT phê duyệt/yêu cầu chỉnh sửa/từ chối, gửi lại sau chỉnh sửa, ghi history/audit và tạo thông báo trong hệ thống. API dùng optimistic locking và `Idempotency-Key` cho các lệnh chuyển trạng thái.

Thông báo trong hệ thống thuộc MVP. Email/FCM, Cron Job, Scheduler, retry/log nâng cao, Kafka, Redis, chat, AI và đa trường thuộc Phase 2.

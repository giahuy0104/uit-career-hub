# UIT Career Hub - Hướng dẫn nhận bàn giao và chạy dự án

Tài liệu này dành cho thành viên mới nhận repository để đọc mã nguồn, chạy hệ thống local, kiểm tra database và lấy thông tin viết báo cáo. Bản mô tả ERD/data dictionary đầy đủ nằm trong `UIT_Career_Hub_ERD_Database_Report.docx`; ảnh ERD dạng bảng và đường nối nằm trong `UIT_Career_Hub_ERD.png` cùng thư mục.

## 1. Tổng quan nhanh

UIT Career Hub là hệ thống kết nối việc làm và quản lý thực tập cho ba vai trò:

- `STUDENT`: quản lý hồ sơ, CV/tài liệu, tìm việc, ứng tuyển, phản hồi phỏng vấn/offer và đánh giá kỳ thực tập.
- `UIT_ADMIN`: quản lý doanh nghiệp/recruiter/taxonomy, duyệt tin và hồ sơ, xác nhận placement, theo dõi thực tập và xuất báo cáo.
- `COMPANY`: quản lý hồ sơ doanh nghiệp, tin tuyển dụng, ứng viên, phỏng vấn, kết quả và offer.

Kiến trúc hiện tại:

```text
React 19 + Vite 6
        |
        | REST /api/v1
        v
Express 5 + TypeScript (modular monolith)
        |
        +-- PostgreSQL / Neon
        +-- Cloudflare R2 private (PDF)
        +-- Resend (email, tùy cấu hình)
```

## 2. Yêu cầu môi trường

- Git.
- Node.js `>=20`; khuyến nghị Node.js 24 giống CI.
- pnpm `11.16.0`.
- Một trong hai lựa chọn database:
  - Docker Desktop và PostgreSQL local; hoặc
  - project/branch development riêng trên Neon.
- Chromium nếu cần chạy Playwright.

Kiểm tra phiên bản:

```powershell
node --version
pnpm --version
git --version
```

Nếu chưa có pnpm đúng phiên bản:

```powershell
corepack enable
corepack prepare pnpm@11.16.0 --activate
```

## 3. Cài đặt source code

Tại thư mục gốc repository:

```powershell
pnpm install
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
```

Không commit `.env`, `frontend/.env.local`, database URL hoặc secret.

## 4. Cách A - Chạy nhanh với PostgreSQL local bằng Docker

Đặt các giá trị sau trong `.env`:

```env
NODE_ENV=development
BACKEND_PORT=3000
CORS_ORIGIN=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173

DATABASE_URL=postgresql://uit_user:uit_local_password@localhost:5432/uit_career_hub
DATABASE_URL_DIRECT=postgresql://uit_user:uit_local_password@localhost:5432/uit_career_hub
DATABASE_URL_TEST=
DATABASE_URL_E2E=

JWT_ACCESS_SECRET=replace_with_a_random_secret_at_least_32_characters
CRON_SECRET=replace_with_a_different_random_secret_at_least_32_characters
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax

OBJECT_STORAGE_ENABLED=false
EMAIL_ENABLED=false
ALLOW_DEMO_RESET=false
ALLOW_E2E_RESET=false
```

Frontend development dùng:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SHOW_DEMO_ACCOUNTS=true
```

Khởi động database, chạy migration `0001` đến `0017` và nạp dữ liệu development:

```powershell
pnpm db:up
pnpm db:setup
```

Kiểm tra PostgreSQL nếu cần:

```powershell
pnpm db:logs
```

## 5. Cách B - Chạy với Neon

Tạo project/branch **development riêng** trên Neon. Tại cửa sổ Connect:

1. Sao chép pooled connection string vào `DATABASE_URL`.
2. Sao chép direct connection string vào `DATABASE_URL_DIRECT`.
3. Bảo đảm URL có `sslmode=require` hoặc `sslmode=verify-full`.
4. Không dùng production branch cho seed, test, demo reset hoặc E2E.

Ví dụ cấu trúc `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@POOLER_HOST/neondb?sslmode=verify-full
DATABASE_URL_DIRECT=postgresql://USER:PASSWORD@DIRECT_HOST/neondb?sslmode=verify-full
```

Sau đó chạy:

```powershell
pnpm db:setup
```

Migration dùng `DATABASE_URL_DIRECT`; backend runtime dùng `DATABASE_URL`.

## 6. Chạy frontend và backend

Mở hai terminal tại thư mục gốc.

Terminal 1:

```powershell
pnpm dev:backend
```

Terminal 2:

```powershell
pnpm dev:frontend
```

Các địa chỉ mặc định:

| Thành phần | URL |
|---|---|
| Frontend | <http://localhost:5173> |
| API info | <http://localhost:3000/api> |
| API v1 | <http://localhost:3000/api/v1> |
| Health | <http://localhost:3000/api/health> |
| Database health | <http://localhost:3000/api/health/database> |

Kiểm tra nhanh bằng PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/health/database
```

## 7. Tài khoản development/demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| UIT Admin | `admin.career@uit.edu.vn` | `Admin@12345` |
| Student chính | `20521067@student.uit.edu.vn` | `Student@12345` |
| Student bổ sung | `21520881@student.uit.edu.vn` | `Student@12345` |
| VNG recruiter | `recruiter@vng.example` | `Company@12345` |
| FPT recruiter | `recruiter@fpt.example` | `Company@12345` |

Các tài khoản này chỉ dành cho development/demo. Production bundle luôn ẩn demo picker và không được sử dụng các mật khẩu trên.

## 8. Cấu hình R2 và email

Giữ hai tích hợp ở trạng thái tắt nếu chỉ cần chạy UI/API/database cơ bản:

```env
OBJECT_STORAGE_ENABLED=false
EMAIL_ENABLED=false
```

Muốn kiểm tra upload/download CV hoặc offer PDF, cần bucket Cloudflare R2 private và điền đủ:

```env
OBJECT_STORAGE_ENABLED=true
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=uit-career-hub-documents
```

Muốn gửi email thật qua Resend:

```env
EMAIL_ENABLED=true
RESEND_API_KEY=
EMAIL_FROM="UIT Career Hub <notifications@your-verified-domain.example>"
```

Không đưa R2/Resend secret vào frontend hoặc tài liệu báo cáo.

## 9. Lệnh kiểm tra bắt buộc

Chạy tại thư mục gốc:

```powershell
pnpm typecheck
pnpm openapi:validate
pnpm test
pnpm build
```

Kết quả baseline tại thời điểm bàn giao:

- Backend: `253/253` test.
- Frontend: `9/9` test.
- OpenAPI 3.1.0: `86 paths`, `97 operations`.
- Playwright smoke: `3/3`.
- Playwright full: `11/11`.

Nếu `DATABASE_URL_TEST` để trống, các integration test cần database sẽ được skip có chủ đích. Muốn chạy đầy đủ integration test, tạo branch/database test riêng và đặt direct URL vào `DATABASE_URL_TEST`.

## 10. Chạy Playwright E2E an toàn

E2E bắt buộc dùng database chuyên dụng có tên chứa `e2e`; không fallback sang database runtime.

Ví dụ local:

```powershell
$env:NODE_ENV = "test"
$env:DATABASE_URL_E2E = "postgresql://uit_user:uit_local_password@127.0.0.1:5432/uit_career_hub_e2e"
$env:ALLOW_E2E_RESET = "true"

pnpm db:e2e:setup
pnpm exec playwright install chromium
pnpm e2e:smoke
pnpm e2e:full

$env:ALLOW_E2E_RESET = "false"
```

Khi test lỗi:

```powershell
pnpm e2e:report
```

Screenshot, video và trace nằm trong `test-results/` và `playwright-report/`.

## 11. Reset checkpoint demo

`db:seed` chỉ thêm dữ liệu còn thiếu; nó không phục hồi trạng thái đã thay đổi. Với **database development/demo riêng**, có thể chạy:

```powershell
$env:ALLOW_DEMO_RESET = "true"
pnpm db:demo:reset
$env:ALLOW_DEMO_RESET = "false"
pnpm db:demo:check
```

> Tuyệt đối không bật `ALLOW_DEMO_RESET` và không chạy `db:demo:reset` trên production. Không sửa trạng thái trực tiếp bằng SQL vì sẽ bỏ qua history, audit và notification.

## 12. Các lỗi thường gặp

### Backend báo thiếu hoặc sai database URL

- Kiểm tra `.env` tồn tại ở thư mục gốc.
- Neon runtime dùng pooled URL; migration dùng direct URL.
- Neon URL phải có SSL mode hợp lệ.
- PostgreSQL local phải được khởi động bằng `pnpm db:up`.

### Frontend gọi sai API

Kiểm tra `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Sau khi sửa env, dừng và chạy lại Vite.

### Đăng nhập thất bại sau reset

Demo reset thu hồi refresh token. Đăng xuất/xóa cookie rồi đăng nhập lại.

### Upload PDF không hoạt động

- `OBJECT_STORAGE_ENABLED` phải là `true`.
- Kiểm tra R2 credentials, bucket và CORS.
- Chỉ chấp nhận PDF tối đa 10 MB.

### Port bị chiếm

Đổi `BACKEND_PORT` và cập nhật `VITE_API_BASE_URL`/`CORS_ORIGIN` tương ứng. Vite mặc định dùng cổng `5173`.

## 13. Nguồn tài liệu cần đọc

- `UIT_Career_Hub_ERD_Database_Report.docx`: ERD, data dictionary và dữ liệu phục vụ báo cáo.
- `UIT_Career_Hub_ERD.png`: ERD vật lý dạng hộp bảng, hiển thị PK/FK/UQ, kiểu dữ liệu và 44 quan hệ khóa ngoại.
- `database/migrations/*.sql`: nguồn sự thật của schema.
- `docs/domain/erd.md`: ERD mức domain.
- `docs/domain/job-state-machine.md`: vòng đời tin tuyển dụng.
- `docs/domain/application-state-machine.md`: pipeline ứng tuyển.
- `docs/domain/internship-placement-lifecycle.md`: placement và evaluation.
- `docs/security/rbac-matrix.md`: phân quyền và ownership.
- `docs/api/openapi.yaml`: contract API.
- `docs/testing/playwright-e2e.md`: kiểm thử E2E.
- `docs/demo/e2e-defense-script.md`: kịch bản demo bảo vệ.
- `docs/handoff/CODEX_NEXT_PHASE.md`: trạng thái và roadmap mới nhất.

## 14. Quy trình Git khi tiếp tục phát triển

1. Đồng bộ `develop` và tạo nhánh mới.
2. Không thay đổi state machine/OpenAPI ngầm trong một PR giao diện.
3. Chạy typecheck, OpenAPI, test, build và E2E phù hợp.
4. Mở pull request vào `develop`.
5. Chỉ merge khi CI xanh.
6. Không đưa trực tiếp vào `main`; `main` chỉ nhận release candidate.

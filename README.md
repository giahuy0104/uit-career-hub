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
├── docs/demo/       Checkpoint dữ liệu và kịch bản bảo vệ E2E
├── docs/deployment/ Cấu hình Vercel và Neon production
├── docs/security/   Ma trận phân quyền và ghi chú hardening
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

Production hiện tại:

- Frontend: https://uit-career-hub-web-041204.vercel.app
- Backend: https://uit-career-hub-api-041204.vercel.app
- Hướng dẫn triển khai: `docs/deployment/vercel-neon.md`

## Kiểm tra

```powershell
pnpm typecheck
pnpm build
pnpm test
pnpm openapi:validate
```

Nếu `DATABASE_URL_TEST` để trống, các integration test cần database sẽ được skip có chủ đích; unit test và health route test vẫn chạy.

### GitHub Actions CI

Workflow `.github/workflows/ci.yml` tự chạy khi có push hoặc pull request vào `develop` và `main`. Mỗi lượt CI sẽ:

1. Cài đúng pnpm 11.16.0 và Node.js 24 theo cấu hình của dự án.
2. Khởi tạo PostgreSQL 16 tạm thời trên GitHub runner, không dùng thông tin kết nối Neon.
3. Chạy typecheck, kiểm tra OpenAPI, toàn bộ unit/integration test và build frontend/backend.

Có thể chạy thủ công trong tab **Actions → CI → Run workflow**. Chỉ merge pull request khi job `Typecheck, test and build` đã thành công.

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
- `docs/security/rbac-matrix.md`
- `docs/demo/e2e-defense-script.md`
- `docs/deployment/vercel-neon.md`
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

Lát cắt nền tảng, Authentication/RBAC, quy trình tin tuyển dụng, sinh viên ứng tuyển và UIT kiểm duyệt hồ sơ đã hoàn thành. Doanh nghiệp có thể tạo/lưu nháp/gửi tin; UIT phê duyệt/yêu cầu chỉnh sửa/từ chối; sinh viên chỉ thấy tin đã duyệt còn hạn, chọn CV/tài liệu đã xác minh và gửi đơn qua hai bước. Đơn mới chuyển sang `UIT_REVIEWING`; UIT có hàng đợi thật để yêu cầu bổ sung, từ chối hoặc chuyển hồ sơ đến đúng doanh nghiệp. Mỗi quyết định đều cập nhật state machine, lưu bản chụp tài liệu/history/audit, chống xử lý trùng và gửi thông báo đúng người nhận.

Doanh nghiệp hiện đã có hàng đợi hồ sơ thật, chỉ thấy hồ sơ được UIT chuyển đúng đến doanh nghiệp của mình. Recruiter có thể bắt đầu sàng lọc, chọn “Không phù hợp”, tạo lịch phỏng vấn, ghi nhận kết quả `PASS/FAIL` và gửi offer khi ứng viên đạt. Khi UIT yêu cầu bổ sung, sinh viên xem đúng loại tài liệu và hạn nộp, chọn phiên bản đã xác minh rồi nộp lại; snapshot cũ vẫn được giữ để đối chiếu. Sinh viên cũng có thể rút đơn trước phỏng vấn, hủy tham gia phỏng vấn hoặc từ chối offer bằng hành động riêng của từng bước. UIT có hàng đợi xác nhận nơi thực tập; khi xác nhận, đơn được chọn chuyển `HIRED`, mọi đơn khác còn hoạt động tự chuyển `WITHDRAWN` và lịch phỏng vấn liên quan bị hủy trong cùng transaction. Mọi thao tác đều cập nhật state machine, history, audit log, chống gửi lặp và thông báo đúng sinh viên/doanh nghiệp/UIT.

Màn “Hồ sơ & CV” của sinh viên dùng dữ liệu thật từ API: hiển thị thông tin UIT, tính độ hoàn thiện, cập nhật số điện thoại, upload/tải xuống PDF qua Cloudflare R2 private bằng URL ký trước, xóa tài liệu chưa được dùng và chọn CV đã xác minh làm mặc định. Backend kiểm tra MIME cùng dung lượng thực tế trên R2 trước khi tạo tài liệu ở trạng thái chờ UIT xác minh; CV mặc định và tài liệu đã dùng trong đơn ứng tuyển được bảo vệ khỏi thao tác xóa. Xem hướng dẫn tại `docs/deployment/cloudflare-r2.md`.

UIT Admin có hàng đợi xác minh tài liệu thật: lọc theo trạng thái, tìm theo sinh viên/MSSV/tên tệp, mở PDF bằng URL ký ngắn hạn và quyết định xác minh hoặc từ chối kèm lý do. Chỉ tài liệu `PENDING` được xử lý; quyết định không thể đảo ngược, được ghi audit log và tạo thông báo cho đúng sinh viên.

Danh bạ doanh nghiệp dành cho sinh viên cũng dùng dữ liệu thật: chỉ công khai đối tác đang hoạt động, hỗ trợ tìm kiếm/lọc, xem hồ sơ công khai và mở danh sách tin còn hạn của đúng doanh nghiệp. API không trả tên pháp lý, mã số thuế, phiên bản quản trị hoặc tài khoản recruiter ra màn sinh viên.

Happy flow và các nhánh ngoại lệ chính của hồ sơ đã chạy xuyên suốt. Hộp thông báo trong hệ thống cũng đã dùng dữ liệu thật cho cả ba vai trò: xem tất cả/chưa đọc, phân trang, đếm badge, đánh dấu một hoặc tất cả là đã đọc và mở đúng màn hình/bản ghi cần xử lý. API luôn giới hạn thông báo theo người dùng đang đăng nhập; không thể đọc hoặc cập nhật thông báo của tài khoản khác.

Ma trận RBAC backend đã được kiểm tra tự động cho toàn bộ endpoint giới hạn vai trò. Middleware từ chối tài khoản thiếu context sinh viên/doanh nghiệp, ownership tiếp tục được bảo vệ ở service/repository và response API không được cache. Tài khoản/dữ liệu demo đã được chuẩn hóa thành checkpoint có lệnh reset an toàn, kiểm tra readiness chỉ đọc và kịch bản E2E bảo vệ 8–10 phút. Frontend, backend và Neon đã được triển khai public; Phase 2 hiện có cron tổng hợp hồ sơ chờ xử lý hằng ngày và email transactional qua Resend.

Thông báo trong hệ thống thuộc MVP. Email Phase 2 hiện gửi cho bốn sự kiện quan trọng: sinh viên nộp đơn, UIT chuyển hồ sơ đến doanh nghiệp và hai bản tổng hợp hàng đợi hằng ngày. Transactional outbox, idempotency key và retry có backoff bảo đảm lỗi provider không rollback nghiệp vụ. FCM, webhook theo dõi delivered/bounced, Kafka, Redis, chat, AI và đa trường vẫn thuộc các lát cắt sau.

UIT Admin hiện có màn hình và API thật để tìm kiếm, tạo, chỉnh sửa, tạm ngưng/kích hoạt lại doanh nghiệp đối tác; thêm, khóa hoặc mở lại từng tài khoản tuyển dụng. Tài khoản mới nhận link kích hoạt một lần (72 giờ), token thô chỉ trả trong response và database chỉ lưu SHA-256 hash. Khi chưa bật email, UIT sao chép link và gửi thủ công; luồng này không phụ thuộc Resend. Doanh nghiệp có thể xem/cập nhật hồ sơ công khai của mình nhưng không được sửa mã đối tác, tên pháp lý, mã số thuế hay trạng thái hợp tác.

Dashboard của cả ba vai trò đã dùng số liệu PostgreSQL thật. UIT theo dõi hàng đợi, SLA, phễu và doanh nghiệp hoạt động; doanh nghiệp theo dõi tin, ứng viên, phỏng vấn và hiệu quả từng tin; sinh viên thấy độ hoàn thiện hồ sơ, đơn đang xử lý, offer, lịch phỏng vấn và các việc cần làm. Mỗi API dashboard có RBAC và phạm vi dữ liệu riêng theo người đăng nhập.

### Lịch phỏng vấn dùng dữ liệu thật

Hai màn lịch của sinh viên và doanh nghiệp đọc trực tiếp từ PostgreSQL. Sinh viên có thể xác nhận lời mời hoặc hủy tham gia kèm lý do; xác nhận được khóa theo bản ghi và gọi lặp không tạo thông báo trùng. Doanh nghiệp chỉ thấy lịch thuộc các tin của chính mình, theo dõi trạng thái xác nhận và mở đúng hồ sơ ứng viên để cập nhật kết quả. Tạo lịch vẫn bắt đầu từ hồ sơ đang ở bước `COMPANY_REVIEWING`, không cho tạo lịch rời khỏi pipeline.

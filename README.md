# UIT Career Hub

Hệ thống kết nối việc làm và quản lý thực tập cho một trường UIT, gồm ba vai trò: Sinh viên, Bộ phận phụ trách UIT và Doanh nghiệp đối tác.

Tài liệu đặc tả nghiệp vụ hiện tại nằm tại `docs/specification/UIT-Career-Hub-dac-ta-V2.docx`.

## Cấu trúc project

```text
uit-career-hub/
├── frontend/        React + Vite, kế thừa prototype đã duyệt
├── backend/         Express + TypeScript
├── database/        Migration và seed sẽ bổ sung ở bước thiết kế dữ liệu
├── docs/            Đặc tả và hình UI tham khảo
└── docker-compose.yml
```

## Yêu cầu môi trường

- Node.js 20 trở lên.
- pnpm 10 trở lên.
- Docker Desktop để chạy PostgreSQL.
- Git.

## Chạy lần đầu trên Windows PowerShell

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
pnpm install
pnpm db:up
```

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
- Health check: http://localhost:3000/api/health
- PostgreSQL: localhost:5432

## Các lệnh thường dùng

```powershell
pnpm build
pnpm typecheck
pnpm test
pnpm db:logs
pnpm db:down
```

## Quy ước nhánh

- `main`: phiên bản ổn định, dùng để demo hoặc triển khai.
- `develop`: nhánh tích hợp chung của nhóm.
- `feature/<ten-chuc-nang>`: phát triển chức năng mới.
- `fix/<ten-loi>`: sửa lỗi.
- `docs/<noi-dung>`: cập nhật tài liệu.

Không đẩy trực tiếp vào `main`. Mỗi chức năng được tạo từ `develop`, sau đó mở pull request quay lại `develop`.

## Phạm vi hiện tại

Giai đoạn này mới khởi tạo nền tảng. ERD, state machine, OpenAPI, migration và dữ liệu mẫu sẽ được thực hiện ở bước thiết kế trước khi phát triển nghiệp vụ.


# Trạng thái triển khai — Nhật ký thực tập định kỳ

Ngày cập nhật: 24/08/2026

## Kết quả

Đã hoàn thành phần triển khai của Giai đoạn 3: một lát cắt dọc nhật ký thực tập hằng tuần cho Sinh viên,
Doanh nghiệp và UIT. Việc chạy migration cùng E2E trên database thật đang chờ PostgreSQL local hoạt động.

### Sinh viên

- Chỉ xem placement thuộc chính mình; ownership sai trả `404`.
- Chỉ tạo tuần tiếp theo theo thứ tự khi placement ở `STARTED`.
- Lưu bản nháp, nộp lần đầu và nộp lại sau khi Doanh nghiệp yêu cầu sửa.
- Xem hạn nộp, cờ quá hạn, trạng thái, phiên bản, số lần nộp và lịch sử xử lý.
- Nhật ký đã được Doanh nghiệp xác nhận không còn CTA sửa hoặc nộp.

### Doanh nghiệp

- Chỉ xem nhật ký của placement thuộc doanh nghiệp tài khoản.
- Xác nhận nhật ký đang `SUBMITTED` hoặc trả về kèm nhóm lý do và góp ý.
- Xem snapshot theo từng lần nộp và lịch sử actor nhưng không sửa nội dung của Sinh viên.

### UIT

- Xem nhật ký của toàn bộ placement ở chế độ chỉ đọc.
- Xem số liệu toàn trường theo trạng thái và danh sách nhật ký quá hạn.
- Không có CTA xác nhận thay Doanh nghiệp.

## Thành phần kỹ thuật

- Migration `0019_internship_weekly_log_workflow.sql` gồm log, snapshot bất biến và transition history.
- Deadline được tính từ ngày bắt đầu thực tế: mỗi kỳ 7 ngày, hạn nộp sau ngày kết thúc 2 ngày.
- `OVERDUE` là giá trị suy diễn khi đọc, không được lưu thành trạng thái nghiệp vụ.
- Spring Boot API có RBAC, ownership, transaction, row lock, optimistic version và idempotency key.
- Mỗi lần nộp tạo snapshot; mỗi transition ghi history, audit và notification có dedupe key.
- OpenAPI `1.6.0` có 106 paths; ERD và tài liệu state machine đã đồng bộ.
- Seed chuyển placement học thuật sang `STARTED`, có tuần 1 đã xác nhận và tuần 2 quá hạn.
- UI được tích hợp vào `Quá trình thực tập`, `Sinh viên thực tập` và `Quản lý thực tập`.

## Kịch bản kiểm thử đã bổ sung

- Unit test state machine cho submit, confirm, request revision và state/role conflict.
- Playwright UI flow qua UIT → Sinh viên → Doanh nghiệp → Sinh viên → Doanh nghiệp → UIT.
- Playwright API flow cho ownership `404`, retry cùng command, dùng lại key cho action khác và stale version.
- Browser verification với API mock cho cả ba vai trò tại `1440×1024` và Sinh viên tại `390×844`.

## Kết quả cổng chất lượng

| Cổng kiểm tra | Kết quả |
|---|---|
| Backend compile/package | Đạt |
| Unit test backend không cần DB | 16/16 đạt, trong đó weekly-log workflow 3/3 |
| Frontend build và bundle gate | Đạt |
| Frontend test | 9/9 đạt |
| OpenAPI validation | Đạt, 106 paths |
| Browser check ba vai trò và mobile | Đạt, không console error, overlay hoặc tràn ngang |
| `git diff --check` | Đạt |
| Migration, Spring context và E2E thật | Chưa chạy: PostgreSQL `localhost:5432` không hoạt động và Docker daemon chưa chạy |

## Việc cần làm để đóng hoàn toàn Giai đoạn 3

1. Khởi động PostgreSQL hoặc Docker Desktop.
2. Chạy `pnpm db:setup` và `pnpm db:demo:reset` để áp dụng migration `0019` cùng seed.
3. Chạy `pnpm e2e:full` trên database E2E cô lập.
4. Lưu kết quả thực tế của migration, ownership, retry, version conflict và overdue vào báo cáo kiểm thử.
5. Sau khi các cổng trên đạt, chuyển sang Giai đoạn 4 — báo cáo cuối kỳ và tệp R2 private.

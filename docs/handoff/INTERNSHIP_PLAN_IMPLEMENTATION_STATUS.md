# Trạng thái triển khai — Kế hoạch thực tập

Ngày cập nhật: 22/08/2026

## Kết quả

Đã hoàn thành lát cắt dọc đầu tiên của kế hoạch đồ án tốt nghiệp: quy trình kế hoạch thực tập từ Sinh viên đến Doanh nghiệp và UIT.

### Sinh viên

- Xem các placement thuộc chính mình.
- Tạo hoặc lưu bản nháp kế hoạch.
- Nộp lần đầu cho Doanh nghiệp.
- Nhận góp ý, chỉnh sửa và nộp lại đúng bên đang chờ duyệt.
- Xem trạng thái, số lần nộp và lịch sử phê duyệt.

### Doanh nghiệp

- Chỉ xem placement thuộc doanh nghiệp của tài khoản.
- Xác nhận để chuyển kế hoạch đến UIT.
- Chọn nhóm lý do và gửi góp ý yêu cầu Sinh viên chỉnh sửa.

### UIT

- Xem toàn bộ kế hoạch và ưu tiên hàng chờ UIT duyệt.
- Phê duyệt cuối hoặc yêu cầu Sinh viên chỉnh sửa.
- Xem actor và timeline của toàn bộ quyết định.

## Thành phần kỹ thuật

- Migration `0018_internship_plan_workflow.sql` với plan, immutable submission snapshot và history.
- Spring Boot API có RBAC, ownership trả `404`, transaction, optimistic version và idempotency key.
- Mỗi transition ghi history, audit log và notification có dedupe key.
- OpenAPI `1.5.0`, ERD và tài liệu state machine đã đồng bộ.
- Seed có placement `HIRED` riêng cho tài khoản demo Sinh viên và VNG để bắt đầu quy trình.
- Playwright full-flow bao phủ hai vòng trả sửa: Company trả sửa, UIT trả sửa, sau đó UIT phê duyệt.

## Kết quả kiểm tra

| Cổng kiểm tra | Kết quả |
|---|---|
| Backend compile/package | Đạt |
| Unit test state machine mới | 4/4 đạt |
| Unit test backend không cần DB | 13/13 đạt |
| Frontend build và bundle gate | Đạt |
| Frontend test | 9/9 đạt |
| OpenAPI validation | Đạt, 97 paths |
| Browser check ba vai trò với API mock | Đạt, không console error/overlay |
| `git diff --check` | Đạt |
| Spring context/integration và E2E thật | Chưa chạy được vì PostgreSQL `localhost:5432` không hoạt động |

## Việc tiếp theo

Giai đoạn 3 — nhật ký thực tập định kỳ — đã được triển khai. Trạng thái mới nhất nằm tại
[`WEEKLY_LOG_IMPLEMENTATION_STATUS.md`](./WEEKLY_LOG_IMPLEMENTATION_STATUS.md). Khi PostgreSQL hoạt động,
cần chạy chung migration `0018–0019`, reset seed và toàn bộ E2E để đóng hai lát cắt trên database thật.

Gate bắt buộc kế hoạch `APPROVED` trước transition placement `STARTED` vẫn tắt trong rollout đầu để không phá luồng demo cũ.

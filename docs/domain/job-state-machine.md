# Job state machine

## Sơ đồ

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING_UIT_REVIEW: Company gửi duyệt
    DRAFT --> CLOSED: Company đóng nháp
    PENDING_UIT_REVIEW --> RECRUITING: UIT duyệt
    PENDING_UIT_REVIEW --> REVISION_REQUIRED: UIT yêu cầu chỉnh sửa
    PENDING_UIT_REVIEW --> REJECTED: UIT từ chối
    REVISION_REQUIRED --> PENDING_UIT_REVIEW: Company sửa và gửi lại
    REVISION_REQUIRED --> CLOSED: Company đóng tin
    RECRUITING --> PAUSED: Company hoặc UIT tạm dừng
    RECRUITING --> EXPIRED: System xác định hết hạn
    RECRUITING --> CLOSED: Company hoặc UIT đóng
    PAUSED --> RECRUITING: Company hoặc UIT mở lại
    PAUSED --> CLOSED: Company hoặc UIT đóng
    EXPIRED --> PENDING_UIT_REVIEW: Company xin gia hạn
    EXPIRED --> CLOSED: Company đóng
    REJECTED --> [*]
    CLOSED --> [*]
```

## Ma trận chuyển trạng thái

| Từ | Hành động | Đến | Actor | Điều kiện bắt buộc |
|---|---|---|---|---|
| `DRAFT` | Gửi duyệt | `PENDING_UIT_REVIEW` | COMPANY | Đủ trường bắt buộc, doanh nghiệp đang hoạt động, deadline hợp lệ |
| `DRAFT` | Đóng | `CLOSED` | COMPANY | Xác nhận thao tác |
| `PENDING_UIT_REVIEW` | Duyệt | `RECRUITING` | UIT_ADMIN | Checklist hợp lệ; ghi reviewer và thời gian |
| `PENDING_UIT_REVIEW` | Yêu cầu sửa | `REVISION_REQUIRED` | UIT_ADMIN | Bắt buộc reason/note |
| `PENDING_UIT_REVIEW` | Từ chối | `REJECTED` | UIT_ADMIN | Bắt buộc reason/note |
| `REVISION_REQUIRED` | Gửi lại | `PENDING_UIT_REVIEW` | COMPANY | Đã xử lý phản hồi và dữ liệu hợp lệ |
| `REVISION_REQUIRED` | Đóng | `CLOSED` | COMPANY | Bắt buộc xác nhận |
| `RECRUITING` | Tạm dừng | `PAUSED` | COMPANY/UIT_ADMIN | Bắt buộc reason nếu UIT thao tác |
| `RECRUITING` | Hết hạn | `EXPIRED` | SYSTEM | `deadline < current_date` |
| `RECRUITING` | Đóng | `CLOSED` | COMPANY/UIT_ADMIN | Cảnh báo nếu còn đơn đang xử lý; lưu reason |
| `PAUSED` | Mở lại | `RECRUITING` | COMPANY/UIT_ADMIN | Deadline còn hiệu lực |
| `PAUSED` | Đóng | `CLOSED` | COMPANY/UIT_ADMIN | Lưu reason |
| `EXPIRED` | Xin gia hạn | `PENDING_UIT_REVIEW` | COMPANY | Deadline mới hợp lệ |
| `EXPIRED` | Đóng | `CLOSED` | COMPANY | Xác nhận thao tác |

`REJECTED` và `CLOSED` là terminal. API không nhận một trường `status` tùy ý từ client; mỗi hành động có endpoint riêng.

## Quy tắc hiển thị và dữ liệu

- Sinh viên chỉ thấy tin `RECRUITING` có deadline chưa qua.
- Tin `PAUSED`, `EXPIRED` hoặc `CLOSED` không nhận đơn mới.
- Việc tin ngừng tuyển không xóa hoặc tự kết thúc các đơn đã nộp.
- Mỗi transition tăng `version`, ghi `job_post_status_history` và audit khi hành động nhạy cảm.
- Khi hai người duyệt cùng một tin, chỉ transition khớp `status/version` hiện tại được phép thành công.

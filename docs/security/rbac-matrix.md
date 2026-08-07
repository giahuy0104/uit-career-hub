# Ma trận phân quyền RBAC

Tài liệu này là nguồn đối chiếu quyền truy cập backend của UIT Career Hub trong phạm vi MVP một trường.

## Nguyên tắc bắt buộc

1. Mọi API nghiệp vụ dưới `/api/v1` yêu cầu Bearer access token, ngoại trừ đăng nhập, làm mới phiên, đăng xuất và kích hoạt tài khoản doanh nghiệp theo contract xác thực.
2. Kiểm tra vai trò được thực hiện tại route trước khi parse payload hoặc gọi service.
3. `STUDENT` phải có `studentProfileId`; `COMPANY` phải có `companyId`. Đúng vai trò nhưng thiếu liên kết trả về `403 AUTH_CONTEXT_MISSING`.
4. Quyền sở hữu được kiểm tra lại trong service/repository. Tài nguyên thuộc sinh viên hoặc doanh nghiệp khác trả về `404` để không làm lộ sự tồn tại của bản ghi.
5. Mọi response `/api/v1` dùng `Cache-Control: private, no-store`. Helmet cung cấp các header bảo vệ trình duyệt cơ bản.

## Quy ước phản hồi từ chối

| Trường hợp | HTTP | Mã lỗi |
|---|---:|---|
| Không có Bearer token | 401 | `AUTH_ACCESS_TOKEN_MISSING` |
| Token sai chữ ký, issuer, audience hoặc hết hạn | 401 | `AUTH_INVALID_ACCESS_TOKEN` |
| Vai trò không được phép gọi endpoint | 403 | `AUTH_FORBIDDEN` |
| Đúng vai trò nhưng thiếu hồ sơ sinh viên/doanh nghiệp liên kết | 403 | `AUTH_CONTEXT_MISSING` |
| Truy cập tài nguyên thuộc chủ thể khác | 404 | mã `*_NOT_FOUND` tương ứng |

## Ma trận endpoint

| Phạm vi | Endpoint | STUDENT | UIT_ADMIN | COMPANY |
|---|---|:---:|:---:|:---:|
| Dùng chung | `GET /jobs`, `GET /jobs/{jobId}` | ✓ | ✓ | ✓ |
| Dùng chung | `/notifications`, unread count, read, read-all | ✓ | ✓ | ✓ |
| Sinh viên | `GET /students/me`, `/students/me/documents` | ✓ | — | — |
| Sinh viên | `GET/POST /applications` và `GET /applications/{id}` | ✓ | — | — |
| Sinh viên | resubmit, withdraw, cancel interview, accept/decline offer | ✓ | — | — |
| UIT | hàng đợi và quyết định duyệt tin `/uit/jobs/**` | — | ✓ | — |
| UIT | hàng đợi và quyết định hồ sơ `/uit/applications/**` | — | ✓ | — |
| Doanh nghiệp | quản lý tin `/companies/me/jobs/**` | — | — | ✓ |
| Doanh nghiệp | danh sách và xử lý ứng viên `/companies/me/**` | — | — | ✓ |

Ký hiệu `—` nghĩa là middleware phải từ chối bằng `403`, không phụ thuộc payload gửi lên có hợp lệ hay không.

## Kiểm thử bảo vệ

- `backend/src/security/rbac-routes.test.ts`: kiểm tra HTTP thực tế cho toàn bộ 30 endpoint giới hạn vai trò, token thiếu/sai, context thiếu, endpoint dùng chung và security headers.
- `backend/src/middleware/auth.test.ts`: kiểm tra độc lập middleware role/context/ownership.
- `backend/src/modules/jobs/job.integration.test.ts`: xác nhận doanh nghiệp không đọc hoặc sửa tin của doanh nghiệp khác.
- `backend/src/modules/applications/application.integration.test.ts`: xác nhận sinh viên và doanh nghiệp không truy cập chéo hồ sơ, tài liệu hoặc đơn ứng tuyển.
- `backend/src/modules/notifications/notification.integration.test.ts`: xác nhận người dùng chỉ đọc/cập nhật thông báo của mình.

## Rủi ro còn lại và giới hạn MVP

- Access token đã cấp có hiệu lực tối đa 15 phút. Đăng xuất hoặc khóa tài khoản thu hồi refresh token, nhưng access token hiện tại chỉ hết hiệu lực khi tới hạn; phương án deny-list hoặc kiểm tra trạng thái người dùng trên từng request để dành cho giai đoạn hardening production.
- Rate limit hiện tập trung vào đăng nhập, refresh và kích hoạt. Rate limit theo người dùng/IP cho API nghiệp vụ sẽ được bổ sung khi triển khai production.
- Phân quyền chi tiết theo từng chức danh trong phòng UIT hoặc nhiều recruiter của doanh nghiệp chưa thuộc MVP; hiện các tài khoản cùng vai trò có cùng tập quyền trong phạm vi tổ chức của mình.

# ADR 002 — JWT access token, refresh rotation và RBAC

## Trạng thái

Đã chấp nhận cho MVP.

## Quyết định

- Đăng nhập email/password; SSO UIT thuộc Phase 2.
- Mật khẩu băm bằng bcrypt với cost 12.
- Access token JWT HS256 có thời hạn mặc định 15 phút, chỉ giữ trong bộ nhớ frontend.
- Refresh token ngẫu nhiên có thời hạn mặc định 7 ngày, chỉ gửi qua cookie HttpOnly và chỉ lưu SHA-256 hash trong PostgreSQL.
- Mỗi lần refresh sẽ xoay token. Việc dùng lại token đã thu hồi sẽ thu hồi cả token family.
- Sau 5 lần sai mật khẩu, tài khoản bị khóa 15 phút; endpoint xác thực còn có rate limit.
- Sinh viên chỉ đăng nhập nếu email thuộc `UIT_EMAIL_DOMAINS`.
- Tài khoản doanh nghiệp không có public signup; UIT tạo tài khoản ở trạng thái `PENDING_ACTIVATION`, activation token chỉ lưu hash.
- RBAC và ownership được kiểm tra ở backend. Vi phạm ownership trả 404 để không làm lộ tài nguyên.

## Cookie

- Local: `HttpOnly`, `SameSite=Lax`, không bắt buộc `Secure`.
- Production cùng site: ưu tiên `SameSite=Lax`, `Secure`.
- Production khác site: `SameSite=None`, `Secure`, HTTPS và CORS origin chính xác.

## Hệ quả và giới hạn

- Refresh token không xuất hiện trong JSON hoặc localStorage, giảm rủi ro khi frontend có XSS.
- JWT access token không cần truy vấn database ở mỗi middleware, nhưng endpoint `/auth/me` vẫn kiểm tra trạng thái tài khoản hiện tại.
- MVP dùng một JWT secret. Khi cần nhiều service hoặc luân chuyển khóa độc lập, có thể chuyển sang asymmetric key/JWKS ở Phase 2.
- Authorization nghiệp vụ vẫn phải kiểm tra ownership/state trong service hoặc repository; kiểm tra role đơn thuần là chưa đủ.

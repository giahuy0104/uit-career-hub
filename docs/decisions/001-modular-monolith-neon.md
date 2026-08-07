# ADR 001: Modular monolith và Neon PostgreSQL

- Trạng thái: Chấp nhận
- Ngày: 2026-08-07

## Bối cảnh

UIT Career Hub là đồ án tốt nghiệp phục vụ một trường UIT với ba vai trò. Mục tiêu gần nhất là hoàn thành happy flow từ doanh nghiệp đăng tin đến UIT xác nhận nơi nhận việc. Repo hiện tại đã dùng React/Vite, Express/TypeScript và PostgreSQL.

Kiến trúc Spring Boot microservices, Kafka, Redis, Keycloak và Kubernetes trong prompt cũ tạo nhiều hạ tầng nhưng không làm tăng giá trị của happy flow ở giai đoạn này. Docker cũng không thể là điều kiện bắt buộc trên mọi máy thành viên.

## Quyết định

- Giữ một monorepo và một backend Express/TypeScript theo kiến trúc modular monolith.
- Dùng một PostgreSQL cho MVP, các module sở hữu logic nhưng có thể dùng foreign key và transaction chung.
- Neon PostgreSQL là môi trường phát triển/deploy chính.
- `DATABASE_URL` dùng pooled connection cho runtime.
- `DATABASE_URL_DIRECT` dùng direct connection cho migration/seed.
- `DATABASE_URL_TEST` luôn trỏ đến branch/database test riêng.
- Docker Compose chỉ là lựa chọn PostgreSQL local dự phòng.
- In-app notification được ghi cùng transaction nghiệp vụ trong MVP.

## Hệ quả tích cực

- Có thể đóng việc nhận offer và các đơn còn lại trong một transaction nhất quán.
- Nhóm tập trung vào RBAC, state machine, audit và trải nghiệm thay vì vận hành nhiều service.
- Thành viên dùng chung môi trường PostgreSQL mà không phụ thuộc WSL/Docker.
- Các module vẫn có ranh giới để tách service sau này nếu có nhu cầu thực tế.

## Trade-off

- Backend và database là một đơn vị triển khai, chưa thể scale độc lập từng module.
- Development phụ thuộc Internet khi dùng Neon.
- Các thành viên phải dùng migration và seed thay vì tự sửa schema qua giao diện.
- Gói dịch vụ cloud có giới hạn; cần theo dõi dung lượng và chuẩn bị dữ liệu demo/backup trước buổi bảo vệ.

## Không làm trong MVP

Cron tổng hợp hằng ngày được bổ sung sau khi happy flow và kiểm thử nghiệp vụ đã ổn định.
Kafka, Redis, WebSocket, email/FCM, scheduler nhiều tần suất, Keycloak, Kubernetes, Kong,
đa trường và AI tiếp tục được hoãn sang các lát cắt sau.

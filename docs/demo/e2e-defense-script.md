# Kịch bản demo E2E bảo vệ đồ án

Kịch bản này dùng checkpoint dữ liệu cố định để trình bày happy flow trong khoảng 8–10 phút. Mục tiêu là cho thấy ba vai trò phối hợp trên cùng một quy trình và hệ thống tự xử lý các đơn còn lại khi sinh viên đã chọn nơi thực tập.

## 1. Chuẩn bị trước buổi demo

Chạy tại thư mục gốc của project:

```powershell
$env:ALLOW_DEMO_RESET = "true"
pnpm db:demo:reset
$env:ALLOW_DEMO_RESET = "false"
pnpm db:demo:check
```

`db:demo:reset` chỉ xóa và tạo lại các định danh demo cố định, đồng thời thu hồi phiên đăng nhập cũ của các tài khoản này. Không bật `ALLOW_DEMO_RESET` trong production và không trình chiếu file `.env`.

Sau khi tất cả kiểm tra báo `PASS`, mở hai terminal:

```powershell
pnpm dev:backend
```

```powershell
pnpm dev:frontend
```

Chuẩn bị ba cửa sổ trình duyệt hoặc ba profile riêng để tránh dùng chung cookie.

## 2. Tài khoản trình bày

| Vai trò | Email | Mật khẩu | Mục đích |
|---|---|---|---|
| UIT Admin | `admin.career@uit.edu.vn` | `Admin@12345` | Duyệt tin, xác nhận nơi thực tập |
| Sinh viên | `20521067@student.uit.edu.vn` | `Student@12345` | Theo dõi ba đơn, phản hồi offer |
| VNG recruiter | `recruiter@vng.example` | `Company@12345` | Minh họa doanh nghiệp đã gửi offer |
| FPT recruiter | `recruiter@fpt.example` | `Company@12345` | Minh họa đơn tự đóng sau khi sinh viên nhận việc khác |

## 3. Checkpoint ban đầu

Sinh viên `20521067` có ba đơn:

1. VNG Backend ở trạng thái `OFFER_PENDING_STUDENT`.
2. FPT Data Engineer ở trạng thái `COMPANY_REVIEWING`.
3. VNG Frontend ở trạng thái `UIT_REVIEWING`.

Ngoài ra có một tin tuyển dụng đang chờ UIT duyệt và cả UIT, sinh viên, doanh nghiệp đều có thông báo chưa đọc.

## 4. Luồng trình bày 8–10 phút

### 0:00–0:45 — Giới thiệu phạm vi

- Hệ thống phục vụ một trường UIT, sinh viên UIT và các doanh nghiệp đối tác.
- Điểm khác biệt là UIT kiểm duyệt tin và hồ sơ, theo dõi xuyên suốt đến khi xác nhận nơi thực tập.
- Ba vai trò dùng chung một state machine; mọi thay đổi đều có history, audit và thông báo.

### 0:45–2:00 — UIT xử lý tin tuyển dụng

1. Đăng nhập bằng UIT Admin.
2. Mở thông báo và hàng đợi tin chờ duyệt.
3. Mở tin đang chờ, kiểm tra thông tin rồi phê duyệt.
4. Nêu ngắn gọn hai nhánh còn lại: yêu cầu chỉnh sửa và từ chối.

Kết quả mong đợi: tin chuyển sang `RECRUITING`, doanh nghiệp nhận thông báo và lịch sử duyệt được lưu.

### 2:00–3:30 — Sinh viên phản hồi offer

1. Chuyển sang tài khoản sinh viên.
2. Mở danh sách ứng tuyển để chỉ ra ba đơn đang ở ba bước khác nhau.
3. Mở đơn VNG Backend và chọn nhận offer.

Kết quả mong đợi: đơn chuyển sang bước chờ UIT xác nhận nơi thực tập; chưa tự đóng các đơn khác ở thời điểm này.

### 3:30–5:00 — UIT xác nhận nơi thực tập

1. Quay lại UIT Admin và mở hàng đợi xác nhận.
2. Kiểm tra offer/sinh viên rồi xác nhận VNG là nơi thực tập.

Kết quả mong đợi trong cùng một transaction:

- Đơn VNG Backend chuyển `HIRED`.
- Hai đơn FPT Data Engineer và VNG Frontend chuyển `WITHDRAWN` với lý do `ACCEPTED_OTHER_JOB`.
- Lịch phỏng vấn còn hiệu lực của các đơn bị rút được hủy.
- History, audit log và thông báo cho các bên liên quan được tạo.

### 5:00–6:30 — Kiểm tra kết quả ở sinh viên

1. Làm mới danh sách đơn của sinh viên.
2. Chỉ ra một đơn `HIRED` và hai đơn đã rút tự động.
3. Mở lịch sử một đơn để cho thấy lý do và thời điểm thay đổi.

### 6:30–7:45 — Kiểm tra kết quả ở doanh nghiệp

1. Đăng nhập FPT recruiter.
2. Mở thông báo về việc ứng viên đã nhận công việc khác.
3. Mở pipeline ứng viên và cho thấy hồ sơ không còn được phép chuyển bước/từ chối lần nữa.

### 7:45–9:00 — Tổng kết

- Nhắc lại kiểm soát quyền theo vai trò và ownership ở backend.
- Thông báo trong hệ thống thuộc MVP; email/FCM, cron job và retry thuộc Phase 2.
- Hướng phát triển: thêm trường khác bằng cấu hình tenant, không thay đổi lõi quy trình.

## 5. Phương án dự phòng

- Nếu dữ liệu khác checkpoint: dừng backend, chạy lại `db:demo:reset` rồi `db:demo:check`.
- Nếu một cửa sổ bị sai quyền: đăng xuất hoặc xóa cookie, không đổi dữ liệu trực tiếp trong Neon Console.
- Nếu mạng chậm: ưu tiên phần sinh viên nhận offer → UIT xác nhận → hai đơn còn lại tự rút; đây là điểm nghiệp vụ quan trọng nhất.
- Không chỉnh trạng thái bằng SQL trong lúc demo vì sẽ bỏ qua history, audit và notification.

## 6. Luồng đầy đủ để quay video hoặc demo dài

Khi có 15–20 phút, có thể chạy từ đầu: doanh nghiệp tạo tin → UIT duyệt → sinh viên ứng tuyển hai bước → UIT chuyển hồ sơ → doanh nghiệp sàng lọc/đặt lịch/phỏng vấn → doanh nghiệp gửi offer → sinh viên nhận offer → UIT xác nhận nơi thực tập. Checkpoint ngắn ở trên phù hợp hơn cho phần bảo vệ trực tiếp.

# Design QA — UIT Career Hub

## Phạm vi kiểm tra

- Prototype: `C:/Users/Windows/Documents/Codex/2026-07-25/hi-n/uit-career-hub-client-prototype`
- Viewport chuẩn: `1440 x 1024`
- Trình duyệt kiểm tra: Codex In-app Browser
- Ngày kiểm tra: `2026-08-05`

## Nguồn thiết kế và bản dựng

| Màn hình | Thiết kế nguồn | Ảnh bản dựng | Ảnh đối chiếu |
| --- | --- | --- | --- |
| Danh sách việc làm | `qa/source-jobs.png` | `qa/implementation-jobs.png` | `qa/compare-jobs.png` |
| Ứng tuyển | `qa/source-apply.png` | `qa/implementation-apply.png` | `qa/compare-apply.png` |
| Đơn ứng tuyển | `qa/source-applications.png` | `qa/implementation-applications.png` | `qa/compare-applications.png` |

Ảnh bổ sung cho các vai trò chưa có thiết kế nguồn độc lập:

- `qa/implementation-admin-dashboard.png`
- `qa/implementation-admin-job-review.png`
- `qa/implementation-company-candidates.png`

## Kết quả đối chiếu hình ảnh

### Danh sách việc làm

- Bố cục danh sách bên trái và chi tiết bên phải khớp với thiết kế nguồn.
- Phân cấp tiêu đề, trạng thái xác thực, bộ lọc, kỹ năng và CTA ứng tuyển rõ ràng.
- Khoảng cách, viền, bán kính bo và sắc độ nền đạt mức nhất quán.
- Sai khác P3: logo doanh nghiệp và avatar dùng dữ liệu/asset mẫu; bộ chuyển vai trò chỉ xuất hiện trong prototype để phục vụ trình bày.

### Ứng tuyển

- Luồng 3 bước, hồ sơ sinh viên, chọn CV, kiểm tra tài liệu và thông tin việc làm được giữ đúng.
- Trạng thái thiếu bảng điểm, thao tác tải lên, câu hỏi nhà tuyển dụng và bước xác nhận đều hoạt động.
- Sai khác P3: prototype dùng thanh điều hướng trắng để thống nhất hệ thống; thiết kế nguồn của riêng màn này dùng thanh điều hướng xanh đậm.
- Không có nội dung quan trọng bị che hoặc mất khả năng thao tác tại viewport chuẩn.

### Đơn ứng tuyển

- Sidebar, thẻ tiến trình 5 bước, trạng thái người xử lý, bảng đơn khác và khu vực thông báo khớp thiết kế nguồn.
- Màu trạng thái, hành động xem hồ sơ/rút đơn và thông báo về quyền xem CV được thể hiện rõ.
- Sai khác P3: tên người dùng và dữ liệu mẫu được chuẩn hóa thành Nguyễn Minh Khoa trong toàn prototype.

### UIT Admin và Doanh nghiệp

- Giữ cùng hệ thống màu, typography, spacing, form, badge và bảng dữ liệu với client.
- Dashboard Admin có số liệu cần xử lý, doanh nghiệp đối tác, duyệt tin, duyệt hồ sơ, tác vụ hẹn giờ và báo cáo.
- Workspace Doanh nghiệp có hồ sơ doanh nghiệp, tin tuyển dụng, Kanban ứng viên, lịch phỏng vấn và thông báo.
- Không phát hiện phần tử tràn, chồng lớp nghiêm trọng hoặc CTA chính không nhìn thấy.

## Kiểm tra chức năng chính

- Chuyển vai trò Sinh viên / UIT Admin / Doanh nghiệp: đạt.
- Sinh viên: Việc làm → Ứng tuyển → tải bảng điểm → trả lời câu hỏi → xác nhận → gửi đơn: đạt.
- Sau khi gửi đơn, hệ thống hiển thị `Đơn ứng tuyển của tôi` và trạng thái `UIT kiểm duyệt`: đạt.
- UIT Admin: mở hàng đợi duyệt tin và phê duyệt tin tuyển dụng: đạt.
- Doanh nghiệp: mở bảng ứng viên và chuyển ứng viên sang bước tiếp theo: đạt.
- Console errors tại thời điểm kiểm tra: không có.

## Lịch sử xử lý

1. Dựng ba màn hình sinh viên theo ba thiết kế nguồn.
2. Mở rộng thành hệ thống ba vai trò theo cùng design system.
3. Chụp ảnh bản dựng tại viewport `1440 x 1024`.
4. Ghép thiết kế nguồn và bản dựng trong cùng một ảnh đối chiếu.
5. Kiểm tra lại bố cục, trạng thái, CTA và luồng thao tác cốt lõi.
6. Giữ các sai khác còn lại ở mức P3, không ảnh hưởng luồng chính hoặc khả năng trình bày đồ án.

## Kết luận

- P0: 0
- P1: 0
- P2: 0
- P3: 3 nhóm sai khác nhỏ đã ghi nhận ở trên

final result: passed

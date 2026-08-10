# Design QA — UIT Career Hub

Ngày audit gần nhất: **10/08/2026**

## Nguồn sự thật hiện tại

- UI đang chạy và API production của `v0.1.0`.
- `docs/domain/application-state-machine.md` và `docs/domain/job-state-machine.md`.
- `docs/api/openapi.yaml`.
- Inventory, bằng chứng ảnh và giới hạn audit: `../docs/ui-audit/route-inventory.md`.

Tài liệu này không còn dùng prototype ngày 05/08 làm nguồn sự thật. Các mô tả luồng ba bước, câu hỏi nhà tuyển
dụng, dữ liệu mẫu và bộ chuyển vai trò đã lỗi thời. Luồng ứng tuyển MVP hiện tại có **hai bước**:

1. chọn CV/tài liệu đã xác minh;
2. kiểm tra consent và gửi đơn.

## Kết quả hiện tại

- Student Dashboard, Jobs, Applications và luồng apply dùng API thật.
- UIT và Company happy flow dùng API thật ở các màn được nêu trong inventory.
- Student Jobs/Applications có loading, empty, error, retry và trạng thái lọc nhất quán.
- Responsive browser check đã đạt tại `1440×1024`, `1024×768`, `768×1024`, `390×844`; không có overflow
  ngang ở cấp trang. Bảng đơn dùng vùng cuộn riêng trên màn nhỏ.
- Mobile navigation không còn ẩn Hồ sơ, Lịch phỏng vấn và Thông báo; toàn bộ route nằm trong thanh cuộn ngang.
- Màn `Scheduler`, `Reports`, `Access` của UIT đã bị loại khỏi điều hướng bảo vệ cho đến khi có API/dữ liệu thật.
- Ô tìm nhanh chỉ điều hướng trong route live của vai trò; avatar mở menu tài khoản và đăng xuất.
- Portal được lazy-load: build production hiện tách `RolePortals` khoảng 181 kB, chunk khởi tạo khoảng 346 kB và không
  còn cảnh báo 535 kB.

## Checklist QA tiếp theo

- Chạy browser check ở `1440×1024`, `1024×768`, `768×1024`, `390×844`.
- Kiểm tra keyboard, focus visible, screen reader và zoom 200%.
- Chạy screen reader, contrast tự động và zoom 200% thủ công trước release candidate; ảnh/DOM hiện tại không đủ để
  tuyên bố WCAG compliance.
- Giữ Scheduler/Reports/Access ngoài portal cho đến khi có lát cắt backend/OpenAPI/RBAC hoàn chỉnh.

Không kết luận WCAG compliance chỉ từ ảnh chụp.

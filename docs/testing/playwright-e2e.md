# Playwright E2E

Bộ E2E chạy Chromium trên hai cổng riêng (`5174` và `3100`) và bắt buộc dùng database chuyên dụng. Cấu hình sẽ dừng ngay nếu thiếu `DATABASE_URL_E2E`, thiếu `ALLOW_E2E_RESET=true`, tên database không chứa `e2e`, hoặc đích trùng database runtime/direct/integration test.

## Phạm vi

- `@smoke`: đăng nhập riêng Student, UIT và Company; mỗi portal phải mở dashboard và nhận response API `200` có dữ liệu.
- `@full`: happy flow Company tạo tin → UIT duyệt → Student ứng tuyển → UIT chuyển → Company sàng lọc/phỏng vấn/PASS/offer → Student nhận offer → UIT xác nhận placement.
- `@full`: revision, supplement, UIT reject, Company reject, withdraw, cancel interview, decline offer và cross-company ownership.
- `@full`: UIT tạo/đổi tên/archive/reactivate nhóm ngành và tạo kỹ năng qua UI thật.
- `@full`: UIT lọc báo cáo tuyển dụng và tải được cả CSV lẫn XLSX thật.

Mỗi test reset checkpoint trong database E2E trước khi chạy. Test dùng API setup chỉ để đưa dữ liệu về đúng tiền điều kiện nghiệp vụ; các transition cần bảo vệ vẫn được thao tác qua UI, ngoại trừ kiểm tra ownership trực tiếp ở API boundary.

## Chạy local an toàn

Ví dụ với PostgreSQL local đang lắng nghe ở cổng `55432`:

```powershell
$env:NODE_ENV = "test"
$env:DATABASE_URL_E2E = "postgresql://uit_user:uit_local_password@127.0.0.1:55432/uit_career_hub_e2e"
$env:ALLOW_E2E_RESET = "true"

pnpm db:e2e:setup
pnpm exec playwright install chromium
pnpm e2e:smoke
pnpm e2e:full

$env:ALLOW_E2E_RESET = "false"
```

`db:e2e:setup` chỉ tự tạo database khi host là local. Với Neon hoặc PostgreSQL từ xa, phải tạo database/branch E2E trước; script chỉ xác nhận kết nối rồi chạy migration/reset. Không đặt URL production vào `DATABASE_URL_E2E`.

## CI và artifact

- `.github/workflows/ci.yml` chạy `e2e:smoke` trên mọi pull request vào `develop` hoặc `main` sau typecheck, OpenAPI, unit/integration test và build.
- `.github/workflows/e2e-full.yml` chạy bộ dài theo lịch mỗi tuần và có thể chạy thủ công trước release candidate.
- Khi test thất bại, Playwright giữ screenshot, video và trace trong `test-results/`; CI tải cả `test-results/` và `playwright-report/` lên artifact.

Mở report hoặc trace local:

```powershell
pnpm e2e:report
pnpm exec playwright show-trace path/to/trace.zip
```

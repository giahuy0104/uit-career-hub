# Quy ước làm việc nhóm

## Quy trình một chức năng

1. Cập nhật nhánh `develop`.
2. Tạo nhánh mới theo mẫu `feature/ten-ngan-gon`.
3. Chỉ thay đổi phần thuộc chức năng đang làm.
4. Chạy build và test trước khi push.
5. Mở pull request vào `develop` và nhờ ít nhất một thành viên review.

## Commit message

Sử dụng các tiền tố ngắn:

- `feat:` thêm chức năng.
- `fix:` sửa lỗi.
- `docs:` cập nhật tài liệu.
- `refactor:` sắp xếp lại mã nguồn nhưng không đổi nghiệp vụ.
- `test:` thêm hoặc sửa kiểm thử.
- `chore:` cấu hình và công việc kỹ thuật.

Ví dụ: `feat: add student application flow`.

## Điều không được commit

- File `.env` hoặc thông tin đăng nhập thật.
- Thư mục `node_modules`, `dist`, `.vercel`.
- Dữ liệu cá nhân, CV hoặc bảng điểm thật của sinh viên.


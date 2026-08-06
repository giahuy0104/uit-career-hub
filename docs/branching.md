# Luồng nhánh Git

```text
main
  └── develop
        ├── feature/auth-rbac
        ├── feature/company-job-post
        ├── feature/student-application
        └── fix/application-status
```

## Quy tắc

- `main` chỉ nhận pull request từ `develop` khi một mốc đã chạy ổn định.
- Nhánh chức năng luôn tạo từ `develop`.
- Pull request phải mô tả chức năng, cách kiểm tra và ảnh giao diện nếu có.
- Không gộp pull request khi build hoặc test thất bại.


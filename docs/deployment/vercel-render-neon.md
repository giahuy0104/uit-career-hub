# Triển khai Vercel Render và Neon

## Kiến trúc production

| Thành phần | Nền tảng | URL |
|---|---|---|
| Frontend React Vite | Vercel | `https://uit-career-hub-web-041204.vercel.app` |
| Backend Java Spring Boot | Render Docker | `https://uit-career-hub-java-api-041204.onrender.com` |
| PostgreSQL | Neon | Kết nối qua `DATABASE_URL` pooled |

Trình duyệt chỉ gọi `/api/*` trên domain frontend. Vercel rewrite request sang Render, nhờ vậy refresh cookie HttpOnly tiếp tục là cookie first-party.

```text
Browser
  -> Vercel frontend
     -> /api/* rewrite
        -> Render Docker
           -> Spring Boot Java
              -> Neon PostgreSQL
```

## Cấu hình Render

File `render.yaml` tạo Web Service gói Free tại Singapore, build `Dockerfile` ở thư mục gốc và kiểm tra `/api/health`.

Render tự sinh `JWT_ACCESS_SECRET` và `CRON_SECRET`. Khi tạo Blueprint, chỉ nhập `DATABASE_URL` pooled của Neon vào biến được đánh dấu `sync: false`. Không commit giá trị này.

Các biến production chính:

- `NODE_ENV=production`
- `DATABASE_URL`: Neon pooled URL, secret
- `DATABASE_POOL_MAX=2`
- `CORS_ORIGIN=https://uit-career-hub-web-041204.vercel.app`
- `PUBLIC_APP_URL=https://uit-career-hub-web-041204.vercel.app`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAME_SITE=lax`
- `UIT_EMAIL_DOMAINS=student.uit.edu.vn`

Gói Render Free phù hợp demo và kiểm thử; service có thể sleep khi không có lưu lượng nên request đầu tiên có thể chậm.

## Migration database

Migration không chạy tự động trong container production. Trên máy quản trị, cấu hình `DATABASE_URL` và `DATABASE_URL_DIRECT` cho đúng Neon project rồi chạy:

```powershell
pnpm db:migrate
```

Không đặt `DATABASE_URL_DIRECT`, `DATABASE_URL_TEST` hoặc `DATABASE_URL_E2E` trên Render runtime.

## Cấu hình frontend Vercel

`frontend/vercel.json` rewrite `/api/:path*` sang backend Render. Frontend không chứa database URL, JWT secret hoặc mật khẩu demo trong production bundle.

Sau khi backend Ready, redeploy project `uit-career-hub-web-041204` để Vercel nhận rewrite mới.

## Kiểm tra sau deploy

```powershell
Invoke-RestMethod https://uit-career-hub-java-api-041204.onrender.com/api/health
Invoke-RestMethod https://uit-career-hub-java-api-041204.onrender.com/api/health/database
Invoke-RestMethod https://uit-career-hub-web-041204.vercel.app/api/health/database
```

Tiếp theo, mở frontend và kiểm tra:

1. Tạo tài khoản sinh viên bằng MSSV và email `MSSV@student.uit.edu.vn`.
2. Xác nhận hệ thống chuyển thẳng vào cổng sinh viên.
3. Làm mới trang và xác nhận phiên được khôi phục.
4. Đăng xuất, sau đó đăng nhập lại bằng tài khoản vừa tạo.

## Rollback

Render giữ lịch sử deploy để rollback service. Vercel frontend cũng có thể rollback độc lập. Rollback ứng dụng không rollback schema database; migration production phải tương thích ngược.

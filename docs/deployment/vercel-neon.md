# Triển khai Vercel và Neon

## Môi trường production hiện tại

| Thành phần | Project | URL production |
|---|---|---|
| Frontend Vite | `uit-career-hub-web-041204` | `https://uit-career-hub-web-041204.vercel.app` |
| Backend Express | `uit-career-hub-api-041204` | `https://uit-career-hub-api-041204.vercel.app` |
| Database | Neon PostgreSQL | Kết nối bằng pooled `DATABASE_URL` |

Backend function chạy tại region `sin1`. Frontend gọi API qua đường dẫn cùng origin `/api/v1`; Vercel rewrite request sang backend. Nhờ vậy refresh cookie vẫn là first-party cookie trên domain frontend.

```text
Browser
  -> uit-career-hub-web-041204.vercel.app
     -> static Vite assets
     -> /api/* rewrite
        -> uit-career-hub-api-041204.vercel.app
           -> Express function
              -> Neon pooled connection
```

## Biến môi trường Vercel

### Backend production

- `NODE_ENV=production`
- `CORS_ORIGIN=https://uit-career-hub-web-041204.vercel.app`
- `DATABASE_URL`: Neon pooled connection string, lưu dạng Sensitive.
- `DATABASE_POOL_MAX=2`: giới hạn kết nối cho mỗi serverless instance.
- `JWT_ACCESS_SECRET`: secret ngẫu nhiên tối thiểu 32 ký tự, lưu dạng Sensitive.
- `JWT_ISSUER`, `JWT_AUDIENCE`.
- `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`.
- `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=lax`.
- `UIT_EMAIL_DOMAINS`.
- `ALLOW_DEMO_RESET=false`.

Không đưa `DATABASE_URL_DIRECT`, `DATABASE_URL_TEST` hoặc secret vào frontend.

### Frontend production

- `VITE_API_BASE_URL=/api/v1`
- `VITE_SHOW_DEMO_ACCOUNTS=true`

Biến có tiền tố `VITE_` được đóng gói vào JavaScript và có thể được người dùng xem; chỉ đặt cấu hình công khai ở đây.

## Neon production

Runtime backend dùng pooled URL để tránh vượt giới hạn kết nối. Migration và seed không chạy trong Vercel Function. Khi cần cập nhật schema:

1. Cấu hình `DATABASE_URL` và `DATABASE_URL_DIRECT` đúng branch Neon trên máy quản trị.
2. Chạy `pnpm db:migrate`.
3. Kiểm tra `pnpm db:demo:check` nếu đây là môi trường demo.
4. Deploy backend rồi kiểm tra `/api/health/database`.

`NODE_ENV=production` chặn development seed và demo reset. Không bật `ALLOW_DEMO_RESET` trên Vercel.

## Lệnh deploy thủ công

```powershell
pnpm dlx vercel@58.7.1 deploy --prod --yes --cwd backend
pnpm dlx vercel@58.7.1 deploy --prod --yes --cwd frontend
```

Deploy backend trước frontend nếu thay đổi URL hoặc hợp đồng API. Hai thư mục `.vercel` chỉ lưu liên kết project trên máy và không được commit.

## Bật tự động deploy từ GitHub

Production hiện được deploy bằng CLI. Để Vercel tự tạo Preview khi push nhánh và deploy Production khi merge `main`:

1. Trong **Vercel → Account Settings → Authentication/Login Connections**, kết nối tài khoản GitHub có quyền với repository `kgiahuy0412/uit-career-hub`.
2. Khi hai project vẫn để Root Directory là `Auto`, chạy:

```powershell
pnpm dlx vercel@58.7.1 git connect https://github.com/kgiahuy0412/uit-career-hub.git --cwd backend
pnpm dlx vercel@58.7.1 git connect https://github.com/kgiahuy0412/uit-career-hub.git --cwd frontend
```

3. Sau khi kết nối thành công, cấu hình Root Directory trong Vercel Dashboard:
   - Backend project: `backend`.
   - Frontend project: `frontend`.

Không đặt Root Directory này trước khi dùng lệnh CLI `--cwd backend/frontend`, vì CLI sẽ ghép đường dẫn thành `backend/backend` hoặc `frontend/frontend`.

## Kiểm tra sau deploy

```powershell
Invoke-RestMethod https://uit-career-hub-api-041204.vercel.app/api/health
Invoke-RestMethod https://uit-career-hub-api-041204.vercel.app/api/health/database
Invoke-RestMethod https://uit-career-hub-web-041204.vercel.app/api/health/database
```

Sau đó kiểm tra bằng trình duyệt:

1. Mở frontend production.
2. Đăng nhập tài khoản demo.
3. Làm mới trang để xác nhận refresh cookie khôi phục phiên.
4. Mở danh sách việc làm và ba đơn ứng tuyển.
5. Đăng xuất.

Quét lỗi runtime:

```powershell
pnpm dlx vercel@58.7.1 logs https://uit-career-hub-api-041204.vercel.app --level error --since 1h --cwd backend
```

## Rollback

Nếu deployment mới lỗi, mở Vercel Dashboard để chọn deployment ổn định gần nhất hoặc dùng:

```powershell
pnpm dlx vercel@58.7.1 rollback --cwd backend
pnpm dlx vercel@58.7.1 rollback --cwd frontend
```

Rollback ứng dụng không rollback database. Migration production phải tương thích ngược hoặc có kế hoạch khôi phục riêng.

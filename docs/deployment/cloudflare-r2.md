# Cloudflare R2 cho tài liệu sinh viên

UIT Career Hub dùng bucket R2 **private** và S3-compatible API. Frontend không giữ API key: backend tạo URL ký trước cho đúng một thao tác `PUT` hoặc `GET`, đúng một object và trong thời gian ngắn.

## 1. Tạo bucket và API token

1. Trong Cloudflare Dashboard, vào **Storage & databases → R2**.
2. Tạo bucket `uit-career-hub-documents`, chọn Standard storage.
3. Tạo R2 API token với quyền **Object Read & Write**, chỉ áp dụng cho bucket trên.
4. Lưu Account ID, Access Key ID và Secret Access Key. Secret chỉ hiển thị một lần.

Không bật `r2.dev` hoặc public bucket. Tài liệu CV, bảng điểm và giấy xác nhận phải luôn được truy cập bằng URL ký trước.

## 2. Cấu hình CORS trên bucket

Thay domain production nếu project frontend dùng domain khác:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://uit-career-hub-web-041204.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Nếu thiếu CORS, URL ký trước vẫn hợp lệ nhưng trình duyệt sẽ chặn upload trực tiếp.

## 3. Biến môi trường backend/Vercel

Chỉ thêm các biến sau vào project API, không thêm vào frontend:

```dotenv
OBJECT_STORAGE_ENABLED=true
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<bucket-access-key-id>
R2_SECRET_ACCESS_KEY=<bucket-secret-access-key>
R2_BUCKET=uit-career-hub-documents
OBJECT_UPLOAD_URL_TTL_SECONDS=600
OBJECT_DOWNLOAD_URL_TTL_SECONDS=300
```

Sau khi cập nhật biến môi trường, redeploy backend và chạy migration `0012_student_document_uploads.sql` trên Neon production.

## 4. Luồng bảo mật

- Chỉ `STUDENT` đã đăng nhập và có `studentProfileId` mới tạo upload intent.
- MVP chỉ nhận PDF, tối đa 10 MB.
- Storage key được backend sinh từ `studentProfileId`, loại tài liệu và UUID; không dùng tên file do người dùng gửi.
- Sau upload, backend đối chiếu MIME, dung lượng và 5 byte chữ ký `%PDF-` trước khi tạo `student_documents`.
- Tài liệu mới ở trạng thái `PENDING`; chưa được dùng trong đơn ứng tuyển cho đến khi UIT xác minh.
- Download chỉ được ký sau khi repository xác nhận tài liệu thuộc sinh viên đang đăng nhập.
- URL ký trước là bearer token; không ghi URL này vào log, database hoặc analytics.

Tài liệu chính thức: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/).

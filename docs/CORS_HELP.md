# Cấu hình CORS cho bucket Viettel IDC S3

## Tại sao cần CORS?

Khi upload trực tiếp từ trình duyệt lên Viettel IDC S3, trình duyệt sẽ gửi **preflight request (OPTIONS)** trước khi PUT. Nếu bucket không cấu hình CORS cho phép origin của bạn, trình duyệt sẽ chặn request và báo lỗi:

```
Lỗi mạng khi upload. Status: 0.
```

Status 0 = request không bao giờ được gửi (bị chặn bởi CORS policy của browser).

## Cấu hình CORS trên Viettel IDC S3

Viettel IDC S3 dùng chuẩn giống AWS S3. Thêm cấu hình CORS vào bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-production-domain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

### Cách áp dụng trên Viettel IDC

Tùy thuộc vào cách quản lý bucket, có 2 cách:

#### Cách 1: Qua S3 Console / Portal của Viettel IDC

Trong phần **Bucket settings → CORS configuration**, paste JSON trên và lưu.

#### Cách 2: Qua AWS CLI

```bash
aws s3api put-bucket-cors \
  --bucket YOUR-BUCKET-NAME \
  --cors-configuration file://cors.json \
  --endpoint-url https://your-endpoint.vcos3.cloudstorage.com.vn
```

File `cors.json`:
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedOrigins": [
        "http://localhost:3000",
        "https://your-production-domain.com"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 86400
    }
  ]
}
```

#### Cách 3: Qua aws-sdk từ Node.js (one-time script)

```js
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "ap-southeast-1",
  endpoint: "https://your-endpoint.vcos3.cloudstorage.com.vn",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

await s3.send(new PutBucketCorsCommand({
  Bucket: "YOUR-BUCKET-NAME",
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["PUT", "GET", "HEAD"],
        AllowedOrigins: ["http://localhost:3000", "https://your-production-domain.com"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 86400,
      },
    ],
  },
}));
```

## Kiểm tra CORS đã đúng chưa

Mở DevTools → Network tab → chọn request PUT đến S3 endpoint → xem có preflight OPTIONS 200 không.

Nếu OPTIONS trả 403 Forbidden → CORS chưa được áp dụng, kiểm tra:
- Origin khớp với `AllowedOrigins` (bao gồm scheme + port)
- Method khớp với `AllowedMethods`
- Bucket name đúng

## Upload trực tiếp từ browser

Sau khi CORS OK, upload flow sẽ là:

```
Client                          Next.js server                Viettel IDC S3
  |                                   |                              |
  | POST /api/uploads/presign         |                              |
  |---------------------------------->|                              |
  |                                   | getSignedUrl(PutObject...)  |
  |<----------------------------------|                              |
  | { uploadUrl, fileKey }            |                              |
  |                                                                    |
  | PUT <uploadUrl> (file body)                                       |
  |--------------------------------------------------------> [S3]    |
  |                                                                    |
  |<-------------------------------------------------------- 200 OK   |
  |                                                                    |
  | POST /api/programs/:id/lessons/:id/confirm-upload                 |
  |---------------------------------->|                              |
  |<----------------------------------|                              |
  | { success: true }                  |                              |
```

Toàn bộ file lớn (vài GB) đi thẳng từ browser lên S3, không qua Next.js → không bị giới hạn body.

## Lưu ý về Content-Length

Khi presign URL, server set `ContentLength` trong `PutObjectCommand`. Client **phải** gửi đúng `Content-Length` (browser tự tính khi dùng `Blob.send()` qua XHR). Đừng custom header `Content-Length` thủ công.

Nếu gặp lỗi `SignatureDoesNotMatch`, kiểm tra:
- `Content-Type` trong request khớp với lúc presign
- Không gắn header `Authorization` khi upload lên S3 (URL đã có chữ ký)

## Giới hạn

- PUT single object: tối đa **5 GB** (Viettel IDC S3 / AWS S3).
- File >5GB: cần **multipart upload** (chia chunk 5–10MB, gửi song song, ghép trên S3).
- Trong app hiện tại đã giới hạn `maxSizeBytes = 5GB` trong response presign.

## Upload qua proxy (BYPASS CORS - MẶC ĐỊNH)

Nếu bạn chưa cấu hình CORS trên bucket và không muốn làm ngay, hệ thống sẽ **tự động upload qua server-side proxy**:

```
Client                          Next.js server                Viettel IDC S3
  |                                   |                              |
  | POST /api/uploads/presign         |                              |
  |---------------------------------->|                              |
  |<----------------------------------|                              |
  | { uploadUrl, fileKey, proxyUrl }  |                              |
  |                                                                    |
  | PUT <proxyUrl> (file body)                                         |
  |---------------------------------->|                              |
  |                                   | PutObject(stream)             |
  |                                   |----------------------------->|
  |                                   |                              |
  |                                   |<----------------------------- 200 OK
  |<----------------------------------|                              |
  | { success: true, etag }           |                              |
```

**Ưu điểm**: Không cần CORS bucket. Chỉ cần S3_ACCESS_KEY_ID/SECRET đúng là upload được.

**Nhược điểm**: File đi qua Next.js nên chậm hơn ~10% và tốn bandwidth server. Với dev/staging thì OK, production nên cấu hình CORS để upload thẳng.

**Cách hoạt động**:
1. Client gọi presign → nhận `proxyUrl: "/api/uploads/s3-proxy?key=...&contentType=..."`.
2. Client PUT trực tiếp tới `proxyUrl` (cùng origin Next.js, không có CORS).
3. Server dùng `@aws-sdk/lib-storage` (`Upload` class) để upload multipart: tự động chia file thành chunks 5MB, tính MD5 cho từng part, gửi song song 4 parts. Không cần SHA256 toàn bộ body, không load vào RAM.

**Lợi ích multipart qua lib-storage**:
- Tự động retry part nếu network giật.
- Upload song song 4 parts → nhanh hơn single PUT.
- KHÔNG throw "Unable to calculate hash for flowing readable stream" (lỗi khi dùng `PutObjectCommand` trực tiếp với stream).
- Hỗ trợ file lớn (vài GB) mà không load toàn bộ vào RAM.
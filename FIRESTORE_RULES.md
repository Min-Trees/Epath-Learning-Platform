# Hướng dẫn deploy Firestore Rules

## Vấn đề
Mặc định Firestore từ chối mọi read/write từ client. Các thao tác dưới đây
sẽ fail với `Missing or insufficient permissions`:
- Seed khóa học qua `/admin/seed-youtube-demo`
- Xóa khóa học qua `/admin/cleanup`
- Cập nhật role user qua `/admin/users`
- Enroll / tạo progress / tạo quizAttempt

## Cách deploy

### Bước 1 — Cài Firebase CLI (chỉ làm 1 lần)
```bash
npm install -g firebase-tools
firebase login
```

### Bước 2 — Deploy rules
```bash
cd "D:\LP & EP IT\EpathSystemTraining"
firebase deploy --only firestore:rules
```

Sau khi deploy thành công, bạn sẽ thấy:
```
✔  firestore: rules released
```

## Nội dung file `firestore.rules`
File này đã được tạo sẵn ở root project, cho phép:

| Collection | Đọc | Ghi |
|------------|-----|-----|
| `users/{uid}` | mọi user đăng nhập | chính user đó + admin |
| `courses` | published + admin + instructor | chỉ admin |
| `courses/{id}/lessons`, `documents`, `quizzes` | mọi người | chỉ admin |
| `quizzes` (top-level) | mọi người | chỉ admin |
| `certificates` | chính user + admin | chỉ admin |
| `progress` | chính user + admin | chính user + admin |
| `quizAttempts` | chính user + admin | user tạo attempt của mình |
| `notifications` | chính user + admin | chỉ admin |
| `ai_knowledge` | mọi người | chỉ admin |

## Nếu bạn muốn dùng nhanh (KHÔNG khuyến nghị cho production)
Mở Firebase Console → Firestore Database → Rules → dán nội dung file
`firestore.rules` → Publish.

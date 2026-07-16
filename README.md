# Epath System Training

Hệ thống đào tạo nhân viên doanh nghiệp toàn diện với Next.js 15, Firebase, và AI.

## Tính năng

### Quản lý Khóa học
- Tạo, chỉnh sửa, xóa khóa học
- Phân loại theo danh mục và cấp độ
- Theo dõi tiến độ học tập
- Hỗ trợ video, tài liệu, quiz

### Quiz & Kiểm tra
- Multiple Choice (chọn một/chọn nhiều)
- True/False (đúng/sai)
- Fill in the Blank (điền từ)
- Timer, random questions, review answers

### Chứng chỉ
- Tự động sinh khi hoàn thành khóa học
- Mã xác minh duy nhất
- Tải PDF

### AI Assistant (Sẵn sàng tích hợp)
- Kiến trúc RAG-ready
- Vector search interface
- Prompt templates

### Quản trị
- Dashboard thống kê
- Quản lý người dùng (phân quyền)
- Quản lý khóa học
- Theo dõi tiến độ

## Tech Stack

### Frontend
- **Next.js 15** - App Router, Server Components
- **TypeScript** - Strict mode
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - UI components
- **React Hook Form** + **Zod** - Form handling
- **TanStack Query** - Data fetching
- **Zustand** - State management

### Backend
- **Firebase Authentication** - Auth
- **Firestore** - Database
- **Firebase Storage** - File storage

### AI (Tương lai)
- **Gemini** / **OpenAI** - LLM
- **Vector Database** - Embeddings

## Cài đặt

### Yêu cầu
- Node.js 18+
- npm / yarn / pnpm
- Firebase project

### 1. Clone và cài đặt dependencies

```bash
git clone <repository-url>
cd epath-system-training
npm install
```

### 2. Cấu hình Firebase

Tạo Firebase project tại [Firebase Console](https://console.firebase.google.com/)

Lấy thông tin cấu hình và tạo file `.env.local`:

```bash
cp .env.example .env.local
```

Điền các giá trị:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key
FIREBASE_ADMIN_CLIENT_EMAIL=your_client_email
```

### 3. Cấu hình Firestore Rules

Sao chép rules từ `firestore-rules/rules.txt` vào Firebase Console.

### 4. Cấu hình Storage Rules

Sao chép rules từ `storage-rules/rules.txt` vào Firebase Console.

### 5. Chạy development server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

## Triển khai

### Vercel (Frontend)

1. Kết nối GitHub repo với Vercel
2. Thêm Environment Variables
3. Deploy

```bash
npm run build
vercel deploy
```

### Firebase (Backend)

```bash
firebase deploy --only firestore:rules,storage:rules
```

## Cấu trúc dự án

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/           # Auth routes
│   ├── (dashboard)/       # Protected routes
│   ├── admin/            # Admin panel
│   └── api/              # API routes
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── layout/           # Layout components
│   └── features/         # Feature components
├── hooks/                # Custom hooks
├── lib/
│   └── firebase/         # Firebase config
├── services/             # Business logic
├── stores/               # Zustand stores
├── types/                # TypeScript types
└── utils/                # Utilities
```

## Firestore Collections

| Collection | Mô tả |
|------------|--------|
| `users` | Thông tin người dùng |
| `courses` | Khóa học |
| `lessons` | Bài học |
| `documents` | Tài liệu |
| `quizzes` | Bài kiểm tra |
| `quizAttempts` | Kết quả quiz |
| `progress` | Tiến độ học |
| `certificates` | Chứng chỉ |
| `notifications` | Thông báo |
| `ai_knowledge` | Knowledge base |

## Phân quyền

| Role | Quyền |
|------|--------|
| `admin` | Toàn quyền |
| `hr` | Quản lý nhân sự, khóa học |
| `trainer` | Tạo/chỉnh sửa khóa học |
| `employee` | Học tập, xem chứng chỉ |

## Mở rộng trong tương lai

### AI Features
- RAG-based Q&A
- Course recommendations
- Smart quiz generation
- Personalized learning paths

### Integrations
- SSO (Azure AD, Google Workspace)
- Slack/Teams notifications
- HRIS integration
- Video conferencing

### Analytics
- Learning analytics dashboard
- Skill gap analysis
- Certification tracking
- Compliance reporting

## License

MIT License

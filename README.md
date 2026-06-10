# Hung Tran Finance

Ứng dụng web quản lý tài chính cá nhân — theo dõi thu/chi, số dư ví, cho mượn và báo cáo theo kỳ. Giao diện tiếng Việt, đăng nhập Google qua Firebase.

**Repo:** [github.com/hungtran1811/expense-tracker](https://github.com/hungtran1811/expense-tracker)

## Tính năng chính

| Tab | Mô tả |
|-----|--------|
| **Tổng quan** (`#home`) | Lưới số dư ví, thu/chi hôm nay, tóm tắt tháng, lọc theo tài khoản, dòng tiền theo ngày |
| **Chi tiêu** (`#expenses`) | Sổ giao dịch (chi / thu / chuyển / sửa số dư), bộ lọc, xuất CSV; sub-tab Quản lý: tài khoản & nhóm chi |
| **Cho mượn** (`#loans`) | Theo dõi công nợ, ghi nhận cho mượn & nhận trả |
| **Báo cáo** (`#reports`) | KPI kỳ, breakdown danh mục / nhóm chi / tài khoản; preset Tháng này / Tháng trước |

Phím tắt nhanh trên Tổng quan & Chi tiêu: `C` (chi), `I` (thu), `T` (chuyển).

## Công nghệ

- **Frontend:** Vite 7, vanilla JS (ES modules), Bootstrap 5
- **Backend / dữ liệu:** Firebase Auth (Google), Cloud Firestore
- **Deploy:** Netlify (static `dist/` + serverless functions cho AI tuỳ chọn)
- **Font:** Plus Jakarta Sans

## Yêu cầu

- Node.js 20+
- npm 10+
- Dự án Firebase (Auth + Firestore)
- (Tuỳ chọn) [Netlify CLI](https://docs.netlify.com/cli/get-started/) khi test functions local

## Cài đặt

```bash
git clone https://github.com/hungtran1811/expense-tracker.git
cd expense-tracker
npm install
```

Sao chép biến môi trường:

```bash
cp .env.example .env
```

Điền giá trị Firebase vào `.env` (file này **không** được commit — đã nằm trong `.gitignore`).

## Chạy local

```bash
# Chỉ frontend (Vite, port 5173)
npm run dev

# Frontend + Netlify Functions (khuyến nghị khi test AI)
npm run dev:netlify
```

Build production:

```bash
npm run build
npm run preview   # xem thử bản build
```

## Kiểm tra chất lượng

```bash
npm run check:i18n      # UTF-8 / copy tiếng Việt
npm run check:smoke     # shell HTML & file bắt buộc
npm run check:baseline  # i18n + build + smoke (gate trước release)
```

Checklist thủ công: [`docs/qa/smoke-checklist.vi.md`](docs/qa/smoke-checklist.vi.md)

## Biến môi trường

### Frontend (Vite — prefix `VITE_`)

| Biến | Mô tả |
|------|--------|
| `VITE_FB_API_KEY` | Firebase Web API key |
| `VITE_FB_AUTH_DOMAIN` | Auth domain |
| `VITE_FB_PROJECT_ID` | Project ID |
| `VITE_FB_STORAGE_BUCKET` | Storage bucket |
| `VITE_FB_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FB_APP_ID` | App ID |
| `VITE_NETLIFY_BASE_URL` | Base URL Netlify (tuỳ chọn) |

### Netlify Functions (AI — không commit)

| Biến | Mô tả |
|------|--------|
| `GEMINI_API_KEY` | Google Gemini (gợi ý danh mục / insight báo cáo) |
| `FIREBASE_WEB_API_KEY` | Verify Firebase ID token phía server |
| `AI_RATE_LIMIT_MAX` | Giới hạn request (mặc định `12`) |
| `AI_RATE_LIMIT_WINDOW_MS` | Cửa sổ rate limit (mặc định `60000`) |
| `AI_TOKEN_CACHE_TTL_MS` | Cache token (mặc định `300000`) |
| `AI_GUARD_DISABLED` | Chỉ debug local — **không** bật production |

Chi tiết mẫu: [`.env.example`](.env.example)

## Firestore

- Dữ liệu theo user: `users/{uid}/...` (accounts, transactions, expenseScopes, loanParties, …)
- Rules: [`firestore.rules`](firestore.rules) — mỗi user chỉ đọc/ghi dữ liệu của mình

Triển khai rules (Firebase CLI):

```bash
firebase deploy --only firestore:rules
```

## Cấu trúc thư mục (rút gọn)

```
src/
  app/           # bootstrap, router, shortcuts
  features/      # home, finance, loans, reports
  services/      # firebase (auth, firestore)
  shared/        # copy, constants, UI helpers
  styles/        # app.css
netlify/
  functions/     # ai-categorize, ai-report-insights
docs/
  qa/            # smoke checklist
  plans/         # UI roadmap theo trang
public/img/      # logo, favicon
```

## Deploy (Netlify)

1. Kết nối repo GitHub với Netlify.
2. Build command: `npm run build` — Publish directory: `dist` (đã cấu hình trong [`netlify.toml`](netlify.toml)).
3. Thêm biến môi trường trên Netlify (Vite + Functions).
4. Sau deploy, chạy lại smoke checklist trên production.

## Ghi chú

- Route cũ (`#overview`, `#dashboard`, …) tự redirect về tab hiện tại.
- Không commit `.env`, `node_modules/`, `dist/`, `.netlify/` — xem [`.gitignore`](.gitignore).

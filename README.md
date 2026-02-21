# NEXUS OS

Workspace cá nhân hóa cho Hưng Trần: quản lý tài chính, mục tiêu/thói quen, kế hoạch video YouTube và lịch video tuần-tháng.

## 1) Yêu cầu môi trường
- Node.js 20+
- npm 10+
- Tài khoản Firebase (Auth + Firestore)
- (Tùy chọn) Netlify CLI: `npm i -g netlify-cli`

## 2) Cài đặt nhanh
```bash
npm install
```

Tạo file `.env.local` từ `.env.example` và điền đầy đủ biến.

## 3) Chạy local
- Chạy Vite thuần:
```bash
npm run dev
```
- Chạy qua Netlify Dev (khuyến nghị khi test AI functions):
```bash
npm run dev:netlify
```

## 4) Các gate chất lượng
```bash
npm run check:i18n
npm run build
npm run check:smoke
npm run check:baseline
```

`check:baseline` là gate chuẩn trước khi commit/release.

## 5) Biến môi trường
Frontend (Vite):
- `VITE_FB_API_KEY`
- `VITE_FB_AUTH_DOMAIN`
- `VITE_FB_PROJECT_ID`
- `VITE_FB_STORAGE_BUCKET`
- `VITE_FB_MESSAGING_SENDER_ID`
- `VITE_FB_APP_ID`
- `VITE_NETLIFY_BASE_URL` (tùy chọn)

Backend function (Netlify):
- `GEMINI_API_KEY`
- `FIREBASE_WEB_API_KEY` (dùng để verify Firebase ID token server-side)
- `AI_RATE_LIMIT_MAX` (mặc định `12`)
- `AI_RATE_LIMIT_WINDOW_MS` (mặc định `60000`)
- `AI_TOKEN_CACHE_TTL_MS` (mặc định `300000`)
- `AI_GUARD_DISABLED` (chỉ bật local debug, không bật production)

## 6) Quy ước release RC
1. Chạy `npm run check:baseline`.
2. Commit theo scope sprint.
3. Tag release:
```bash
git tag -a nexus-os-phase-2.8-rc1 -m "NEXUS OS Phase 2.8 RC1"
```
4. Push branch + tag.
5. Merge vào `main` để Netlify deploy.

## 7) Rollback nhanh
- Re-deploy tag/commit ổn định gần nhất trên Netlify.
- Sau rollback, chạy lại checklist trong `docs/qa/smoke-checklist.vi.md`.

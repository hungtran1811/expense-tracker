# Hung Tran Finance (React + TypeScript)

Ứng dụng quản lý chi tiêu cá nhân: **Vite + React + TypeScript + Firebase Auth/Firestore** (web / PWA).

## Khái niệm chính

- **Ví (`accountId`)**: nơi giữ tiền (tiền mặt, ngân hàng, ví điện tử…).
- **Nguồn tiền (`moneyOwner`)**: `personal` | `mother` | `unassigned` — phân tích hai dòng tiền.
- Hai khái niệm độc lập; không suy nguồn tiền từ tên ví.

## Đã có

- Tổng quan hai board (tôi / mẹ), sổ chi tiêu, báo cáo so sánh, cho mượn (gốc + lãi), quản lý ví/nhóm/danh mục/ngân sách/định kỳ/tiết kiệm
- Modal xác nhận trong app, PWA shell (`public/sw.js`, manifest)
- Nhập nhanh (mẫu chi, nhân bản, `50tr`/`500k`), nhắc nợ 30 ngày, recurring tự tạo, góp tiết kiệm, gợi ý danh mục, in/PDF báo cáo
- Đăng nhập Google hoặc email/mật khẩu

## Chưa làm / cố ý cắt

- Multi-user / chia sẻ gia đình
- Đóng gói desktop/Android (chỉ dùng web)

## Chạy local

```bash
npm install
npm run dev
```

Cần `.env.local` với các biến `VITE_FB_*` (xem `.env.example`).

## Scripts

- `npm run build` — typecheck + production build
- `npm run check:smoke` — smoke shell React
- `npm run check:unit` — unit nhẹ (parse amount / helpers)
- `npm run check:baseline` — build + smoke + unit

## Cấu trúc

- `src/app` — router, auth, layout, workspace
- `src/features` — home, expenses, reports, loans, manage
- `src/services/firebase` — Auth + Firestore ledger (`ledgerApi.ts` typed wrappers)
- `legacy/` — bản Vanilla JS (tham khảo)

## Deploy web

Netlify: `npm run build`, publish `dist`, SPA fallback `public/_redirects`. PWA đăng ký SW ở production.

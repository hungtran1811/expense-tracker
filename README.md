# Hung Tran Finance (React + TypeScript)

Ứng dụng quản lý chi tiêu cá nhân: **Vite + React + TypeScript + Firebase Auth/Firestore**.

## Khái niệm chính

- **Ví (`accountId`)**: nơi giữ tiền (tiền mặt, ngân hàng, ví điện tử…).
- **Nguồn tiền (`moneyOwner`)**: `personal` | `mother` | `unassigned` — phân tích hai dòng tiền.
- Hai khái niệm độc lập; không suy nguồn tiền từ tên ví.

## Đã có

- Tổng quan hai board (tôi / mẹ), sổ chi tiêu, báo cáo so sánh, cho mượn (gốc + lãi), quản lý ví/nhóm/danh mục/ngân sách/định kỳ/tiết kiệm
- Modal xác nhận trong app, PWA shell (`public/sw.js`, manifest)
- Đóng gói: **Android (Capacitor)** + **Windows Desktop (Electron)**
- Nhập nhanh (mẫu chi, nhân bản, `50tr`/`500k`), nhắc nợ 30 ngày, recurring tự tạo, góp tiết kiệm, gợi ý danh mục, in/PDF báo cáo

## Chưa làm / cố ý cắt

- Multi-user / chia sẻ gia đình
- Đăng Play Store / Microsoft Store (v1: APK / `.exe` cài tay)
- iOS (cần Mac)

## Chạy local (web)

```bash
npm install
npm run dev
```

Cần `.env.local` với các biến `VITE_FB_*` (xem `.env.example`).

## Tải bản đóng gói (v2.0.1)

Trong app: [https://hungtran.netlify.app/downloads](https://hungtran.netlify.app/downloads) (nút **Tải app** trên thanh trên, hoặc link ở màn đăng nhập).

File binary nằm ở `public/downloads/` khi deploy (không commit vào git). Bản build local cũng copy sang `release/downloads/`.

Lưu ý desktop: Vite phải dùng `base: "./"` (chỉ giữ `vite.config.ts`, không để `vite.config.js` ghi đè) — nếu không Electron/`file://` sẽ màn hình trắng.

Android APK debug: build bằng `npm run build:android` rồi `cd android && .\\gradlew.bat assembleDebug` (cần **JDK 21** + Android SDK API 35).

## Đóng gói Desktop (Windows)

```bash
npm run build:desktop
```

File cài đặt mặc định ở `release/desktop/` (bản copy tải về nằm ở `release/downloads/`). Nếu gặp lỗi `EPERM` khi đóng gói, tắt tạm Windows Defender/antivirus đang quét thư mục `release/`, rồi chạy lại — hoặc chạy thử không installer:

```bash
npm run build
npx electron .
```

Dev desktop:

```bash
npm run dev:desktop
```

Trong Electron/Capacitor, đăng nhập Google dùng **redirect** (không dùng popup).

## Đóng gói Android (Capacitor)

Cần [Android Studio](https://developer.android.com/studio) + JDK.

```bash
npm run build:android
npm run android:open
```

Trong Android Studio: Run / Build APK. Project native: thư mục `android/`.

Firebase Console: thêm authorized domain / cấu hình OAuth phù hợp `appId` `com.hungtran.finance` khi test đăng nhập trên thiết bị.

## Scripts

- `npm run build` — typecheck + production build
- `npm run check:smoke` — smoke shell React
- `npm run check:unit` — unit nhẹ (parse amount / helpers)
- `npm run check:baseline` — build + smoke + unit
- `npm run build:desktop` — Electron Windows installer
- `npm run build:android` — sync Capacitor Android

## Cấu trúc

- `src/app` — router, auth, layout, workspace
- `src/features` — home, expenses, reports, loans, manage
- `src/services/firebase` — Auth + Firestore ledger (`ledgerApi.ts` typed wrappers)
- `electron/` — Electron main/preload
- `android/` — Capacitor Android project
- `legacy/` — bản Vanilla JS (tham khảo)

## Deploy web

Netlify: `npm run build`, publish `dist`, SPA fallback `public/_redirects`. PWA đăng ký SW ở production (không đăng ký trong native shell).

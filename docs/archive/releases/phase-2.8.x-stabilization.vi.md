# NEXUS OS — Phase 2.8.x Stabilization

## Mục tiêu
Khóa ổn định sau RC 2.8 trước khi mở phase mới: bảo mật AI endpoint, giảm read cost Firestore cho số dư tài khoản, dọn nợ kỹ thuật và chuẩn hóa onboarding.

## Các thay đổi chính

### 1) Bảo mật AI endpoint (P0)
- Thêm guard dùng chung: `netlify/utils/aiGuard.js`.
- Áp dụng cho các function:
- `netlify/functions/ai-categorize.js`
- `netlify/functions/ai-goal-suggest.js`
- `netlify/functions/ai-video-copilot.js`
- `netlify/functions/ai-report-insights.js`
- Chuẩn hóa lỗi:
- `401` khi chưa có bearer token.
- `403` khi token không hợp lệ/hết hạn.
- `429` khi vượt ngưỡng rate-limit theo `uid + route`.
- Chuẩn CORS response cho luồng AI.

### 2) Client AI gọi function có token
- `src/services/api/netlifyClient.js`:
- tự đính kèm `Authorization: Bearer <idToken>`.
- chuẩn hóa thông báo lỗi tiếng Việt theo `401/403/429/timeout`.
- fallback endpoint local vẫn giữ như cũ.
- `src/services/firebase/auth.js`:
- thêm `getCurrentIdToken(forceRefresh)`.

### 3) Tối ưu số dư tài khoản (P0)
- `src/services/firebase/firestore.js`:
- thêm cache số dư theo `uid` (`BALANCE_CACHE_TTL_MS`).
- `balancesByAccountTotal(uid, options)` ưu tiên trả từ cache, chỉ full-scan khi cần.
- update delta cache ngay khi tạo/sửa/xóa `income/expense/transfer`.
- invalid cache khi `deleteAccountWithReassign`.
- `src/features/accounts/accounts.controller.js`:
- `refreshBalances(uid, preloadedAccounts, options)` giảm query lặp.
- sau add/edit/delete account dùng lại `accounts` đã tải để refresh số dư.

### 4) i18n consistency + dead code cleanup
- `src/features/accounts/accounts.controller.js` chuyển toast/validation sang constants (`copy.vi.js`).
- Dọn module không dùng:
- `src/services/api/aiVideoTip.js`
- `netlify/functions/ai-video-tip.js`
- `src/app/routes.js`
- `src/app/state.js`
- `src/shared/ui/dom.js`
- `src/shared/ui/format.js`
- `src/shared/ui/loading.js`
- `src/shared/ui/toast.js`

### 5) QA/tooling/docs
- `scripts/check-i18n.js` mở rộng phạm vi quét:
- `src`
- `netlify/functions`
- `netlify/utils`
- `docs/qa`
- `docs/releases`
- `index.html`
- `README.md`
- `.env.example`
- Thêm smoke nhẹ: `scripts/smoke-lite.js`.
- `package.json` thêm `check:smoke` và cập nhật `check:baseline`.
- Thêm onboarding:
- `README.md`
- `.env.example`

## Lưu ý vận hành
- Trên môi trường production phải cấu hình đủ:
- `GEMINI_API_KEY`
- `FIREBASE_WEB_API_KEY`
- Nếu thiếu, AI endpoint sẽ trả lỗi server hoặc từ chối xác thực.
- Rate-limit hiện là in-memory theo instance (best-effort), đủ cho lớp bảo vệ cơ bản.

## Gate phát hành
```bash
npm run check:i18n
npm run build
npm run check:smoke
npm run check:baseline
```

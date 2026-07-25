# NEXUS OS — Phase 2.9 Perf RC

## Mục tiêu
Tối ưu frontend theo hướng an toàn, không đổi nghiệp vụ, tập trung giảm kích thước chunk JS chính.

## Baseline trước tối ưu
- Build trước 2.9: chunk JS chính khoảng `~518KB` (minified).

## KPI đã khóa
- Mục tiêu chính: `chunk JS chính <= 400KB`.
- Fallback cho patch tiếp theo: `<= 450KB` nếu có blocker ngoài sprint.

## Thay đổi kỹ thuật chính
1. Thêm `src/app/moduleLoader.js` để lazy-load theo route và cache module.
2. Bootstrap chuyển một phần import eager sang lazy-load:
- Dashboard modules
- Weekly Review modules
- AI services modules
3. Route sync preload module theo route hiện hành.
4. Vite `manualChunks` để tách:
- `vendor-firebase`
- `vendor`
- `feature-dashboard`
- `feature-weekly-review`
- `feature-ai-services`

## Regression contract
- Route/hash public: không đổi.
- Firestore schema: không đổi.
- Hành vi user-facing chính: không đổi.

## Gate bắt buộc
```bash
npm run check:i18n
npm run build
npm run check:smoke
npm run check:baseline
```

## Kết quả đo sau tối ưu
- Kết quả build hiện tại:
- `assets/index-CoFltJYf.js`: `107.76KB` (PASS KPI `<= 400KB`).
- `assets/vendor-CMBpX6uC.js`: `339.97KB`.
- `assets/feature-dashboard-*.js`: `33.88KB`.
- `assets/feature-weekly-review-*.js`: `33.38KB`.
- `assets/feature-ai-services-*.js`: `9.13KB`.

## Gợi ý vận hành
- Ưu tiên kiểm tra manual các route:
- `#dashboard`, `#expenses`, `#goals`, `#video-plan`, `#weekly-review`, `#accounts`, `#settings`
- Kiểm tra AI action sau lazy-load:
- gợi ý nhãn chi tiêu
- video copilot
- goal copilot

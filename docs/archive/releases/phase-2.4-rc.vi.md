# NEXUS OS — Phase 2.4 RC (Creator Action Board)

## Phạm vi
- Dashboard-first cho workflow creator.
- Giữ route/hash hiện tại.
- Giữ schema Firestore hiện tại.
- Không bật lại Reports/AI.

## Thay đổi chính
- Thêm khối `Bảng hành động hôm nay` trên `#dashboard`:
  - Việc kế tiếp (`#dashNextActions`)
  - Cận hạn 72 giờ (`#dashDeadline72h`)
  - Tóm tắt hành động (`#dashActionSummary`)
- Mở rộng priority engine từ Habit + Video.
- Thêm quick action ngữ cảnh:
  - `#btnDashQuickCheckIn`
  - `#btnDashQuickDeadline`
- Tách event dashboard sang module mới:
  - `src/features/dashboard/dashboard.events.js`
- Giảm trách nhiệm dashboard trong `src/app/bootstrap.js` theo hướng orchestration.

## Bổ sung sau RC1 — Settings Hub
- Triển khai đầy đủ route `#settings` theo mô hình 3 tab:
  - Hồ sơ cá nhân
  - Tùy chọn Dashboard
  - Bộ lọc & Hiển thị
- Thêm autosave realtime (debounce 700ms + lưu ngay khi blur text dài) với trạng thái:
  - `Đang lưu...`
  - `Đã lưu lúc HH:mm`
  - `Lưu thất bại`
- Mở rộng contract `users/{uid}` với:
  - `profile.*`
  - `preferences.dashboard.*`
  - `preferences.filters.*`
  - `preferences.ui.*`
- Nối settings vào runtime:
  - `nextActionsMax`, `deadlineWindowHours`, `startRoute`
  - `monthMode`, `lastMonth`, `remember*Filters`
  - `ui.density`

## Gate xác nhận
- `npm run check:i18n`
- `npm run build`
- `npm run check:baseline`

## Regression cần pass
- Auth login/logout.
- CRUD expense/income/account/transfer.
- Goals habit lock theo target kỳ.
- Video create/edit/delete/move stage + XP rule.
- Dashboard balances realtime (`nexus:balances-updated`).

## Ghi chú
- Tài liệu smoke test cập nhật tại `docs/qa/smoke-checklist.vi.md`.

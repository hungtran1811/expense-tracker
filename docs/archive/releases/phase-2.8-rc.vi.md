# NEXUS OS - Phase 2.8 RC (Video Plan Calendar)

## 1) Tóm tắt bản phát hành
Phase 2.8 RC tập trung khóa chất lượng cho `#video-plan` với chế độ `Bảng/Lịch`, nhắc việc in-app, và hardening runtime trước khi mở rộng tính năng mới.

Phạm vi giữ nguyên:
- Không đổi route/hash công khai.
- Không đổi schema Firestore nghiệp vụ.
- Không bật lại `reports/ai`.

## 2) Điểm nổi bật
- Thêm UI chuyển đổi `Bảng/Lịch` ngay trong `#video-plan`.
- Thêm calendar month/week + agenda theo ngày + bucket `Chưa lên lịch`.
- Đồng bộ reminder giữa dashboard và video-plan.
- Mở nhanh công việc từ dashboard qua event `nexus:video-focus`.
- Lưu state lịch cục bộ với key `nexus_video_calendar_v1`.

## 3) Runtime hardening đã thực hiện
- Khóa lifecycle event cho:
- `videoViewBoard`, `videoViewCalendar`
- `btnVideoCalPrevMonth`, `btnVideoCalNextMonth`, `btnVideoCalToday`
- click date cell và open công việc từ agenda/unscheduled
- listener `nexus:video-focus`
- Null-safety cho:
- `selectedDate/monthAnchor` không hợp lệ
- công việc không tồn tại khi focus từ quick action
- dữ liệu lịch rỗng

## 4) i18n/Copy
- Chuẩn hóa wording tiếng Việt cho calendar/reminder.
- Loại bỏ wording lẫn tiếng Anh trong phần mới.
- Không còn hardcode text mới ngoài constants ở runtime path chính (phạm vi phase 2.8).

## 5) Responsive
- Hardening cho 3 breakpoint:
- `<=767px`
- `768-991px`
- `>=992px`
- Khóa overflow ngang cho month grid/week strip/agenda/action group.

## 6) QA/Gate kết quả
- `npm run check:i18n`: PASS
- `npm run build`: PASS
- `npm run check:baseline`: PASS

Checklist smoke tương ứng: `docs/qa/smoke-checklist.vi.md`

## 7) Known limitations
- Chưa hỗ trợ drag-drop trực tiếp trên lưới tháng của calendar.
- Deadline không có giờ được xử lý là hạn cuối ngày local.
- Quick action mở task đã bị xóa sẽ fail-safe (không crash), không có toast riêng.

## 8) Rollback notes
Nếu cần rollback nhanh phase 2.8:
1. Revert các file chính của calendar/dashboard reminder:
- `index.html`
- `src/app/bootstrap.js`
- `src/features/videoPlan/videoPlan.ui.js`
- `src/features/videoPlan/videoPlan.controller.js`
- `src/features/dashboard/dashboard.ui.js`
- `src/features/dashboard/dashboard.controller.js`
- `src/styles/app.css`
- `src/shared/constants/copy.vi.js`
- `src/shared/utils/date.js`
2. Chạy lại gate `npm run check:baseline`.

## 9) Đề xuất mốc tag RC
`nexus-os-phase-2.8-rc1`

## 10) Nhịp vận hành sau release
### Hằng ngày (10-15 phút)
1. Mở production và chạy quick smoke:
- đăng nhập
- `#dashboard` + quick action
- `#video-plan` đổi `Bảng/Lịch`
- `#settings` autosave
2. Kiểm tra console/browser không có lỗi mới.
3. Nếu lỗi nhẹ: ghi backlog patch `2.8.x`.
4. Nếu lỗi nặng: rollback theo mục 8.

### Hằng tuần
1. Chạy full checklist `docs/qa/smoke-checklist.vi.md`.
2. Chạy lại gate local:
- `npm run check:i18n`
- `npm run build`
- `npm run check:baseline`
3. Tổng hợp issue để lên patch release `2.8.x`.

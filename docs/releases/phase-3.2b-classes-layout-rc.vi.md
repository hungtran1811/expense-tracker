# NEXUS OS — Phase 3.2B Classes Layout RC

## Phạm vi phát hành
- Tách danh sách lớp thành 2 tab: `Đang dạy` / `Đã hoàn thành`.
- Tự động chuyển lớp sang `Hoàn thành` khi đủ `14/14` buổi `done`.
- Bổ sung thao tác `Mở lại lớp` cho lớp đã hoàn thành.
- Bổ sung thao tác `Dời sang tuần kế` cho buổi `planned`, dời theo chuỗi các buổi planned phía sau.
- Marker hiển thị buổi đã dời: `Đã dời từ dd/mm`.
- Dashboard widget lớp học chỉ lấy lớp `active`.

## Điểm kỹ thuật chính
- Firestore:
  - Auto recompute progress + status trong `syncClassProgress`.
  - API mới: `shiftClassSessionNextWeek(uid, classId, sessionId, reason)`.
  - Lưu metadata dời buổi: `rescheduledAt`, `rescheduledFrom`, `rescheduleReason`.
- UI:
  - IDs mới: `classesListTabActive`, `classesListTabCompleted`, `btnShiftSessionNextWeek`, `btnReopenClass`.
  - Trạng thái tab classes lưu local: `nexus_classes_list_tab_v1`.

## Checklist xác nhận trước deploy
- `npm run check:i18n`
- `npm run build`
- `npm run check:smoke`
- `npm run check:baseline`

## Known limitations
- Dời buổi chỉ áp dụng cho session `planned`.
- Nếu đã có session `done` phía sau session mục tiêu thì chặn dời để tránh phá lịch sử.
- Tab `Đã hoàn thành` là chế độ read-first; muốn chỉnh lại cần bấm `Mở lại lớp`.

## Rollback
- Rollback về tag ổn định gần nhất trước Phase 3.2B.
- Sau rollback, chạy lại smoke checklist route chính và `#classes`.

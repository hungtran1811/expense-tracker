# NEXUS OS - Smoke Checklist Phase 2.8 (Video Plan Calendar RC)

## 1) Gate bắt buộc
- Chạy `npm run check:i18n`.
- Chạy `npm run build`.
- Chạy `npm run check:baseline`.
- Xác nhận không có lỗi console mới ở thao tác chính.

## 2) Video Plan - Chế độ Bảng/Lịch
- Mở `#video-plan`, chuyển `Bảng -> Lịch -> Bảng` liên tục ít nhất 10 lần.
- Xác nhận không phát sinh duplicate event handler.
- Xác nhận bộ lọc (`giai đoạn`, `ưu tiên`, `tìm nhanh`) vẫn hoạt động khi ở cả hai chế độ.

## 3) Video Calendar - Điều hướng thời gian
- Bấm `Tháng trước`, `Tháng sau`, `Hôm nay` và kiểm tra:
- `videoCalendarMonthLabel` cập nhật đúng.
- `videoCalendarGrid` và `videoCalendarWeekStrip` cập nhật đúng dữ liệu.
- Bấm chọn ngày trong lưới/thanh tuần:
- `videoCalendarAgenda` đổi theo ngày đã chọn.
- Reload trang giữ lại `viewMode`, `selectedDate`, `monthAnchor` từ `nexus_video_calendar_v1`.

## 4) Video Calendar - Mapping dữ liệu
- Task có `deadline` phải hiển thị đúng ngày trên lịch.
- Task không có `deadline` phải vào `videoUnscheduledList`.
- Agenda hiển thị đúng thứ tự ưu tiên:
- quá hạn trước,
- sau đó đến hạn gần,
- rồi theo mức ưu tiên/tên.

## 5) Nhắc việc in-app (Dashboard <-> Video Plan)
- Trên `#dashboard`, kiểm tra badge nhắc việc:
- Quá hạn,
- Hôm nay,
- Cận hạn.
- Bấm quick action mở công việc từ dashboard:
- điều hướng đúng `#video-plan`,
- focus đúng thẻ công việc (nếu có),
- không lỗi khi task không còn tồn tại.

## 6) Regression nghiệp vụ chính
- Auth login/logout hoạt động bình thường.
- CRUD expense/income/account/transfer không regress.
- Goals/Habits:
- Habit `target=1` vẫn khóa lần tick thứ 2 trong cùng kỳ.
- Video:
- create/edit/delete/move stage hoạt động đúng.
- XP rule khi move/publish không đổi.
- Settings:
- autosave vẫn hoạt động,
- `startRoute` không regress,
- remember filters không regress.

## 7) Responsive
- `<=767px`:
- Không tràn ngang ở `#video-plan`.
- Month grid/week strip/agenda/unscheduled thao tác được.
- Action button wrap đúng, không đè nhau.
- `768-991px`:
- Calendar và board co giãn ổn định.
- `>=992px`:
- Layout ổn định, không jump bất thường khi mở offcanvas.

## 8) i18n/UTF-8
- Toàn bộ text mới ở dashboard/video-plan hiển thị tiếng Việt có dấu.
- Không còn wording lẫn tiếng Anh ở phần calendar/reminder.
- Không xuất hiện chuỗi lỗi encoding (mojibake).

## 9) Known limitations (ghi nhận trước RC)
- Ứng dụng hiện chưa tích hợp drag-drop trực tiếp trong month grid calendar.
- Hạn không có giờ được xử lý là cuối ngày local (23:59).
- Không có thông báo riêng khi mở quick action vào task đã bị xóa, chỉ bỏ qua an toàn.

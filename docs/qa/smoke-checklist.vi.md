# NEXUS OS - Smoke Checklist Phase 2.8 (Video Plan Calendar RC)

## 0) Vận hành nhanh hằng ngày (10-15 phút)
- Mở production, đăng nhập và đi qua nhanh:
- `#dashboard` (quick action + badge nhắc việc)
- `#video-plan` (đổi `Bảng/Lịch`, mở 1 công việc từ agenda)
- `#settings` (xác nhận autosave không lỗi)
- Kiểm tra console không có lỗi đỏ mới.
- Nếu fail ở bất kỳ bước nào:
- Ghi issue vào backlog `2.8.x` với ảnh + bước tái hiện.

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

## 10) Ổn định 2.8.x (bổ sung sau RC)
- AI endpoint bảo mật:
- gọi AI khi chưa đăng nhập phải nhận lỗi `401`.
- đăng nhập hợp lệ, gọi AI bình thường.
- bấm AI liên tục vượt ngưỡng phải nhận `429`.
- Tối ưu số dư tài khoản:
- sau `add/edit/delete income` số dư cập nhật đúng.
- sau `add/edit/delete expense` số dư cập nhật đúng.
- sau `transfer` số dư 2 tài khoản thay đổi đúng.
- thao tác lặp trong cùng phiên không gây full refresh nặng bất thường.
- i18n gate mở rộng:
- `npm run check:i18n` phải quét cả `src`, `netlify/functions`, `docs/releases`, `docs/qa`, `index.html`.

## 11) Performance Gate (Phase 2.9)
- Chạy `npm run build` và ghi lại size chunk JS chính từ output.
- Xác nhận KPI pass: chunk JS chính `<= 400KB`.
- Nếu chưa đạt, ghi rõ mức hiện tại và tạo backlog patch `2.9.x-p1`.
- Test lazy-load:
- vào `#dashboard` lần đầu không lỗi console.
- vào `#weekly-review` lần đầu không lỗi console.
- bấm AI ở expenses/video/goals vẫn hoạt động đúng sau khi lazy-load module.
- Test chuyển route liên tục (`dashboard -> video-plan -> goals -> weekly-review -> dashboard`) ít nhất 10 vòng, không duplicate event handler.

## 12) Creator Ops Lite (Phase 3.0)
- Video retro:
- Mở panel `Kết quả xuất bản` từ card video.
- Lưu `publishedAt`, `durationSec`, `views`, `ctr`, `retention30s`, `note` thành công.
- Reload trang, dữ liệu retro vẫn còn.
- Filter `Trạng thái kết quả`:
- `Tất cả` hiển thị đầy đủ.
- `Đã ghi kết quả` chỉ hiện task có retro.
- `Chưa ghi kết quả` chỉ hiện task chưa retro.
- Blueprint workflow:
- Chọn `Ngôn ngữ` + `Loại template`, danh sách template cập nhật đúng.
- `Áp dụng template` điền đúng `title/shotList/note/videoType`.
- `Lưu template` từ form thành công và xuất hiện sau reload.
- AI video copilot v3:
- `Generate` và `Improve` trả đúng 3 phương án có `title/hook/outline/shotList/cta/videoType`.
- `Áp dụng` điền form đúng mapping.
- `Lưu thành template` từ option AI hoạt động.
- Cooldown:
- Khi request thành công, nút AI vào cooldown 8s.
- Khi request lỗi, có thể bấm lại ngay, không bị kẹt loading.
- Weekly review:
- Có card `Hiệu suất video tuần`.
- Hiển thị đúng `videosPublished/totalViews/avgCtr/avgRetention30s/avgDurationSec`.
- Insight rule-based thay đổi theo dữ liệu (CTR thấp, retention thấp, sản lượng publish thấp).

## 13) UX Polish Video Plan (Phase 3.0A)
- Chụp baseline trước/sau ở 3 breakpoint: `<=767`, `768-991`, `>=992`.
- Kiểm tra khu đầu trang `#video-plan`:
- Tiêu đề + mô tả + form tạo mới đọc nhanh trong 3-5 giây.
- Nhóm nút AI/template/thêm công việc không bị rối hoặc chồng lấn.
- Kiểm tra card công việc ở chế độ `Bảng`:
- Dòng 1: tiêu đề + ưu tiên.
- Dòng 2: giai đoạn + hạn.
- Dòng 3: badge kết quả + ghi chú + hành động.
- Click vào thân card mở panel sửa nhanh đúng task.
- Kiểm tra khu `Lịch`:
- Click item trong `Lịch theo ngày` hoặc `Chưa lên lịch` mở đúng panel sửa.
- Điều hướng tháng/ngày vẫn ổn định, không nhân đôi event.
- Kiểm tra bộ lọc:
- `Tìm nhanh` debounce mượt, không lag khi gõ liên tục.
- `Đặt lại` đưa filter về mặc định và focus vào ô tìm nhanh.
- Xác nhận không có text mới hardcode sai nguồn: các nhãn mới đi qua `copy.vi.js`.

## 14) Weekly Review (Bản tối giản)
- Vào `#weekly-review`:
- Chỉ còn các khối tổng kết tuần phục vụ lập kế hoạch (tài chính, mục tiêu/thói quen, video tuần này, động lực, lịch sử review).
- Không còn hiển thị các khối hiệu suất video tuần (`wrVideoPerformance*`, `wrPerf*`).
- Chuyển tuần trong `wrHistoryList` vẫn hoạt động, không lỗi console.
- Dashboard:
- Card đầu tiên là `Số dư tài khoản` (ID `dashboardAccountBalances`), hiển thị gọn, không trùng card khác.
- Regression nhanh:
- Auth, CRUD finance, goals lock `target=1`, video workflow + XP, settings autosave vẫn hoạt động.

# NEXUS OS — Smoke Checklist Baseline RC1

## 1) Gate bắt buộc
- Chạy `npm run check:i18n`.
- Chạy `npm run build`.
- Đảm bảo không có lỗi console mới ở các thao tác chính.

## 2) Dashboard + Số dư tài khoản
- Mở `#dashboard`, xác nhận khối số dư tài khoản hiển thị đầu tiên.
- Xác nhận không còn khối "Nhịp tài chính".
- Tạo tài khoản mới trong `#accounts`, quay lại dashboard và xác nhận số dư cập nhật.
- Sửa tài khoản, xác nhận tên/số dư hiển thị cập nhật.
- Xóa tài khoản (có chuyển dữ liệu), xác nhận dashboard cập nhật ngay.
- Chuyển tiền giữa 2 tài khoản, xác nhận số dư 2 bên thay đổi đúng ở dashboard và accounts.

## 3) Tài chính (regression)
- Đăng nhập/đăng xuất hoạt động bình thường.
- CRUD khoản chi trong `#expenses` hoạt động đúng.
- CRUD khoản thu trong `#incomes` hoạt động đúng.
- Lọc theo tháng đồng bộ giữa `monthFilter` và `incomeMonthFilter`.
- Xuất CSV thành công.

## 4) Goals + Motivation
- Tạo mục tiêu và cập nhật tiến độ.
- Tạo habit `target=1`, điểm danh lần 1 thành công.
- Điểm danh lần 2 trong cùng kỳ bị khóa.
- Badge "Đã đạt/Hoàn thành" hiển thị đúng.
- Day/Week/Month summary không bị cộng chéo.

## 5) Video plan
- Tạo task video mới thành công.
- Mở offcanvas sửa task từ nút "Sửa", dữ liệu được prefill.
- Lưu sửa task thành công, board và summary cập nhật.
- Kéo thả qua các giai đoạn hoạt động đúng.
- Xóa task video hoạt động đúng.

## 6) i18n tiếng Việt 100%
- Kiểm tra `#dashboard`, `#expenses`, `#goals`, `#video-plan`, `#accounts`, `#settings`.
- Không còn chuỗi lỗi kiểu `�`, `T�m`, `th�ng`, `cÃ¡`.
- Toast và label động đều hiển thị tiếng Việt có dấu.

## 7) Responsive
- `<=767px`: không tràn ngang ở dashboard/expenses/goals/video-plan/accounts.
- `768-991px`: bảng, filter, action group, offcanvas hiển thị ổn định.
- `>=992px`: layout không bị nhảy khi mở/đóng offcanvas.

# NEXUS OS — Phase 3.2D RC: Classes Presenter

## Scope
- Tách `#classes` thành 2 chế độ: `Quản trị` và `Trình chiếu`.
- Trình chiếu theo tab từng lớp `active`.
- Thêm sao/điểm cho học sinh: `+⭐`, quy đổi thủ công `5⭐ = +1 điểm`, reset sao.
- Thêm random học sinh theo `%` từng học sinh, chuẩn hóa theo tổng hiện tại khi lệch 100.
- Giữ nguyên route/hash cũ và schema nghiệp vụ cũ ngoài classes.

## Technical Changes
- Firestore student fields mới trong classes:
  - `starsBalance`, `pointsTotal`, `pickPercent`, `scoreUpdatedAt`.
- Firestore APIs mới:
  - `awardStudentStar`, `redeemStudentStars`, `updateStudentPickPercent`, `bulkUpdateStudentPickPercent`.
- Classes runtime:
  - mode switch `Quản trị/Trình chiếu`.
  - presentation tabs theo lớp active.
  - random engine theo `%` (normalize when total != 100).

## QA Focus
- Chuyển mode nhiều lần không duplicate handler.
- `+⭐` / `Đã sử dụng` cập nhật điểm-sao đúng.
- Random chạy đúng với tổng `%` = 100 và != 100.
- Responsive không chồng layout ở 3 breakpoint.
- Regression toàn app không vỡ flow chính.

## Known Limitations
- Lịch sử random chỉ lưu trong state phiên hiện tại (không lưu DB).
- `% random` hiện chỉnh từng học sinh ở chế độ quản trị.

## Rollback
- Rollback theo tag gần nhất trước Phase 3.2D.

## Stabilization Add-on: Layout + Fast Login Warm Start
- Chuẩn hóa khung lề toàn app bằng token layout chung: `--page-max-width`, `--page-gutter-x`, `--page-gutter-y`.
- Đồng nhất spacing giữa `#classes`, `#video-plan`, `#accounts`, `#settings` với các trang lõi.
- Bổ sung warm-start đăng nhập:
- Ưu tiên route theo thứ tự: hash hiện tại (khác auth) -> route cuối (`nexus_last_route`) -> `dashboard`.
- Dùng auth warm hint `nexus_auth_hint_v1` + timeout bootstrap `1200ms`.
- Session không hợp lệ tự fallback `#auth`, tránh treo ở trạng thái trung gian.
- Thiết lập auth persistence local trong Firebase Auth để giảm thời gian vào app khi đã có phiên.

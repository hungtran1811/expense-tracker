# NEXUS OS - Phase 3.2 Classes RC

## Scope
- Thêm route mới `#classes`.
- Thêm module quản lý lớp học theo mô hình `classes/students/sessions`.
- Tự sinh 14 buổi theo `thứ + giờ`.
- Thêm đánh giá học sinh theo 5 trạng thái và ghi chú buổi học.
- Thêm widget dashboard: `Buổi học sắp tới`.

## Thay đổi chính
- Firestore service:
- Dùng collections:
  - `users/{uid}/classes/{classId}`
  - `users/{uid}/classes/{classId}/students/{studentId}`
  - `users/{uid}/classes/{classId}/sessions/{sessionId}`
- UI/route:
- Nav có thêm mục `Lớp học`.
- Có section `#classes` với 3 khối:
  - Danh sách + form lớp
  - Chi tiết lớp + học sinh
  - Lịch 14 buổi + ghi chú/nhận xét buổi
- Dashboard:
- Card đầu bổ sung khối `Buổi học sắp tới` dạng tối giản.
- Settings:
- `startRoute` hỗ trợ thêm giá trị `classes`.

## Regression guard
- Không đổi schema nghiệp vụ cũ: finance/goals/video/settings.
- Không đổi route/hash cũ.
- Không thêm dependency mới.

## Gate cần pass
- `npm run check:i18n`
- `npm run build`
- `npm run check:smoke`
- `npm run check:baseline`

## Known limitations
- Chưa có lịch nghỉ/bù buổi tự động.
- Chưa có import danh sách học sinh từ file.
- Chưa có module học phí/thanh toán trong phase này.

## Rollback
- Rollback về tag RC ổn định gần nhất trước Phase 3.2.
- Re-deploy từ tag đó trên `main` theo flow hiện tại.


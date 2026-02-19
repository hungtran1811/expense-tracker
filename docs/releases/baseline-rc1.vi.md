# NEXUS OS — Baseline RC1 (Mini Phase 2.3.2)

## Mốc phát hành
- Baseline đề xuất: `nexus-os-rc1`
- Trạng thái: sẵn sàng chốt sau khi QA smoke pass toàn bộ checklist.

## Những gì đã khóa trong RC1
- Dashboard theo hướng balance-first.
- Không còn card "Nhịp tài chính" cũ.
- Số dư tài khoản cập nhật qua event `nexus:balances-updated`.
- Luồng sửa task video bằng offcanvas đã hoạt động ổn định.
- UI tiếng Việt có dấu là mặc định cho luồng chính.
- Reports/AI tiếp tục tắt theo feature flags hiện tại.

## Gate bắt buộc trước khi tag
- `npm run check:i18n`
- `npm run build`
- Chạy checklist tại `docs/qa/smoke-checklist.vi.md`

## Các luồng chính cần pass
- Auth login/logout.
- CRUD expense/income/account + transfer.
- Goals/Habits lock theo target kỳ.
- Video create/edit/delete/move stage.
- Dashboard cập nhật balances theo thời gian thực trong app.
- Responsive ở 3 breakpoint chính.

## Giới hạn đã biết (ngoài scope RC1)
- Chưa mở lại Reports/AI.
- Chưa thêm QA automation framework.
- Không đổi route/hash và không đổi schema Firestore.

## Cách chốt tag (sau khi QA pass)
```bash
git tag nexus-os-rc1
git push origin nexus-os-rc1
```

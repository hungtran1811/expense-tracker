# NEXUS OS — Phase 3.0 + 3.0A RC

## 1) Tóm tắt phát hành
Bản RC này gộp toàn bộ thay đổi của:
- Phase 3.0 Creator Ops Lite.
- Phase 3.0A UX Polish cho `#video-plan`.

Mục tiêu phát hành:
- Chốt bản ổn định để vận hành thật.
- Giữ nguyên route/hash public.
- Không đổi schema nghiệp vụ cũ.

Tag phát hành:
- `nexus-os-phase-3.0-3.0a-rc1`

## 2) Phạm vi thay đổi chính
### 2.1 Creator Ops Lite
1. Bổ sung collection phụ trợ Firestore:
- `users/{uid}/videoRetros/{taskId}`
- `users/{uid}/contentBlueprints/{blueprintId}`
2. Nâng cấp `#video-plan`:
- Ghi/sửa kết quả xuất bản theo task (retro panel).
- Lọc theo trạng thái retro (`all|withRetro|withoutRetro`).
- Workflow template nội dung (apply/save).
3. Nâng cấp AI video copilot:
- Trả 3 phương án có cấu trúc đầy đủ.
- Áp dụng 1 chạm vào form video.
4. Nâng cấp `#weekly-review`:
- Snapshot hiệu suất video tuần.
- Insight rule-based cho quyết định tuần mới.

### 2.2 UX Polish `#video-plan`
1. Tối ưu hierarchy hiển thị board/calendar/agenda.
2. Tối ưu thao tác mở/sửa task từ board và calendar.
3. Khóa responsive ổn định ở 3 breakpoint.
4. Chuẩn hóa copy tiếng Việt theo constants.

## 3) Contract giữ nguyên
1. Route/hash public: không đổi.
2. Firestore schema nghiệp vụ cũ (`videoTasks`, `expenses`, `goals`, `accounts`, ...): không đổi.
3. Behavior lõi finance/goals/settings: không đổi.

## 4) Gate bắt buộc và kết quả
Đã chạy lần cuối trước release:

```bash
npm run check:i18n
npm run build
npm run check:smoke
npm run check:baseline
```

Kết quả:
- `check:i18n`: PASS.
- `build`: PASS.
- `check:smoke`: PASS.
- `check:baseline`: PASS.

Build snapshot (vite):
- `assets/index-*.js`: `126.31KB`
- `assets/vendor-*.js`: `339.97KB`
- `assets/feature-dashboard-*.js`: `36.87KB`
- `assets/feature-weekly-review-*.js`: `38.26KB`
- `assets/feature-ai-services-*.js`: `22.68KB`

## 5) Checklist verify production sau deploy
1. Login/logout hoạt động bình thường.
2. Dashboard load không lỗi console.
3. `#video-plan` board/calendar/reminder hoạt động đúng.
4. `#weekly-review` hiển thị snapshot/plan/history đúng.
5. Settings autosave hoạt động.
6. AI video generate/improve/apply không crash UI.

## 6) Known limitations
1. Chưa có drag-drop trực tiếp trong month grid calendar.
2. Deadline không có giờ được coi là cuối ngày local.
3. Một số phần smoke manual vẫn cần verify trực tiếp trên production sau deploy.

## 7) Rollback note
Nếu có sự cố nghiêm trọng sau deploy:
1. Rollback về tag ổn định gần nhất.
2. Ưu tiên rollback nhanh trước, sau đó mở patch `3.0.x-p1` để sửa dứt điểm.

## 8) Ghi chú vận hành sau release
1. Daily smoke 10–15 phút trong 2–3 ngày đầu.
2. Weekly full smoke theo `docs/qa/smoke-checklist.vi.md`.
3. Lỗi nhẹ ghi backlog patch `3.0.x-p1` theo ưu tiên P0/P1/P2.

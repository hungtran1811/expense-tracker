# NEXUS OS — Phase 3.1 Analytics RC

## 1) Tóm tắt phát hành
Bản RC này tập trung nâng `#weekly-review` thành Analytics Hub để ra quyết định nội dung theo dữ liệu tuần thực tế.

Mục tiêu chính:
- So sánh tuần hiện tại với tuần trước (WoW).
- Breakdown hiệu suất theo ngôn ngữ và định dạng video.
- Đưa ra hành động ưu tiên tuần mới theo rule-based.
- Giữ dashboard ở vai trò tóm tắt nhẹ (Creator Pulse).

Tag đề xuất:
- `nexus-os-phase-3.1-analytics-rc1`

## 2) Phạm vi thay đổi
1. Weekly Review analytics VM:
- `buildWeeklyPerformanceAnalyticsVM(...)`.
- Tính KPI tuần hiện tại, tuần trước, rolling 4 tuần.
- Trend WoW: delta tuyệt đối + delta phần trăm.
- Breakdown theo `language` và `videoType`.
- Top video nổi bật và video cần cải thiện.
2. Weekly Review UI analytics:
- Hero KPI, trend card, breakdown card, highlight card, action list.
- IDs mới: `wrPerfHero`, `wrPerfTrend`, `wrPerfBreakdownLanguage`, `wrPerfBreakdownType`, `wrPerfBestVideo`, `wrPerfImproveVideo`, `wrPerfActions`.
3. Dashboard Creator Pulse:
- Khối tóm tắt KPI tuần nhẹ tại `dashboardCreatorPulse`.
- Link nhanh sang `#weekly-review`.
4. Copy/i18n:
- Namespace mới trong `copy.vi.js`: `weeklyReview.analytics.*`, `dashboard.creatorPulse.*`.

## 3) Contract giữ nguyên
1. Route/hash public: không đổi.
2. Firestore schema nghiệp vụ cũ: không đổi.
3. Nguồn dữ liệu analytics: dùng `videoRetros` hiện có, không thêm API ngoài.

## 4) Gate bắt buộc
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
- `assets/index-*.js`: `126.50KB`
- `assets/vendor-*.js`: `339.97KB`
- `assets/feature-dashboard-*.js`: `43.28KB`
- `assets/feature-weekly-review-*.js`: `50.37KB`
- `assets/feature-ai-services-*.js`: `22.68KB`

## 5) Smoke verify trọng tâm
1. Weekly analytics vẫn render sạch khi dữ liệu rỗng.
2. WoW trend đúng khi có dữ liệu tuần trước.
3. Breakdown `language/videoType` đúng tổng.
4. Action suggestions đúng rule (`publish/ctr/retention`).
5. Dashboard Creator Pulse hiển thị đúng và điều hướng đúng `#weekly-review`.
6. Không regress auth/finance/goals/video/settings.

## 6) Known limitations
1. Chất lượng insight phụ thuộc dữ liệu `videoRetros` nhập tay.
2. Chưa tích hợp YouTube API để tự động đồng bộ chỉ số hiệu suất.
3. Dashboard chỉ hiển thị pulse nhẹ, phân tích sâu vẫn nằm tại `#weekly-review`.

## 7) Rollback note
Nếu phát sinh sự cố nghiêm trọng sau deploy:
1. Rollback về tag ổn định gần nhất.
2. Mở patch `3.1.x-p1` cho fix tối thiểu, ưu tiên an toàn runtime.

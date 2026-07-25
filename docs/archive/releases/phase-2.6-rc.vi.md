# NEXUS OS — Phase 2.6 RC

## Mục tiêu
- Nhúng AI Copilot trực tiếp vào `#dashboard` và `#weekly-review` theo cơ chế manual-first.
- Lưu lịch sử AI output trên Firestore để dùng lại sau reload.
- Tăng độ ổn định runtime: timeout 15s, cooldown 8s, fallback local rõ ràng.

## Phạm vi đã triển khai
- Thêm Netlify function mới:
  - `/.netlify/functions/ai-dashboard-brief`
- Nâng cấp function hiện có:
  - `/.netlify/functions/ai-report-insights` trả thêm `model`, `promptVersion`
- Thêm service client:
  - `src/services/api/aiDashboardBrief.js`
  - Cập nhật `src/services/api/aiReportInsights.js` với timeout + metadata option.
- Mở rộng Firestore service:
  - `readDashboardBrief(uid, dateKey)`
  - `saveDashboardBrief(uid, dateKey, payload)`
  - `listDashboardBriefs(uid, limitCount)`
- Dashboard:
  - Widget mới `AI Brief hôm nay`
  - IDs: `btnDashAiBrief`, `dashAiBriefText`, `dashAiBriefActions`, `dashAiBriefRisk`, `dashAiBriefMeta`
  - Cooldown 8 giây, fallback local nếu AI lỗi.
- Weekly Review:
  - Chuẩn hóa insight AI cho flow tuần.
  - Lưu metadata: `aiSummary`, `aiUpdatedAt`, `aiModel`, `aiPromptVersion`.

## Regression contract
- Không đổi route/hash công khai.
- Không đổi schema nghiệp vụ cũ (finance/goals/video).
- Không bật lại page `#reports` / `#ai`.

## Gate
- `npm run check:i18n`
- `npm run build`
- `npm run check:baseline`


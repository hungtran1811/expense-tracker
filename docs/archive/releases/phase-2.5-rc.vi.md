# NEXUS OS — Phase 2.5 RC (Weekly Review Hub)

## Phạm vi
- Thêm route mới `#weekly-review` cho nghi thức tổng kết tuần.
- Giữ nguyên route/hash cũ và schema Firestore hiện tại cho finance/goals/video.
- Insight mặc định local rule-based, AI là tùy chọn.

## Thay đổi chính
- App shell:
  - Thêm nav entry `Tổng kết tuần`.
  - Thêm quick link từ dashboard sang trang tổng kết tuần.
- Firestore service:
  - Thêm `users/{uid}/weeklyReviews`.
  - Bổ sung API:
    - `readWeeklyReview(uid, weekKey)`
    - `saveWeeklyReview(uid, weekKey, payload)`
    - `listWeeklyReviews(uid, limitCount)`
  - Bổ sung query range:
    - `listExpensesByDateRange`
    - `listIncomesByDateRange`
    - `listTransfersByDateRange`
- Feature module mới:
  - `src/features/weeklyReview/weeklyReview.controller.js`
  - `src/features/weeklyReview/weeklyReview.ui.js`
- Weekly Review page:
  - Header tuần đang xem.
  - Snapshot 4 khối: tài chính, mục tiêu/habit, video, động lực.
  - Insight local “Điểm tốt / Cần cải thiện”.
  - Form kế hoạch tuần mới.
  - Lịch sử review gần đây.
  - Nút AI insight tùy chọn + fallback local.
- Bootstrap integration:
  - Load module theo route `#weekly-review`.
  - Save/AI flow có trạng thái lưu và toast tiếng Việt.
  - Không làm vỡ settings/startRoute/filter hiện tại.

## Internal contracts mới
- `WeeklyReview` doc shape tại `users/{uid}/weeklyReviews/{weekKey}`:
  - `weekKey`, `rangeStart`, `rangeEnd`
  - `snapshot.finance`, `snapshot.goals`, `snapshot.video`, `snapshot.motivation`
  - `plan.focusTheme`, `plan.topPriorities`, `plan.riskNote`, `plan.actionCommitments`
  - `insight.localSummary`, `insight.aiSummary`, `insight.aiUpdatedAt`
  - `createdAt`, `updatedAt`, `finalizedAt`

## Regression cần pass
- Auth login/logout.
- CRUD expense/income/account/transfer.
- Habit lock `target=1`.
- Video create/edit/delete/move stage + XP rule.
- Settings autosave + startRoute.

## Gate
- `npm run check:i18n`
- `npm run build`
- `npm run check:baseline`

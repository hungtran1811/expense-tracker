# NEXUS OS - Phase 2.7 RC

## Scope da trien khai
- Chuyen AI tu insight tong quat sang goi y tac vu dung ngay.
- Tat hoan toan AI Brief tren dashboard va AI insight tren weekly review.
- Them AI Copilot cho 3 diem thao tac:
  - Goi y nhan chi tieu theo do tin cay.
  - Goi y content video (generate + improve, 3 options).
  - Goi y bundle Goal + Habit (generate + improve, 3 options).
- Chi luu Firestore khi nguoi dung bam `Ap dung` (hoac auto-apply nhan chi confidence cao).

## Thay doi ky thuat chinh

### 1) Dashboard/Weekly cleanup
- Loai bo UI va runtime path cua AI Brief/AI insight cu.
- Weekly review giu trong tam: snapshot + ke hoach + lich su.

### 2) Expense Label AI v2
- Trigger tu dong sau 600ms dung go o form them chi.
- Rule confidence:
  - `>= 0.75`: auto-apply category.
  - `< 0.75`: hien thi de xuat va cho ap dung thu cong.
- Co guard stale request de tranh spam/goi de.

### 3) Video Copilot
- Them 2 hanh dong: `AI goi y moi`, `AI cai thien noi dung`.
- Function tra ve toi da 3 phuong an co cau truc.
- `Ap dung toan bo` chi do vao form, khong auto-save task.
- Timeout 15s, cooldown 8s.

### 4) Goal Copilot Bundle
- Them 2 hanh dong: `AI goi y moi`, `AI cai thien noi dung`.
- Moi option gom day du `goal` + `habit`.
- `Ap dung bundle` do vao form Goal/Habit, nguoi dung tu chu tao du lieu that.

### 5) Firestore persistence cho ban da ap dung
- Them `users/{uid}/aiSuggestions`.
- API: `saveAppliedAiSuggestion`, `listAppliedAiSuggestions`.
- Payload luu gom: `type`, `mode`, `inputSnapshot`, `appliedOutput`, `appliedAt`.

### 6) UI/Copy/CSS
- Bo sung namespace copy:
  - `ai.common.*`
  - `ai.expenseLabel.*`
  - `ai.videoCopilot.*`
  - `ai.goalCopilot.*`
- Bo sung style cho hint/suggestion card AI.
- Don selector CSS chet cua khoi AI cu.

## File chinh da thay doi
- `index.html`
- `src/app/bootstrap.js`
- `src/features/dashboard/dashboard.ui.js`
- `src/features/dashboard/dashboard.events.js`
- `src/features/dashboard/dashboard.controller.js`
- `src/features/weeklyReview/weeklyReview.controller.js`
- `src/features/weeklyReview/weeklyReview.ui.js`
- `src/services/firebase/firestore.js`
- `src/services/api/aiCategorize.js`
- `src/services/api/aiVideoCopilot.js` (new)
- `src/services/api/aiGoalSuggest.js` (new)
- `netlify/functions/ai-categorize.js`
- `netlify/functions/ai-video-copilot.js` (new)
- `netlify/functions/ai-goal-suggest.js` (new)
- `src/shared/constants/copy.vi.js`
- `src/styles/app.css`
- `docs/qa/smoke-checklist.vi.md`

## QA gate
- `npm run check:i18n`: pass
- `npm run build`: pass
- `npm run check:baseline`: pass

## Luu y hien tai
- AI chay qua Netlify Functions.
- Khi local, nen chay qua `npm run dev:netlify` de endpoint `/.netlify/functions/*` hoat dong day du.

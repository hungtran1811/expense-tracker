# NEXUS OS - Smoke Checklist Phase 2.7

## 1) Gate bat buoc
- Chay `npm run check:i18n`.
- Chay `npm run build`.
- Chay `npm run check:baseline`.
- Xac nhan khong co loi console moi o cac thao tac chinh.

## 2) Dashboard + Action Board
- Mo `#dashboard`, xac nhan khong con khoi AI Brief.
- Xac nhan thu tu: Hero + Action Board + So du tai khoan + Video + Goals + Dong luc.
- `dashPriorityList` hien thi dung nguon Habit + Video.
- Nut quick action tu dashboard hoat dong dung (`Diem danh ngay`, `Mo task can han`).

## 3) Expense label AI v2
- Mo form them chi, nhap ten giao dich ro nghia, dung go 600ms.
- Neu confidence >= 0.75: category duoc auto-apply.
- Neu confidence < 0.75: hien thi goi y + nut `Ap dung de xuat AI`.
- Bam ap dung thu cong: category doi dung va khong crash form.
- Tat AI/loi mang: form van thao tac binh thuong.

## 4) Video Copilot
- O `#video-plan`, bam `AI goi y moi` va nhan 3 phuong an.
- Bam `AI cai thien noi dung` khi da co input, nhan 3 phuong an theo context.
- Bam `Ap dung toan bo` o 1 option: du lieu do vao form dung field.
- Xac nhan chua tao task neu chua bam `Them cong viec video`.
- Cooldown 8s hoat dong, khong spam request.

## 5) Goal Copilot Bundle
- O `#goals`, bam `AI goi y moi` va nhan 3 bundle goal+habit.
- Bam `AI cai thien noi dung` khi da co input, nhan 3 bundle theo context.
- Bam `Ap dung toan bo` o 1 bundle: do du lieu vao ca form Goal va Habit.
- Sau khi bam `Them muc tieu`/`Them thoi quen`, luong tao du lieu van hoat dong dung.

## 6) Weekly Review (khong AI insight)
- Mo `#weekly-review`, xac nhan khong con nut/khung AI insight.
- Snapshot 4 khoi render dung khi co va khi rong du lieu.
- Luu ke hoach tuan moi thanh cong va reload van con du lieu.
- `wrHistoryList` hien thi va mo lai tuan da luu dung thu tu gan nhat.

## 7) Firestore apply-log AI
- Khi chi xem goi y AI (chua bam ap dung): khong luu ban ghi apply.
- Khi bam `Ap dung` (hoac auto-label confidence cao): luu vao `users/{uid}/aiSuggestions`.
- Payload co du `type`, `mode`, `inputSnapshot`, `appliedOutput`, `appliedAt`.

## 8) Regression nghiep vu
- Auth login/logout binh thuong.
- CRUD expense/income/account/transfer khong regress.
- Habit `target=1`: tick lan 2 trong cung ky bi khoa.
- Video create/edit/delete/move stage + XP rule khong doi.
- Settings autosave + startRoute + remember filter khong regress.

## 9) Responsive
- `<=767px`: khong tran ngang o dashboard/expenses/goals/video/weekly/accounts.
- `768-991px`: filter, form, board, action group co gian on dinh.
- `>=992px`: layout on dinh, khong jump bat thuong khi mo offcanvas.

## 10) i18n
- Kiem tra phan moi (expense AI, goal AI, video AI) hien thi tieng Viet co dau day du.
- Khong con wording cu: `AI Brief`, `insight AI` tren dashboard/weekly-review.
- Khong co chuoi loi mojibake tren UI.

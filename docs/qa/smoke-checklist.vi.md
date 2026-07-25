# Hung Tran Finance — Smoke Checklist (Finance-only)

## 0) Vận hành nhanh hằng ngày (10–15 phút)

- Mở production, đăng nhập Google và đi qua nhanh 4 tab:
  - `#home` (4 ví, thu/chi/còn lại, nút Chi/Thu/Chuyển)
  - `#expenses` (thêm/sửa 1 giao dịch, xem danh sách)
  - `#loans` (xem danh sách người mượn)
  - `#reports` (áp dụng bộ lọc báo cáo)
- Kiểm tra console không có lỗi đỏ mới.
- Nếu fail ở bất kỳ bước nào: ghi issue kèm ảnh + bước tái hiện.

## 1) Gate bắt buộc

```bash
npm run check:i18n
npm run build
npm run check:smoke
npm run check:baseline
```

- Xác nhận không có lỗi console mới ở thao tác chính.

## 2) Auth

- Đăng nhập Google thành công, hiển thị tên user trên menu.
- Đăng xuất thành công, quay về `#auth`.
- Reload khi còn session: vào lại workspace, không kẹt ở màn login.
- Truy cập route khi chưa login: redirect về `#auth`.
- Màn login hiển thị «Quản lý chi tiêu cá nhân».

## 3) Tổng quan (`#home`)

- Dashboard quản trị ngắn: KPI (Số dư / Thu / Chi / Còn lại / Cho mượn) + chip lọc ví.
- Biểu đồ **Chi theo danh mục** (donut) và **Chi theo ngày** (cột 14 ngày gần).
- Lưới ví gọn: số dư đầy đủ VND, không tràn mobile 375px.
- «Hôm nay»: 2 số thu/chi + tối đa 4 dòng; bấm dòng mở sửa.
- **Giao dịch gần đây** (7 ngày) trên Tổng quan; bấm dòng mở sửa.
- Nút Chi / Thu / Chuyển và phím `C` / `I` / `T` hoạt động trên tab này.
- Phân tích sâu (MoM, dòng tiền đầy đủ, top danh mục chi tiết) nằm trên tab **Báo cáo**.
- Mục tiêu tiết kiệm: bấm «Thêm» / «Sửa» mở popup modal.

## 4) Chi tiêu (`#expenses`)

### 4.1 Sub-tab

- Mặc định `#expenses` mở sub-tab **Giao dịch**.
- `#expenses/manage` mở sub-tab **Quản lý**; nav chính «Chi tiêu» vẫn active.
- Chuyển sub-tab không reload toàn app, không lỗi console.

### 4.2 Giao dịch (sub-tab Giao dịch)

- Preset **Hôm nay** mặc định; chọn **Tháng này** sẽ tự tải giao dịch tháng.
- Thêm / sửa / xóa khoản chi, thu, chuyển.
- Form Chi / Thu hiển thị gợi ý phím tắt (`C`, `I`, `/`); form Chuyển không hiện dòng gợi ý.
- Số tiền timeline hiển thị đầy đủ VND, không tràn (`u-money`).
- Bộ lọc drawer: nhãn tiếng Việt từ copy (Tài khoản, Loại, Danh mục, Nhóm chi).
- Xuất CSV theo bộ lọc hiện tại.
- **Không còn** panel «Chỉ khoản chi», ngân sách tháng, preview ngân sách trong composer.

### 4.3 Quản lý (sub-tab Quản lý)

- Khi chưa có tài khoản: empty state + nút «Thêm tài khoản đầu tiên».
- Tạo / sửa / lưu trữ tài khoản; số dư `formatCurrency` đầy đủ.
- Thêm / đổi tên / xóa nhóm chi (có chuyển dữ liệu nếu cần).
- Thêm / đổi tên / xóa **danh mục chi** (có chuyển dữ liệu nếu cần); form ghi chi và bộ lọc dùng danh mục động.
- Ngân sách theo nhóm (tháng hiện tại) trên sub-tab Quản lý.

## 5) Cho mượn (`#loans`)

- Summary 4 KPI: số tiền đầy đủ VND (`u-money`), không tràn mobile.
- Layout V3: một cột — spotlight tổng nợ + dải chip người mượn ngang + lịch sử full width.
- Font đồng bộ `Plus Jakarta Sans` trên toàn site (không dùng font lạ).
- Chip người mượn (`loans-party-chip`): tên + còn nợ, scroll ngang trên mobile.
- Thêm người mượn, sửa, xóa.
- Ghi nhận cho mượn — số dư tài khoản giảm đúng.
- Ghi nhận nhận trả — số dư tăng, nợ giảm đúng.
- Form Cho mượn / Nhận trả hiển thị gợi ý chip trên tab (display-only).
- Phím `M` (cho mượn) / `N` (nhận trả) trên tab `#loans`.
- Chọn người mượn xem lịch sử công nợ; số tiền timeline `u-money`.
- Sửa / xóa giao dịch công nợ.

## 6) Báo cáo (`#reports`)

- Layout quản trị: filter gọn + KPI (Số dư / Thu / Chi / Còn lại).
- Biểu đồ chính: **Danh mục chi**, **Nhóm chi**, **Chi theo ngày** (cột).
- MoM: nút «So với kỳ trước» hoặc chip % gọn (không đoạn mô tả dài).
- Số dư ví + điểm nổi bật ngắn; khoản lớn nhất 1 dòng; biến động tài khoản (Vào/Ra).
- Giao dịch gần đây nằm trên tab **Tổng quan**.
- Breakdown danh mục / nhóm / tài khoản — bấm hàng mở `#expenses` đã lọc.

## 7) Responsive

- `<=767px`:
  - 4 tab workspace (bottom nav) hiển thị đủ, label rút gọn (Tổng / Chi).
  - FAB ghi chi nhanh trên `#home` và `#expenses`.
  - Modal fullscreen-sm-down mở/đóng được.
  - KPI và số tiền topbar không tràn viền.
- `768–991px`:
  - Layout chi tiêu/loans/reports co giãn ổn định.
- `>=992px`:
  - Ledger một cột full width; sub-tab Quản lý hiển thị card tài khoản + nhóm chi + danh mục chi.

## 8) i18n / UTF-8

- Toàn bộ nhãn UI hiển thị tiếng Việt có dấu.
- Không xuất hiện chuỗi lỗi encoding (mojibake).
- Không còn thuật ngữ tiếng Anh lẫn (`insight`, `workspace`) trên UI chính.
- `npm run check:i18n` pass.

## 9) Legacy routes

- Truy cập `#overview`, `#dashboard`:
  - Redirect về `#home`.
- Truy cập `#settings`, `#goals`, `#video-plan`:
  - Redirect an toàn về `#expenses`.
  - Không lỗi console.

## 10) Known limitations

- AI tóm tắt báo cáo tạm ẩn (`featureFlags.ai = false`).
- Xuất PDF báo cáo chưa có (CSV kỳ báo cáo đã có).

## 11) Growth

- Phím `/` mở tìm kiếm toàn cục (giao dịch + người mượn).
- Badge số người còn nợ trên tab Cho mượn; meta «Cần nhắc» nếu quá 30 ngày.
- Quản lý: mẫu định kỳ + «Tạo hôm nay».
- Tổng quan: mục tiêu tiết kiệm (tiến độ thủ công).
- Production: PWA Add to Home Screen (manifest + SW).

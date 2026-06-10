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

- Sau đăng nhập, mặc định vào tab Tổng quan (không còn mở thẳng Chi tiêu).
- Tiêu đề «Tổng quan» và nhãn tháng hiện tại hiển thị đúng.
- Lưới 4 tài khoản: số dư **đầy đủ** từng ví (vd. `1.234.567đ`), **không có phần thập phân** (`,04`) — không xuống hàng, không tràn viền (mobile 375px).
- Section «Hôm nay»: tổng thu/chi ngày + danh sách chỉ giao dịch thu và chi trong ngày; bấm dòng mở sửa.
- Thanh tháng: thu, chi, còn lại, tiền cho mượn — ô cho mượn số đầy đủ, bấm chuyển `#loans`; 3 ô kia compact + `title` đầy đủ.
- Nút Chi / Thu / Chuyển và phím `C` / `I` / `T` hoạt động trên tab này.
- Panel **Dòng tiền theo ngày** (tháng hiện tại): mở/đóng được, ngày có giao dịch mới nhất lên trên.
- Chưa có panel MoM / top danh mục — sẽ thêm theo block nếu cần.

## 4) Chi tiêu (`#expenses`)

### 4.1 Sub-tab

- Mặc định `#expenses` mở sub-tab **Giao dịch**.
- `#expenses/manage` mở sub-tab **Quản lý**; nav chính «Chi tiêu» vẫn active.
- Chuyển sub-tab không reload toàn app, không lỗi console.

### 4.2 Giao dịch (sub-tab Giao dịch)

- Preset **Hôm nay** và **Tháng này** + date picker hoạt động (không còn preset 7 ngày).
- Thêm / sửa / xóa khoản chi, thu, chuyển, sửa số dư.
- Form Chi / Thu hiển thị gợi ý phím tắt (`C`, `I`, `/`); form Chuyển / Sửa số dư không hiện dòng gợi ý.
- Số tiền timeline hiển thị đầy đủ VND, không tràn (`u-money`).
- Bộ lọc drawer: nhãn tiếng Việt từ copy (Tài khoản, Loại, Danh mục, Nhóm chi).
- Xuất CSV theo bộ lọc hiện tại.
- **Không còn** panel «Chỉ khoản chi», ngân sách tháng, preview ngân sách trong composer.

### 4.3 Quản lý (sub-tab Quản lý)

- Tạo / sửa / lưu trữ tài khoản; số dư `formatCurrency` đầy đủ.
- Sửa số dư qua bút toán điều chỉnh.
- Thêm / đổi tên / xóa nhóm chi (có chuyển dữ liệu nếu cần).

## 5) Cho mượn (`#loans`)

- Summary 4 KPI: số tiền đầy đủ VND (`u-money`), không tràn mobile.
- Layout V3: một cột — spotlight tổng nợ + dải chip người mượn ngang + lịch sử full width.
- Font đồng bộ `Plus Jakarta Sans` trên toàn site (không dùng font lạ).
- Chip người mượn (`loans-party-chip`): tên + còn nợ, scroll ngang trên mobile.
- Thêm người mượn, sửa, xóa.
- Ghi nhận cho mượn — số dư tài khoản giảm đúng.
- Ghi nhận nhận trả — số dư tăng, nợ giảm đúng.
- Form Cho mượn / Nhận trả hiển thị gợi ý chip trên tab (display-only).
- Chọn người mượn xem lịch sử công nợ; số tiền timeline `u-money`.
- Sửa / xóa giao dịch công nợ.

## 6) Báo cáo (`#reports`)

- Layout V2: header «Báo cáo» + preset **Tháng này** / **Tháng trước** (chip active đúng kỳ).
- Preset bấm là áp dụng ngay; khoảng ngày tùy chỉnh vẫn cần **Áp dụng**.
- Spotlight 4 KPI tách khỏi filter; số tiền `u-money` đầy đủ VND, không tràn mobile 375px.
- Áp dụng bộ lọc từ ngày / đến ngày / tài khoản.
- Summary, số dư các ví, tóm tắt kỳ, điểm đáng lưu ý render đúng.
- Breakdown danh mục, nhóm chi, tài khoản.
- **Không còn** panel ngân sách hoặc dòng tiền theo ngày trên Báo cáo.
- Đặt lại bộ lọc về mặc định (Tháng này).
- Subtitle «X ví đang dùng» khớp số tài khoản thực tế.

## 7) Responsive

- `<=767px`:
  - 4 tab workspace (bottom nav) hiển thị đủ, label rút gọn (Tổng / Chi).
  - FAB ghi chi nhanh trên `#home` và `#expenses`.
  - Modal fullscreen-sm-down mở/đóng được.
  - KPI và số tiền topbar không tràn viền.
- `768–991px`:
  - Layout chi tiêu/loans/reports co giãn ổn định.
- `>=992px`:
  - Ledger một cột full width; sub-tab Quản lý hiển thị card tài khoản + nhóm chi.

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

- Sửa tài khoản không đổi số dư đầu kỳ — dùng Sửa số dư.
- AI phân loại chi tiêu tạm tắt (ngoài scope Finance-only hiện tại).

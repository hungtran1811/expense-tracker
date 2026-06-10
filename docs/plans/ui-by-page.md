# UI theo từng trang — roadmap

Chiến lược: một trang một lần, chốt từng block trước khi code. Tab chưa đến lượt **đóng băng** (không đổi layout).

## Trang 1 — Tổng quan (`#home`) — Done

| Block | Nội dung | Trạng thái |
|-------|----------|------------|
| A | Lưới 4 ví số dư (số đầy đủ `formatCurrency`) | Done |
| B | Nút Chi / Thu / Chuyển | Done |
| C | Thanh thu / chi / còn lại tháng | Done |
| D | Thu/chi hôm nay (danh sách + bấm sửa) | Done |
| E | Số VND làm tròn số nguyên (bỏ `,04`) | Done |
| F | Tiền cho mượn trên thanh tháng (link `#loans`) | Done |
| G | Dòng tiền theo ngày (tháng hiện tại, panel mở/đóng) | Done |

### Backlog Tổng quan (chưa code)

| Block | Nội dung | VM sẵn có |
|-------|----------|-----------|
| H | So với tháng trước | `momComparison` |
| I | Top danh mục chi | `categoryBreakdown` |
| J | Giao dịch 7 ngày | `recentTransactions` |

---

## Trang 2 — Chi tiêu (`#expenses`) — Done (V2 tối giản)

| Block | Nội dung | Trạng thái |
|-------|----------|------------|
| A | Sub-tab Giao dịch / Quản lý (`#expenses`, `#expenses/manage`) | Done |
| B | Toolbar preset Hôm nay + Tháng này + date picker (bỏ 7 ngày) | Done |
| C | Bỏ ngân sách UI trên Chi tiêu (giữ Firestore) | Done |
| D | Ledger/filter anti-overflow + nhãn từ `copy.vi.js` | Done |
| E | Sub-tab Quản lý: tài khoản + nhóm chi | Done |

**Cấu trúc:** một cột full width; Giao dịch = toolbar + chips + sổ; Quản lý = tài khoản + nhóm chi.

### Backlog Chi tiêu (chưa code)

- Polish animation sub-tab
- Empty state Quản lý khi chưa có tài khoản

---

## Trang 3 — Cho mượn (`#loans`) — Done

| Block | Nội dung | Trạng thái |
|-------|----------|------------|
| L-A | Copy `loans.*` wire vào UI + `loansWorkspaceInfo` | Done |
| L-B | Summary KPI `u-money` + `title` | Done |
| L-C | Party list outstanding/meta anti-overflow | Done |
| L-D | Timeline ledger pattern + empty states | Done |
| L-E | `loanEntryShortcuts` display-only | Done |
| L-H | Layout V3: spotlight + party chips ngang + một cột (cùng hệ font Home) | Done |

### Backlog Cho mượn (chưa code)

| Block | Nội dung |
|-------|----------|
| L-F | Phím `M` Cho mượn / `N` Nhận trả trên tab `#loans` |

---

## Trang 4 — Báo cáo (`#reports`) — Done (V2 layout + UX kỳ)

**Phân vai:** analytics sâu trên Báo cáo; Tổng quan có dòng tiền theo ngày (tháng hiện tại). Không còn UI ngân sách.

| Block | Nội dung | Trạng thái |
|-------|----------|------------|
| R-A | Shell `reports-top` + wire `copy.vi` (bỏ breadcrumb) | Done |
| R-B | Spotlight KPI tách filter + `u-money` | Done |
| R-C | Preset Tháng này / Tháng trước (auto-apply) + load `expenseScopes` | Done |
| R-D | Layout một cột mobile, insights/drivers 2 cột desktop | Done |
| R-E | QA smoke + checklist | Done |

### Backlog Báo cáo (chưa code)

| Block | Nội dung |
|-------|----------|
| R-F | So sánh kỳ trước (MoM) |
| R-G | Drill-down DM/nhóm → `#expenses` |
| R-H | AI tóm tắt (`ai-report-insights`) |
| R-I | Xuất báo cáo CSV/PDF |

---

## Trang 5 — Shell chung — sau cùng

- Topbar stats (Số dư / Chi / Thu)
- Mobile nav 4 tab
- Auth card

Chỉ polish khi 4 tab nội dung ổn.

export const copyVi = {
  brand: {
    name: "Hung Tran Finance",
    owner: "Hưng Trần",
  },
  nav: {
    overview: "Tổng quan",
    expenses: "Tài chính",
    reports: "Báo cáo",
  },
  routeMeta: {
    auth: {
      title: "Đăng nhập",
      subtitle: "Đăng nhập Google để vào Hung Tran Finance",
    },
    expenses: {
      title: "Tài chính",
      subtitle: "Workspace tài chính tập trung cho thu, chi, chuyển khoản và số dư tài khoản.",
    },
    overview: {
      title: "Tổng quan",
      subtitle: "Nhìn nhanh số dư, tín hiệu rủi ro và các insight tài chính quan trọng nhất.",
    },
    reports: {
      title: "Báo cáo",
      subtitle: "Đọc nhanh số dư, áp lực chi và các tín hiệu quan trọng trong kỳ đang xem.",
    },
  },
  common: {
    guest: "Khách",
    loading: "Đang tải dữ liệu...",
    save: "Lưu",
    cancel: "Hủy",
    close: "Đóng",
    delete: "Xóa",
    edit: "Sửa",
  },
  finance: {
    monthInfo: "Tất cả giao dịch trong tháng {{month}}.",
    emptyLedgerTitle: "Chưa có giao dịch nào trong tháng này",
    emptyLedgerBody: "Thêm một khoản chi, khoản thu hoặc chuyển khoản để bắt đầu sổ giao dịch mới.",
    emptyAccountsTitle: "Chưa có tài khoản nào",
    emptyAccountsBody: "Tạo ít nhất một tài khoản để bắt đầu theo dõi số dư và ghi nhận giao dịch.",
    composer: {
      createExpense: "Thêm khoản chi",
      createIncome: "Thêm khoản thu",
      createTransfer: "Thêm chuyển khoản",
      createAdjustment: "Thêm bút toán điều chỉnh",
      editExpense: "Sửa khoản chi",
      editIncome: "Sửa khoản thu",
      editTransfer: "Sửa chuyển khoản",
      editAdjustment: "Sửa bút toán điều chỉnh",
      expenseHint: "Khoản chi sẽ trừ trực tiếp vào số dư của tài khoản đã chọn.",
      incomeHint: "Khoản thu sẽ cộng trực tiếp vào số dư của tài khoản đã chọn.",
      transferHint: "Chuyển khoản chỉ đổi chỗ tiền giữa hai tài khoản, không tính vào thu hoặc chi.",
      adjustmentHint:
        "Bút toán điều chỉnh dùng để sửa số dư bằng lịch sử minh bạch. Có thể nhập số dương hoặc âm.",
    },
    account: {
      active: "Đang dùng",
      archived: "Đã lưu trữ",
      default: "Mặc định",
      openingBalance: "Đầu kỳ {{amount}}",
    },
    transactionType: {
      expense: "Khoản chi",
      income: "Khoản thu",
      transfer: "Chuyển khoản",
      adjustment: "Điều chỉnh",
    },
    summary: {
      totalBalance: "Tổng số dư",
      income: "Thu trong tháng",
      expense: "Chi trong tháng",
      net: "Chênh lệch tháng",
      transfer: "Chuyển khoản tháng",
    },
  },
  toast: {
    signInRequired: "Vui lòng đăng nhập trước.",
    loadFail: "Không thể tải dữ liệu tài chính. Vui lòng thử lại.",
    transactionSaved: "Đã lưu giao dịch.",
    transactionDeleted: "Đã xóa giao dịch.",
    transactionSaveFail: "Không thể lưu giao dịch.",
    transactionDeleteFail: "Không thể xóa giao dịch.",
    accountCreated: "Đã tạo tài khoản mới.",
    accountCreateFail: "Không thể tạo tài khoản.",
    accountRemoved: "Đã cập nhật trạng thái tài khoản.",
    accountRemoveFail: "Không thể cập nhật tài khoản.",
    financeResetDone: "Đã xóa sạch dữ liệu tài chính cũ.",
    financeResetFail: "Không thể xóa dữ liệu tài chính.",
    csvExportSuccess: "Đã xuất CSV theo bộ lọc hiện tại.",
    csvExportFail: "Không thể xuất CSV.",
    reportLoadFail: "Không thể tải báo cáo tài chính.",
  },
};

export function t(path, fallback = "") {
  if (!path) return fallback;

  const chunks = String(path).split(".");
  let cursor = copyVi;

  for (const key of chunks) {
    if (!cursor || !Object.prototype.hasOwnProperty.call(cursor, key)) return fallback;
    cursor = cursor[key];
  }

  return cursor ?? fallback;
}

export function formatTemplate(template, payload = {}) {
  let output = String(template || "");
  Object.entries(payload).forEach(([key, value]) => {
    output = output.replaceAll(`{{${key}}}`, String(value ?? ""));
  });
  return output;
}

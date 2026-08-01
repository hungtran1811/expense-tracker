import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import {
  ACCOUNT_TYPE_OPTIONS,
  FINANCE_TRANSACTION_TYPE_OPTIONS,
  getAccountTypeLabel,
  getExpenseCategoryOptions,
  getFinanceCategoryLabel,
  getTransactionTypeLabel,
} from "../../shared/constants/finance.constants.js";
import { isFinanceTransactionType } from "../../shared/utils/finance.shared.js";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function sortAccounts(items = []) {
  return [...items].sort((a, b) => {
    const archivedA = String(a?.status || "active") === "archived" ? 1 : 0;
    const archivedB = String(b?.status || "active") === "archived" ? 1 : 0;
    if (archivedA !== archivedB) return archivedA - archivedB;
    const defaultA = a?.isDefault ? -1 : 0;
    const defaultB = b?.isDefault ? -1 : 0;
    if (defaultA !== defaultB) return defaultA - defaultB;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}

function buildAccountMap(accounts = []) {
  return new Map(
    (Array.isArray(accounts) ? accounts : []).map((item) => [String(item?.id || "").trim(), item])
  );
}

function buildScopeMap(expenseScopes = []) {
  return new Map(
    (Array.isArray(expenseScopes) ? expenseScopes : []).map((item) => [String(item?.id || "").trim(), item])
  );
}

function sortTransactions(items = []) {
  return [...items].sort((a, b) => {
    const aa = toDate(a?.occurredAt)?.getTime() || 0;
    const bb = toDate(b?.occurredAt)?.getTime() || 0;
    if (bb !== aa) return bb - aa;
    const ua = toDate(a?.updatedAt)?.getTime() || 0;
    const ub = toDate(b?.updatedAt)?.getTime() || 0;
    return ub - ua;
  });
}

function buildSearchText(transaction, accountMap, scopeMap) {
  const fromAccount = accountMap.get(String(transaction?.accountId || "").trim());
  const toAccount = accountMap.get(String(transaction?.toAccountId || "").trim());
  const scope = scopeMap.get(String(transaction?.scopeId || "").trim());
  return [
    transaction?.note,
    getTransactionTypeLabel(transaction?.type),
    getFinanceCategoryLabel(transaction?.categoryKey),
    scope?.name,
    fromAccount?.name,
    toAccount?.name,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function getTransactionTitle(transaction) {
  const type = String(transaction?.type || "").trim();
  if (type === "expense") return getFinanceCategoryLabel(transaction?.categoryKey);
  if (type === "income") return "Khoản thu";
  if (type === "transfer") return "Chuyển khoản nội bộ";
  if (type === "adjustment") return "Điều chỉnh";
  return "Giao dịch";
}

function getTransactionAmountClass(transaction) {
  const type = String(transaction?.type || "").trim();
  const amount = Number(transaction?.amount || 0);
  if (type === "expense") return "expense";
  if (type === "income") return "income";
  if (type === "transfer") return "transfer";
  if (type === "adjustment" && amount >= 0) return "adjustment-positive";
  return "adjustment-negative";
}

function getTransactionAmountText(transaction) {
  const amount = Number(transaction?.amount || 0);
  const type = String(transaction?.type || "").trim();
  const abs = formatCurrency(Math.abs(amount));
  if (type === "expense") return `-${abs}`;
  if (type === "income") return `+${abs}`;
  if (type === "adjustment") return `${amount >= 0 ? "+" : "-"}${abs}`;
  return abs;
}

function getTransactionNetAmount(transaction) {
  const amount = Number(transaction?.amount || 0);
  const type = String(transaction?.type || "").trim();
  if (type === "expense") return -Math.abs(amount);
  if (type === "income") return Math.abs(amount);
  if (type === "adjustment") return amount;
  return 0;
}

function buildAccountLabel(transaction, accountMap) {
  const fromAccount = accountMap.get(String(transaction?.accountId || "").trim());
  const toAccount = accountMap.get(String(transaction?.toAccountId || "").trim());
  if (String(transaction?.type || "").trim() === "transfer") {
    return `${String(fromAccount?.name || "Không rõ")} → ${String(toAccount?.name || "Không rõ")}`;
  }
  return String(fromAccount?.name || "Không rõ");
}

function buildScopeLabel(transaction, scopeMap) {
  if (String(transaction?.type || "").trim() !== "expense") return "";
  return String(scopeMap.get(String(transaction?.scopeId || "").trim())?.name || "").trim();
}

function shiftDateInput(value = "", delta = 0) {
  const date = toDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + Number(delta || 0));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildFinanceRangeLabel(filters = {}) {
  const range = getFinanceRange(filters);
  if (range.preset === "today") {
    return `Hôm nay • ${formatDateLabel(range.toDate)}`;
  }
  if (range.preset === "month") {
    return range.presetLabel;
  }
  return `${range.presetLabel} • ${formatDateLabel(range.fromDate)} - ${formatDateLabel(range.toDate)}`;
}

function buildLedgerInfoText(filters = {}) {
  const parts = [`Hoạt động trong ${buildFinanceRangeLabel(filters)}.`];
  if (filters?.accountId && filters.accountId !== "all") {
    parts.push("Đã lọc theo tài khoản.");
  }
  if (filters?.type && filters.type !== "all") {
    parts.push("Đã lọc theo loại giao dịch.");
  }
  if (filters?.categoryKey && filters.categoryKey !== "all") {
    parts.push("Đã lọc theo danh mục.");
  }
  if (filters?.scopeId && filters.scopeId !== "all") {
    parts.push("Đã lọc theo nhóm chi.");
  }
  if (filters?.search) {
    parts.push("Đã áp dụng từ khóa tìm kiếm.");
  }
  return parts.join(" ");
}

function buildExpenseDetailsInfoText(filters = {}) {
  const parts = [`Toàn bộ khoản chi trong ${buildFinanceRangeLabel(filters).toLowerCase()}.`];
  if (filters?.accountId && filters.accountId !== "all") {
    parts.push("Đã áp dụng lọc theo tài khoản.");
  }
  if (filters?.categoryKey && filters.categoryKey !== "all") {
    parts.push("Đã áp dụng lọc theo danh mục.");
  }
  if (filters?.scopeId && filters.scopeId !== "all") {
    parts.push("Đã áp dụng lọc theo nhóm chi.");
  }
  if (filters?.search) {
    parts.push("Đã áp dụng từ khóa tìm kiếm.");
  }
  return parts.join(" ");
}

function groupTransactionsByDate(items = [], accountMap, scopeMap) {
  const groups = new Map();

  items.forEach((transaction) => {
    const dateLabel = formatDateLabel(transaction?.occurredAt);
    if (!groups.has(dateLabel)) {
      groups.set(dateLabel, {
        dateLabel,
        items: [],
        incomeTotal: 0,
        expenseTotal: 0,
        transferTotal: 0,
        netTotal: 0,
      });
    }

    const group = groups.get(dateLabel);
    const type = String(transaction?.type || "").trim();
    const amount = Number(transaction?.amount || 0);

    if (type === "income") group.incomeTotal += Math.abs(amount);
    if (type === "expense") group.expenseTotal += Math.abs(amount);
    if (type === "transfer") group.transferTotal += Math.abs(amount);
    group.netTotal += getTransactionNetAmount(transaction);

    group.items.push({
      id: String(transaction?.id || "").trim(),
      dateLabel,
      title: getTransactionTitle(transaction),
      note: String(transaction?.note || "").trim(),
      typeKey: type,
      typeLabel: getTransactionTypeLabel(transaction?.type),
      categoryLabel: type === "expense" ? getFinanceCategoryLabel(transaction?.categoryKey) : "",
      scopeLabel: buildScopeLabel(transaction, scopeMap),
      accountLabel: buildAccountLabel(transaction, accountMap),
      amountText: getTransactionAmountText(transaction),
      amountClass: getTransactionAmountClass(transaction),
    });
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    incomeTotalText: formatCurrency(group.incomeTotal),
    expenseTotalText: formatCurrency(group.expenseTotal),
    transferTotalText: formatCurrency(group.transferTotal),
    netTotalText: `${group.netTotal >= 0 ? "+" : "-"}${formatCurrency(Math.abs(group.netTotal))}`,
  }));
}

export function getCurrentYm() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function getTodayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function normalizeFinancePreset(value = "") {
  const raw = String(value || "").trim();
  if (raw === "today" || raw === "month") return raw;
  return "month";
}

export function getFinanceRange(filters = {}) {
  const preset = normalizeFinancePreset(filters?.preset);
  const anchorDate = String(filters?.date || "").trim() || getTodayInputValue();
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(anchorDate) ? anchorDate : getTodayInputValue();

  if (preset === "today") {
    return {
      preset,
      presetLabel: "Hôm nay",
      fromDate: safeDate,
      toDate: safeDate,
    };
  }

  if (preset === "month") {
    const monthKey = getYmFromDateInput(safeDate) || getCurrentYm();
    const [year, month] = monthKey.split("-").map(Number);
    const firstDate = `${year}-${pad(month)}-01`;
    const lastDate = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

    return {
      preset,
      presetLabel: `Tháng ${formatMonthLabel(monthKey)}`,
      fromDate: firstDate,
      toDate: lastDate,
    };
  }

  return {
    preset,
    presetLabel: "30 ngày gần nhất",
    fromDate: shiftDateInput(safeDate, -29),
    toDate: safeDate,
  };
}

export function formatMonthLabel(ym = getCurrentYm()) {
  const raw = String(ym || "").trim();
  const [year, month] = raw.split("-");
  if (!year || !month) return raw;
  return `${month}/${year}`;
}

export function formatCurrency(amount = 0) {
  const value = Math.round(Number(amount || 0));
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)}đ`;
}

export function formatCurrencyCompact(amount = 0) {
  const value = Number(amount || 0);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    const scaled = abs / 1_000_000_000;
    const text = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text} tỷ`;
  }

  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text} tr`;
  }

  if (abs >= 10_000) {
    const scaled = abs / 1_000;
    const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text} k`;
  }

  return formatCurrency(value);
}

export function formatDateLabel(value) {
  const date = toDate(value);
  if (!date) return "--";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function toDateInputValue(value) {
  const date = toDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function normalizeFinanceFilters(filters = {}) {
  return {
    preset: normalizeFinancePreset(filters?.preset),
    accountId: String(filters?.accountId || "all").trim() || "all",
    type: String(filters?.type || "all").trim() || "all",
    categoryKey: String(filters?.categoryKey || "all").trim() || "all",
    scopeId: String(filters?.scopeId || "all").trim() || "all",
    date: String(filters?.date || getTodayInputValue()).trim() || getTodayInputValue(),
    search: String(filters?.search || "").trim(),
  };
}

export function getYmFromDateInput(value = "") {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw.slice(0, 7) : "";
}

export function sanitizeAccountDraft(payload = {}) {
  const name = String(payload?.name || "").trim();
  const type = String(payload?.type || "bank").trim();
  const openingBalance = Math.round(Number(payload?.openingBalance || 0));
  const isDefault = !!payload?.isDefault;

  if (!name) throw new Error("Vui lòng nhập tên tài khoản.");
  if (!Number.isFinite(openingBalance)) throw new Error("Số dư đầu kỳ không hợp lệ.");

  const typeValid = ACCOUNT_TYPE_OPTIONS.some((item) => item.key === type) ? type : "other";
  return {
    name,
    type: typeValid,
    openingBalance,
    isDefault,
  };
}

export function sanitizeAccountEditDraft(payload = {}) {
  const id = String(payload?.id || "").trim();
  const name = String(payload?.name || "").trim();
  const type = String(payload?.type || "bank").trim();
  const isDefault = !!payload?.isDefault;

  if (!id) throw new Error("Không tìm thấy tài khoản cần cập nhật.");
  if (!name) throw new Error("Vui lòng nhập tên tài khoản.");

  const typeValid = ACCOUNT_TYPE_OPTIONS.some((item) => item.key === type) ? type : "other";
  return {
    id,
    name,
    type: typeValid,
    isDefault,
  };
}

export function sanitizeTransactionDraft(payload = {}) {
  const id = String(payload?.id || "").trim();
  const type = String(payload?.type || "expense").trim();
  const amount = Math.round(Number(payload?.amount || 0));
  const occurredAt = String(payload?.occurredAt || "").trim();
  const accountId = String(payload?.accountId || "").trim();
  const toAccountId = String(payload?.toAccountId || "").trim();
  const categoryKey = String(payload?.categoryKey || "other").trim() || "other";
  const scopeId = String(payload?.scopeId || "").trim();
  const note = String(payload?.note || "").trim();

  if (!FINANCE_TRANSACTION_TYPE_OPTIONS.some((item) => item.key === type)) {
    throw new Error("Loại giao dịch không hợp lệ.");
  }
  if (!accountId) throw new Error("Vui lòng chọn tài khoản.");
  if (!occurredAt) throw new Error("Vui lòng chọn ngày ghi nhận.");

  if (type === "transfer") {
    if (!toAccountId) throw new Error("Vui lòng chọn tài khoản nhận.");
    if (toAccountId === accountId) throw new Error("Tài khoản chuyển và nhận phải khác nhau.");
    if (!(amount > 0)) throw new Error("Số tiền chuyển phải lớn hơn 0.");
  } else if (!(amount > 0)) {
    throw new Error("Số tiền phải lớn hơn 0.");
  }

  if (type === "expense" && !scopeId) {
    throw new Error("Vui lòng chọn nhóm chi.");
  }

  return {
    id,
    type,
    amount,
    occurredAt,
    accountId,
    toAccountId: type === "transfer" ? toAccountId : "",
    categoryKey: type === "expense" ? categoryKey : "",
    scopeId: type === "expense" ? scopeId : "",
    note,
  };
}

export function buildTransactionDraft({
  accounts = [],
  transaction = null,
  type = "expense",
  presetAccountId = "",
} = {}) {
  const activeAccounts = (Array.isArray(accounts) ? accounts : []).filter(
    (item) => String(item?.status || "active") !== "archived"
  );
  const defaultAccountId =
    String(presetAccountId || "").trim() ||
    String(activeAccounts.find((item) => item?.isDefault)?.id || "").trim() ||
    String(activeAccounts[0]?.id || "").trim();

  if (transaction) {
    return {
      id: String(transaction?.id || "").trim(),
      type: String(transaction?.type || type || "expense").trim(),
      accountId: String(transaction?.accountId || defaultAccountId).trim(),
      toAccountId: String(transaction?.toAccountId || "").trim(),
      amount: Number(transaction?.amount || 0),
      occurredAt: toDateInputValue(transaction?.occurredAt),
      categoryKey: String(transaction?.categoryKey || "other").trim() || "other",
      scopeId: String(transaction?.scopeId || "").trim(),
      note: String(transaction?.note || "").trim(),
    };
  }

  return {
    id: "",
    type: String(type || "expense").trim(),
    accountId: defaultAccountId,
    toAccountId: String(activeAccounts.find((item) => item?.id !== defaultAccountId)?.id || "").trim(),
    amount: "",
    occurredAt: getTodayInputValue(),
    categoryKey: "other",
    scopeId: "",
    note: "",
  };
}

export function buildFinanceVm({
  month,
  accounts = [],
  transactions = [],
  expenseScopes = [],
  expenseCategories = [],
  filters = {},
} = {}) {
  const normalizedFilters = normalizeFinanceFilters(filters);
  const financeRange = getFinanceRange(normalizedFilters);
  const orderedAccounts = sortAccounts(accounts);
  const accountMap = buildAccountMap(orderedAccounts);
  const scopeMap = buildScopeMap(expenseScopes);
  const categoryOptions = getExpenseCategoryOptions(expenseCategories);
  const orderedTransactions = sortTransactions(transactions).filter((transaction) =>
    isFinanceTransactionType(transaction?.type)
  );
  const filteredTransactions = orderedTransactions.filter((transaction) => {
    if (
      normalizedFilters.accountId !== "all" &&
      String(transaction?.accountId || "").trim() !== normalizedFilters.accountId &&
      String(transaction?.toAccountId || "").trim() !== normalizedFilters.accountId
    ) {
      return false;
    }
    if (normalizedFilters.type !== "all" && String(transaction?.type || "").trim() !== normalizedFilters.type) {
      return false;
    }
    if (
      normalizedFilters.categoryKey !== "all" &&
      String(transaction?.categoryKey || "").trim() !== normalizedFilters.categoryKey
    ) {
      return false;
    }
    if (
      normalizedFilters.scopeId !== "all" &&
      String(transaction?.scopeId || "").trim() !== normalizedFilters.scopeId
    ) {
      return false;
    }
    if (normalizedFilters.search) {
      const haystack = buildSearchText(transaction, accountMap, scopeMap);
      if (!haystack.includes(normalizedFilters.search.toLowerCase())) return false;
    }
    return true;
  });

  const incomeTotal = filteredTransactions
    .filter((item) => String(item?.type || "") === "income")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const expenseTotal = filteredTransactions
    .filter((item) => String(item?.type || "") === "expense")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const transferTotal = filteredTransactions
    .filter((item) => String(item?.type || "") === "transfer")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const adjustmentTotal = filteredTransactions
    .filter((item) => String(item?.type || "") === "adjustment")
    .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const totalBalance = orderedAccounts
    .filter((item) => String(item?.status || "active") !== "archived")
    .reduce((sum, item) => sum + Number(item?.currentBalance || 0), 0);

  const ledgerRows = filteredTransactions.map((transaction) => ({
    id: String(transaction?.id || "").trim(),
    dateLabel: formatDateLabel(transaction?.occurredAt),
    title: getTransactionTitle(transaction),
    note: String(transaction?.note || "").trim(),
    typeKey: String(transaction?.type || "").trim(),
    typeLabel: getTransactionTypeLabel(transaction?.type),
    categoryLabel:
      String(transaction?.type || "").trim() === "expense"
        ? getFinanceCategoryLabel(transaction?.categoryKey)
        : "",
    scopeLabel: buildScopeLabel(transaction, scopeMap),
    accountLabel: buildAccountLabel(transaction, accountMap),
    amountText: getTransactionAmountText(transaction),
    amountClass: getTransactionAmountClass(transaction),
  }));
  const ledgerGroups = groupTransactionsByDate(filteredTransactions, accountMap, scopeMap);
  const activeAccounts = orderedAccounts.filter((item) => String(item?.status || "active") !== "archived");
  const archivedAccounts = orderedAccounts.filter((item) => String(item?.status || "active") === "archived");
  const scopeUsageMap = new Map();
  const categoryUsageMap = new Map();
  filteredTransactions.forEach((transaction) => {
    if (String(transaction?.type || "").trim() !== "expense") return;
    const scopeId = String(transaction?.scopeId || "").trim();
    if (scopeId) scopeUsageMap.set(scopeId, (scopeUsageMap.get(scopeId) || 0) + 1);
    const categoryKey = String(transaction?.categoryKey || "").trim();
    if (categoryKey) {
      categoryUsageMap.set(categoryKey, (categoryUsageMap.get(categoryKey) || 0) + 1);
    }
  });

  return {
    month: String(month || getCurrentYm()).trim(),
    monthLabel: formatMonthLabel(month),
    filters: normalizedFilters,
    range: financeRange,
    categories: categoryOptions,
    transactionTypes: FINANCE_TRANSACTION_TYPE_OPTIONS,
    accounts: orderedAccounts,
    activeAccounts,
    archivedAccounts,
    summary: {
      totalBalance,
      incomeTotal,
      expenseTotal,
      transferTotal,
      adjustmentTotal,
      netTotal: incomeTotal - expenseTotal + adjustmentTotal,
      accountHighlights: activeAccounts.slice(0, 4).map((account) => ({
        id: account.id,
        name: account.name,
        typeLabel: getAccountTypeLabel(account.type),
        balanceText: formatCurrency(account.currentBalance || 0),
        metaText: formatTemplate(t("finance.account.openingBalance", "Đầu kỳ {{amount}}"), {
          amount: formatCurrency(account.openingBalance || 0),
        }),
        isDefault: !!account.isDefault,
      })),
    },
    filtersMeta: {
      accountOptions: activeAccounts.map((item) => ({ value: item.id, label: item.name })),
      typeOptions: FINANCE_TRANSACTION_TYPE_OPTIONS,
      categoryOptions,
      scopeOptions: (Array.isArray(expenseScopes) ? expenseScopes : []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    },
    ledger: {
      count: ledgerRows.length,
      rows: ledgerRows,
      groups: ledgerGroups,
      emptyTitle: t("finance.emptyLedgerTitle", "Chưa có giao dịch nào trong tháng này"),
      emptyBody: t(
        "finance.emptyLedgerBody",
        "Thêm một khoản chi, khoản thu hoặc chuyển khoản để bắt đầu sổ giao dịch mới."
      ),
      transferMeta: `Chuyển khoản trong kỳ ${formatCurrency(transferTotal)} • Không tính vào thu hoặc chi`,
      info: buildLedgerInfoText(normalizedFilters),
    },
    accountsPanel: {
      hasActiveAccounts: activeAccounts.length > 0,
      hasArchivedAccounts: archivedAccounts.length > 0,
      summaryText:
        activeAccounts.length || archivedAccounts.length
          ? `${activeAccounts.length + archivedAccounts.length} tài khoản • tổng ${formatCurrency(totalBalance)}`
          : "Chưa có tài khoản",
      activeAccounts: activeAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        typeLabel: getAccountTypeLabel(account.type),
        statusLabel: t("finance.account.active", "Đang dùng"),
        openingBalanceText: formatTemplate(t("finance.account.openingBalance", "Đầu kỳ {{amount}}"), {
          amount: formatCurrency(account.openingBalance || 0),
        }),
        currentBalanceText: formatCurrency(account.currentBalance || 0),
        isDefault: !!account.isDefault,
      })),
      archivedAccounts: archivedAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        typeLabel: getAccountTypeLabel(account.type),
        statusLabel: t("finance.account.archived", "Đã lưu trữ"),
        openingBalanceText: formatTemplate(t("finance.account.openingBalance", "Đầu kỳ {{amount}}"), {
          amount: formatCurrency(account.openingBalance || 0),
        }),
        currentBalanceText: formatCurrency(account.currentBalance || 0),
        isDefault: !!account.isDefault,
      })),
      archivedCount: archivedAccounts.length,
      emptyTitle: t("finance.emptyAccountsTitle", "Chưa có tài khoản nào"),
      emptyBody: t(
        "finance.emptyAccountsBody",
        "Tạo ít nhất một tài khoản để bắt đầu theo dõi số dư và ghi nhận giao dịch."
      ),
    },
    scopePanel: {
      count: Array.isArray(expenseScopes) ? expenseScopes.length : 0,
      summaryText: `${Array.isArray(expenseScopes) ? expenseScopes.length : 0} nhóm chi`,
      items: (Array.isArray(expenseScopes) ? expenseScopes : []).map((scope) => ({
        id: scope.id,
        name: scope.name,
        usageCount: Number(scopeUsageMap.get(scope.id) || 0),
        canDelete: (Array.isArray(expenseScopes) ? expenseScopes.length : 0) > 1,
      })),
      emptyTitle: "Chưa có nhóm chi nào",
      emptyBody: "Thêm nhóm chi để tách khoản cá nhân, gia đình hoặc mục đích.",
    },
    categoryPanel: {
      count: Array.isArray(expenseCategories) ? expenseCategories.length : 0,
      summaryText: `${Array.isArray(expenseCategories) ? expenseCategories.length : 0} danh mục`,
      items: (Array.isArray(expenseCategories) ? expenseCategories : [])
        .filter((item) => !String(item?.parentId || "").trim())
        .map((category) => {
          const key = String(category.key || category.id).trim();
          return {
            id: category.id,
            key,
            name: category.name,
            usageCount:
              Number(categoryUsageMap.get(key) || 0) +
              Number(categoryUsageMap.get(String(category.id || "").trim()) || 0) +
              Number(categoryUsageMap.get(String(category.legacyKey || "").trim()) || 0),
            canDelete: (Array.isArray(expenseCategories) ? expenseCategories.length : 0) > 1,
          };
        }),
      emptyTitle: "Chưa có danh mục nào",
      emptyBody: "Thêm danh mục để phân loại khoản chi chi tiết hơn.",
    },
  };
}

export function buildCsvContent(vm = {}) {
  const rows = Array.isArray(vm?.ledger?.rows) ? vm.ledger.rows : [];
  const header = ["Ngày", "Loại", "Tài khoản", "Danh mục", "Nhóm chi chi", "Ghi chú", "Số tiền"];
  const lines = [header.join(",")];

  rows.forEach((row) => {
    const values = [
      row.dateLabel,
      row.typeLabel,
      row.accountLabel,
      row.categoryLabel,
      row.scopeLabel,
      row.note || row.title,
      row.amountText,
    ].map((value) => `"${String(value || "").replaceAll('"', '""')}"`);
    lines.push(values.join(","));
  });

  return lines.join("\n");
}

export function buildScopeBudgetPanel({
  expenseScopes = [],
  scopeBudgets = [],
  monthTransactions = [],
  monthKey = getCurrentYm(),
} = {}) {
  const budgetByScope = new Map(
    (Array.isArray(scopeBudgets) ? scopeBudgets : []).map((item) => [
      String(item?.scopeId || "").trim(),
      item,
    ])
  );
  const spentByScope = new Map();
  (Array.isArray(monthTransactions) ? monthTransactions : []).forEach((transaction) => {
    if (String(transaction?.type || "").trim() !== "expense") return;
    const scopeId = String(transaction?.scopeId || "").trim();
    if (!scopeId) return;
    spentByScope.set(scopeId, Number(spentByScope.get(scopeId) || 0) + Math.abs(Number(transaction?.amount || 0)));
  });

  const items = (Array.isArray(expenseScopes) ? expenseScopes : []).map((scope) => {
    const scopeId = String(scope?.id || "").trim();
    const budget = budgetByScope.get(scopeId) || null;
    const spent = Number(spentByScope.get(scopeId) || 0);
    const limitAmount = Number(budget?.limitAmount || 0);
    return {
      scopeId,
      name: String(scope?.name || "").trim(),
      budgetId: String(budget?.id || "").trim(),
      limitAmount,
      limitText: limitAmount > 0 ? formatCurrency(limitAmount) : "",
      spent,
      spentText: formatCurrency(spent),
      overBudget: limitAmount > 0 && spent > limitAmount,
    };
  });

  return {
    monthKey: String(monthKey || getCurrentYm()).trim(),
    monthLabel: formatMonthLabel(monthKey),
    items,
    emptyTitle: "Chưa có nhóm chi",
    emptyBody: "Thêm nhóm chi trước khi đặt ngân sách tháng.",
  };
}

import { getExpenseCategoryOptions, getFinanceCategoryLabel } from "../../shared/constants/finance.constants.js";
import { formatCurrency, getTodayInputValue } from "../finance/finance.controller.js";
import { t } from "../../shared/constants/copy.vi.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fillSelect(selectEl, items = [], selectedValue = "", placeholder = "") {
  if (!selectEl) return;
  const options = [];
  if (placeholder) options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
  items.forEach((item) => {
    const value = String(item?.value ?? item?.key ?? item?.id ?? "").trim();
    const label = String(item?.label ?? item?.name ?? "").trim();
    options.push(`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
  });
  selectEl.innerHTML = options.join("");
  selectEl.value = String(selectedValue || "").trim();
}

export function sanitizeRecurringRuleDraft(payload = {}) {
  const type = String(payload?.type || "expense").trim() === "income" ? "income" : "expense";
  const amount = Math.round(Number(payload?.amount || 0));
  const dayOfMonth = Math.round(Number(payload?.dayOfMonth || 0));
  const categoryKey = String(payload?.categoryKey || "other").trim() || "other";
  const scopeId = String(payload?.scopeId || "").trim();
  const accountId = String(payload?.accountId || "").trim();
  const note = String(payload?.note || "").trim();

  if (!(amount > 0)) throw new Error(t("recurring.errAmount", "Số tiền phải lớn hơn 0."));
  if (!(dayOfMonth >= 1 && dayOfMonth <= 28)) {
    throw new Error(t("recurring.errDay", "Ngày trong tháng phải từ 1 đến 28."));
  }
  if (!accountId) throw new Error(t("recurring.errAccount", "Vui lòng chọn tài khoản."));
  if (type === "expense" && !scopeId) {
    throw new Error(t("recurring.errScope", "Vui lòng chọn nhóm chi."));
  }

  return {
    type,
    amount,
    dayOfMonth,
    categoryKey: type === "expense" ? categoryKey : "",
    scopeId: type === "expense" ? scopeId : "",
    accountId,
    note,
    active: true,
  };
}

export function buildTransactionFromRecurringRule(rule = {}, { occurredAt = getTodayInputValue() } = {}) {
  const type = String(rule?.type || "expense").trim() === "income" ? "income" : "expense";
  return {
    type,
    amount: Math.round(Number(rule?.amount || 0)),
    occurredAt: String(occurredAt || getTodayInputValue()).trim(),
    accountId: String(rule?.accountId || "").trim(),
    categoryKey: type === "expense" ? String(rule?.categoryKey || "other").trim() || "other" : "",
    scopeId: type === "expense" ? String(rule?.scopeId || "").trim() : "",
    note: String(rule?.note || "").trim(),
  };
}

export function renderRecurringSection({
  rules = [],
  accounts = [],
  expenseScopes = [],
  expenseCategories = [],
} = {}) {
  const listEl = document.getElementById("recurringRulesList");
  const summaryEl = document.getElementById("recurringRulesSummary");
  const typeEl = document.getElementById("rrType");
  const dayEl = document.getElementById("rrDayOfMonth");
  const amountEl = document.getElementById("rrAmount");
  const categoryEl = document.getElementById("rrCategory");
  const scopeEl = document.getElementById("rrScopeId");
  const accountEl = document.getElementById("rrAccountId");
  const noteEl = document.getElementById("rrNote");

  const activeAccounts = (Array.isArray(accounts) ? accounts : [])
    .filter((item) => String(item?.status || "active") !== "archived")
    .map((item) => ({ value: item.id, label: item.name }));
  const scopes = (Array.isArray(expenseScopes) ? expenseScopes : []).map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const categories = getExpenseCategoryOptions(expenseCategories);
  const accountMap = new Map((Array.isArray(accounts) ? accounts : []).map((a) => [String(a.id), a]));
  const scopeMap = new Map((Array.isArray(expenseScopes) ? expenseScopes : []).map((s) => [String(s.id), s]));

  if (summaryEl) {
    summaryEl.textContent = `${(Array.isArray(rules) ? rules : []).length} mẫu`;
  }

  fillSelect(typeEl, [
    { value: "expense", label: t("recurring.typeExpense", "Chi") },
    { value: "income", label: t("recurring.typeIncome", "Thu") },
  ], typeEl?.value || "expense");
  fillSelect(categoryEl, categories, categoryEl?.value || "other");
  fillSelect(scopeEl, scopes, scopeEl?.value || scopes[0]?.value || "", t("recurring.pickScope", "Chọn nhóm chi"));
  fillSelect(
    accountEl,
    activeAccounts,
    accountEl?.value || activeAccounts[0]?.value || "",
    t("recurring.pickAccount", "Chọn tài khoản")
  );
  if (dayEl && !dayEl.value) dayEl.value = "1";
  if (amountEl && amountEl.value === undefined) amountEl.value = "";
  if (noteEl && noteEl.value === undefined) noteEl.value = "";

  if (!listEl) return;

  const items = Array.isArray(rules) ? rules : [];
  if (!items.length) {
    listEl.innerHTML = `
      <div class="finance-empty">
        <strong>${escapeHtml(t("recurring.emptyTitle", "Chưa có khoản định kỳ"))}</strong>
        <div>${escapeHtml(
          t("recurring.emptyBody", "Thêm mẫu chi/thu theo ngày trong tháng, rồi bấm Tạo hôm nay khi cần.")
        )}</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div class="scope-list">
      ${items
        .map((rule) => {
          const type = String(rule?.type || "expense").trim();
          const typeLabel = type === "income" ? t("recurring.typeIncome", "Thu") : t("recurring.typeExpense", "Chi");
          const accountName = accountMap.get(String(rule?.accountId || "").trim())?.name || "—";
          const scopeName = scopeMap.get(String(rule?.scopeId || "").trim())?.name || "";
          const categoryLabel = type === "expense" ? getFinanceCategoryLabel(rule?.categoryKey) : "";
          const meta = [
            `Ngày ${Number(rule?.dayOfMonth || 0)}`,
            typeLabel,
            categoryLabel,
            scopeName,
            accountName,
            rule?.note || "",
          ]
            .filter(Boolean)
            .join(" · ");

          return `
            <article class="scope-card">
              <div class="scope-card-main">
                <div class="scope-card-title u-money">${escapeHtml(formatCurrency(rule?.amount || 0))}</div>
                <div class="scope-card-meta u-ellipsis">${escapeHtml(meta)}</div>
              </div>
              <div class="scope-card-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  data-recurring-action="create-today"
                  data-recurring-id="${escapeHtml(rule.id)}"
                >
                  ${escapeHtml(t("recurring.createToday", "Tạo hôm nay"))}
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  data-recurring-action="delete"
                  data-recurring-id="${escapeHtml(rule.id)}"
                >
                  ${escapeHtml(t("common.delete", "Xóa"))}
                </button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function readRecurringForm() {
  return {
    type: document.getElementById("rrType")?.value || "expense",
    amount: document.getElementById("rrAmount")?.value || "",
    dayOfMonth: document.getElementById("rrDayOfMonth")?.value || "",
    categoryKey: document.getElementById("rrCategory")?.value || "other",
    scopeId: document.getElementById("rrScopeId")?.value || "",
    accountId: document.getElementById("rrAccountId")?.value || "",
    note: document.getElementById("rrNote")?.value || "",
  };
}

export function clearRecurringForm() {
  const amountEl = document.getElementById("rrAmount");
  const noteEl = document.getElementById("rrNote");
  const dayEl = document.getElementById("rrDayOfMonth");
  if (amountEl) amountEl.value = "";
  if (noteEl) noteEl.value = "";
  if (dayEl) dayEl.value = "1";
}

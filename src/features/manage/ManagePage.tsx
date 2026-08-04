import { useEffect, useMemo, useState } from "react";
import { useLedgerUid } from "../../shared/hooks/useLedgerUid";
import { useWorkspaceContext } from "../../app/WorkspaceProvider";
import {
  archiveAccount,
  createAccount,
  createExpenseCategory,
  createExpenseScope,
  createRecurringRule,
  createSavingsGoal,
  createTransaction,
  deleteExpenseCategory,
  deleteExpenseScope,
  deleteRecurringRule,
  deleteSavingsGoal,
  saveScopeBudget,
  updateExpenseCategory,
  updateExpenseScope,
  updateLedgerAccount,
  updateSavingsGoal,
} from "../../services/firebase/firestore";
import { getTodayInputValue } from "../../shared/lib/date";
import { parseAmountInput } from "../../shared/lib/parseAmount";
import { ACCOUNT_TYPE_OPTIONS } from "../../shared/constants/finance";
import { formatCurrency } from "../../shared/lib/money";
import {
  getMoneyOwnerLabel,
  matchesMoneyOwnerFilter,
  normalizeAccountMoneyOwner,
  resolveTransactionMoneyOwner,
} from "../../shared/lib/moneyOwner";
import { useOwnerLabels } from "../../shared/hooks/useOwnerLabels";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageState } from "../../shared/ui/PageState";
import { MoneyOwnerSelector } from "../../shared/ui/MoneyOwnerSelector";
import { useConfirm } from "../../shared/ui/ConfirmDialog";
import { useToast } from "../../shared/ui/Toast";
import { SavingsGoalCard } from "../../shared/ui/SavingsGoalCard";
import {
  normalizeSavingsGoalIconKey,
  SAVINGS_GOAL_ICON_KEYS,
  SAVINGS_GOAL_ICON_LABELS,
  type SavingsGoalIconKey,
} from "../../shared/constants/savingsGoals";
import { createTransactionFromRecurringRule } from "./recurring";

export function ManagePage() {
  const ledgerUid = useLedgerUid();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { labels, saveLabels, saving: savingLabels } = useOwnerLabels();
  const {
    loading,
    error,
    accounts,
    scopes,
    categories,
    recurringRules,
    savingsGoals,
    scopeBudgets,
    transactions,
    month,
    setMonth,
    refresh,
  } = useWorkspaceContext();

  const [ownerLabelForm, setOwnerLabelForm] = useState({
    personal: labels.personal,
    mother: labels.mother,
  });
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setOwnerLabelForm({ personal: labels.personal, mother: labels.mother });
  }, [labels.personal, labels.mother]);
  const [accountForm, setAccountForm] = useState({
    id: "",
    name: "",
    type: "cash",
    openingBalance: "0",
    isDefault: false,
    moneyOwner: "personal" as "personal" | "mother",
  });
  const [scopeName, setScopeName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [renameOpen, setRenameOpen] = useState<{
    kind: "scope" | "category";
    id: string;
    name: string;
  } | null>(null);
  const [goalForm, setGoalForm] = useState<{
    name: string;
    targetAmount: string;
    currentAmount: string;
    iconKey: SavingsGoalIconKey;
  }>({ name: "", targetAmount: "", currentAmount: "0", iconKey: "custom" });
  const [goalEdit, setGoalEdit] = useState<{
    id: string;
    name: string;
    targetAmount: string;
    currentAmount: string;
    iconKey: SavingsGoalIconKey;
  } | null>(null);
  const [contribute, setContribute] = useState<{
    goalId: string;
    goalName: string;
    accountId: string;
    amount: string;
  } | null>(null);
  const [budgetOwnerFilter, setBudgetOwnerFilter] = useState("all");
  const [ruleForm, setRuleForm] = useState({
    type: "expense",
    amount: "",
    dayOfMonth: "1",
    accountId: "",
    scopeId: "",
    categoryKey: "other",
    note: "",
  });

  const spentByScope = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((tx) => {
      if (tx.type !== "expense") return;
      if (!matchesMoneyOwnerFilter(resolveTransactionMoneyOwner(tx, accounts), budgetOwnerFilter)) return;
      const scopeId = String(tx.scopeId || "");
      if (!scopeId) return;
      map.set(scopeId, (map.get(scopeId) || 0) + Math.abs(Number(tx.amount || 0)));
    });
    return map;
  }, [transactions, budgetOwnerFilter, accounts]);

  async function saveAccount() {
    if (!ledgerUid) return;
    try {
      if (accountForm.id) {
        await updateLedgerAccount(ledgerUid, accountForm.id, accountForm);
      } else {
        await createAccount(ledgerUid, {
          ...accountForm,
          openingBalance: Number(accountForm.openingBalance || 0),
        });
      }
      showToast("Đã lưu tài khoản.", "success");
      setAccountOpen(false);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể lưu tài khoản.", "error");
    }
  }

  async function askRemoveAccount(accountId: string, accountName: string) {
    if (!ledgerUid) return;
    const ok = await confirm({
      title: "Xóa ví / tài khoản",
      message: `Xác nhận thao tác với “${accountName}”.`,
      details: [
        "Chưa có giao dịch: hệ thống sẽ xóa hẳn ví.",
        "Đã có giao dịch: ví sẽ được lưu trữ để giữ lịch sử, không mất dữ liệu cũ.",
      ],
      confirmLabel: "Xác nhận xóa",
      tone: "danger",
    });
    if (!ok) return;

    try {
      const result = await archiveAccount(ledgerUid, accountId);
      showToast(
        result?.action === "deleted" ? `Đã xóa ví "${accountName}".` : `Đã lưu trữ ví "${accountName}".`,
        "success"
      );
      if (accountForm.id === accountId) setAccountOpen(false);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể xóa ví.", "error");
    }
  }

  async function saveRename() {
    if (!ledgerUid || !renameOpen) return;
    const name = renameOpen.name.trim();
    if (!name) {
      showToast("Vui lòng nhập tên.", "error");
      return;
    }
    try {
      if (renameOpen.kind === "scope") {
        await updateExpenseScope(ledgerUid, renameOpen.id, { name });
        showToast("Đã đổi tên nhóm chi.", "success");
      } else {
        await updateExpenseCategory(ledgerUid, renameOpen.id, { name });
        showToast("Đã đổi tên danh mục.", "success");
      }
      setRenameOpen(null);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể đổi tên.", "error");
    }
  }

  async function askDeleteScope(scopeId: string, scopeName: string) {
    if (!ledgerUid) return;
    const replacement = scopes.find((item) => item.id !== scopeId);
    const ok = await confirm({
      title: "Xóa nhóm chi",
      message: `Xóa nhóm chi “${scopeName}”?`,
      details: replacement
        ? [`Giao dịch và ngân sách liên quan (nếu có) sẽ chuyển sang “${replacement.name}”.`]
        : ["Cần giữ lại ít nhất 1 nhóm chi."],
      confirmLabel: "Xóa nhóm",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteExpenseScope(ledgerUid, scopeId, {
        replacementScopeId: replacement?.id || "",
      });
      showToast("Đã xóa nhóm chi.", "success");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể xóa nhóm chi.", "error");
    }
  }

  async function askDeleteCategory(categoryId: string, categoryName: string) {
    if (!ledgerUid) return;
    const replacement = categories.find((item) => item.id !== categoryId);
    const ok = await confirm({
      title: "Xóa danh mục",
      message: `Xóa danh mục “${categoryName}”?`,
      details: replacement
        ? [`Giao dịch đang dùng danh mục này (nếu có) sẽ chuyển sang “${replacement.name}”.`]
        : ["Cần giữ lại ít nhất 1 danh mục."],
      confirmLabel: "Xóa danh mục",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteExpenseCategory(ledgerUid, categoryId, {
        replacementCategoryId: replacement?.id || "",
      });
      showToast("Đã xóa danh mục.", "success");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể xóa danh mục.", "error");
    }
  }

  async function saveGoalEdit() {
    if (!ledgerUid || !goalEdit) return;
    try {
      await updateSavingsGoal(ledgerUid, goalEdit.id, {
        name: goalEdit.name.trim(),
        targetAmount: Number(goalEdit.targetAmount),
        currentAmount: Number(goalEdit.currentAmount || 0),
        iconKey: goalEdit.iconKey,
      });
      showToast("Đã cập nhật mục tiêu.", "success");
      setGoalEdit(null);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể cập nhật mục tiêu.", "error");
    }
  }

  async function createTodayFromRule(ruleId: string) {
    if (!ledgerUid) return;
    const rule = recurringRules.find((item) => item.id === ruleId);
    if (!rule) return;
    try {
      await createTransactionFromRecurringRule(ledgerUid, rule, accounts);
      showToast("Đã tạo giao dịch từ mẫu định kỳ.", "success");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể tạo giao dịch định kỳ.", "error");
    }
  }

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingText="Đang tải quản lý..." />;
  }

  return (
    <div className="page">
      <PageHeader title="Quản lý" />

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Tên hai dòng tiền</h2>
            <p className="card-subtitle">Đổi cách gọi cho dễ nhìn (ví dụ: Cá nhân / Gia đình).</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={savingLabels}
            onClick={() => {
              void saveLabels({
                personal: ownerLabelForm.personal.trim() || labels.personal,
                mother: ownerLabelForm.mother.trim() || labels.mother,
              })
                .then(() => showToast("Đã lưu tên dòng tiền.", "success"))
                .catch((err) => {
                  showToast(err instanceof Error ? err.message : "Không thể lưu tên dòng tiền.", "error");
                });
            }}
          >
            {savingLabels ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
        <div className="filters">
          <label className="field">
            <span className="field-label">Dòng tiền của bạn</span>
            <input
              value={ownerLabelForm.personal}
              onChange={(event) =>
                setOwnerLabelForm((current) => ({ ...current, personal: event.target.value }))
              }
              maxLength={40}
            />
          </label>
          <label className="field">
            <span className="field-label">Dòng tiền còn lại (VD: ví mẹ / VP Bank)</span>
            <input
              value={ownerLabelForm.mother}
              onChange={(event) =>
                setOwnerLabelForm((current) => ({ ...current, mother: event.target.value }))
              }
              maxLength={40}
            />
          </label>
        </div>
      </section>

      <div className="grid grid-2 manage-layout">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Ví</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAccountForm({
                  id: "",
                  name: "",
                  type: "cash",
                  openingBalance: "0",
                  isDefault: false,
                  moneyOwner: "personal",
                });
                setAccountOpen(true);
              }}
            >
              Thêm
            </button>
          </div>
          <div className="list manage-compact-list">
            {accounts.map((account) => (
              <div key={account.id} className="list-row manage-compact-row">
                <div className="list-main">
                  <div className="list-title">
                    {account.name}
                    {account.status === "archived" ? " · lưu trữ" : ""}
                  </div>
                  <div className="list-meta">
                    {getMoneyOwnerLabel(normalizeAccountMoneyOwner(account.moneyOwner), labels)} ·{" "}
                    {formatCurrency(account.currentBalance || 0)}
                  </div>
                </div>
                {account.status !== "archived" ? (
                  <div className="list-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setAccountForm({
                          id: account.id,
                          name: account.name,
                          type: String(account.type || "cash"),
                          openingBalance: String(account.openingBalance || 0),
                          isDefault: !!account.isDefault,
                          moneyOwner: normalizeAccountMoneyOwner(account.moneyOwner),
                        });
                        setAccountOpen(true);
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => void askRemoveAccount(account.id, account.name)}
                    >
                      Xóa
                    </button>
                  </div>
                ) : (
                  <span className="list-meta">Lưu trữ</span>
                )}
              </div>
            ))}
            {!accounts.length ? <EmptyState title="Chưa có ví" /> : null}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Ngân sách</h2>
            <div className="manage-head-tools">
              <select
                className="field-control manage-inline-select"
                value={budgetOwnerFilter}
                onChange={(event) => setBudgetOwnerFilter(event.target.value)}
                aria-label="Lọc nguồn tiền"
              >
                <option value="all">Tất cả</option>
                <option value="personal">Tôi</option>
                <option value="mother">Mẹ</option>
              </select>
              <input
                className="month-input"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </div>
          </div>
          <div className="list manage-compact-list">
            {scopes.map((scope) => {
              const budget = scopeBudgets.find((item) => item.scopeId === scope.id);
              const spent = spentByScope.get(scope.id) || 0;
              const limit = Number(budget?.limitAmount || 0);
              return (
                <div key={scope.id} className="list-row manage-compact-row">
                  <div className="list-main">
                    <div className="list-title">{scope.name}</div>
                    <div className="list-meta">
                      {formatCurrency(spent)}
                      {limit > 0 ? ` / ${formatCurrency(limit)}` : ""}
                      {limit > 0 && spent > limit ? " · Vượt" : ""}
                    </div>
                  </div>
                  <input
                    key={`${scope.id}-${month}-${limit}`}
                    className="field-control manage-budget-input"
                    type="number"
                    defaultValue={limit || ""}
                    placeholder="Hạn mức"
                    onBlur={(event) => {
                      if (!ledgerUid) return;
                      const value = Number(event.target.value || 0);
                      if (!(value > 0)) return;
                      void saveScopeBudget(ledgerUid, {
                        scopeId: scope.id,
                        monthKey: month,
                        limitAmount: value,
                      })
                        .then(() => {
                          showToast("Đã lưu ngân sách.", "success");
                          return refresh();
                        })
                        .catch((err) => showToast(err?.message || "Lỗi", "error"));
                    }}
                  />
                </div>
              );
            })}
            {!scopes.length ? <EmptyState title="Thêm nhóm chi trước" /> : null}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Nhóm chi</h2>
          </div>
          <div className="stack manage-catalog">
            <div className="toolbar-form">
              <input
                className="field-control"
                value={scopeName}
                placeholder="Tên nhóm chi"
                onChange={(event) => setScopeName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !ledgerUid || !scopeName.trim()) return;
                  void createExpenseScope(ledgerUid, { name: scopeName.trim() })
                    .then(() => {
                      setScopeName("");
                      showToast("Đã thêm nhóm chi.", "success");
                      return refresh();
                    })
                    .catch((err) => showToast(err?.message || "Lỗi", "error"));
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (!ledgerUid || !scopeName.trim()) return;
                  void createExpenseScope(ledgerUid, { name: scopeName.trim() })
                    .then(() => {
                      setScopeName("");
                      showToast("Đã thêm nhóm chi.", "success");
                      return refresh();
                    })
                    .catch((err) => showToast(err?.message || "Lỗi", "error"));
                }}
              >
                Thêm
              </button>
            </div>
            <div className="list manage-compact-list">
              {scopes.map((scope) => (
                <div key={scope.id} className="list-row manage-compact-row">
                  <div className="list-title u-ellipsis">{scope.name}</div>
                  <div className="list-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setRenameOpen({ kind: "scope", id: scope.id, name: scope.name })}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => void askDeleteScope(scope.id, scope.name)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
              {!scopes.length ? <EmptyState title="Chưa có nhóm chi" /> : null}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Danh mục</h2>
          </div>
          <div className="stack manage-catalog">
            <div className="toolbar-form">
              <input
                className="field-control"
                value={categoryName}
                placeholder="Tên danh mục"
                onChange={(event) => setCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !ledgerUid || !categoryName.trim()) return;
                  void createExpenseCategory(ledgerUid, { name: categoryName.trim() })
                    .then(() => {
                      setCategoryName("");
                      showToast("Đã thêm danh mục.", "success");
                      return refresh();
                    })
                    .catch((err) => showToast(err?.message || "Lỗi", "error"));
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (!ledgerUid || !categoryName.trim()) return;
                  void createExpenseCategory(ledgerUid, { name: categoryName.trim() })
                    .then(() => {
                      setCategoryName("");
                      showToast("Đã thêm danh mục.", "success");
                      return refresh();
                    })
                    .catch((err) => showToast(err?.message || "Lỗi", "error"));
                }}
              >
                Thêm
              </button>
            </div>
            <div className="list manage-compact-list">
              {categories.map((category) => (
                <div key={category.id} className="list-row manage-compact-row">
                  <div className="list-title u-ellipsis">{category.name}</div>
                  <div className="list-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setRenameOpen({ kind: "category", id: category.id, name: category.name })
                      }
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => void askDeleteCategory(category.id, category.name)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
              {!categories.length ? <EmptyState title="Chưa có danh mục" /> : null}
            </div>
          </div>
        </section>

        <section className="card manage-span-2">
          <div className="card-head">
            <h2 className="card-title">Định kỳ & tiết kiệm</h2>
          </div>
          <div className="grid grid-2 manage-split">
            <div className="form-panel stack">
              <h3 className="section-label">Mẫu định kỳ</h3>
              <div className="field">
                <label className="field-label">Loại</label>
                <select value={ruleForm.type} onChange={(event) => setRuleForm((c) => ({ ...c, type: event.target.value }))}>
                  <option value="expense">Chi</option>
                  <option value="income">Thu</option>
                </select>
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label className="field-label">Số tiền</label>
                  <input
                    className="field-control"
                    type="number"
                    placeholder="0"
                    value={ruleForm.amount}
                    onChange={(event) => setRuleForm((c) => ({ ...c, amount: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Ngày trong tháng</label>
                  <input
                    className="field-control"
                    type="number"
                    placeholder="1"
                    value={ruleForm.dayOfMonth}
                    onChange={(event) => setRuleForm((c) => ({ ...c, dayOfMonth: event.target.value }))}
                  />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Ví</label>
                <select
                  value={ruleForm.accountId}
                  onChange={(event) => setRuleForm((c) => ({ ...c, accountId: event.target.value }))}
                >
                  <option value="">Chọn ví</option>
                  {accounts
                    .filter((item) => item.status !== "archived")
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </div>
              {ruleForm.type === "expense" ? (
                <div className="grid grid-2">
                  <div className="field">
                    <label className="field-label">Nhóm chi</label>
                    <select
                      value={ruleForm.scopeId}
                      onChange={(event) => setRuleForm((c) => ({ ...c, scopeId: event.target.value }))}
                    >
                      <option value="">Chọn nhóm chi</option>
                      {scopes.map((scope) => (
                        <option key={scope.id} value={scope.id}>
                          {scope.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Danh mục</label>
                    <select
                      value={ruleForm.categoryKey}
                      onChange={(event) => setRuleForm((c) => ({ ...c, categoryKey: event.target.value }))}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.key || category.id}>
                          {category.name}
                        </option>
                      ))}
                      {!categories.length ? <option value="other">Khác</option> : null}
                    </select>
                  </div>
                </div>
              ) : null}
              <div className="field">
                <label className="field-label">Ghi chú</label>
                <input
                  className="field-control"
                  placeholder="Tùy chọn"
                  value={ruleForm.note}
                  onChange={(event) => setRuleForm((c) => ({ ...c, note: event.target.value }))}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (!ledgerUid) return;
                  void createRecurringRule(ledgerUid, {
                    ...ruleForm,
                    amount: Number(ruleForm.amount),
                    dayOfMonth: Number(ruleForm.dayOfMonth),
                    active: true,
                  })
                    .then(() => {
                      showToast("Đã tạo mẫu định kỳ.", "success");
                      return refresh();
                    })
                    .catch((err) => showToast(err?.message || "Lỗi", "error"));
                }}
              >
                Lưu mẫu định kỳ
              </button>
              <div className="list">
                {recurringRules.map((rule) => (
                  <div key={rule.id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">
                        {rule.type === "income" ? "Thu" : "Chi"} · {formatCurrency(rule.amount)}
                      </div>
                      <div className="list-meta">Ngày {rule.dayOfMonth} hàng tháng</div>
                    </div>
                    <div className="list-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void createTodayFromRule(rule.id)}
                      >
                        Tạo hôm nay
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (!ledgerUid) return;
                          void confirm({
                            title: "Xóa mẫu định kỳ",
                            message: "Mẫu này sẽ bị xóa. Các giao dịch đã tạo trước đó không bị ảnh hưởng.",
                            confirmLabel: "Xóa mẫu",
                            tone: "danger",
                          }).then((ok) => {
                            if (!ok) return;
                            return deleteRecurringRule(ledgerUid, rule.id)
                              .then(() => {
                                showToast("Đã xóa mẫu định kỳ.", "success");
                                return refresh();
                              })
                              .catch((err) => showToast(err?.message || "Lỗi", "error"));
                          });
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
                {!recurringRules.length ? <EmptyState title="Chưa có mẫu định kỳ" /> : null}
              </div>
            </div>

            <div className="form-panel stack">
              <h3 className="section-label">Mục tiêu tiết kiệm</h3>
              <div className="field">
                <label className="field-label">Loại mục tiêu</label>
                <div className="goal-icon-grid">
                  {SAVINGS_GOAL_ICON_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`goal-icon-option${goalForm.iconKey === key ? " is-active" : ""}`}
                      onClick={() => setGoalForm((c) => ({ ...c, iconKey: key }))}
                    >
                      {SAVINGS_GOAL_ICON_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="field-label">Tên mục tiêu</label>
                <input
                  className="field-control"
                  placeholder="Ví dụ: Nhà Q7, xe Vision…"
                  value={goalForm.name}
                  onChange={(event) => setGoalForm((c) => ({ ...c, name: event.target.value }))}
                />
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label className="field-label">Số cần đạt</label>
                  <input
                    className="field-control"
                    type="number"
                    placeholder="0"
                    value={goalForm.targetAmount}
                    onChange={(event) => setGoalForm((c) => ({ ...c, targetAmount: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Hiện có</label>
                  <input
                    className="field-control"
                    type="number"
                    placeholder="0"
                    value={goalForm.currentAmount}
                    onChange={(event) => setGoalForm((c) => ({ ...c, currentAmount: event.target.value }))}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (!ledgerUid) return;
                  void createSavingsGoal(ledgerUid, {
                    name: goalForm.name,
                    targetAmount: Number(goalForm.targetAmount),
                    currentAmount: Number(goalForm.currentAmount || 0),
                    iconKey: goalForm.iconKey,
                  })
                    .then(() => {
                      setGoalForm({ name: "", targetAmount: "", currentAmount: "0", iconKey: "custom" });
                      showToast("Đã tạo mục tiêu.", "success");
                      return refresh();
                    })
                    .catch((err) => showToast(err?.message || "Lỗi", "error"));
                }}
              >
                Thêm mục tiêu
              </button>
              <div className="savings-goals-grid manage-goals-grid">
                {savingsGoals.map((goal) => (
                  <div key={goal.id} className="manage-goal-wrap">
                    <SavingsGoalCard
                      goal={goal}
                      compact
                      onContribute={() =>
                        setContribute({
                          goalId: goal.id,
                          goalName: goal.name,
                          accountId:
                            accounts.find((item) => item.isDefault && item.status !== "archived")?.id ||
                            accounts.find((item) => item.status !== "archived")?.id ||
                            "",
                          amount: "",
                        })
                      }
                    />
                    <div className="list-actions manage-goal-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          setGoalEdit({
                            id: goal.id,
                            name: goal.name,
                            targetAmount: String(goal.targetAmount || 0),
                            currentAmount: String(goal.currentAmount || 0),
                            iconKey: normalizeSavingsGoalIconKey(goal.iconKey),
                          })
                        }
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (!ledgerUid) return;
                          void confirm({
                            title: "Xóa mục tiêu tiết kiệm",
                            message: `Xóa mục tiêu “${goal.name}”?`,
                            confirmLabel: "Xóa mục tiêu",
                            tone: "danger",
                          }).then((ok) => {
                            if (!ok) return;
                            return deleteSavingsGoal(ledgerUid, goal.id)
                              .then(() => {
                                showToast("Đã xóa mục tiêu.", "success");
                                return refresh();
                              })
                              .catch((err) => showToast(err?.message || "Lỗi", "error"));
                          });
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!savingsGoals.length ? <EmptyState title="Chưa có mục tiêu tiết kiệm" /> : null}
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={!!contribute}
        title={contribute ? `Góp vào ${contribute.goalName}` : "Góp tiết kiệm"}
        onClose={() => setContribute(null)}
      >
        {contribute ? (
          <div className="stack">
            <div className="field">
              <label className="field-label">Từ ví</label>
              <select
                value={contribute.accountId}
                onChange={(event) =>
                  setContribute((current) => (current ? { ...current, accountId: event.target.value } : current))
                }
              >
                <option value="">Chọn ví</option>
                {accounts
                  .filter((item) => item.status !== "archived")
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {formatCurrency(account.currentBalance || 0)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Số tiền</label>
              <input
                value={contribute.amount}
                placeholder="500k hoặc 1.5tr"
                onChange={(event) =>
                  setContribute((current) => (current ? { ...current, amount: event.target.value } : current))
                }
              />
            </div>
            <div className="page-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setContribute(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!ledgerUid || !contribute) return;
                  const amount = parseAmountInput(contribute.amount);
                  if (!contribute.accountId) {
                    showToast("Chọn ví.", "error");
                    return;
                  }
                  if (amount == null) {
                    showToast("Số tiền không hợp lệ.", "error");
                    return;
                  }
                  const account = accounts.find((item) => item.id === contribute.accountId);
                  const goal = savingsGoals.find((item) => item.id === contribute.goalId);
                  if (!goal) return;
                  void createTransaction(ledgerUid, {
                    type: "adjustment",
                    amount: -amount,
                    occurredAt: getTodayInputValue(),
                    accountId: contribute.accountId,
                    note: `Góp tiết kiệm: ${goal.name}`,
                    moneyOwner: normalizeAccountMoneyOwner(account?.moneyOwner),
                  })
                    .then(() =>
                      updateSavingsGoal(ledgerUid, goal.id, {
                        currentAmount: Number(goal.currentAmount || 0) + amount,
                      })
                    )
                    .then(() => {
                      showToast("Đã góp tiết kiệm.", "success");
                      setContribute(null);
                      return refresh();
                    })
                    .catch((err) => showToast(err?.message || "Không thể góp.", "error"));
                }}
              >
                Xác nhận góp
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={accountOpen} title={accountForm.id ? "Sửa ví" : "Thêm ví"} onClose={() => setAccountOpen(false)}>
        <div className="stack">
          <div className="field">
            <label className="field-label">Tên ví</label>
            <input
              value={accountForm.name}
              onChange={(event) => setAccountForm((c) => ({ ...c, name: event.target.value }))}
            />
          </div>
          <div className="field">
            <label className="field-label">Loại</label>
            <select
              value={accountForm.type}
              onChange={(event) => setAccountForm((c) => ({ ...c, type: event.target.value }))}
            >
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {!accountForm.id ? (
            <div className="field">
              <label className="field-label">Số dư đầu kỳ</label>
              <input
                type="number"
                value={accountForm.openingBalance}
                onChange={(event) => setAccountForm((c) => ({ ...c, openingBalance: event.target.value }))}
              />
            </div>
          ) : null}
          <MoneyOwnerSelector
            value={accountForm.moneyOwner}
            onChange={(moneyOwner) => setAccountForm((current) => ({ ...current, moneyOwner }))}
            label="Dòng tiền của ví"
            hint="Ví dụ: VP Bank → Tiền của mẹ. Các ví khác → Tiền của tôi."
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={accountForm.isDefault}
              onChange={(event) => setAccountForm((c) => ({ ...c, isDefault: event.target.checked }))}
            />
            <span>Đặt làm ví mặc định</span>
          </label>
          <div className="page-actions">
            {accountForm.id ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void askRemoveAccount(accountForm.id, accountForm.name || "ví này")}
              >
                Xóa ví
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={() => setAccountOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveAccount()}>
              Lưu
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!renameOpen}
        title={renameOpen?.kind === "category" ? "Đổi tên danh mục" : "Đổi tên nhóm chi"}
        onClose={() => setRenameOpen(null)}
      >
        <div className="stack">
          <div className="field">
            <label className="field-label">Tên mới</label>
            <input
              className="field-control"
              value={renameOpen?.name || ""}
              onChange={(event) =>
                setRenameOpen((current) => (current ? { ...current, name: event.target.value } : current))
              }
            />
          </div>
          <div className="page-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setRenameOpen(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveRename()}>
              Lưu
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!goalEdit} title="Sửa mục tiêu tiết kiệm" onClose={() => setGoalEdit(null)}>
        <div className="stack">
          <div className="field">
            <label className="field-label">Loại mục tiêu</label>
            <div className="goal-icon-grid">
              {SAVINGS_GOAL_ICON_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`goal-icon-option${goalEdit?.iconKey === key ? " is-active" : ""}`}
                  onClick={() =>
                    setGoalEdit((current) => (current ? { ...current, iconKey: key } : current))
                  }
                >
                  {SAVINGS_GOAL_ICON_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">Tên mục tiêu</label>
            <input
              className="field-control"
              value={goalEdit?.name || ""}
              onChange={(event) =>
                setGoalEdit((current) => (current ? { ...current, name: event.target.value } : current))
              }
            />
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label className="field-label">Số cần đạt</label>
              <input
                className="field-control"
                type="number"
                value={goalEdit?.targetAmount || ""}
                onChange={(event) =>
                  setGoalEdit((current) =>
                    current ? { ...current, targetAmount: event.target.value } : current
                  )
                }
              />
            </div>
            <div className="field">
              <label className="field-label">Hiện có</label>
              <input
                className="field-control"
                type="number"
                value={goalEdit?.currentAmount || ""}
                onChange={(event) =>
                  setGoalEdit((current) =>
                    current ? { ...current, currentAmount: event.target.value } : current
                  )
                }
              />
            </div>
          </div>
          <div className="page-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setGoalEdit(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveGoalEdit()}>
              Lưu
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

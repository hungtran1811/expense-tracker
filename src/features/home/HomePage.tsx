import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useWorkspaceContext } from "../../app/WorkspaceProvider";
import { formatCurrency } from "../../shared/lib/money";
import { formatMonthLabel, getTodayInputValue, toDateInputValue } from "../../shared/lib/date";
import {
  getMoneyOwnerLabel,
  normalizeAccountMoneyOwner,
  resolveTransactionMoneyOwner,
} from "../../shared/lib/moneyOwner";
import { MoneyOwnerBadge } from "../../shared/ui/MoneyOwnerBadge";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageState } from "../../shared/ui/PageState";
import { TransactionForm, type TransactionDraft } from "../expenses/TransactionForm";
import { createTransaction } from "../../services/firebase/firestore";
import { useLedgerUid } from "../../shared/hooks/useLedgerUid";
import { useToast } from "../../shared/ui/Toast";
import { getFinanceCategoryLabel, isFinanceTransactionType } from "../../shared/constants/finance";
import { summarizeOwnerBoard } from "../reports/reportCalculations";
import { EXPENSE_TEMPLATES } from "../../shared/constants/expenseTemplates";
import { materializeDueRecurringRules } from "../manage/autoRecurring";
import { isLoanPartyNeedsReminder } from "../loans/loanCalculations";
export function HomePage() {
  const ledgerUid = useLedgerUid();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    loading,
    error,
    accounts,
    transactions,
    scopes,
    categories,
    month,
    setMonth,
    refresh,
    savingsGoals,
    scopeBudgets,
    recurringRules,
    loanParties,
    loanTransactions,
  } = useWorkspaceContext();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<"expense" | "income" | "transfer">("expense");
  const [composerInitial, setComposerInitial] = useState<Partial<TransactionDraft> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const compose = (location.state as { compose?: string } | null)?.compose;
    if (compose === "expense" || compose === "income" || compose === "transfer") {
      setComposerType(compose);
      setComposerInitial({ type: compose, occurredAt: getTodayInputValue() });
      setComposerOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!ledgerUid || loading || !recurringRules?.length) return;
    let cancelled = false;
    void materializeDueRecurringRules(ledgerUid, recurringRules, accounts).then((ids) => {
      if (cancelled || !ids.length) return;
      showToast(`Đã tạo ${ids.length} giao dịch định kỳ.`, "success");
      return refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [ledgerUid, loading, recurringRules, accounts, refresh, showToast]);

  const activeAccounts = accounts.filter((item) => String(item.status) !== "archived");
  const monthTx = useMemo(
    () => transactions.filter((tx) => isFinanceTransactionType(tx.type)),
    [transactions]
  );

  const personalBoard = useMemo(
    () => summarizeOwnerBoard("personal", activeAccounts, monthTx),
    [activeAccounts, monthTx]
  );
  const motherBoard = useMemo(
    () => summarizeOwnerBoard("mother", activeAccounts, monthTx),
    [activeAccounts, monthTx]
  );

  const today = getTodayInputValue();
  const todayItems = monthTx.filter((tx) => toDateInputValue(tx.occurredAt) === today).slice(0, 6);
  const recent = [...monthTx]
    .filter((tx) => tx.type === "expense" || tx.type === "income")
    .slice(0, 8);

  const unassignedCount = useMemo(
    () =>
      monthTx.filter(
        (tx) =>
          (tx.type === "expense" || tx.type === "income") &&
          resolveTransactionMoneyOwner(tx, accounts) === "unassigned"
      ).length,
    [monthTx, accounts]
  );

  const budgetRows = useMemo(() => {
    const spent = new Map<string, { personal: number; mother: number; total: number }>();
    monthTx.forEach((tx) => {
      if (tx.type !== "expense") return;
      const scopeId = String(tx.scopeId || "");
      if (!scopeId) return;
      const owner = resolveTransactionMoneyOwner(tx, accounts);
      const amount = Math.abs(Number(tx.amount || 0));
      const row = spent.get(scopeId) || { personal: 0, mother: 0, total: 0 };
      if (owner === "personal") row.personal += amount;
      if (owner === "mother") row.mother += amount;
      row.total += amount;
      spent.set(scopeId, row);
    });
    return scopes
      .map((scope) => {
        const limit = Number(scopeBudgets.find((item) => item.scopeId === scope.id)?.limitAmount || 0);
        const used = spent.get(scope.id) || { personal: 0, mother: 0, total: 0 };
        const pct = limit > 0 ? Math.min(999, (used.total / limit) * 100) : 0;
        return {
          scope,
          limit,
          used: used.total,
          personal: used.personal,
          mother: used.mother,
          pct,
          over: limit > 0 && used.total > limit,
        };
      })
      .filter((item) => item.limit > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [monthTx, scopes, scopeBudgets, accounts]);

  const budgetAlerts = budgetRows.filter((item) => item.over);

  const loanReminders = useMemo(
    () => loanParties.filter((party) => isLoanPartyNeedsReminder(party.id, loanTransactions, 30)),
    [loanParties, loanTransactions]
  );

  function openComposer(type: "expense" | "income" | "transfer", initial?: Partial<TransactionDraft>) {
    setComposerType(type);
    setComposerInitial({ type, occurredAt: getTodayInputValue(), ...initial });
    setComposerOpen(true);
  }

  function openFromTemplate(templateId: string) {
    const template = EXPENSE_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const scope =
      scopes.find((item) => item.name.toLowerCase().includes(template.scopeHint.toLowerCase())) || scopes[0];
    const category =
      categories.find((item) => (item.key || item.id) === template.categoryKey) ||
      categories.find((item) => item.name.toLowerCase().includes(template.label.toLowerCase()));
    openComposer("expense", {
      moneyOwner: template.moneyOwner,
      scopeId: scope?.id || "",
      categoryKey: category?.key || category?.id || template.categoryKey,
      note: template.note,
    });
  }

  function duplicateTx(tx: (typeof recent)[number]) {
    openComposer(tx.type === "income" ? "income" : "expense", {
      type: tx.type === "income" ? "income" : "expense",
      amount: String(Math.abs(Number(tx.amount || 0))),
      accountId: String(tx.accountId || ""),
      categoryKey: String(tx.categoryKey || "other"),
      scopeId: String(tx.scopeId || ""),
      moneyOwner:
        resolveTransactionMoneyOwner(tx, accounts) === "mother" ? "mother" : "personal",
      note: String(tx.note || ""),
      occurredAt: getTodayInputValue(),
    });
  }

  async function handleCreate(draft: TransactionDraft) {
    if (!ledgerUid) return;
    setSubmitting(true);
    try {
      await createTransaction(ledgerUid, {
        ...draft,
        amount: Number(draft.amount),
        moneyOwner: draft.type === "transfer" ? "unassigned" : draft.moneyOwner,
      });
      showToast("Đã lưu giao dịch.", "success");
      setComposerOpen(false);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể lưu giao dịch.", "error");
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingText="Đang tải tổng quan..." />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Tổng quan"
        subtitle={formatMonthLabel(month)}
        actions={
          <>
            <input className="month-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            <button type="button" className="btn btn-primary" onClick={() => openComposer("expense")}>
              + Chi
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => openComposer("income")}>
              + Thu
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => openComposer("transfer")}>
              + Chuyển
            </button>
          </>
        }
      />

      <div className="chip-row">
        {EXPENSE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="chip"
            onClick={() => openFromTemplate(template.id)}
          >
            {template.label}
          </button>
        ))}
      </div>

      {unassignedCount > 0 ? (
        <div className="alert-banner">
          <div>
            <strong>{unassignedCount} giao dịch chưa phân loại</strong>
            <p>Gán nguồn tiền (tôi/mẹ) — có gợi ý theo ví trên Báo cáo.</p>
          </div>
          <Link className="btn btn-secondary btn-sm" to="/reports">
            Phân loại
          </Link>
        </div>
      ) : null}

      {loanReminders.length ? (
        <div className="alert-banner is-danger">
          <div>
            <strong>Cần nhắc nợ: {loanReminders.map((item) => item.name).join(", ")}</strong>
            <p>Còn nợ và lần cho mượn gần nhất đã quá 30 ngày.</p>
          </div>
          <Link className="btn btn-secondary btn-sm" to="/loans">
            Cho mượn
          </Link>
        </div>
      ) : null}

      {budgetAlerts.length ? (
        <div className="alert-banner is-danger">
          <div>
            <strong>Vượt ngân sách: {budgetAlerts.map((item) => item.scope.name).join(", ")}</strong>
            <p>
              {budgetAlerts
                .map(
                  (item) =>
                    `${item.scope.name} ${item.pct.toFixed(0)}% · ${formatCurrency(item.used)} / ${formatCurrency(item.limit)}`
                )
                .join(" · ")}
            </p>
          </div>
          <Link className="btn btn-secondary btn-sm" to="/manage">
            Ngân sách
          </Link>
        </div>
      ) : null}

      {budgetRows.length ? (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Ngân sách {formatMonthLabel(month)}</h2>
          </div>
          <div className="list manage-compact-list">
            {budgetRows.slice(0, 6).map((item) => (
              <div key={item.scope.id} className="list-row manage-compact-row">
                <div className="list-main">
                  <div className="list-title">
                    {item.scope.name} · {item.pct.toFixed(0)}%
                  </div>
                  <div className="list-meta">
                    Tôi {formatCurrency(item.personal)} · Mẹ {formatCurrency(item.mother)} ·{" "}
                    {formatCurrency(item.used)} / {formatCurrency(item.limit)}
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill${item.over ? " is-over" : ""}`}
                      style={{ width: `${Math.min(100, item.pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="owner-boards">
        <article className="owner-board personal">
          <div className="owner-board-head">
            <div>
              <h2 className="owner-board-title">Tiền của tôi</h2>
              <p className="owner-board-meta">
                {personalBoard.accounts.length
                  ? `${personalBoard.accounts.length} ví · các ví còn lại`
                  : "Chưa có ví được gắn"}
              </p>
            </div>
            <Link className="inline-link" to="/reports">
              Báo cáo
            </Link>
          </div>
          <div className="stat-grid stat-grid-compact">
            <div className="stat-card">
              <div className="label">Số dư</div>
              <div className="value u-money">{personalBoard.balanceText}</div>
            </div>
            <div className="stat-card income">
              <div className="label">Thu tháng này</div>
              <div className="value u-money">{personalBoard.incomeText}</div>
            </div>
            <div className="stat-card expense">
              <div className="label">Chi tháng này</div>
              <div className="value u-money">{personalBoard.expenseText}</div>
            </div>
            <div className="stat-card net">
              <div className="label">Còn lại</div>
              <div className="value u-money">{personalBoard.netText}</div>
            </div>
          </div>
          <div className="list">
            {personalBoard.accounts.map((account) => (
              <div key={account.id} className="list-row">
                <div className="list-main">
                  <div className="list-title u-ellipsis">{account.name}</div>
                  <div className="list-meta">{account.isDefault ? "Mặc định" : account.type}</div>
                </div>
                <strong className="amount u-money">{formatCurrency(account.currentBalance || 0)}</strong>
              </div>
            ))}
            {!personalBoard.accounts.length ? (
              <EmptyState title="Chưa có ví của bạn" body="Tạo ví trong Quản lý và để nguồn là Tiền của tôi." />
            ) : null}
          </div>
        </article>

        <article className="owner-board mother">
          <div className="owner-board-head">
            <div>
              <h2 className="owner-board-title">Tiền của mẹ</h2>
              <p className="owner-board-meta">
                {motherBoard.accounts.length
                  ? `${motherBoard.accounts.length} ví · ví dụ VP Bank`
                  : "Gắn ví VP Bank vào dòng này"}
              </p>
            </div>
            <Link className="inline-link" to="/manage">
              Gắn ví
            </Link>
          </div>
          {!motherBoard.accounts.length ? (
            <p className="owner-hint">
              Vào <strong>Quản lý → Sửa ví VP Bank</strong> và chọn nguồn <strong>Tiền của mẹ</strong>. Sau đó bảng này sẽ hiện số dư và báo cáo riêng.
            </p>
          ) : null}
          <div className="stat-grid stat-grid-compact">
            <div className="stat-card">
              <div className="label">Số dư</div>
              <div className="value u-money">{motherBoard.balanceText}</div>
            </div>
            <div className="stat-card income">
              <div className="label">Thu tháng này</div>
              <div className="value u-money">{motherBoard.incomeText}</div>
            </div>
            <div className="stat-card expense">
              <div className="label">Chi tháng này</div>
              <div className="value u-money">{motherBoard.expenseText}</div>
            </div>
            <div className="stat-card net">
              <div className="label">Còn lại</div>
              <div className="value u-money">{motherBoard.netText}</div>
            </div>
          </div>
          <div className="list">
            {motherBoard.accounts.map((account) => (
              <div key={account.id} className="list-row">
                <div className="list-main">
                  <div className="list-title u-ellipsis">{account.name}</div>
                  <div className="list-meta">{getMoneyOwnerLabel(normalizeAccountMoneyOwner(account.moneyOwner))}</div>
                </div>
                <strong className="amount u-money">{formatCurrency(account.currentBalance || 0)}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Hôm nay</h2>
              <p className="card-subtitle">Thu chi trong ngày</p>
            </div>
            <Link className="inline-link" to="/expenses">
              Sổ giao dịch
            </Link>
          </div>
          <div className="list">
            {todayItems.map((tx) => (
              <div key={tx.id} className="list-row">
                <div className="list-main">
                  <div className="list-title">
                    {tx.type === "expense"
                      ? getFinanceCategoryLabel(tx.categoryKey, categories)
                      : tx.type === "income"
                        ? "Khoản thu"
                        : "Chuyển khoản"}
                  </div>
                  <div className="list-meta">
                    <MoneyOwnerBadge owner={resolveTransactionMoneyOwner(tx, accounts)} />
                    <span className="u-ellipsis">{tx.note || "Không ghi chú"}</span>
                  </div>
                </div>
                <strong className={`amount u-money ${tx.type}`}>
                  {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                  {formatCurrency(tx.amount || 0)}
                </strong>
              </div>
            ))}
            {!todayItems.length ? <EmptyState title="Chưa có thu chi hôm nay" /> : null}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Gần đây</h2>
              <p className="card-subtitle">Thu chi mới nhất trong tháng</p>
            </div>
          </div>
          <div className="list">
            {recent.map((tx) => (
              <div key={tx.id} className="list-row">
                <div className="list-main">
                  <div className="list-title">
                    {tx.type === "expense" ? getFinanceCategoryLabel(tx.categoryKey, categories) : "Khoản thu"}
                  </div>
                  <div className="list-meta">
                    <MoneyOwnerBadge owner={resolveTransactionMoneyOwner(tx, accounts)} />
                    <span>{toDateInputValue(tx.occurredAt)}</span>
                  </div>
                </div>
                <div className="list-side">
                  <strong className={`amount u-money ${tx.type}`}>
                    {tx.type === "expense" ? "-" : "+"}
                    {formatCurrency(tx.amount || 0)}
                  </strong>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => duplicateTx(tx)}>
                    Nhân bản
                  </button>
                </div>
              </div>
            ))}
            {!recent.length ? <EmptyState title="Chưa có giao dịch" /> : null}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Tiết kiệm</h2>
              <p className="card-subtitle">Tiến độ mục tiêu</p>
            </div>
          </div>
          <div className="list">
            {savingsGoals.map((goal) => {
              const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
              return (
                <div key={goal.id} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{goal.name}</div>
                    <div className="list-meta">
                      {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {!savingsGoals.length ? <EmptyState title="Chưa có mục tiêu tiết kiệm" body="Thêm trong trang Quản lý." /> : null}
          </div>
        </section>
      </div>

      <Modal
        open={composerOpen}
        title={composerType === "income" ? "Thêm khoản thu" : composerType === "transfer" ? "Chuyển khoản" : "Thêm khoản chi"}
        onClose={() => {
          setComposerOpen(false);
          setComposerInitial(null);
        }}
      >
        <TransactionForm
          key={`home-${composerType}-${composerInitial?.note || ""}-${composerInitial?.amount || ""}`}
          accounts={accounts}
          scopes={scopes}
          categories={categories}
          initial={composerInitial || { type: composerType, occurredAt: getTodayInputValue() }}
          submitting={submitting}
          onCancel={() => {
            setComposerOpen(false);
            setComposerInitial(null);
          }}
          onSubmit={handleCreate}
        />
      </Modal>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLedgerUid } from "../../shared/hooks/useLedgerUid";
import { useWorkspaceContext } from "../../app/WorkspaceProvider";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "../../services/firebase/firestore";
import { getFinanceCategoryLabel, getTransactionTypeLabel, isFinanceTransactionType } from "../../shared/constants/finance";
import {
  defaultDateForMonth,
  formatDateLabel,
  getTodayInputValue,
  getYmFromDateInput,
  shiftDateInput,
  toDateInputValue,
} from "../../shared/lib/date";
import { formatCurrency } from "../../shared/lib/money";
import { downloadCsv } from "../../shared/lib/csv";
import {
  buildMoneyOwnerFilterOptions,
  matchesMoneyOwnerFilter,
  resolveTransactionMoneyOwner,
} from "../../shared/lib/moneyOwner";
import { useOwnerLabels } from "../../shared/hooks/useOwnerLabels";
import type { Transaction } from "../../shared/types/finance";
import { Modal } from "../../shared/ui/Modal";
import { MoneyOwnerBadge } from "../../shared/ui/MoneyOwnerBadge";
import { PageHeader } from "../../shared/ui/PageHeader";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageState } from "../../shared/ui/PageState";
import { useConfirm } from "../../shared/ui/ConfirmDialog";
import { useToast } from "../../shared/ui/Toast";
import { TransactionForm, type TransactionDraft } from "./TransactionForm";

export function ExpensesPage() {
  const ledgerUid = useLedgerUid();
  const { labels } = useOwnerLabels();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const ownerFilterOptions = buildMoneyOwnerFilterOptions(labels);
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, error, accounts, transactions, scopes, categories, month, setMonth, refresh } =
    useWorkspaceContext();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    date: defaultDateForMonth(month),
    accountId: "all",
    moneyOwner: "all",
    type: "all",
    search: "",
  });

  const accountMap = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts]);
  const todayKey = getTodayInputValue();

  function changeDate(nextDate: string) {
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(nextDate) ? nextDate : todayKey;
    setFilters((current) => ({ ...current, date: normalized }));
    const nextMonth = getYmFromDateInput(normalized);
    if (nextMonth && nextMonth !== month) setMonth(nextMonth);
  }

  useEffect(() => {
    setFilters((current) => {
      const currentMonth = getYmFromDateInput(current.date);
      if (currentMonth === month) return current;
      return { ...current, date: defaultDateForMonth(month) };
    });
  }, [month]);

  useEffect(() => {
    const editTxId = (location.state as { editTxId?: string } | null)?.editTxId;
    if (!editTxId || loading) return;
    const tx = transactions.find((item) => item.id === editTxId);
    if (tx) {
      const txDate = toDateInputValue(tx.occurredAt);
      if (txDate) changeDate(txDate);
      setEditing(tx);
      setOpen(true);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, transactions, loading]);

  const rows = useMemo(() => {
    return transactions
      .filter((tx) => isFinanceTransactionType(tx.type))
      .filter((tx) => {
        if (toDateInputValue(tx.occurredAt) !== filters.date) return false;
        if (filters.accountId !== "all" && tx.accountId !== filters.accountId && tx.toAccountId !== filters.accountId) {
          return false;
        }
        const owner = resolveTransactionMoneyOwner(tx, accounts);
        if (!matchesMoneyOwnerFilter(owner, filters.moneyOwner)) return false;
        if (filters.type !== "all" && tx.type !== filters.type) return false;
        if (filters.search) {
          const hay = `${tx.note || ""} ${tx.categoryKey || ""}`.toLowerCase();
          if (!hay.includes(filters.search.toLowerCase())) return false;
        }
        return true;
      });
  }, [transactions, filters, accounts]);

  const dayTotals = useMemo(() => {
    return rows.reduce(
      (acc, tx) => {
        const amount = Math.abs(Number(tx.amount || 0));
        if (tx.type === "income") acc.income += amount;
        if (tx.type === "expense") acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [rows]);

  async function saveDraft(draft: TransactionDraft) {
    if (!ledgerUid) return;
    setSubmitting(true);
    try {
      const payload = {
        ...draft,
        amount: Number(draft.amount),
        moneyOwner: draft.type === "transfer" ? "unassigned" : draft.moneyOwner,
      };
      if (draft.id) await updateTransaction(ledgerUid, draft.id, payload);
      else await createTransaction(ledgerUid, payload);
      showToast("Đã lưu giao dịch.", "success");
      setOpen(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Không thể cập nhật giao dịch. Dữ liệu của bạn chưa bị thay đổi.",
        "error"
      );
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  async function removeTransaction(id: string) {
    if (!ledgerUid) return;
    const ok = await confirm({
      title: "Xóa giao dịch",
      message: "Giao dịch này sẽ bị xóa khỏi sổ. Thao tác không hoàn tác được.",
      confirmLabel: "Xóa giao dịch",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteTransaction(ledgerUid, id);
      showToast("Đã xóa giao dịch.", "success");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể xóa giao dịch.", "error");
    }
  }

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingText="Đang tải sổ giao dịch..." />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Chi tiêu"
        subtitle={formatDateLabel(filters.date)}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                downloadCsv(
                  `chi-tieu-${filters.date}.csv`,
                  [
                    ["Ngày", "Loại", "Nguồn tiền", "Ví", "Danh mục", "Số tiền", "Ghi chú"],
                    ...rows.map((tx) => [
                      toDateInputValue(tx.occurredAt),
                      getTransactionTypeLabel(tx.type),
                      resolveTransactionMoneyOwner(tx, accounts),
                      accountMap.get(tx.accountId)?.name || "",
                      getFinanceCategoryLabel(tx.categoryKey, categories),
                      Math.round(Number(tx.amount || 0)),
                      tx.note || "",
                    ]),
                  ]
                );
                showToast("Đã xuất CSV.", "success");
              }}
            >
              Xuất CSV
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Thêm giao dịch
            </button>
          </>
        }
      />

      <section className="card">
        <div className="day-nav" aria-label="Lọc theo ngày">
          <button
            type="button"
            className="btn btn-secondary day-nav-step"
            onClick={() => changeDate(shiftDateInput(filters.date, -1))}
            aria-label="Ngày trước"
          >
            ←
          </button>
          <div className="field day-nav-field">
            <label className="field-label" htmlFor="expense-day-filter">
              Ngày xem
            </label>
            <input
              id="expense-day-filter"
              className="month-input"
              type="date"
              value={filters.date}
              onChange={(event) => changeDate(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary day-nav-step"
            onClick={() => changeDate(shiftDateInput(filters.date, 1))}
            aria-label="Ngày sau"
          >
            →
          </button>
          <button
            type="button"
            className={`chip${filters.date === todayKey ? " active" : ""}`}
            onClick={() => changeDate(todayKey)}
          >
            Hôm nay
          </button>
        </div>
        <div className="filters">
          <div className="field">
            <label className="field-label">Nguồn tiền</label>
            <select
              value={filters.moneyOwner}
              onChange={(event) => setFilters((current) => ({ ...current, moneyOwner: event.target.value }))}
            >
              {ownerFilterOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Ví</label>
            <select
              value={filters.accountId}
              onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))}
            >
              <option value="all">Tất cả ví</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Loại</label>
            <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
              <option value="all">Tất cả</option>
              <option value="expense">Chi</option>
              <option value="income">Thu</option>
              <option value="transfer">Chuyển</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Tìm kiếm</label>
            <input
              value={filters.search}
              placeholder="Ghi chú, danh mục..."
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">{rows.length} giao dịch</h2>
            <p className="card-subtitle">
              {formatDateLabel(filters.date)}
              {dayTotals.expense || dayTotals.income
                ? ` · Chi ${formatCurrency(dayTotals.expense)} · Thu ${formatCurrency(dayTotals.income)}`
                : " · Chạm vào dòng để sửa"}
            </p>
          </div>
        </div>
        <div className="list">
          {rows.map((tx) => {
            const accountName = accountMap.get(tx.accountId)?.name || "Không rõ";
            const title =
              tx.type === "expense"
                ? getFinanceCategoryLabel(tx.categoryKey, categories)
                : getTransactionTypeLabel(tx.type);
            return (
              <article
                key={tx.id}
                className="list-row clickable"
                onClick={() => {
                  setEditing(tx);
                  setOpen(true);
                }}
              >
                <div className="list-main">
                  <div className="list-title">{title}</div>
                  <div className="list-meta">
                    <MoneyOwnerBadge owner={resolveTransactionMoneyOwner(tx, accounts)} />
                    <span>{formatDateLabel(tx.occurredAt)}</span>
                    <span>{accountName}</span>
                    <span className="u-ellipsis">{tx.note || "Không ghi chú"}</span>
                  </div>
                </div>
                <div className="list-side">
                  <div className={`amount u-money ${tx.type}`}>
                    {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                    {formatCurrency(tx.amount || 0)}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeTransaction(tx.id);
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            );
          })}
          {!rows.length ? (
            <EmptyState
              title="Chưa có giao dịch ngày này"
              body="Chọn ngày khác, hoặc thêm khoản thu/chi cho ngày đang xem."
            />
          ) : null}
        </div>
      </section>

      <Modal
        open={open}
        title={editing ? "Sửa giao dịch" : "Thêm giao dịch"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <TransactionForm
          key={editing?.id || "new-tx"}
          accounts={accounts}
          scopes={scopes}
          categories={categories}
          initial={
            editing
              ? {
                  ...editing,
                  occurredAt: toDateInputValue(editing.occurredAt),
                  amount: String(editing.amount || ""),
                  moneyOwner: (() => {
                    const resolved = resolveTransactionMoneyOwner(editing, accounts);
                    return resolved === "mother" ? "mother" : "personal";
                  })(),
                  type: (["expense", "income", "transfer"].includes(String(editing.type))
                    ? editing.type
                    : "expense") as TransactionDraft["type"],
                }
              : { type: "expense", moneyOwner: "personal", occurredAt: filters.date }
          }
          submitting={submitting}
          onCancel={() => {
            setOpen(false);
            setEditing(null);
          }}
          onSubmit={saveDraft}
        />
      </Modal>
    </div>
  );
}

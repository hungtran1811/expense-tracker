import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLedgerUid } from "../../shared/hooks/useLedgerUid";
import { useWorkspaceContext } from "../../app/WorkspaceProvider";
import {
  createLoanParty,
  createTransaction,
  deleteLoanParty,
  deleteTransaction,
  updateLoanParty,
  updateTransaction,
} from "../../services/firebase/firestore";
import { formatCurrency } from "../../shared/lib/money";
import { formatDateLabel, getTodayInputValue, toDateInputValue, toSortableDateKey } from "../../shared/lib/date";
import { normalizeAccountMoneyOwner } from "../../shared/lib/moneyOwner";
import type { LoanParty, Transaction } from "../../shared/types/finance";
import { Modal } from "../../shared/ui/Modal";
import { MoneyOwnerSelector } from "../../shared/ui/MoneyOwnerSelector";
import { PageHeader } from "../../shared/ui/PageHeader";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageState } from "../../shared/ui/PageState";
import { useConfirm } from "../../shared/ui/ConfirmDialog";
import { useToast } from "../../shared/ui/Toast";
import { buildOutstandingByParty, getLoanInterestRate, isLoanPartyNeedsReminder } from "./loanCalculations";

type LoanForm = {
  id: string;
  type: "loan_lend" | "loan_repay";
  loanPartyId: string;
  accountId: string;
  amount: string;
  interestRate: string;
  occurredAt: string;
  moneyOwner: "personal" | "mother";
  note: string;
};

function emptyLoanForm(accounts: { id: string; isDefault?: boolean }[], parties: { id: string }[]): LoanForm {
  return {
    id: "",
    type: "loan_lend",
    loanPartyId: parties[0]?.id || "",
    accountId: accounts.find((item) => item.isDefault)?.id || accounts[0]?.id || "",
    amount: "",
    interestRate: "0",
    occurredAt: getTodayInputValue(),
    moneyOwner: "personal",
    note: "",
  };
}

function formFromTransaction(tx: Transaction): LoanForm {
  return {
    id: tx.id,
    type: tx.type === "loan_repay" ? "loan_repay" : "loan_lend",
    loanPartyId: String(tx.loanPartyId || ""),
    accountId: String(tx.accountId || ""),
    amount: String(tx.amount || ""),
    interestRate: String(tx.interestRate || 0),
    occurredAt: toDateInputValue(tx.occurredAt) || getTodayInputValue(),
    moneyOwner: tx.moneyOwner === "mother" ? "mother" : "personal",
    note: String(tx.note || ""),
  };
}

export function LoansPage() {
  const ledgerUid = useLedgerUid();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, error, accounts, loanParties, loanTransactions, refresh } = useWorkspaceContext();
  const [partyName, setPartyName] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [form, setForm] = useState<LoanForm>(() => emptyLoanForm([], []));
  const [submitting, setSubmitting] = useState(false);
  const [partyDetail, setPartyDetail] = useState<LoanParty | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    const editLoanId = (location.state as { editLoanId?: string } | null)?.editLoanId;
    if (!editLoanId || loading) return;
    const tx = loanTransactions.find((item) => item.id === editLoanId);
    if (tx) {
      setForm(formFromTransaction(tx));
      setEntryOpen(true);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, loanTransactions, loading]);

  const partyStats = useMemo(
    () => buildOutstandingByParty(
      loanTransactions,
      loanParties.map((party) => party.id)
    ),
    [loanTransactions, loanParties]
  );

  const totalOutstanding = useMemo(
    () => Array.from(partyStats.values()).reduce((sum, item) => sum + item.outstanding, 0),
    [partyStats]
  );

  const recentHistory = useMemo(
    () =>
      [...loanTransactions]
        .sort((a, b) => toSortableDateKey(b.occurredAt).localeCompare(toSortableDateKey(a.occurredAt)))
        .slice(0, 8),
    [loanTransactions]
  );

  async function addParty() {
    if (!ledgerUid || !partyName.trim()) return;
    try {
      await createLoanParty(ledgerUid, { name: partyName.trim() });
      setPartyName("");
      showToast("Đã thêm người mượn.", "success");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể thêm người mượn.", "error");
    }
  }

  function openCreateEntry() {
    setForm(emptyLoanForm(
      accounts.filter((item) => String(item.status) !== "archived"),
      loanParties
    ));
    setEntryOpen(true);
  }

  function openEditEntry(tx: Transaction) {
    setForm(formFromTransaction(tx));
    setEntryOpen(true);
  }

  async function saveEntry() {
    if (!ledgerUid) return;
    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        loanPartyId: form.loanPartyId,
        accountId: form.accountId,
        amount: Number(form.amount),
        interestRate: Number(form.interestRate || 0),
        occurredAt: form.occurredAt,
        moneyOwner: form.moneyOwner,
        note: form.note,
      };
      if (form.id) {
        await updateTransaction(ledgerUid, form.id, payload);
        showToast("Đã cập nhật giao dịch.", "success");
      } else {
        await createTransaction(ledgerUid, payload);
        showToast("Đã lưu giao dịch cho mượn.", "success");
      }
      setEntryOpen(false);
      setForm(emptyLoanForm([], []));
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể lưu.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeEntry(tx: Transaction) {
    if (!ledgerUid) return;
    const partyNameLabel = loanParties.find((item) => item.id === tx.loanPartyId)?.name || "người mượn";
    const ok = await confirm({
      title: tx.type === "loan_repay" ? "Xóa khoản nhận trả" : "Xóa khoản cho mượn",
      message: `Xóa giao dịch ${formatCurrency(tx.amount || 0)} của ${partyNameLabel}? Số dư ví và công nợ sẽ được cập nhật lại.`,
      confirmLabel: "Xóa giao dịch",
      tone: "danger",
    });
    if (!ok) return;

    try {
      await deleteTransaction(ledgerUid, tx.id);
      showToast("Đã xóa giao dịch.", "success");
      if (form.id === tx.id) {
        setEntryOpen(false);
        setForm(emptyLoanForm([], []));
      }
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể xóa giao dịch.", "error");
    }
  }

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingText="Đang tải cho mượn..." />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Cho mượn"
        subtitle={`Còn nợ ${formatCurrency(totalOutstanding)}`}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreateEntry}>
            Ghi nhận
          </button>
        }
      />

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Người mượn</h2>
          </div>
          <div className="stack">
            <div className="toolbar-form">
              <div className="field">
                <input
                  className="field-control"
                  value={partyName}
                  placeholder="Tên người mượn"
                  onChange={(event) => setPartyName(event.target.value)}
                />
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => void addParty()}>
                Thêm
              </button>
            </div>
            <div className="list">
              {loanParties.map((party) => {
                const stats = partyStats.get(party.id);
                const needsReminder = isLoanPartyNeedsReminder(party.id, loanTransactions, 30);
                return (
                  <div key={party.id} className="list-row">
                    <button
                      type="button"
                      className="list-main clickable-plain"
                      onClick={() => setPartyDetail(party)}
                    >
                      <div className="list-title">
                        {party.name}
                        {needsReminder ? <span className="tag tag-warn"> Cần nhắc</span> : null}
                      </div>
                      <div className="list-meta">
                        <span>Còn {formatCurrency(stats?.outstanding || 0)}</span>
                      </div>
                    </button>
                    <div className="list-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setRenameValue(party.name);
                          setPartyDetail(party);
                          setRenameOpen(true);
                        }}
                      >
                        Đổi tên
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (!ledgerUid) return;
                          void confirm({
                            title: "Xóa người mượn",
                            message: `Xóa “${party.name}”?`,
                            confirmLabel: "Xóa",
                            tone: "danger",
                          }).then((ok) => {
                            if (!ok) return;
                            return deleteLoanParty(ledgerUid, party.id)
                              .then(() => {
                                showToast("Đã xóa người mượn.", "success");
                                return refresh();
                              })
                              .catch((err) => showToast(err?.message || "Không thể xóa.", "error"));
                          });
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
              {!loanParties.length ? <EmptyState title="Chưa có người mượn" /> : null}
            </div>
          </div>
        </section>

        <section className="card loan-history-card">
          <div className="card-head">
            <h2 className="card-title">Lịch sử</h2>
          </div>
          <div className="list loan-history-list">
            {recentHistory.map((tx) => {
              const rate = getLoanInterestRate(tx);
              const partyNameLabel = loanParties.find((item) => item.id === tx.loanPartyId)?.name || "—";
              return (
                <div key={tx.id} className="list-row loan-history-row">
                  <div className="list-main">
                    <div className="list-title">
                      {tx.type === "loan_lend" ? "Cho mượn" : "Nhận trả"} · {partyNameLabel}
                    </div>
                    <div className="list-meta">
                      <span>{formatDateLabel(tx.occurredAt)}</span>
                      {tx.type === "loan_lend" && rate > 0 ? <span>Lãi {rate}%</span> : null}
                    </div>
                  </div>
                  <div className="list-side">
                    <strong className={`amount u-money ${tx.type === "loan_lend" ? "expense" : "income"}`}>
                      {tx.type === "loan_lend" ? "-" : "+"}
                      {formatCurrency(tx.amount || 0)}
                    </strong>
                    <div className="list-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditEntry(tx)}>
                        Sửa
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeEntry(tx)}>
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loanTransactions.length ? <EmptyState title="Chưa có giao dịch" /> : null}
          </div>
        </section>
      </div>

      <Modal
        open={entryOpen}
        title={
          form.id
            ? form.type === "loan_repay"
              ? "Sửa khoản nhận trả"
              : "Sửa khoản cho mượn"
            : form.type === "loan_repay"
              ? "Ghi nhận nhận trả"
              : "Ghi nhận cho mượn"
        }
        onClose={() => {
          setEntryOpen(false);
          setForm(emptyLoanForm([], []));
        }}
      >
        <div className="stack">
          <div className="field">
            <label className="field-label">Loại</label>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({ ...current, type: event.target.value as "loan_lend" | "loan_repay" }))
              }
            >
              <option value="loan_lend">Cho mượn</option>
              <option value="loan_repay">Nhận trả</option>
            </select>
          </div>
          <MoneyOwnerSelector
            value={form.moneyOwner}
            onChange={(moneyOwner) =>
              setForm((current) => {
                const matched = accounts.filter(
                  (item) =>
                    String(item.status) !== "archived" &&
                    normalizeAccountMoneyOwner(item.moneyOwner) === moneyOwner
                );
                const accountId = matched.some((item) => item.id === current.accountId)
                  ? current.accountId
                  : matched.find((item) => item.isDefault)?.id || matched[0]?.id || current.accountId;
                return { ...current, moneyOwner, accountId };
              })
            }
          />
          <div className="field">
            <label className="field-label">Người mượn</label>
            <select
              value={form.loanPartyId}
              onChange={(event) => setForm((current) => ({ ...current, loanPartyId: event.target.value }))}
            >
              <option value="">Chọn người</option>
              {loanParties.map((party) => {
                const stats = partyStats.get(party.id);
                const remaining = stats?.outstanding || 0;
                return (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {remaining > 0 ? ` · còn nợ ${formatCurrency(remaining)}` : " · đã hết nợ"}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="field">
            <label className="field-label">Ví</label>
            <select
              value={form.accountId}
              onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
            >
              <option value="">Chọn ví</option>
              {accounts
                .filter((item) => String(item.status) !== "archived")
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label className="field-label">
                {form.type === "loan_repay" ? "Số tiền nhận trả" : "Số tiền"}
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>
            <div className="field">
              <label className="field-label">Ngày</label>
              <input
                type="date"
                value={form.occurredAt}
                onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))}
              />
            </div>
          </div>
          {form.type === "loan_lend" ? (
            <div className="field">
              <label className="field-label">Lãi suất (%)</label>
              <input
                type="number"
                value={form.interestRate}
                onChange={(event) => setForm((current) => ({ ...current, interestRate: event.target.value }))}
              />
            </div>
          ) : null}
          <div className="field">
            <label className="field-label">Ghi chú</label>
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </div>
          <div className="page-actions">
            {form.id ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={submitting}
                onClick={() => {
                  const tx = loanTransactions.find((item) => item.id === form.id);
                  if (tx) void removeEntry(tx);
                }}
              >
                Xóa
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEntryOpen(false);
                setForm(emptyLoanForm([], []));
              }}
            >
              Hủy
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => void saveEntry()}>
              {submitting ? "Đang lưu..." : form.id ? "Cập nhật" : "Lưu"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!partyDetail && !renameOpen}
        title={partyDetail?.name || "Lịch sử"}
        subtitle={
          partyDetail
            ? `Còn ${formatCurrency(partyStats.get(partyDetail.id)?.outstanding || 0)}`
            : undefined
        }
        onClose={() => setPartyDetail(null)}
      >
        <div className="list loan-history-list">
          {loanTransactions
            .filter((tx) => tx.loanPartyId === partyDetail?.id)
            .sort((a, b) => toSortableDateKey(b.occurredAt).localeCompare(toSortableDateKey(a.occurredAt)))
            .map((tx) => {
              const rate = getLoanInterestRate(tx);
              return (
                <div key={tx.id} className="list-row loan-history-row">
                  <div className="list-main">
                    <div className="list-title">{tx.type === "loan_lend" ? "Cho mượn" : "Nhận trả"}</div>
                    <div className="list-meta">
                      <span>{formatDateLabel(tx.occurredAt)}</span>
                      {tx.type === "loan_lend" && rate > 0 ? <span>Lãi {rate}%</span> : null}
                      {tx.note ? <span className="u-ellipsis">{tx.note}</span> : null}
                    </div>
                  </div>
                  <div className="list-actions">
                    <strong className={`amount u-money ${tx.type === "loan_lend" ? "expense" : "income"}`}>
                      {formatCurrency(tx.amount || 0)}
                    </strong>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setPartyDetail(null);
                        openEditEntry(tx);
                      }}
                    >
                      Sửa
                    </button>
                  </div>
                </div>
              );
            })}
          {partyDetail && !loanTransactions.some((tx) => tx.loanPartyId === partyDetail.id) ? (
            <EmptyState title="Chưa có giao dịch" />
          ) : null}
        </div>
      </Modal>

      <Modal
        open={renameOpen && !!partyDetail}
        title="Sửa tên người mượn"
        onClose={() => {
          setRenameOpen(false);
        }}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRenameOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!ledgerUid || !partyDetail) return;
                void updateLoanParty(ledgerUid, partyDetail.id, {
                  name: renameValue.trim(),
                  note: partyDetail.note || "",
                })
                  .then(() => {
                    showToast("Đã đổi tên người mượn.", "success");
                    setRenameOpen(false);
                    setPartyDetail(null);
                    return refresh();
                  })
                  .catch((err) => showToast(err?.message || "Không thể đổi tên.", "error"));
              }}
            >
              Lưu
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label">Tên</label>
          <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

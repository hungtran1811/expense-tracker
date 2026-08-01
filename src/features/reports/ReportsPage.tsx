import { useEffect, useMemo, useState } from "react";
import { useLedgerUid } from "../../shared/hooks/useLedgerUid";
import { useWorkspaceContext } from "../../app/WorkspaceProvider";
import { listTransactions, updateTransaction } from "../../services/firebase/firestore";
import { getFinanceCategoryLabel } from "../../shared/constants/finance";
import {
  formatDateLabel,
  formatMonthLabel,
  getCurrentYm,
  monthStartEnd,
  prevYm,
  toDateInputValue,
} from "../../shared/lib/date";
import { formatCurrency } from "../../shared/lib/money";
import { downloadCsv } from "../../shared/lib/csv";
import { moneyCell, openReportPrintWindow } from "../../shared/lib/reportPdf";
import {
  MONEY_OWNER_FILTER_OPTIONS,
  normalizeAccountMoneyOwner,
  resolveTransactionMoneyOwner,
} from "../../shared/lib/moneyOwner";
import type { Transaction } from "../../shared/types/finance";
import { DonutChart } from "../../shared/ui/charts";
import { MoneyOwnerBadge } from "../../shared/ui/MoneyOwnerBadge";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PageState } from "../../shared/ui/PageState";
import { useToast } from "../../shared/ui/Toast";
import {
  buildAccountBalanceSnapshot,
  buildCategoryComparison,
  buildDailyOwnerFlow,
  buildOwnerComparison,
  filterReportTransactions,
  formatOwnerTotals,
  summarizeOwnerBoard,
  type ReportFilters,
} from "./reportCalculations";

function presetRange(preset: string) {
  const today = new Date();
  const ym = getCurrentYm(today);
  if (preset === "this_month") return { ...monthStartEnd(ym), month: ym };
  if (preset === "last_month") {
    const prev = prevYm(ym);
    return { ...monthStartEnd(prev), month: prev };
  }
  if (preset === "this_year") {
    const y = today.getFullYear();
    return { fromDate: `${y}-01-01`, toDate: `${y}-12-31`, month: ym };
  }
  if (preset === "last_3_months") {
    const end = monthStartEnd(ym).toDate;
    const startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const fromDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;
    return { fromDate, toDate: end, month: ym };
  }
  const day = today.getDay() || 7;
  const start = new Date(today);
  start.setDate(today.getDate() - day + 1);
  return {
    fromDate: toDateInputValue(start),
    toDate: toDateInputValue(today),
    month: ym,
  };
}

export function ReportsPage() {
  const ledgerUid = useLedgerUid();
  const { showToast } = useToast();
  const { accounts, categories, scopes, loading, error, refresh } = useWorkspaceContext();
  const initial = presetRange("this_month");
  const [preset, setPreset] = useState("this_month");
  const [filters, setFilters] = useState<ReportFilters>({
    fromDate: initial.fromDate,
    toDate: initial.toDate,
    accountId: "all",
    moneyOwner: "all",
    type: "all",
    categoryKey: "all",
    search: "",
  });
  const [reportTx, setReportTx] = useState<Transaction[]>([]);
  const [compareLeftYm, setCompareLeftYm] = useState(() => getCurrentYm());
  const [compareRightYm, setCompareRightYm] = useState(() => prevYm(getCurrentYm()));
  const [compareLeftTx, setCompareLeftTx] = useState<Transaction[]>([]);
  const [compareRightTx, setCompareRightTx] = useState<Transaction[]>([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadingCompare, setLoadingCompare] = useState(true);
  const [selectedUnassigned, setSelectedUnassigned] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!ledgerUid) return;
      setLoadingReport(true);
      try {
        const items = await listTransactions(ledgerUid, {
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        });
        if (!cancelled) setReportTx(items);
      } catch (err) {
        console.error(err);
        showToast("Không thể tải dữ liệu báo cáo.", "error");
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ledgerUid, filters.fromDate, filters.toDate, showToast]);

  useEffect(() => {
    let cancelled = false;
    async function loadCompare() {
      if (!ledgerUid) return;
      setLoadingCompare(true);
      try {
        const leftRange = monthStartEnd(compareLeftYm);
        const rightRange = monthStartEnd(compareRightYm);
        const [leftItems, rightItems] = await Promise.all([
          listTransactions(ledgerUid, { fromDate: leftRange.fromDate, toDate: leftRange.toDate }),
          compareLeftYm === compareRightYm
            ? Promise.resolve(null)
            : listTransactions(ledgerUid, { fromDate: rightRange.fromDate, toDate: rightRange.toDate }),
        ]);
        if (cancelled) return;
        setCompareLeftTx(leftItems);
        setCompareRightTx(rightItems ?? leftItems);
      } catch (err) {
        console.error(err);
        showToast("Không thể tải dữ liệu so sánh tháng.", "error");
      } finally {
        if (!cancelled) setLoadingCompare(false);
      }
    }
    void loadCompare();
    return () => {
      cancelled = true;
    };
  }, [ledgerUid, compareLeftYm, compareRightYm, showToast]);

  const filtered = useMemo(
    () => filterReportTransactions(reportTx, filters, accounts),
    [reportTx, filters, accounts]
  );
  const comparison = useMemo(
    () => buildOwnerComparison(filtered, filters, categories, accounts),
    [filtered, filters, categories, accounts]
  );
  const categoryCompare = useMemo(
    () => buildCategoryComparison(filtered, categories, accounts),
    [filtered, categories, accounts]
  );
  const daily = useMemo(() => {
    const rows = buildDailyOwnerFlow(filtered, filters.fromDate, filters.toDate, accounts);
    return rows
      .map((item) => {
        const income = item.personalIncome + item.motherIncome;
        const expense = item.personalExpense + item.motherExpense;
        return {
          ...item,
          income,
          expense,
          net: income - expense,
          hasActivity: income > 0 || expense > 0,
        };
      })
      .filter((item) => item.hasActivity)
      .reverse();
  }, [filtered, filters.fromDate, filters.toDate, accounts]);
  const balance = buildAccountBalanceSnapshot(accounts, filters.accountId);
  const personalBoard = useMemo(
    () => summarizeOwnerBoard("personal", accounts, filtered),
    [accounts, filtered]
  );
  const motherBoard = useMemo(
    () => summarizeOwnerBoard("mother", accounts, filtered),
    [accounts, filtered]
  );
  const personal = formatOwnerTotals(comparison.personal);
  const mother = formatOwnerTotals(comparison.mother);
  const total = formatOwnerTotals(comparison.total);
  const focused =
    filters.moneyOwner === "personal" ? personal : filters.moneyOwner === "mother" ? mother : total;

  const monthCompare = useMemo(() => {
    const leftLabel = formatMonthLabel(compareLeftYm);
    const rightLabel = formatMonthLabel(compareRightYm);
    const leftRange = monthStartEnd(compareLeftYm);
    const rightRange = monthStartEnd(compareRightYm);
    const leftFilters = { ...filters, fromDate: leftRange.fromDate, toDate: leftRange.toDate };
    const rightFilters = { ...filters, fromDate: rightRange.fromDate, toDate: rightRange.toDate };
    const leftComparison = buildOwnerComparison(
      filterReportTransactions(compareLeftTx, leftFilters, accounts),
      leftFilters,
      categories,
      accounts
    );
    const rightComparison = buildOwnerComparison(
      filterReportTransactions(compareRightTx, rightFilters, accounts),
      rightFilters,
      categories,
      accounts
    );

    function ownerBlock(owner: "personal" | "mother") {
      const left = leftComparison[owner];
      const right = rightComparison[owner];
      return {
        owner,
        title: owner === "personal" ? "Tiền của tôi" : "Tiền của mẹ",
        expenseLeft: left.expense,
        expenseRight: right.expense,
        incomeLeft: left.income,
        incomeRight: right.income,
      };
    }

    return {
      leftLabel,
      rightLabel,
      sameMonth: compareLeftYm === compareRightYm,
      boards: [ownerBlock("personal"), ownerBlock("mother")],
    };
  }, [compareLeftYm, compareRightYm, compareLeftTx, compareRightTx, filters, accounts, categories]);

  const unassigned = useMemo(
    () => filtered.filter((tx) => resolveTransactionMoneyOwner(tx, accounts) === "unassigned"),
    [filtered, accounts]
  );

  const maxDailyExpense = Math.max(1, ...daily.map((item) => item.expense));

  const categoryDonut = useMemo(() => {
    const palette = ["#3558d4", "#0f8f7f", "#e25b4a", "#c47d0e", "#7c5cbf", "#2f6fed", "#d6244d", "#5b6b82"];
    return categoryCompare.slice(0, 6).map((row, index) => ({
      key: row.key,
      label: row.label,
      value: row.total,
      color: palette[index % palette.length],
      valueText: formatCurrency(row.total),
    }));
  }, [categoryCompare]);

  const dayTransactions = useMemo(() => {
    if (!selectedDay) return [];
    return filtered
      .filter((tx) => tx.type === "expense" || tx.type === "income")
      .filter((tx) => toDateInputValue(tx.occurredAt) === selectedDay)
      .sort((a, b) => Math.abs(Number(b.amount || 0)) - Math.abs(Number(a.amount || 0)));
  }, [filtered, selectedDay]);

  const selectedDaySummary = daily.find((item) => item.dateKey === selectedDay);

  async function classifySelected(owner: "personal" | "mother") {
    if (!ledgerUid || !selectedUnassigned.length) return;
    try {
      await Promise.all(
        selectedUnassigned.map((id) => {
          const tx = unassigned.find((item) => item.id === id);
          if (!tx) return Promise.resolve();
          return updateTransaction(ledgerUid, id, {
            ...tx,
            occurredAt: toDateInputValue(tx.occurredAt),
            moneyOwner: owner,
          });
        })
      );
      showToast(`Đã gán ${selectedUnassigned.length} giao dịch.`, "success");
      setSelectedUnassigned([]);
      const items = await listTransactions(ledgerUid, {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      });
      setReportTx(items);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể phân loại giao dịch.", "error");
    }
  }

  async function classifyByWallet() {
    if (!ledgerUid || !unassigned.length) return;
    const targets = unassigned.filter((tx) => {
      const account = accounts.find((item) => item.id === tx.accountId);
      return account && (account.moneyOwner === "personal" || account.moneyOwner === "mother");
    });
    if (!targets.length) {
      showToast("Không có giao dịch nào gợi ý được từ ví.", "error");
      return;
    }
    try {
      await Promise.all(
        targets.map((tx) => {
          const account = accounts.find((item) => item.id === tx.accountId);
          const owner = normalizeAccountMoneyOwner(account?.moneyOwner);
          return updateTransaction(ledgerUid, tx.id, {
            ...tx,
            occurredAt: toDateInputValue(tx.occurredAt),
            moneyOwner: owner,
          });
        })
      );
      showToast(`Đã gán theo ví: ${targets.length} giao dịch.`, "success");
      setSelectedUnassigned([]);
      const items = await listTransactions(ledgerUid, {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      });
      setReportTx(items);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể gán theo ví.", "error");
    }
  }

  if (loading || error) {
    return <PageState loading={loading} error={error} loadingText="Đang tải báo cáo..." />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Báo cáo"
        subtitle={formatMonthLabel(filters.fromDate.slice(0, 7))}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                downloadCsv(`bao-cao-${filters.fromDate}_${filters.toDate}.csv`, [
                  ["Chỉ số", "Tiền của tôi", "Tiền của mẹ", "Tổng"],
                  ["Thu", personal.income, mother.income, total.income],
                  ["Chi", personal.expense, mother.expense, total.expense],
                  ["Còn lại", personal.net, mother.net, total.net],
                ]);
                showToast("Đã xuất CSV báo cáo.", "success");
              }}
            >
              Xuất CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                try {
                  openReportPrintWindow({
                    title: "Báo cáo Hung Tran Finance",
                    subtitle: `${filters.fromDate} → ${filters.toDate}`,
                    rows: [
                      ["Thu", moneyCell(personal.income), moneyCell(mother.income), moneyCell(total.income)],
                      ["Chi", moneyCell(personal.expense), moneyCell(mother.expense), moneyCell(total.expense)],
                      ["Còn lại", moneyCell(personal.net), moneyCell(mother.net), moneyCell(total.net)],
                    ],
                  });
                } catch (err) {
                  showToast(err instanceof Error ? err.message : "Không thể mở bản in.", "error");
                }
              }}
            >
              In / PDF
            </button>
          </>
        }
      />

      <section className="owner-boards">
        <article className="owner-board personal">
          <div className="owner-board-head">
            <div>
              <h2 className="owner-board-title">Báo cáo của tôi</h2>
              <p className="owner-board-meta">
                {personalBoard.accounts.map((item) => item.name).join(", ") || "Chưa gắn ví"}
              </p>
            </div>
          </div>
          <div className="stat-grid stat-grid-compact">
            <div className="stat-card">
              <div className="label">Số dư ví</div>
              <div className="value u-money">{personalBoard.balanceText}</div>
            </div>
            <div className="stat-card income">
              <div className="label">Thu</div>
              <div className="value u-money">{personal.incomeText}</div>
            </div>
            <div className="stat-card expense">
              <div className="label">Chi</div>
              <div className="value u-money">{personal.expenseText}</div>
            </div>
            <div className="stat-card net">
              <div className="label">Còn lại</div>
              <div className="value u-money">{personal.netText}</div>
            </div>
          </div>
        </article>

        <article className="owner-board mother">
          <div className="owner-board-head">
            <div>
              <h2 className="owner-board-title">Báo cáo của mẹ</h2>
              <p className="owner-board-meta">
                {motherBoard.accounts.map((item) => item.name).join(", ") || "Gắn ví VP Bank trong Quản lý"}
              </p>
            </div>
          </div>
          {!motherBoard.accounts.length ? (
            <p className="owner-hint">
              Chưa có ví của mẹ. Vào Quản lý → sửa ví VP Bank → chọn <strong>Tiền của mẹ</strong>.
            </p>
          ) : null}
          <div className="stat-grid stat-grid-compact">
            <div className="stat-card">
              <div className="label">Số dư ví</div>
              <div className="value u-money">{motherBoard.balanceText}</div>
            </div>
            <div className="stat-card income">
              <div className="label">Thu</div>
              <div className="value u-money">{mother.incomeText}</div>
            </div>
            <div className="stat-card expense">
              <div className="label">Chi</div>
              <div className="value u-money">{mother.expenseText}</div>
            </div>
            <div className="stat-card net">
              <div className="label">Còn lại</div>
              <div className="value u-money">{mother.netText}</div>
            </div>
          </div>
        </article>
      </section>

      <section className="card stack">
        <div className="chip-row">
          {[
            ["this_week", "Tuần này"],
            ["this_month", "Tháng này"],
            ["last_month", "Tháng trước"],
            ["last_3_months", "3 tháng"],
            ["this_year", "Năm nay"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`chip${preset === key ? " active" : ""}`}
              onClick={() => {
                setPreset(key);
                const range = presetRange(key);
                setFilters((current) => ({ ...current, fromDate: range.fromDate, toDate: range.toDate }));
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="filters">
          <div className="field">
            <label className="field-label">Từ ngày</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => {
                setPreset("custom");
                setFilters((current) => ({ ...current, fromDate: event.target.value }));
              }}
            />
          </div>
          <div className="field">
            <label className="field-label">Đến ngày</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => {
                setPreset("custom");
                setFilters((current) => ({ ...current, toDate: event.target.value }));
              }}
            />
          </div>
          <div className="field">
            <label className="field-label">Nguồn tiền</label>
            <select
              value={filters.moneyOwner}
              onChange={(event) => setFilters((current) => ({ ...current, moneyOwner: event.target.value }))}
            >
              {MONEY_OWNER_FILTER_OPTIONS.map((option) => (
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
            <select
              value={filters.type}
              onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="all">Tất cả</option>
              <option value="expense">Chi</option>
              <option value="income">Thu</option>
            </select>
          </div>
        </div>
      </section>

      {loadingReport ? (
        <div className="inline-status" role="status">
          <div className="page-state-spinner" aria-hidden="true" />
          <span>Đang tính báo cáo...</span>
        </div>
      ) : null}

      <section className="card stack">
        <div className="card-head">
          <h2 className="card-title">So sánh 2 tháng</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setCompareLeftYm(getCurrentYm());
              setCompareRightYm(prevYm(getCurrentYm()));
            }}
          >
            Tháng này / trước
          </button>
        </div>

        <div className="mom-pickers">
          <label className="mom-month-field">
            <span>Tháng 1</span>
            <input
              className="month-input"
              type="month"
              value={compareLeftYm}
              onChange={(event) => setCompareLeftYm(event.target.value)}
            />
          </label>
          <span className="mom-vs">so với</span>
          <label className="mom-month-field">
            <span>Tháng 2</span>
            <input
              className="month-input"
              type="month"
              value={compareRightYm}
              onChange={(event) => setCompareRightYm(event.target.value)}
            />
          </label>
        </div>

        {loadingCompare ? (
          <div className="inline-status" role="status">
            <div className="page-state-spinner" aria-hidden="true" />
            <span>Đang so sánh...</span>
          </div>
        ) : monthCompare.sameMonth ? (
          <p className="section-note">Chọn hai tháng khác nhau.</p>
        ) : (
          <div className="mom-board-grid">
            {monthCompare.boards.map((board) => {
              const rows = [
                {
                  key: "expense",
                  label: "Chi",
                  left: board.expenseLeft,
                  right: board.expenseRight,
                  tone: "expense" as const,
                },
                {
                  key: "income",
                  label: "Thu",
                  left: board.incomeLeft,
                  right: board.incomeRight,
                  tone: "income" as const,
                },
              ];
              return (
                <article key={board.owner} className={`mom-board ${board.owner}`}>
                  <header className="mom-board-head">
                    <h3 className="mom-board-title">{board.title}</h3>
                    <div className="mom-board-months">
                      <span className="mom-chip left">{monthCompare.leftLabel}</span>
                      <span className="mom-chip right">{monthCompare.rightLabel}</span>
                    </div>
                  </header>
                  <div className="mom-board-body">
                    {rows.map((row) => {
                      const max = Math.max(row.left, row.right, 1);
                      const delta = row.left - row.right;
                      const deltaText =
                        Math.abs(delta) < 1
                          ? "Bằng nhau"
                          : delta > 0
                            ? `+${formatCurrency(delta)}`
                            : `−${formatCurrency(Math.abs(delta))}`;
                      return (
                        <div key={row.key} className={`mom-row ${row.tone}`}>
                          <div className="mom-row-top">
                            <span className="mom-row-label">{row.label}</span>
                            <span
                              className={`mom-delta-badge ${
                                Math.abs(delta) < 1 ? "neutral" : delta > 0 ? "up" : "down"
                              }`}
                            >
                              {deltaText}
                            </span>
                          </div>
                          <div className="mom-row-cols">
                            <div className="mom-col">
                              <span className="mom-col-month">{monthCompare.leftLabel}</span>
                              <strong className={`u-money tone-${row.tone}`}>
                                {formatCurrency(row.left)}
                              </strong>
                              <div className="mom-meter">
                                <span style={{ width: `${(row.left / max) * 100}%` }} />
                              </div>
                            </div>
                            <div className="mom-col">
                              <span className="mom-col-month">{monthCompare.rightLabel}</span>
                              <strong className="u-money">{formatCurrency(row.right)}</strong>
                              <div className="mom-meter muted">
                                <span style={{ width: `${(row.right / max) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {filters.moneyOwner === "all" ? (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Hai dòng tiền</h2>
          </div>
          <div className="owner-compare-grid">
            <article className="owner-compare-panel personal">
              <h3 className="owner-compare-title">Tiền của tôi</h3>
              <dl className="owner-compare-metrics">
                <div>
                  <dt>Số dư ví</dt>
                  <dd className="u-money">{personalBoard.balanceText}</dd>
                </div>
                <div>
                  <dt>Thu kỳ này</dt>
                  <dd className="u-money tone-income">{personal.incomeText}</dd>
                </div>
                <div>
                  <dt>Chi kỳ này</dt>
                  <dd className="u-money tone-expense">{personal.expenseText}</dd>
                </div>
                <div>
                  <dt>Chi nhiều nhất</dt>
                  <dd>
                    {personal.topCategoryLabel !== "—"
                      ? `${personal.topCategoryLabel} · ${personal.topCategoryAmountText}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </article>
            <article className="owner-compare-panel mother">
              <h3 className="owner-compare-title">Tiền của mẹ</h3>
              <dl className="owner-compare-metrics">
                <div>
                  <dt>Số dư ví</dt>
                  <dd className="u-money">{motherBoard.balanceText}</dd>
                </div>
                <div>
                  <dt>Thu kỳ này</dt>
                  <dd className="u-money tone-income">{mother.incomeText}</dd>
                </div>
                <div>
                  <dt>Chi kỳ này</dt>
                  <dd className="u-money tone-expense">{mother.expenseText}</dd>
                </div>
                <div>
                  <dt>Chi nhiều nhất</dt>
                  <dd>
                    {mother.topCategoryLabel !== "—"
                      ? `${mother.topCategoryLabel} · ${mother.topCategoryAmountText}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          </div>
          {comparison.unassignedCount ? (
            <p className="section-note">
              {comparison.unassignedCount} giao dịch chưa phân loại — chưa tính vào hai dòng trên.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="stat-grid">
          <article className="stat-card income">
            <div className="label">Thu</div>
            <div className="value u-money">{focused.incomeText}</div>
          </article>
          <article className="stat-card expense">
            <div className="label">Chi</div>
            <div className="value u-money">{focused.expenseText}</div>
          </article>
          <article className="stat-card net">
            <div className="label">Còn lại</div>
            <div className="value u-money">{focused.netText}</div>
          </article>
          <article className="stat-card">
            <div className="label">Số dư ví</div>
            <div className="value u-money">{balance.totalBalanceText}</div>
          </article>
        </section>
      )}

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Ai đang chi nhiều hơn?</h2>
              <p className="card-subtitle">Tỷ trọng tổng chi kỳ này</p>
            </div>
          </div>
          <DonutChart
            segments={[
              {
                key: "personal",
                label: "Tiền của tôi",
                value: comparison.personal.expense,
                color: "var(--brand)",
                valueText: formatCurrency(comparison.personal.expense),
              },
              {
                key: "mother",
                label: "Tiền của mẹ",
                value: comparison.mother.expense,
                color: "var(--mother)",
                valueText: formatCurrency(comparison.mother.expense),
              },
            ]}
            centerLabel="Tổng chi"
            centerValue={formatCurrency(comparison.personal.expense + comparison.mother.expense)}
            emptyLabel="Chưa có chi trong kỳ"
          />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Chi theo danh mục</h2>
              <p className="card-subtitle">Biểu đồ tròn tổng hợp · cột so sánh tôi/mẹ</p>
            </div>
          </div>
          <DonutChart
            segments={categoryDonut}
            centerLabel="Danh mục"
            centerValue={
              categoryCompare.length
                ? formatCurrency(categoryCompare.reduce((sum, row) => sum + row.total, 0))
                : undefined
            }
            emptyLabel="Chưa có chi theo danh mục"
          />
          <div className="bar-chart chart-follow">
            {categoryCompare.slice(0, 8).map((row) => {
              const max = Math.max(row.personal, row.mother, 1);
              return (
                <div key={row.key} className="bar-row">
                  <div className="bar-label">
                    <span className="u-ellipsis">{row.label}</span>
                    <span>
                      Tôi {row.personalText} · Mẹ {row.motherText}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill-personal" style={{ width: `${(row.personal / max) * 50}%` }} />
                    <div className="bar-fill-mother" style={{ width: `${(row.mother / max) * 50}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Thu & chi theo ngày</h2>
            <p className="card-subtitle">Chạm vào ngày để xem từng khoản thu/chi</p>
          </div>
        </div>
        <div className="list timeline-list">
          {daily.map((item) => (
            <button
              key={item.dateKey}
              type="button"
              className={`list-row clickable timeline-row${selectedDay === item.dateKey ? " is-selected" : ""}`}
              onClick={() => setSelectedDay(item.dateKey)}
            >
              <div className="list-main">
                <div className="list-title">{formatDateLabel(item.dateKey)}</div>
                <div className="list-meta">
                  <span className="tone-income">Thu {formatCurrency(item.income)}</span>
                  <span className="tone-expense">Chi {formatCurrency(item.expense)}</span>
                  {(item.personalExpense > 0 || item.motherExpense > 0) && item.expense > 0 ? (
                    <span>
                      Tôi {formatCurrency(item.personalExpense)} · Mẹ {formatCurrency(item.motherExpense)}
                    </span>
                  ) : null}
                </div>
                {item.expense > 0 ? (
                  <div className="bar-track timeline-track">
                    <div
                      className="bar-fill-personal"
                      style={{ width: `${(item.personalExpense / maxDailyExpense) * 100}%` }}
                    />
                    <div
                      className="bar-fill-mother"
                      style={{ width: `${(item.motherExpense / maxDailyExpense) * 100}%` }}
                    />
                  </div>
                ) : null}
              </div>
              <strong className={`amount u-money ${item.net >= 0 ? "income" : "expense"}`}>
                {item.net >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(item.net))}
              </strong>
            </button>
          ))}
          {!daily.length ? <EmptyState title="Chưa có thu chi trong kỳ này" /> : null}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Phân loại nhanh</h2>
            <p className="card-subtitle">Giao dịch cũ chưa có nguồn tiền — không tính vào Tôi/Mẹ cho đến khi bạn gán</p>
          </div>
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!unassigned.length}
              onClick={() => void classifyByWallet()}
            >
              Gán theo ví
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedUnassigned.length}
              onClick={() => void classifySelected("personal")}
            >
              Gán Tiền của tôi
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!selectedUnassigned.length}
              onClick={() => void classifySelected("mother")}
            >
              Gán Tiền của mẹ
            </button>
          </div>
        </div>
        <div className="list">
          {unassigned.map((tx) => {
            const checked = selectedUnassigned.includes(tx.id);
            return (
              <label key={tx.id} className="list-row clickable checkbox-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    setSelectedUnassigned((current) =>
                      event.target.checked ? [...current, tx.id] : current.filter((id) => id !== tx.id)
                    );
                  }}
                />
                <div className="list-main">
                  <div className="list-title">
                    {tx.type === "expense" ? getFinanceCategoryLabel(tx.categoryKey, categories) : tx.type}
                  </div>
                  <div className="list-meta">
                    <MoneyOwnerBadge owner={resolveTransactionMoneyOwner(tx, accounts)} />
                    <span>{formatDateLabel(tx.occurredAt)}</span>
                    <span className="u-money">{formatCurrency(tx.amount || 0)}</span>
                    <span className="u-ellipsis">{tx.note || "Không ghi chú"}</span>
                  </div>
                </div>
              </label>
            );
          })}
          {!unassigned.length ? <EmptyState title="Không còn giao dịch chưa phân loại trong kỳ" /> : null}
        </div>
      </section>

      <Modal
        open={!!selectedDay}
        title={selectedDay ? `Chi tiết ${formatDateLabel(selectedDay)}` : "Chi tiết ngày"}
        subtitle={
          selectedDaySummary
            ? `Thu ${formatCurrency(selectedDaySummary.income)} · Chi ${formatCurrency(selectedDaySummary.expense)} · Còn ${formatCurrency(selectedDaySummary.net)}`
            : undefined
        }
        onClose={() => setSelectedDay(null)}
      >
        <div className="list">
          {dayTransactions.map((tx) => (
            <div key={tx.id} className="list-row">
              <div className="list-main">
                <div className="list-title">
                  {tx.type === "expense" ? getFinanceCategoryLabel(tx.categoryKey, categories) : "Khoản thu"}
                </div>
                <div className="list-meta">
                  <MoneyOwnerBadge owner={resolveTransactionMoneyOwner(tx, accounts)} />
                  <span>{accounts.find((item) => item.id === tx.accountId)?.name || "—"}</span>
                  <span>{scopes.find((item) => item.id === tx.scopeId)?.name || ""}</span>
                  <span className="u-ellipsis">{tx.note || "Không ghi chú"}</span>
                </div>
              </div>
              <strong className={`amount u-money ${tx.type}`}>
                {tx.type === "expense" ? "-" : "+"}
                {formatCurrency(tx.amount || 0)}
              </strong>
            </div>
          ))}
          {!dayTransactions.length ? <EmptyState title="Không có giao dịch trong ngày này" /> : null}
        </div>
      </Modal>
    </div>
  );
}

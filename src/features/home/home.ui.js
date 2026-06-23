import { formatTemplate, t } from "../../shared/constants/copy.vi.js";
import { formatCurrency } from "../finance/finance.controller.js";

const MONTH_BAR_KEYS = new Set(["income", "expense", "net", "debt"]);

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function titleAttr(value = "") {
  const text = String(value || "").trim();
  return text ? ` title="${escapeHtml(text)}"` : "";
}

function renderTop(vm = {}) {
  const titleEl = byId("homeTitle");
  const monthEl = byId("homeMonthLabel");
  if (titleEl) titleEl.textContent = t("home.pageTitle", "Tổng quan");
  if (monthEl) monthEl.textContent = String(vm?.monthLabel || "").trim();
}

function renderAccountsHeadings() {
  const titleEl = byId("homeAccountsTitle");
  const subtitleEl = byId("homeAccountsSubtitle");
  if (titleEl) titleEl.textContent = t("home.accountsTitle", "Tài khoản");
  if (subtitleEl) subtitleEl.textContent = t("home.accountsSubtitle", "Số dư từng ví");
}

function renderAccountsGrid(container, accounts = []) {
  if (!container) return;
  const list = Array.isArray(accounts) ? accounts : [];

  if (!list.length) {
    container.innerHTML = `
      <div class="home-empty-inline" style="grid-column: 1 / -1;">
        <strong>${escapeHtml(t("home.noAccounts", "Chưa có tài khoản"))}</strong>
        <div>${escapeHtml(t("home.noAccountsBody", "Thêm tài khoản ở tab Chi tiêu để theo dõi số dư."))}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map(
      (card) => `
        <article class="home-account-card${card.isFiltered ? " is-filtered" : ""}">
          <span class="home-account-type u-ellipsis">${escapeHtml(card.typeLabel || "Tài khoản")}</span>
          <strong class="home-account-balance u-money"${titleAttr(card.balanceTitle)}>${escapeHtml(card.balanceText || "0đ")}</strong>
          <div class="home-account-name-row">
            <span class="home-account-name u-ellipsis">${escapeHtml(card.name || "Không rõ")}</span>
            ${card.isDefault ? '<span class="ledger-chip transfer">Mặc định</span>' : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function renderAccountFilter(block = {}) {
  const titleEl = byId("homeFilterTitle");
  const subtitleEl = byId("homeFilterSubtitle");
  const railEl = byId("homeAccountFilter");
  const options = Array.isArray(block?.options) ? block.options : [];
  const selectedId = String(block?.accountId || "all").trim() || "all";

  if (titleEl) titleEl.textContent = t("home.filterTitle", "Xem theo ví");
  if (subtitleEl) {
    subtitleEl.textContent =
      selectedId === "all"
        ? t("home.filterSubtitle", "Lọc thu chi hôm nay, tháng này và dòng tiền theo ngày.")
        : formatTemplate(t("home.filterActiveSubtitle", "Đang xem dữ liệu của {{account}}."), {
            account: String(block?.label || "").trim(),
          });
  }

  if (!railEl) return;

  if (!options.length) {
    railEl.innerHTML = `
      <div class="home-empty-inline">
        <div>${escapeHtml(t("home.filterNoAccounts", "Thêm tài khoản để lọc theo ví."))}</div>
      </div>
    `;
    return;
  }

  const chips = [
    {
      id: "all",
      label: t("home.filterAll", "Tất cả ví"),
    },
    ...options.map((item) => ({
      id: String(item?.id || "").trim(),
      label: String(item?.name || "").trim(),
    })),
  ];

  railEl.innerHTML = chips
    .map((chip) => {
      const isActive = chip.id === selectedId;
      return `
        <button
          type="button"
          class="home-account-filter-chip${isActive ? " is-active" : ""}"
          data-home-account-filter="${escapeHtml(chip.id)}"
          role="tab"
          aria-selected="${isActive ? "true" : "false"}"
        >
          <span class="home-account-filter-chip-label u-ellipsis">${escapeHtml(chip.label)}</span>
        </button>
      `;
    })
    .join("");
}

function renderTodayHeadings(block = {}) {
  const titleEl = byId("homeTodayTitle");
  const subtitleEl = byId("homeTodaySubtitle");
  if (titleEl) titleEl.textContent = t("home.todayTitle", "Hôm nay");
  if (subtitleEl) {
    const base = t("home.todaySubtitle", "Các khoản thu và chi trong ngày");
    const note = String(block?.filterNote || "").trim();
    subtitleEl.textContent = note ? `${base} · ${note}` : base;
  }
}

function renderTodaySection(block = {}) {
  const summaryEl = byId("homeTodaySummary");
  const listEl = byId("homeTodayList");
  const items = Array.isArray(block?.items) ? block.items : [];

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="home-today-metric tone-income">
        <span class="home-today-metric-label">${escapeHtml(t("home.todayIncome", "Thu"))}</span>
        <strong class="home-today-metric-value u-money">${escapeHtml(block?.incomeTotalText || "0đ")}</strong>
      </div>
      <div class="home-today-metric tone-expense">
        <span class="home-today-metric-label">${escapeHtml(t("home.todayExpense", "Chi"))}</span>
        <strong class="home-today-metric-value u-money">${escapeHtml(block?.expenseTotalText || "0đ")}</strong>
      </div>
    `;
  }

  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = `
      <div class="home-empty-inline">
        <strong>${escapeHtml(block?.emptyTitle || "")}</strong>
        <div>${escapeHtml(block?.emptyBody || "")}</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = items
    .map((row) => {
      const metaParts = [row.categoryLabel, row.accountLabel].filter(Boolean);
      const meta = metaParts.join(" · ");
      return `
        <article class="home-today-row" data-home-today-id="${escapeHtml(row.id)}">
          <div class="home-today-main">
            <div class="home-today-title u-ellipsis">${escapeHtml(row.title)}</div>
            <div class="home-today-meta u-ellipsis">${escapeHtml(meta)}</div>
          </div>
          <strong class="home-today-amount u-money ${escapeHtml(row.amountClass)}">${escapeHtml(row.amountText)}</strong>
        </article>
      `;
    })
    .join("");
}

function renderMonthBar(container, items = []) {
  if (!container) return;
  const list = (Array.isArray(items) ? items : []).filter((item) => MONTH_BAR_KEYS.has(String(item?.key || "")));

  container.innerHTML = list
    .map((item) => {
      const tone = escapeHtml(item.tone || "net");
      const body = `
        <span class="home-month-label u-ellipsis">${escapeHtml(item.label)}</span>
        <strong class="home-month-value u-money"${titleAttr(item.valueTitle)}>${escapeHtml(item.valueText)}</strong>
        ${item.note ? `<span class="home-month-note u-ellipsis">${escapeHtml(item.note)}</span>` : ""}
      `;
      const link = String(item?.link || "").trim();
      if (link) {
        return `
          <a class="home-month-metric home-month-metric-link tone-${tone}" data-route-link href="${escapeHtml(link)}">
            ${body}
          </a>
        `;
      }
      return `<article class="home-month-metric tone-${tone}">${body}</article>`;
    })
    .join("");
}

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function parseDailyDateParts(dateKey = "") {
  const parts = String(dateKey || "").trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) {
    return { day: "--", weekday: "" };
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return {
    day,
    weekday: WEEKDAY_SHORT[date.getDay()] || "",
  };
}

function hasDailyActivity(item = {}) {
  return !!(item.income || item.expense || item.net || item.transfer);
}

function renderHomeDailyFlow(container, block = {}) {
  if (!container) return;

  if (block?.loadPending) {
    container.innerHTML = `
      <div class="workspace-load-prompt workspace-load-prompt-inline">
        <strong>${escapeHtml(block?.emptyTitle || t("home.dailyFlowLoadTitle", "Dòng tiền theo ngày"))}</strong>
        <p>${escapeHtml(block?.emptyBody || t("home.dailyFlowLoadBody", "Bấm để xem biến động từng ngày trong tháng — không tải tự động."))}</p>
        <button type="button" class="btn btn-sm btn-outline-primary" id="btnLoadHomeDailyFlow">
          ${escapeHtml(t("home.dailyFlowLoadAction", "Xem dòng tiền"))}
        </button>
      </div>
    `;
    return;
  }

  const items = (Array.isArray(block?.items) ? block.items : [])
    .filter(hasDailyActivity)
    .slice()
    .reverse();

  if (!items.length) {
    container.innerHTML = `
      <div class="home-empty-inline">
        <strong>${escapeHtml(block?.emptyTitle || t("home.dailyFlowEmpty", "Chưa có dòng tiền tháng này"))}</strong>
        <div>${escapeHtml(block?.emptyBody || t("home.dailyFlowEmptyBody", "Ghi thu hoặc chi để theo dõi biến động từng ngày."))}</div>
      </div>
    `;
    return;
  }

  const totals = items.reduce(
    (acc, item) => {
      acc.income += Number(item.income || 0);
      acc.expense += Number(item.expense || 0);
      acc.net += Number(item.net || 0);
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );
  const netClass = totals.net >= 0 ? "positive" : "negative";
  const netPrefix = totals.net >= 0 ? "+" : "-";
  const totalIncomeText = formatCurrency(totals.income);
  const totalExpenseText = formatCurrency(totals.expense);
  const totalNetText = `${netPrefix}${formatCurrency(Math.abs(totals.net))}`;

  container.innerHTML = `
    <div class="home-daily-overview" aria-label="Tổng các ngày có giao dịch">
      <article class="home-daily-overview-card tone-income">
        <span class="home-daily-overview-label">${escapeHtml(t("home.todayIncome", "Thu"))}</span>
        <strong class="home-daily-overview-value u-money">${escapeHtml(totalIncomeText)}</strong>
      </article>
      <article class="home-daily-overview-card tone-expense">
        <span class="home-daily-overview-label">${escapeHtml(t("home.todayExpense", "Chi"))}</span>
        <strong class="home-daily-overview-value u-money">${escapeHtml(totalExpenseText)}</strong>
      </article>
      <article class="home-daily-overview-card tone-net ${escapeHtml(netClass)}">
        <span class="home-daily-overview-label">${escapeHtml(t("home.dailyFlowNetLabel", "Ròng"))}</span>
        <strong class="home-daily-overview-value u-money">${escapeHtml(totalNetText)}</strong>
      </article>
    </div>
    <div class="home-daily-list">
      ${items
        .map((item) => {
          const dateParts = parseDailyDateParts(item.dateKey);
          const netTone = escapeHtml(item.netClass || "positive");
          const incomeChip =
            Number(item.income || 0) > 0
              ? `<span class="home-daily-chip income">${escapeHtml(t("home.todayIncome", "Thu"))} <strong class="u-money">${escapeHtml(item.incomeText)}</strong></span>`
              : "";
          const expenseChip =
            Number(item.expense || 0) > 0
              ? `<span class="home-daily-chip expense">${escapeHtml(t("home.todayExpense", "Chi"))} <strong class="u-money">${escapeHtml(item.expenseText)}</strong></span>`
              : "";
          const transferNote =
            Number(item.transfer || 0) > 0
              ? `<div class="home-daily-transfer">Chuyển khoản <span class="u-money">${escapeHtml(item.transferText)}</span></div>`
              : "";

          return `
            <article class="home-daily-row">
              <div class="home-daily-date-col" aria-hidden="true">
                <span class="home-daily-day">${escapeHtml(dateParts.day)}</span>
                <span class="home-daily-weekday">${escapeHtml(dateParts.weekday)}</span>
              </div>
              <div class="home-daily-flow-main">
                <div class="home-daily-metrics">
                  ${incomeChip}
                  ${expenseChip}
                </div>
                ${transferNote}
              </div>
              <div class="home-daily-net-col ${netTone}">
                <span class="home-daily-net-label">${escapeHtml(t("home.dailyFlowNetLabel", "Ròng"))}</span>
                <strong class="home-daily-net-value u-money"${titleAttr(item.netText)}>${escapeHtml(item.netText)}</strong>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderMomComparison(container, block = {}) {
  if (!container) return;

  if (block?.loadPending) {
    container.innerHTML = `
      <div class="workspace-load-prompt workspace-load-prompt-inline">
        <strong>${escapeHtml(block?.emptyTitle || t("home.momLoadTitle", "So với tháng trước"))}</strong>
        <p>${escapeHtml(block?.emptyBody || t("home.momLoadBody", "Bấm để so sánh chi, thu và còn lại với tháng liền trước."))}</p>
        <button type="button" class="btn btn-sm btn-outline-primary" id="btnLoadHomeMom">
          ${escapeHtml(t("home.momLoadAction", "Xem so với tháng trước"))}
        </button>
      </div>
    `;
    return;
  }

  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) {
    container.innerHTML = `
      <div class="home-empty-inline">
        <strong>${escapeHtml(t("home.noMonthSummary", "Chưa có tóm tắt tháng."))}</strong>
      </div>
    `;
    return;
  }

  const note = String(block?.prevMonthLabel || "").trim();
  container.innerHTML = `
    ${note ? `<p class="home-mom-note small text-muted">${escapeHtml(formatTemplate(t("home.momCompareNote", "So với {{month}}"), { month: note }))}</p>` : ""}
    <div class="home-mom-grid">
      ${items
        .map(
          (item) => `
            <article class="home-mom-card tone-${escapeHtml(item.key || "net")}">
              <span class="home-mom-label">${escapeHtml(item.label)}</span>
              <strong class="home-mom-current u-money"${titleAttr(item.currentTitle)}>${escapeHtml(item.currentText)}</strong>
              <span class="home-mom-previous">Tháng trước <span class="u-money"${titleAttr(item.previousTitle)}>${escapeHtml(item.previousText)}</span></span>
              <span class="home-mom-delta tone-${escapeHtml(item.deltaTone || "up")}">${escapeHtml(item.deltaText || "0%")}</span>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderMomSection(block = {}) {
  const titleEl = byId("homeMomTitle");
  const metaEl = byId("homeMomMeta");
  if (titleEl) titleEl.textContent = t("home.momTitle", "So với tháng trước");
  if (metaEl) {
    metaEl.textContent = block?.loadPending
      ? t("home.momLoadMeta", "Tải khi cần — không quét tháng trước tự động.")
      : t("home.momMeta", "Chi, thu và còn lại so với tháng liền trước.");
  }
  renderMomComparison(byId("homeMomComparison"), block);
}

function renderTopCategoriesSection(block = {}) {
  const sectionEl = byId("homeTopCategoriesSection");
  if (!sectionEl) return;

  const items = Array.isArray(block?.items) ? block.items : [];
  const headHtml = `
    <div class="home-section-head home-section-head-split">
      <div class="home-section-head-copy">
        <h2 class="home-section-title">${escapeHtml(t("glossary.topCategories", "Top danh mục chi"))}</h2>
        <p class="home-section-subtitle">${escapeHtml(t("home.topCategoriesMeta", "Tháng này — từ cache hiện tại."))}</p>
      </div>
      <a class="btn btn-sm btn-outline-secondary home-section-head-action" data-route-link href="#reports">${escapeHtml(t("glossary.fullReport", "Báo cáo"))}</a>
    </div>
  `;

  if (!items.length) {
    sectionEl.innerHTML = `
      ${headHtml}
      <div class="home-empty-inline">
        <strong>${escapeHtml(block?.emptyTitle || "")}</strong>
        <div>${escapeHtml(block?.emptyBody || "")}</div>
      </div>
    `;
    return;
  }

  sectionEl.innerHTML = `
    ${headHtml}
    <div class="home-category-list">
      ${items
        .map(
          (item, index) => `
            <article class="home-category-row">
              <span class="home-category-rank">${index + 1}</span>
              <div class="home-category-main">
                <div class="home-category-title u-ellipsis">${escapeHtml(item.label)}</div>
                <div class="home-category-meta u-ellipsis">${escapeHtml(item.shareText || "")} · ${escapeHtml(String(item.count || 0))} giao dịch</div>
              </div>
              <strong class="home-category-value u-money"${titleAttr(item.totalText || "0đ")}>${escapeHtml(item.totalText || "0đ")}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderRecentSection(block = {}) {
  const sectionEl = byId("homeRecentSection");
  if (!sectionEl) return;

  const items = Array.isArray(block?.items) ? block.items : [];
  sectionEl.innerHTML = `
    <div class="home-section-head home-section-head-split">
      <div class="home-section-head-copy">
        <h2 class="home-section-title">${escapeHtml(t("glossary.recentTransactions", "Giao dịch gần đây"))}</h2>
        <p class="home-section-subtitle">${escapeHtml(t("home.recentMeta", "7 ngày gần nhất trong tháng này."))}</p>
      </div>
      <a class="btn btn-sm btn-outline-secondary home-section-head-action" data-route-link href="#expenses">${escapeHtml(t("glossary.openLedger", "Mở chi tiêu"))}</a>
    </div>
    ${
      items.length
        ? `<div class="home-recent-list">${items
            .map(
              (row) => `
                <article class="home-today-row" data-home-recent-id="${escapeHtml(row.id)}">
                  <div class="home-today-main">
                    <div class="home-today-title u-ellipsis">${escapeHtml(row.title)}</div>
                    <div class="home-today-meta u-ellipsis">${escapeHtml([row.dateLabel, row.categoryLabel, row.accountLabel].filter(Boolean).join(" · "))}</div>
                  </div>
                  <strong class="home-today-amount u-money ${escapeHtml(row.amountClass)}"${titleAttr(row.amountText)}>${escapeHtml(row.amountText)}</strong>
                </article>
              `
            )
            .join("")}</div>`
        : `<div class="home-empty-inline">
            <strong>${escapeHtml(block?.emptyTitle || "")}</strong>
            <div>${escapeHtml(block?.emptyBody || "")}</div>
          </div>`
    }
  `;
}

function renderDailyFlowSection(block = {}, accountFilter = {}) {
  const titleEl = byId("homeDailyFlowTitle");
  const metaEl = byId("homeDailyFlowMeta");
  const countEl = byId("homeDailyFlowCount");
  const activeCount = (Array.isArray(block?.items) ? block.items : []).filter(hasDailyActivity).length;
  const filterId = String(accountFilter?.accountId || "all").trim() || "all";
  const filterLabel = String(accountFilter?.label || "").trim();

  if (titleEl) titleEl.textContent = t("home.dailyFlowTitle", "Dòng tiền theo ngày");
  if (metaEl) {
    const base = t("home.dailyFlowMeta", "Tháng này — ngày có giao dịch, mới nhất lên trên.");
    metaEl.textContent =
      filterId !== "all" && filterLabel
        ? `${base} · ${formatTemplate(t("home.filterActiveNote", "Đang lọc theo {{account}}"), { account: filterLabel })}`
        : base;
  }
  if (countEl) {
    const countText = formatTemplate(t("home.dailyFlowDayCount", "{{count}} ngày"), { count: activeCount });
    countEl.textContent = countText;
    countEl.classList.toggle("d-none", block?.loadPending || activeCount <= 0);
  }

  renderHomeDailyFlow(byId("homeDailyFlow"), block);
}

export function renderHomeRoute(vm = {}) {
  renderTop(vm);
  renderAccountsHeadings();
  renderAccountsGrid(byId("homeAccountsGrid"), vm?.accountHighlights || []);
  renderAccountFilter(vm?.accountFilter || {});
  renderTodayHeadings(vm?.todayLedger || {});
  renderTodaySection(vm?.todayLedger || {});
  renderMonthBar(byId("homeMonthBar"), vm?.monthBar || []);
  renderTopCategoriesSection(vm?.categoryBreakdown || {});
  renderRecentSection(vm?.recentTransactions || {});
  renderMomSection(vm?.momComparison || {});
  renderDailyFlowSection(vm?.dailyFlow || {}, vm?.accountFilter || {});
}

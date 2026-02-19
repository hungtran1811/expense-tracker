// migrated to src structure
import {
  getMonthValue,
  lastMonths,
  VND,
  formatVND,
  getReportAccountFilter,
} from "../../shared/ui/core.js";
import {
  listExpensesByMonth,
  listIncomesByMonth,
} from "../../services/firebase/firestore.js";
import { getReportInsights } from "../../services/api/aiReportInsights.js";

// Top categories by spend (overview card)
export async function refreshTopCategories(uid) {
  const ym = getMonthValue();
  const list = await listExpensesByMonth(uid, ym);
  const agg = new Map();

  list.forEach((x) => {
    const k = x.category || "Other";
    agg.set(k, (agg.get(k) || 0) + Number(x.amount || 0));
  });

  const top = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = top.length ? top[0][1] : 1;
  const wrap = document.getElementById("topCats");
  if (!wrap) return;

  wrap.innerHTML = top.length
    ? top
        .map(([cat, total]) => {
          const ratio = Math.max(8, Math.round((total / max) * 100));
          return `
            <div class="top-cat-item">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="top-cat-name">${cat}</span>
                <strong class="top-cat-value">${Number(total).toLocaleString(
                  "en-US"
                )} VND</strong>
              </div>
              <div class="top-cat-track"><span style="width:${ratio}%"></span></div>
            </div>
          `;
        })
        .join("")
    : '<div class="text-muted small">No spending data for this month.</div>';
}

// 1) Recent transactions (current month)
export async function renderOverviewRecent(uid) {
  const ym = getMonthValue();
  const [exps, incs] = await Promise.all([
    listExpensesByMonth(uid, ym),
    listIncomesByMonth(uid, ym),
  ]);
  const merged = [
    ...exps.map((x) => ({
      type: "expense",
      date: x.date,
      name: x.name || x.note || "Expense",
      amt: x.amount || x.money || 0,
      cat: x.category || "Other",
    })),
    ...incs.map((x) => ({
      type: "income",
      date: x.date,
      name: x.name || x.note || "Income",
      amt: x.amount || x.money || 0,
      cat: x.category || "Other",
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const ul = document.getElementById("ov-recent");
  if (!ul) return;
  ul.innerHTML = merged
    .map((item) => {
      const badge =
        item.type === "expense"
          ? '<span class="badge bg-danger-subtle text-danger ov-badge">Expense</span>'
          : '<span class="badge bg-success-subtle text-success ov-badge">Income</span>';
      return `<li class="list-group-item">
      <span class="ov-note">${badge} ${
        item.name
      } <span class="text-secondary ms-1"> - ${item.cat}</span></span>
      <span class="ov-amt ${
        item.type === "expense" ? "text-danger" : "text-success"
      }">${VND(item.amt)}</span>
    </li>`;
    })
    .join("");
}

// Top 5 expenses (current month)
export async function renderOverviewTopExpenses(uid) {
  const ym = getMonthValue();
  const exps = await listExpensesByMonth(uid, ym);

  const top5 = exps
    .map((x) => ({
      id: x.id,
      name: x.name || x.note || "Expense",
      cat: x.category || "Other",
      amt: Number(x.amount || x.money || 0),
      date: x.date,
    }))
    .sort((a, b) => b.amt - a.amt)
    .slice(0, 5);

  const toDDMM = (d) => {
    const dt = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
    return isNaN(dt)
      ? ""
      : dt.toISOString().slice(5, 10).split("-").reverse().join("/");
  };

  const ul = document.getElementById("ov-top5");
  if (!ul) return;
  ul.innerHTML = top5.length
    ? top5
        .map(
          (i) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold">${i.name}</div>
            <div class="text-secondary small">${i.cat}${
            i.date ? " - " + toDDMM(i.date) : ""
          }</div>
          </div>
          <div class="text-danger fw-semibold">${VND(i.amt)}</div>
        </li>
      `
        )
        .join("")
    : '<li class="list-group-item text-muted">No data yet</li>';
}

// 2) 6-month trend (sparkline)
export async function renderOverviewTrend(uid) {
  const months = lastMonths(6);
  const sum = async (fn, ym) =>
    (await fn(uid, ym)).reduce((s, x) => s + (x.amount || x.money || 0), 0);

  const exp = [];
  const inc = [];
  for (const m of months) {
    exp.push(await sum(listExpensesByMonth, m));
    inc.push(await sum(listIncomesByMonth, m));
  }

  const el = document.getElementById("ov-trend");
  if (!el) return;
  const W = el.clientWidth || 520,
    H = el.clientHeight || 140,
    pad = 12;
  const max = Math.max(...exp, ...inc, 1);
  const sx = (i) => pad + i * ((W - 2 * pad) / (months.length - 1));
  const sy = (v) => H - pad - (v / max) * (H - 2 * pad);
  const path = (arr) =>
    arr.map((v, i) => (i ? "L" : "M") + sx(i) + "," + sy(v)).join(" ");

  el.innerHTML = `
    <svg class="spark" viewBox="0 0 ${W} ${H}">
      <path class="line-exp" d="${path(exp)}"></path>
      <path class="line-inc" d="${path(inc)}"></path>
      <g font-size="10" fill="#64748b">
        ${months
          .map(
            (m, i) =>
              `<text x="${sx(i)}" y="${H - 2}" text-anchor="middle">${m.slice(
                5
              )}</text>`
          )
          .join("")}
      </g>
    </svg>
  `;
}

// 3) Expense by category (current month) + alerts
export async function renderOverviewCategory(uid) {
  const ym = getMonthValue();
  const exps = await listExpensesByMonth(uid, ym);
  const byCat = {};
  exps.forEach((x) => {
    const k = x.category || "Other";
    byCat[k] = (byCat[k] || 0) + (x.amount || x.money || 0);
  });
  const total = Object.values(byCat).reduce((s, v) => s + v, 0) || 1;
  const rows = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, val]) => {
      const pct = (val * 100) / total;
      return `<div class="cat-row">
        <div class="d-flex justify-content-between">
          <span class="cat-name">${name}</span>
          <span class="fw-semibold">${VND(val)}</span>
        </div>
        <div class="cat-bar mt-1"><div class="cat-fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join("");

  const wrap = document.getElementById("ov-cat");
  if (wrap) wrap.innerHTML = rows || '<div class="text-muted">No data yet.</div>';

  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const alerts = [];
  const top = entries[0];
  if (top && top[1] > total * 0.4) {
    alerts.push(
      `Category <b>${top[0]}</b> takes ${Math.round(
        (top[1] * 100) / total
      )}% of total spend.`
    );
  }
  if (exps.length === 0) {
    alerts.push("No expenses recorded this month.");
  }

  const lines = entries.map(([name, val]) => {
    const pct = Math.round((val * 100) / total);
    return `- <b>${name}</b> takes ${pct}% (${VND(val)})`;
  });

  const box = document.getElementById("ov-alerts");
  if (box) {
    box.innerHTML =
      (alerts.length
        ? alerts.map((a) => `<div class="mb-1">- ${a}</div>`).join("") +
          "<hr class='my-2'/>"
        : "") +
      (lines.length
        ? `<div class="small">${lines.join("<br/>")}</div>`
        : '<div class="text-muted">No data available.</div>');
  }
}

// Run the overview blocks together
export async function renderOverviewLower(uid) {
  await Promise.all([
    renderOverviewRecent(uid),
    renderOverviewTopExpenses(uid),
    renderOverviewCategory(uid),
    // Optional: renderOverviewTrend(uid)
  ]);
}

// Cashflow chart by day in month
export async function renderReportCashflow(uid) {
  const el = document.getElementById("cashflowChart");
  if (!el || !uid) return;

  const ym = getMonthValue();
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return;

  el.textContent = "Loading cashflow chart...";

  try {
    const [exps, incs] = await Promise.all([
      listExpensesByMonth(uid, ym),
      listIncomesByMonth(uid, ym),
    ]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const exp = Array(daysInMonth).fill(0);
    const inc = Array(daysInMonth).fill(0);

    const getDayIndex = (doc) => {
      const d = doc?.date?.seconds
        ? new Date(doc.date.seconds * 1000)
        : new Date(doc.date);
      if (isNaN(d)) return null;
      return d.getDate() - 1;
    };

    exps.forEach((e) => {
      const idx = getDayIndex(e);
      if (idx == null || idx < 0 || idx >= daysInMonth) return;
      exp[idx] += Number(e.amount || e.money || 0);
    });

    incs.forEach((i) => {
      const idx = getDayIndex(i);
      if (idx == null || idx < 0 || idx >= daysInMonth) return;
      inc[idx] += Number(i.amount || i.money || 0);
    });

    const hasData = exp.some((v) => v > 0) || inc.some((v) => v > 0);
    if (!hasData) {
      el.innerHTML =
        '<div class="text-muted small">No income or expense data for this month.</div>';
      return;
    }

    const W = el.clientWidth || 520;
    const H = 160;
    const pad = 16;

    const max = Math.max(...exp, ...inc, 1);
    const sx = (i) =>
      daysInMonth === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (daysInMonth - 1);
    const sy = (v) => H - pad - (v / max) * (H - 2 * pad);
    const path = (arr) =>
      arr.map((v, i) => (i ? "L" : "M") + sx(i) + "," + sy(v)).join(" ");

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    el.innerHTML = `
      <svg class="spark" viewBox="0 0 ${W} ${H}">
        <path class="line-exp" d="${path(exp)}"></path>
        <path class="line-inc" d="${path(inc)}"></path>
        <g font-size="9" fill="#64748b">
          ${days
            .filter((d) => d === 1 || d === daysInMonth || d % 5 === 0)
            .map((d) => {
              const idx = d - 1;
              return `<text x="${sx(idx)}" y="${
                H - 2
              }" text-anchor="middle">${d}</text>`;
            })
            .join("")}
        </g>
      </svg>
      <div class="cashflow-legend">
        <span class="legend-item">
          <span class="dot dot-exp"></span> Expense
        </span>
        <span class="legend-item">
          <span class="dot dot-inc"></span> Income
        </span>
      </div>
    `;
  } catch (err) {
    console.error("renderReportCashflow error:", err);
    el.innerHTML =
      '<div class="text-danger small">Failed to load cashflow data.</div>';
  }
}

// Bar + pie charts for Reports
export async function renderReportsCharts(uid, accountFilter = "all") {
  const barWrap = document.getElementById("barChart");
  const pieWrap = document.getElementById("pieChart");
  if (!barWrap || !pieWrap || !uid) return;

  const ym = getMonthValue();
  const account = accountFilter || getReportAccountFilter();

  try {
    const [expenses, incomes] = await Promise.all([
      listExpensesByMonth(uid, ym),
      listIncomesByMonth(uid, ym),
    ]);

    const expFiltered =
      account === "all"
        ? expenses
        : expenses.filter(
            (e) => (e.account || "").toLowerCase() === account.toLowerCase()
          );

    const incFiltered =
      account === "all"
        ? incomes
        : incomes.filter(
            (i) => (i.account || "").toLowerCase() === account.toLowerCase()
          );

    if (!expFiltered.length && !incFiltered.length) {
      const msg =
        '<div class="text-muted small">No data for this month and account selection.</div>';
      barWrap.innerHTML = msg;
      pieWrap.innerHTML = msg;
      return;
    }

    // BAR: top 5 expense categories
    const catMap = new Map();
    expFiltered.forEach((e) => {
      const cat = e.category || "Other";
      catMap.set(cat, (catMap.get(cat) || 0) + Number(e.amount || 0));
    });

    const catEntries = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
    const topCats = catEntries.slice(0, 5);
    const maxVal =
      topCats.length > 0 ? Math.max(...topCats.map(([, v]) => v)) : 0;

    if (!topCats.length || maxVal <= 0) {
      barWrap.innerHTML =
        '<div class="text-muted small">No expense data for this month.</div>';
    } else {
      barWrap.innerHTML = `
        <div class="ht-bar-chart">
          ${topCats
            .map(([name, val]) => {
              const h = (val / maxVal) * 100 || 1;
              return `
              <div class="bar-col">
                <div class="bar" style="height:${h}%">
                  <span class="bar-value">${Number(val).toLocaleString(
                    "en-US"
                  )} VND</span>
                </div>
                <div class="bar-label" title="${name}">${name}</div>
              </div>`;
            })
            .join("")}
        </div>`;
    }

    // PIE: expense distribution
    const totalExp = catEntries.reduce((s, [, v]) => s + v, 0);
    if (!totalExp) {
      pieWrap.innerHTML =
        '<div class="text-muted small">No expense data for this month.</div>';
      return;
    }

    const colors = [
      "#4E79A7",
      "#F28E2B",
      "#E15759",
      "#76B7B2",
      "#59A14F",
      "#EDC948",
      "#B07AA1",
      "#9C755F",
      "#BAB0AC",
    ];

    let currentDeg = 0;
    const segments = [];
    const legends = [];
    const usedCats = topCats.length ? topCats : catEntries;

    usedCats.forEach(([name, val], idx) => {
      const start = currentDeg;
      const angle = (val / totalExp) * 360;
      const end = start + angle;
      const color = colors[idx % colors.length];
      currentDeg = end;

      segments.push(`${color} ${start}deg ${end}deg`);

      const percent = ((val / totalExp) * 100).toFixed(1);
      legends.push(`
        <div class="ht-pie-legend-row">
          <div class="d-flex align-items-center">
            <span class="ht-pie-dot" style="background:${color}"></span>
            <span class="text-truncate">${name}</span>
          </div>
          <div class="text-end">
            <strong>${percent}%</strong>
            <span class="text-muted ms-1 small">${Number(val).toLocaleString(
              "en-US"
            )} VND</span>
          </div>
        </div>`);
    });

    pieWrap.innerHTML = `
      <div class="d-flex align-items-center gap-3 flex-wrap">
        <div class="ht-pie" style="background-image: conic-gradient(${segments.join(
          ","
        )});"></div>
        <div class="flex-grow-1">
          ${legends.join("")}
        </div>
      </div>`;
  } catch (err) {
    console.error("[renderReportsCharts]", err);
    barWrap.innerHTML =
      '<div class="text-danger small">Failed to load report data.</div>';
    pieWrap.innerHTML =
      '<div class="text-danger small">Failed to load report data.</div>';
  }
}

export async function renderReportInsights(uid, accountFilter = "all") {
  const wrap = document.getElementById("reportInsightsBody");
  const aiBox = document.getElementById("reportInsightsAi");
  if (!wrap || !uid) return;

  // Set loading state for AI (if box exists)
  if (aiBox) {
    renderAiSummaryBox(aiBox, "", "loading");
  }

  const ym = getMonthValue();
  const account = accountFilter || getReportAccountFilter();

  const [y, m] = ym.split("-").map(Number);
  let prevY = y;
  let prevM = m - 1;
  if (prevM === 0) {
    prevM = 12;
    prevY = y - 1;
  }
  const prevYm = `${prevY}-${String(prevM).padStart(2, "0")}`;

  try {
    const [curExp, curInc, prevExp, prevInc] = await Promise.all([
      listExpensesByMonth(uid, ym),
      listIncomesByMonth(uid, ym),
      listExpensesByMonth(uid, prevYm),
      listIncomesByMonth(uid, prevYm),
    ]);

    const filterByAcc = (list) =>
      account === "all"
        ? list
        : list.filter(
            (x) => (x.account || "").toLowerCase() === account.toLowerCase()
          );

    const curE = filterByAcc(curExp);
    const curI = filterByAcc(curInc);
    const prevE = filterByAcc(prevExp);
    const prevI = filterByAcc(prevInc);

    // No data this month -> stop, and skip AI
    if (!curE.length && !curI.length) {
      wrap.innerHTML =
        '<span class="text-muted">No data to analyze for the selected account.</span>';
      if (aiBox) {
        aiBox.textContent =
          "No data this month for AI analysis. Add a few expenses or incomes to get insights.";
      }
      return;
    }

    const totalExp = curE.reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalInc = curI.reduce((s, x) => s + Number(x.amount || 0), 0);
    const net = totalInc - totalExp;

    const prevExpSum = prevE.reduce((s, x) => s + Number(x.amount || 0), 0);
    const prevIncSum = prevI.reduce((s, x) => s + Number(x.amount || 0), 0);
    const prevNet = prevIncSum - prevExpSum;

    // Compare expenses vs last month
    let expCompareHtml = "";
    if (prevExpSum > 0) {
      const diff = totalExp - prevExpSum;
      const perc = Math.abs((diff / prevExpSum) * 100).toFixed(1);
      if (diff > 0) {
        expCompareHtml = `<span class="insight-up">+${perc}%</span> vs last month`;
      } else if (diff < 0) {
        expCompareHtml = `<span class="insight-down">-${perc}%</span> vs last month`;
      } else {
        expCompareHtml = "No change vs last month";
      }
    } else {
      expCompareHtml = "No expense data last month for comparison";
    }

    // Compare net vs last month
    let netCompareHtml = "";
    if (prevE.length || prevI.length) {
      const diffNet = net - prevNet;
      const percNet =
        prevNet === 0 ? null : Math.abs((diffNet / prevNet) * 100).toFixed(1);
      if (prevNet === 0 || percNet === null) {
        netCompareHtml = "Not enough data to compare net vs last month";
      } else if (diffNet > 0) {
        netCompareHtml = `<span class="insight-down">Improved ${percNet}%</span> vs last month`;
      } else if (diffNet < 0) {
        netCompareHtml = `<span class="insight-up">Worse ${percNet}%</span> vs last month`;
      } else {
        netCompareHtml = "Net unchanged vs last month";
      }
    }

    // Category totals to find highest spend category
    const catMap = new Map();
    curE.forEach((e) => {
      const cat = e.category || "Other";
      catMap.set(cat, (catMap.get(cat) || 0) + Number(e.amount || 0));
    });
    const topCat = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];

    // Aggregate by day to find peak/low spend days
    const dayMap = new Map();
    curE.forEach((e) => {
      const d = e?.date?.seconds
        ? new Date(e.date.seconds * 1000)
        : new Date(e.date);
      if (isNaN(d)) return;
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      dayMap.set(key, (dayMap.get(key) || 0) + Number(e.amount || 0));
    });

    const dayEntries = [...dayMap.entries()].filter(([, total]) => total > 0);

    const topDay =
      dayEntries.length > 0
        ? [...dayEntries].sort((a, b) => b[1] - a[1])[0]
        : null;

    const minDay =
      dayEntries.length > 0
        ? [...dayEntries].sort((a, b) => a[1] - b[1])[0]
        : null;

    const formatDayLabel = (key) => {
      const [, mm, dd] = key.split("-");
      return `${dd}/${mm}`;
    };

    const accLabel =
      account === "all" ? "all accounts" : `account ${account}`;

    const fallback = (() => {
      const netTxt =
        net >= 0
          ? "You are running a surplus this month."
          : "You are running a deficit this month.";
      const topTxt = topCat
        ? `Your highest spend category is ${topCat[0]}.`
        : "Track your top category to optimize spending.";
      const actTxt =
        net < 0
          ? "Consider trimming 1-2 big expenses or setting category limits next month."
          : "Keep this habit and set light limits on categories that tend to grow.";
      return `${netTxt} ${topTxt} ${actTxt}`;
    })();

    // Local insight text
    wrap.innerHTML = `
      <div class="insight-item">
        - Total expenses this month (${accLabel}): <strong>${formatVND(
          totalExp
        )}</strong>
      </div>
      <div class="insight-item">
        - Total income this month (${accLabel}): <strong>${formatVND(
          totalInc
        )}</strong>
      </div>
      <div class="insight-item">
        - Net (Income - Expense): <strong>${formatVND(net)}</strong>
      </div>
      <div class="insight-item">
        - Expense comparison: ${expCompareHtml}
      </div>
      ${
        netCompareHtml
          ? `<div class="insight-item">- Net comparison: ${netCompareHtml}</div>`
          : ""
      }
      ${
        topCat
          ? `<div class="insight-item">
              - Top spend category: <strong>${topCat[0]}</strong>
              (${formatVND(topCat[1])})
            </div>`
          : ""
      }
      ${
        topDay
          ? `<div class="insight-item">
              - Highest spend day: <strong>${formatDayLabel(topDay[0])}</strong>
              (${formatVND(topDay[1])})
            </div>`
          : ""
      }
      ${
        minDay
          ? `<div class="insight-item">
              - Lowest spend day (with spend): <strong>${formatDayLabel(
                minDay[0]
              )}</strong>
              (${formatVND(minDay[1])})
            </div>`
          : ""
      }
      ${
        topDay && minDay
          ? `<div class="insight-item mt-1 text-secondary">
              <em>This month, you spent the most on ${formatDayLabel(
                topDay[0]
              )} (${formatVND(topDay[1])}) and the least on ${formatDayLabel(
              minDay[0]
            )} (${formatVND(minDay[1])}).</em>
            </div>`
          : ""
      }
    `;

    // AI summary
    if (aiBox) {
      const monthLabel = `${String(m).padStart(2, "0")}/${y}`;
      const payload = {
        monthLabel,
        accountLabel: accLabel,
        totalChi: totalExp,
        totalThu: totalInc,
        net,
        chiCompareText: stripHtmlTags(expCompareHtml),
        netCompareText: stripHtmlTags(netCompareHtml),
        topCategory: topCat ? { name: topCat[0], amount: topCat[1] } : null,
        topDay: topDay
          ? {
              date: formatDayLabel(topDay[0]),
              amount: topDay[1],
            }
          : null,
      };

      try {
        const rawSummary = await getReportInsights(payload);

        const raw = (rawSummary || "").trim();
        const summary = normalizeAiSummary(raw, fallback);
        renderAiSummaryBox(aiBox, summary, "done");
      } catch (err) {
        console.error("AI report summary failed:", err);
        renderAiSummaryBox(
          aiBox,
          "AI is unavailable right now. You can still review the quick insights above.",
          "error"
        );
      }
    }
  } catch (err) {
    wrap.innerHTML =
      '<span class="text-danger small">Failed to analyze data.</span>';
    if (aiBox) {
      aiBox.textContent =
        "AI is unavailable due to an analysis error.";
    }
    console.error("renderReportInsights error:", err);
  }
}

// Remove simple HTML tags for AI text
function stripHtmlTags(str = "") {
  if (!str) return "";
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// UI helpers (safe render)
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAiSummaryBox(aiBox, summaryText, state = "done") {
  if (!aiBox) return;

  if (state === "loading") {
    aiBox.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span class="text-secondary small">AI is analyzing...</span>
      </div>
    `;
    return;
  }

  if (state === "error") {
    aiBox.innerHTML = `<div class="text-danger small">${escapeHtml(
      summaryText
    )}</div>`;
    return;
  }

  // done
  const safe = escapeHtml(summaryText)
    .replace(/\n{2,}/g, "\n")
    .replace(/\n/g, "<br/>");

  aiBox.innerHTML = `
    <div class="small text-secondary mb-1">AI insights</div>
    <div class="ai-summary">${safe}</div>
  `;
}

function normalizeAiSummary(summary, fallback) {
  let s = (summary || "").replace(/\s+/g, " ").trim();

  // Too short or no punctuation => fallback
  const hasSentenceEnd = /[.!?]$/.test(s);
  const hasAnyPunc = /[.!?]/.test(s);

  if (!s || s.length < 45 || !hasAnyPunc) return fallback;

  if (!hasSentenceEnd) s += ".";

  if (/\b(you spend|you earn|you pay)\.$/i.test(s)) return fallback;

  return s;
}

async function fetchAiReportInsights(payload) {
  try {
    const res = await fetch("/.netlify/functions/ai-report-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("AI report insights HTTP error:", res.status, errText);
      throw new Error(`HTTP ${res.status}: ${errText || "Server error"}`);
    }

    const data = await res.json();
    if (data?.summary) return data.summary.trim();

    throw new Error("No summary in response");
  } catch (err) {
    console.error("fetchAiReportInsights error:", err);
    throw err;
  }
}
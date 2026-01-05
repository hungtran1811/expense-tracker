// assets/reports.js
import {
  getMonthValue,
  lastMonths,
  VND,
  formatVND,
  getReportAccountFilter,
} from "./core.js";
import { listExpensesByMonth, listIncomesByMonth } from "./db.js";

// 🔹 Top 3 danh mục chi nhiều nhất (overview card)
export async function refreshTopCategories(uid) {
  const ym = getMonthValue();
  const list = await listExpensesByMonth(uid, ym);
  const agg = new Map();
  list.forEach((x) => {
    const k = x.category || "Khác";
    agg.set(k, (agg.get(k) || 0) + Number(x.amount || 0));
  });
  const top = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const wrap = document.getElementById("topCats");
  if (!wrap) return;
  wrap.innerHTML = top.length
    ? top
        .map(
          ([cat, total]) =>
            `<button class="btn btn-outline-secondary d-flex justify-content-between">
              <span>${cat}</span>
              <strong>${Number(total).toLocaleString("vi-VN")}đ</strong>
            </button>`
        )
        .join("")
    : '<div class="text-muted">Chưa có dữ liệu</div>';
}

// ---- 1) Giao dịch gần nhất (tháng hiện tại)
export async function renderOverviewRecent(uid) {
  const ym = getMonthValue();
  const [exps, incs] = await Promise.all([
    listExpensesByMonth(uid, ym),
    listIncomesByMonth(uid, ym),
  ]);
  const merged = [
    ...exps.map((x) => ({
      type: "chi",
      date: x.date,
      name: x.name || x.note || "Chi",
      amt: x.amount || x.money || 0,
      cat: x.category || "Khác",
    })),
    ...incs.map((x) => ({
      type: "thu",
      date: x.date,
      name: x.name || x.note || "Thu",
      amt: x.amount || x.money || 0,
      cat: x.category || "Khác",
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const ul = document.getElementById("ov-recent");
  if (!ul) return;
  ul.innerHTML = merged
    .map((item) => {
      const badge =
        item.type === "chi"
          ? '<span class="badge bg-danger-subtle text-danger ov-badge">Chi</span>'
          : '<span class="badge bg-success-subtle text-success ov-badge">Thu</span>';
      return `<li class="list-group-item">
      <span class="ov-note">${badge} ${
        item.name
      } <span class="text-secondary ms-1">• ${item.cat}</span></span>
      <span class="ov-amt ${
        item.type === "chi" ? "text-danger" : "text-success"
      }">${VND(item.amt)}</span>
    </li>`;
    })
    .join("");
}

// ---- Top 5 khoản chi lớn nhất (tháng hiện tại)
export async function renderOverviewTopExpenses(uid) {
  const ym = getMonthValue();
  const exps = await listExpensesByMonth(uid, ym);

  const top5 = exps
    .map((x) => ({
      id: x.id,
      name: x.name || x.note || "Chi",
      cat: x.category || "Khác",
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
            i.date ? " • " + toDDMM(i.date) : ""
          }</div>
          </div>
          <div class="text-danger fw-semibold">${VND(i.amt)}</div>
        </li>
      `
        )
        .join("")
    : '<li class="list-group-item text-muted">Chưa có dữ liệu</li>';
}

// ---- 2) Xu hướng 6 tháng (sparkline)
export async function renderOverviewTrend(uid) {
  const months = lastMonths(6);
  const sum = async (fn, ym) =>
    (await fn(uid, ym)).reduce((s, x) => s + (x.amount || x.money || 0), 0);

  const chi = [];
  const thu = [];
  for (const m of months) {
    chi.push(await sum(listExpensesByMonth, m));
    thu.push(await sum(listIncomesByMonth, m));
  }

  const el = document.getElementById("ov-trend");
  if (!el) return;
  const W = el.clientWidth || 520,
    H = el.clientHeight || 140,
    pad = 12;
  const max = Math.max(...chi, ...thu, 1);
  const sx = (i) => pad + i * ((W - 2 * pad) / (months.length - 1));
  const sy = (v) => H - pad - (v / max) * (H - 2 * pad);
  const path = (arr) =>
    arr.map((v, i) => (i ? "L" : "M") + sx(i) + "," + sy(v)).join(" ");

  el.innerHTML = `
    <svg class="spark" viewBox="0 0 ${W} ${H}">
      <path class="line-exp" d="${path(chi)}"></path>
      <path class="line-inc" d="${path(thu)}"></path>
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

// ---- 3) Chi theo danh mục (tháng hiện tại) + alerts
export async function renderOverviewCategory(uid) {
  const ym = getMonthValue();
  const exps = await listExpensesByMonth(uid, ym);
  const byCat = {};
  exps.forEach((x) => {
    const k = x.category || "Khác";
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
  if (wrap)
    wrap.innerHTML = rows || '<div class="text-muted">Chưa có dữ liệu.</div>';

  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const alerts = [];
  const top = entries[0];
  if (top && top[1] > total * 0.4) {
    alerts.push(
      `Danh mục <b>${top[0]}</b> chiếm ${Math.round(
        (top[1] * 100) / total
      )}% tổng chi.`
    );
  }
  if (exps.length === 0) {
    alerts.push("Tháng này chưa có khoản chi.");
  }

  const lines = entries.map(([name, val]) => {
    const pct = Math.round((val * 100) / total);
    return `• <b>${name}</b> chiếm ${pct}% (${VND(val)})`;
  });

  const box = document.getElementById("ov-alerts");
  if (box) {
    box.innerHTML =
      (alerts.length
        ? alerts.map((a) => `<div class="mb-1">• ${a}</div>`).join("") +
          "<hr class='my-2'/>"
        : "") +
      (lines.length
        ? `<div class="small">${lines.join("<br/>")}</div>`
        : '<div class="text-muted">Không có dữ liệu.</div>');
  }
}

// Gói gọn: gọi 3 block overview cùng lúc
export async function renderOverviewLower(uid) {
  await Promise.all([
    renderOverviewRecent(uid),
    renderOverviewTopExpenses(uid),
    renderOverviewCategory(uid),
    // Nếu muốn: thêm renderOverviewTrend(uid) vào đây
  ]);
}

// ---- Biểu đồ dòng tiền theo ngày trong tháng
export async function renderReportCashflow(uid) {
  const el = document.getElementById("cashflowChart");
  if (!el || !uid) return;

  const ym = getMonthValue();
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return;

  el.textContent = "Đang tải biểu đồ dòng tiền...";

  try {
    const [exps, incs] = await Promise.all([
      listExpensesByMonth(uid, ym),
      listIncomesByMonth(uid, ym),
    ]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const chi = Array(daysInMonth).fill(0);
    const thu = Array(daysInMonth).fill(0);

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
      chi[idx] += Number(e.amount || e.money || 0);
    });

    incs.forEach((i) => {
      const idx = getDayIndex(i);
      if (idx == null || idx < 0 || idx >= daysInMonth) return;
      thu[idx] += Number(i.amount || i.money || 0);
    });

    const hasData = chi.some((v) => v > 0) || thu.some((v) => v > 0);
    if (!hasData) {
      el.innerHTML =
        '<div class="text-muted small">Chưa có dữ liệu thu / chi trong tháng này.</div>';
      return;
    }

    const W = el.clientWidth || 520;
    const H = 160;
    const pad = 16;

    const max = Math.max(...chi, ...thu, 1);
    const sx = (i) =>
      daysInMonth === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (daysInMonth - 1);
    const sy = (v) => H - pad - (v / max) * (H - 2 * pad);
    const path = (arr) =>
      arr.map((v, i) => (i ? "L" : "M") + sx(i) + "," + sy(v)).join(" ");

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    el.innerHTML = `
      <svg class="spark" viewBox="0 0 ${W} ${H}">
        <path class="line-exp" d="${path(chi)}"></path>
        <path class="line-inc" d="${path(thu)}"></path>
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
          <span class="dot dot-exp"></span> Chi
        </span>
        <span class="legend-item">
          <span class="dot dot-inc"></span> Thu
        </span>
      </div>
    `;
  } catch (err) {
    console.error("renderReportCashflow error:", err);
    el.innerHTML =
      '<div class="text-danger small">Lỗi tải dữ liệu dòng tiền.</div>';
  }
}

// ---- Biểu đồ cột + tròn cho Báo cáo
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
        '<div class="text-muted small">Chưa có dữ liệu trong tháng này cho tài khoản đã chọn.</div>';
      barWrap.innerHTML = msg;
      pieWrap.innerHTML = msg;
      return;
    }

    // BAR: top 5 danh mục chi
    const catMap = new Map();
    expFiltered.forEach((e) => {
      const cat = e.category || "Khác";
      catMap.set(cat, (catMap.get(cat) || 0) + Number(e.amount || 0));
    });

    const catEntries = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
    const topCats = catEntries.slice(0, 5);
    const maxVal =
      topCats.length > 0 ? Math.max(...topCats.map(([, v]) => v)) : 0;

    if (!topCats.length || maxVal <= 0) {
      barWrap.innerHTML =
        '<div class="text-muted small">Chưa có dữ liệu chi tiêu trong tháng này.</div>';
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
                    "vi-VN"
                  )}đ</span>
                </div>
                <div class="bar-label" title="${name}">${name}</div>
              </div>`;
            })
            .join("")}
        </div>`;
    }

    // PIE: tỷ trọng chi
    const totalChi = catEntries.reduce((s, [, v]) => s + v, 0);
    if (!totalChi) {
      pieWrap.innerHTML =
        '<div class="text-muted small">Chưa có dữ liệu chi tiêu trong tháng này.</div>';
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
      const angle = (val / totalChi) * 360;
      const end = start + angle;
      const color = colors[idx % colors.length];
      currentDeg = end;

      segments.push(`${color} ${start}deg ${end}deg`);

      const percent = ((val / totalChi) * 100).toFixed(1);
      legends.push(`
        <div class="ht-pie-legend-row">
          <div class="d-flex align-items-center">
            <span class="ht-pie-dot" style="background:${color}"></span>
            <span class="text-truncate">${name}</span>
          </div>
          <div class="text-end">
            <strong>${percent}%</strong>
            <span class="text-muted ms-1 small">${Number(val).toLocaleString(
              "vi-VN"
            )}đ</span>
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
      '<div class="text-danger small">Lỗi tải dữ liệu báo cáo.</div>';
    pieWrap.innerHTML =
      '<div class="text-danger small">Lỗi tải dữ liệu báo cáo.</div>';
  }
}

export async function renderReportInsights(uid, accountFilter = "all") {
  const wrap = document.getElementById("reportInsightsBody");
  const aiBox = document.getElementById("reportInsightsAi");
  if (!wrap || !uid) return;

  // set trạng thái loading cho AI (nếu có box)
  if (aiBox) {
    // aiBox.textContent = "AI đang phân tích dữ liệu tháng này...";
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

    // Không có dữ liệu tháng này -> dừng luôn, AI cũng khỏi gọi
    if (!curE.length && !curI.length) {
      wrap.innerHTML =
        '<span class="text-muted">Chưa có dữ liệu để phân tích cho tài khoản đã chọn.</span>';
      if (aiBox) {
        aiBox.textContent =
          "Không có dữ liệu tháng này để AI phân tích. Hãy thêm vài khoản chi / thu nhé.";
      }
      return;
    }

    const totalChi = curE.reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalThu = curI.reduce((s, x) => s + Number(x.amount || 0), 0);
    const net = totalThu - totalChi;

    const prevChi = prevE.reduce((s, x) => s + Number(x.amount || 0), 0);
    const prevThu = prevI.reduce((s, x) => s + Number(x.amount || 0), 0);
    const prevNet = prevThu - prevChi;

    // So sánh chi tiêu với tháng trước
    let chiCompareHtml = "";
    if (prevChi > 0) {
      const diff = totalChi - prevChi;
      const perc = Math.abs((diff / prevChi) * 100).toFixed(1);
      if (diff > 0) {
        chiCompareHtml = `<span class="insight-up">+${perc}%</span> so với chi tháng trước`;
      } else if (diff < 0) {
        chiCompareHtml = `<span class="insight-down">-${perc}%</span> so với chi tháng trước`;
      } else {
        chiCompareHtml = `Chi không đổi so với tháng trước`;
      }
    } else {
      chiCompareHtml = `Không có dữ liệu chi tháng trước để so sánh`;
    }

    // So sánh số dư với tháng trước
    let netCompareHtml = "";
    if (prevE.length || prevI.length) {
      const diffNet = net - prevNet;
      const percNet =
        prevNet === 0 ? null : Math.abs((diffNet / prevNet) * 100).toFixed(1);
      if (prevNet === 0 || percNet === null) {
        netCompareHtml = `Không có đủ dữ liệu để so sánh số dư với tháng trước`;
      } else if (diffNet > 0) {
        netCompareHtml = `<span class="insight-down">Tốt hơn ${percNet}%</span> so với số dư tháng trước`;
      } else if (diffNet < 0) {
        netCompareHtml = `<span class="insight-up">Xấu hơn ${percNet}%</span> so với số dư tháng trước`;
      } else {
        netCompareHtml = `Số dư không đổi so với tháng trước`;
      }
    }

    // Tổng hợp theo danh mục để tìm danh mục chi cao nhất
    const catMap = new Map();
    curE.forEach((e) => {
      const cat = e.category || "Khác";
      catMap.set(cat, (catMap.get(cat) || 0) + Number(e.amount || 0));
    });
    const topCat = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];

    // Tổng hợp theo ngày: dùng để tìm ngày chi nhiều nhất / ít nhất
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

    // Ngày chi nhiều nhất
    const topDay =
      dayEntries.length > 0
        ? [...dayEntries].sort((a, b) => b[1] - a[1])[0]
        : null;

    // Ngày chi ít nhất (nhưng phải có chi, > 0)
    const minDay =
      dayEntries.length > 0
        ? [...dayEntries].sort((a, b) => a[1] - b[1])[0]
        : null;

    const formatDayLabel = (key) => {
      // "2025-12-03" -> "03/12"
      const [yy, mm, dd] = key.split("-");
      return `${dd}/${mm}`;
    };

    const accLabel =
      account === "all" ? "tất cả tài khoản" : `tài khoản ${account}`;

    const fallback = (() => {
      const netTxt =
        net >= 0
          ? "Bạn đang thặng dư trong tháng này."
          : "Bạn đang âm trong tháng này.";
      const topTxt = topCat
        ? `Khoản chi lớn nhất nằm ở danh mục ${topCat[0]}.`
        : "Hãy theo dõi danh mục chi lớn nhất để dễ tối ưu.";
      const actTxt =
        net < 0
          ? "Thử cắt bớt 1–2 khoản chi lớn hoặc đặt giới hạn theo danh mục cho tháng sau."
          : "Bạn có thể giữ thói quen này và đặt giới hạn nhẹ cho các danh mục hay tăng.";
      return `${netTxt} ${topTxt} ${actTxt}`;
    })();

    // ====== PHẦN TEXT NHẬN XÉT NGẮN (LOCAL) ======
    wrap.innerHTML = `
      <div class="insight-item">
        • Tổng chi tháng này (${accLabel}): <strong>${formatVND(
      totalChi
    )}</strong>
      </div>
      <div class="insight-item">
        • Tổng thu tháng này (${accLabel}): <strong>${formatVND(
      totalThu
    )}</strong>
      </div>
      <div class="insight-item">
        • Số dư (Thu - Chi): <strong>${formatVND(net)}</strong>
      </div>
      <div class="insight-item">
        • So sánh chi tiêu: ${chiCompareHtml}
      </div>
      ${
        netCompareHtml
          ? `<div class="insight-item">• So sánh số dư: ${netCompareHtml}</div>`
          : ""
      }
      ${
        topCat
          ? `<div class="insight-item">
              • Danh mục chi cao nhất: <strong>${topCat[0]}</strong>
              (${formatVND(topCat[1])})
            </div>`
          : ""
      }
      ${
        topDay
          ? `<div class="insight-item">
              • Ngày chi nhiều nhất: <strong>${formatDayLabel(
                topDay[0]
              )}</strong>
              (${formatVND(topDay[1])})
            </div>`
          : ""
      }
      ${
        minDay
          ? `<div class="insight-item">
              • Ngày chi ít nhất (có chi): <strong>${formatDayLabel(
                minDay[0]
              )}</strong>
              (${formatVND(minDay[1])})
            </div>`
          : ""
      }
      ${
        topDay && minDay
          ? `<div class="insight-item mt-1 text-secondary">
              <em>Trong tháng này, bạn chi nhiều nhất vào ngày ${formatDayLabel(
                topDay[0]
              )} (${formatVND(
              topDay[1]
            )}) và chi ít nhất vào ngày ${formatDayLabel(
              minDay[0]
            )} (${formatVND(minDay[1])}).</em>
            </div>`
          : ""
      }
    `;

    // ====== PHẦN GỌI AI (AI REPORT INSIGHTS) ======
    if (aiBox) {
      const monthLabel = `${String(m).padStart(2, "0")}/${y}`;
      const payload = {
        monthLabel,
        accountLabel: accLabel,
        totalChi,
        totalThu,
        net,
        chiCompareText: stripHtmlTags(chiCompareHtml),
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
        const rawSummary = await fetchAiReportInsights(payload);

        const raw = (rawSummary || "").trim();
        const summary = normalizeAiSummary(raw, fallback);
        renderAiSummaryBox(aiBox, summary, "done");
      } catch (err) {
        console.error("AI report summary failed:", err);
        renderAiSummaryBox(
          aiBox,
          "Không thể sử dụng AI vào lúc này. Bạn vẫn có thể xem phần nhận xét nhanh phía trên.",
          "error"
        );
      }
    }
  } catch (err) {
    wrap.innerHTML =
      '<span class="text-danger small">Lỗi phân tích dữ liệu.</span>';
    if (aiBox) {
      aiBox.textContent =
        "Không thể sử dụng AI vào lúc này do lỗi phân tích dữ liệu.";
    }
    console.error("renderReportInsights error:", err);
  }
}

// ========== AI REPORT INSIGHTS ==========

// Bỏ các thẻ HTML đơn giản ra khỏi chuỗi (để gửi text gọn cho AI)
function stripHtmlTags(str = "") {
  if (!str) return "";
  return str
    .replace(/<[^>]+>/g, "") // bỏ mọi thẻ <...>
    .replace(/\s+/g, " ") // gom khoảng trắng
    .trim();
}

// ========== UI helpers (safe render) ==========
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
        <span class="text-secondary small">AI đang phân tích…</span>
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
    <div class="small text-secondary mb-1">AI gợi ý</div>
    <div class="ai-summary">${safe}</div>
  `;
}

function normalizeAiSummary(summary, fallback) {
  let s = (summary || "").replace(/\s+/g, " ").trim();

  // quá ngắn / không có dấu câu -> coi như không đạt
  const hasSentenceEnd = /[.!?]$/.test(s);
  const hasAnyPunc = /[.!?]/.test(s);

  if (!s || s.length < 45 || !hasAnyPunc) return fallback;

  // Nếu không kết thúc bằng dấu câu -> thêm "."
  if (!hasSentenceEnd) s += ".";

  // Tránh trường hợp kết thúc bằng từ cụt kiểu "bạn chi"
  if (/\b(bạn chi|bạn thu|bạn tiêu)\.$/i.test(s)) return fallback;

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
      console.error("AI report insights HTTP error:", res.status);
      throw new Error("HTTP error");
    }

    const data = await res.json();
    if (data?.summary) return data.summary.trim();

    throw new Error("No summary in response");
  } catch (err) {
    console.error("fetchAiReportInsights error:", err);
    throw err;
  }
}

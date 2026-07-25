function byId(id) {
  return document.getElementById(id);
}

function readReportFilters() {
  return {
    fromDate: byId("reportFromDate")?.value || "",
    toDate: byId("reportToDate")?.value || "",
    accountId: byId("reportAccountFilter")?.value || "all",
  };
}

export function bindReportEvents(handlers = {}) {
  document.addEventListener("click", (event) => {
    const recentRow = event.target.closest("[data-report-recent-id]");
    if (recentRow) {
      handlers.onEditTransaction?.(recentRow.getAttribute("data-report-recent-id") || "");
      return;
    }

    const drillEl = event.target.closest("[data-report-drill]");
    if (drillEl) {
      const kind = String(drillEl.getAttribute("data-report-drill") || "").trim();
      const key = String(drillEl.getAttribute("data-drill-key") || "").trim();
      if (kind && key) handlers.onDrillDown?.(kind, key);
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const drillEl = event.target.closest("[data-report-drill]");
    if (!drillEl) return;
    event.preventDefault();
    const kind = String(drillEl.getAttribute("data-report-drill") || "").trim();
    const key = String(drillEl.getAttribute("data-drill-key") || "").trim();
    if (kind && key) handlers.onDrillDown?.(kind, key);
  });

  byId("btnLoadReportsMom")?.addEventListener("click", () => {
    handlers.onLoadReportsMom?.();
  });

  byId("reportFromDate")?.addEventListener("change", () => {
    handlers.onChangeDraftFilters?.(readReportFilters());
  });

  byId("reportToDate")?.addEventListener("change", () => {
    handlers.onChangeDraftFilters?.(readReportFilters());
  });

  byId("reportAccountFilter")?.addEventListener("change", () => {
    handlers.onChangeDraftFilters?.(readReportFilters());
  });

  byId("btnLoadReports")?.addEventListener("click", () => {
    handlers.onLoadReports?.();
  });

  byId("btnApplyReportFilters")?.addEventListener("click", () => {
    handlers.onApplyFilters?.(readReportFilters());
  });

  byId("btnResetReportFilters")?.addEventListener("click", () => {
    handlers.onResetFilters?.();
  });

  byId("btnExportReportCsv")?.addEventListener("click", () => {
    handlers.onExportCsv?.();
  });

  byId("btnAiReportInsights")?.addEventListener("click", () => {
    handlers.onAiInsights?.();
  });

  document.querySelectorAll("[data-report-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = String(button.getAttribute("data-report-preset") || "").trim();
      if (!preset) return;
      handlers.onSelectPreset?.(preset);
    });
  });
}

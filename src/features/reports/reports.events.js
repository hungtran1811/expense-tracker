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
  byId("reportFromDate")?.addEventListener("change", () => {
    handlers.onChangeDraftFilters?.(readReportFilters());
  });

  byId("reportToDate")?.addEventListener("change", () => {
    handlers.onChangeDraftFilters?.(readReportFilters());
  });

  byId("reportAccountFilter")?.addEventListener("change", () => {
    handlers.onChangeDraftFilters?.(readReportFilters());
  });

  byId("btnApplyReportFilters")?.addEventListener("click", () => {
    handlers.onApplyFilters?.(readReportFilters());
  });

  byId("btnResetReportFilters")?.addEventListener("click", () => {
    handlers.onResetFilters?.();
  });
}

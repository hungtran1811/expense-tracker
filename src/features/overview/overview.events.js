function byId(id) {
  return document.getElementById(id);
}

function readOverviewFilters() {
  return {
    preset: document.querySelector("[data-overview-preset].active")?.getAttribute("data-overview-preset") || "30d",
    fromDate: byId("overviewFromDate")?.value || "",
    toDate: byId("overviewToDate")?.value || "",
  };
}

export function bindOverviewEvents(handlers = {}) {
  document.addEventListener("click", (event) => {
    const presetButton = event.target.closest("[data-overview-preset]");
    if (presetButton) {
      handlers.onChangePreset?.(presetButton.getAttribute("data-overview-preset") || "30d");
    }
  });

  byId("overviewFromDate")?.addEventListener("change", () => {
    handlers.onChangeDraftFilters?.(readOverviewFilters());
  });

  byId("overviewToDate")?.addEventListener("change", () => {
    handlers.onChangeDraftFilters?.(readOverviewFilters());
  });

  byId("btnApplyOverviewFilters")?.addEventListener("click", () => {
    handlers.onApplyFilters?.(readOverviewFilters());
  });
}

export function bindHomeEvents(handlers = {}) {
  document.addEventListener("click", (event) => {
    const filterChip = event.target.closest("[data-home-account-filter]");
    if (filterChip) {
      handlers.onChangeAccountFilter?.(filterChip.getAttribute("data-home-account-filter") || "all");
      return;
    }

    const todayRow = event.target.closest("[data-home-today-id]");
    if (todayRow) {
      handlers.onEditTransaction?.(todayRow.getAttribute("data-home-today-id") || "");
    }
  });
}

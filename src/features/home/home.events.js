export function bindHomeEvents(handlers = {}) {
  document.addEventListener("click", (event) => {
    if (event.target.closest("#btnOpenSavingsGoalPanel")) {
      handlers.onOpenSavingsGoalPanel?.();
      return;
    }

    if (event.target.closest("#btnSaveSavingsGoal")) {
      handlers.onSaveSavingsGoal?.();
      return;
    }

    const savingsAction = event.target.closest("[data-savings-action]");
    if (savingsAction) {
      const action = savingsAction.getAttribute("data-savings-action") || "";
      const id = savingsAction.getAttribute("data-savings-id") || "";
      if (action === "edit") handlers.onEditSavingsGoal?.(id);
      if (action === "delete") handlers.onDeleteSavingsGoal?.(id);
      return;
    }

    const filterChip = event.target.closest("[data-home-account-filter]");
    if (filterChip) {
      handlers.onChangeAccountFilter?.(filterChip.getAttribute("data-home-account-filter") || "all");
      return;
    }

    const todayRow = event.target.closest("[data-home-today-id]");
    if (todayRow) {
      handlers.onEditTransaction?.(todayRow.getAttribute("data-home-today-id") || "");
      return;
    }

    const recentRow = event.target.closest("[data-home-recent-id]");
    if (recentRow) {
      handlers.onEditTransaction?.(recentRow.getAttribute("data-home-recent-id") || "");
    }
  });
}

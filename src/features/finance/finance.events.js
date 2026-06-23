function byId(id) {
  return document.getElementById(id);
}

function readTransactionForm() {
  return {
    id: byId("ftId")?.value || "",
    type: byId("ftType")?.value || "expense",
    accountId: byId("ftAccountId")?.value || "",
    toAccountId: byId("ftToAccountId")?.value || "",
    amount: byId("ftAmount")?.value || "",
    occurredAt: byId("ftOccurredAt")?.value || "",
    categoryKey: byId("ftCategory")?.value || "other",
    scopeId: byId("ftScopeId")?.value || "",
    note: byId("ftNote")?.value || "",
  };
}

function readAccountForm() {
  return {
    id: byId("faId")?.value || "",
    name: byId("faName")?.value || "",
    type: byId("faType")?.value || "bank",
    openingBalance: byId("faOpeningBalance")?.value || "0",
    isDefault: !!byId("faDefault")?.checked,
  };
}

function readScopeCreateForm() {
  return {
    name: byId("expenseScopeName")?.value || "",
  };
}

function readExpenseScopeForm() {
  return {
    mode: byId("fsMode")?.value || "rename",
    id: byId("fsId")?.value || "",
    name: byId("fsName")?.value || "",
    replacementScopeId: byId("fsReplacementScopeId")?.value || "",
  };
}

export function bindFinanceEvents(handlers = {}) {
  byId("dayFilter")?.addEventListener("change", (event) => {
    handlers.onChangeFilters?.({ date: event?.target?.value || "" });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("#btnLoadFinanceMonth")) {
      handlers.onLoadFinanceMonth?.();
      return;
    }

    if (event.target.closest("#btnManageCreateAccount")) {
      handlers.onOpenAccountPanel?.();
      return;
    }

    const presetButton = event.target.closest("[data-finance-preset]");
    if (presetButton) {
      handlers.onChangePreset?.(presetButton.getAttribute("data-finance-preset") || "today");
      return;
    }

    const openButton = event.target.closest("[data-finance-open]");
    if (openButton) {
      handlers.onOpenComposer?.(openButton.getAttribute("data-finance-open") || "expense");
      return;
    }

    if (event.target.closest("#btnOpenAccountPanel") || event.target.closest("[data-open-account-panel]")) {
      handlers.onOpenAccountPanel?.();
      return;
    }

    const ledgerAction = event.target.closest("[data-ledger-action]");
    if (ledgerAction) {
      const action = ledgerAction.getAttribute("data-ledger-action") || "";
      const id = ledgerAction.getAttribute("data-id") || "";
      if (action === "edit") handlers.onEditTransaction?.(id);
      if (action === "delete") handlers.onDeleteTransaction?.(id);
      return;
    }

    const ledgerMain = event.target.closest("[data-ledger-main]");
    if (ledgerMain) {
      handlers.onEditTransaction?.(ledgerMain.getAttribute("data-id") || "");
      return;
    }

    const accountAction = event.target.closest("[data-account-action]");
    if (accountAction) {
      const action = accountAction.getAttribute("data-account-action") || "";
      const accountId = accountAction.getAttribute("data-account-id") || "";
      if (action === "edit") handlers.onEditAccount?.(accountId);
      if (action === "adjustment") handlers.onOpenAdjustment?.(accountId);
      if (action === "remove") handlers.onRemoveAccount?.(accountId);
      return;
    }

    const scopeAction = event.target.closest("[data-scope-action]");
    if (scopeAction) {
      const payload = {
        id: scopeAction.getAttribute("data-scope-id") || "",
        name: scopeAction.getAttribute("data-scope-name") || "",
        usageCount: Number(scopeAction.getAttribute("data-scope-usage-count") || 0),
      };
      const action = scopeAction.getAttribute("data-scope-action") || "";
      if (action === "rename") handlers.onRenameExpenseScope?.(payload);
      if (action === "delete") handlers.onDeleteExpenseScope?.(payload);
      return;
    }

  });

  byId("ledgerFilterAccount")?.addEventListener("change", (event) => {
    handlers.onChangeFilters?.({ accountId: event?.target?.value || "all" });
  });

  byId("ledgerFilterType")?.addEventListener("change", (event) => {
    handlers.onChangeFilters?.({ type: event?.target?.value || "all" });
  });

  byId("ledgerFilterCategory")?.addEventListener("change", (event) => {
    handlers.onChangeFilters?.({ categoryKey: event?.target?.value || "all" });
  });

  byId("ledgerFilterScope")?.addEventListener("change", (event) => {
    handlers.onChangeFilters?.({ scopeId: event?.target?.value || "all" });
  });

  byId("ledgerFilterSearch")?.addEventListener("input", (event) => {
    handlers.onChangeFilters?.({ search: event?.target?.value || "" });
  });

  byId("expenseScopeName")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handlers.onCreateExpenseScope?.(readScopeCreateForm());
  });

  byId("btnCreateExpenseScope")?.addEventListener("click", () => {
    handlers.onCreateExpenseScope?.(readScopeCreateForm());
  });

  byId("ftType")?.addEventListener("change", () => {
    handlers.onComposerTypeChange?.(readTransactionForm());
  });

  ["ftAccountId", "ftToAccountId", "ftAmount", "ftOccurredAt", "ftCategory", "ftScopeId", "ftNote"].forEach(
    (id) => {
      byId(id)?.addEventListener("input", () => {
        handlers.onComposerDraftChange?.(readTransactionForm());
      });
      byId(id)?.addEventListener("change", () => {
        handlers.onComposerDraftChange?.(readTransactionForm());
      });
    }
  );

  byId("btnSaveFinanceTransaction")?.addEventListener("click", () => {
    handlers.onSubmitTransaction?.(readTransactionForm());
  });

  byId("btnSaveFinanceAccount")?.addEventListener("click", () => {
    handlers.onSubmitAccount?.(readAccountForm());
  });

  byId("btnSaveExpenseScope")?.addEventListener("click", () => {
    handlers.onSubmitExpenseScopeForm?.(readExpenseScopeForm());
  });

  byId("fsName")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handlers.onSubmitExpenseScopeForm?.(readExpenseScopeForm());
  });

  byId("btnExportCsv")?.addEventListener("click", () => {
    handlers.onExportCsv?.();
  });

  byId("btnResetFinanceData")?.addEventListener("click", () => {
    handlers.onResetFinanceData?.();
  });
}

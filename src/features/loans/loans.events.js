function byId(id) {
  return document.getElementById(id);
}

function readLoanPartyForm() {
  return {
    id: byId("lpId")?.value || "",
    name: byId("lpName")?.value || "",
    note: byId("lpNote")?.value || "",
  };
}

function readLoanEntryForm() {
  return {
    id: byId("leId")?.value || "",
    type: byId("leType")?.value || "loan_lend",
    loanPartyId: byId("leLoanPartyId")?.value || "",
    accountId: byId("leAccountId")?.value || "",
    amount: byId("leAmount")?.value || "",
    occurredAt: byId("leOccurredAt")?.value || "",
    note: byId("leNote")?.value || "",
  };
}

export function bindLoanEvents(handlers = {}) {
  document.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-loan-action]");
    if (!actionEl) return;

    const action = actionEl.getAttribute("data-loan-action") || "";
    const partyId = actionEl.getAttribute("data-party-id") || "";
    const entryId = actionEl.getAttribute("data-entry-id") || "";

    if (action === "open-party-create") handlers.onOpenPartyCreate?.();
    if (action === "edit-party") handlers.onEditParty?.(partyId);
    if (action === "delete-party") handlers.onDeleteParty?.(partyId);
    if (action === "select-party") handlers.onSelectParty?.(partyId);
    if (action === "open-lend") handlers.onOpenLoanEntry?.("loan_lend", { partyId });
    if (action === "open-repay") handlers.onOpenLoanEntry?.("loan_repay", { partyId });
    if (action === "edit-entry") handlers.onEditLoanEntry?.(entryId);
    if (action === "delete-entry") handlers.onDeleteLoanEntry?.(entryId);
  });

  byId("btnSaveLoanParty")?.addEventListener("click", () => {
    handlers.onSubmitLoanParty?.(readLoanPartyForm());
  });

  byId("btnSaveLoanEntry")?.addEventListener("click", () => {
    handlers.onSubmitLoanEntry?.(readLoanEntryForm());
  });

  ["leType", "leLoanPartyId", "leAccountId", "leAmount", "leOccurredAt", "leNote"].forEach((id) => {
    byId(id)?.addEventListener("input", () => {
      handlers.onChangeLoanEntryDraft?.(readLoanEntryForm());
    });
    byId(id)?.addEventListener("change", () => {
      handlers.onChangeLoanEntryDraft?.(readLoanEntryForm());
    });
  });
}

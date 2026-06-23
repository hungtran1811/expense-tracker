function shouldIgnoreShortcut(event) {
  const target = event.target;
  const tag = String(target?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target?.isContentEditable) return true;
  if (target?.closest?.(".modal.show")) return true;
  return false;
}

function isQuickActionRoute() {
  const route = String(document.body?.dataset?.route || "").trim();
  return route === "home" || route === "expenses";
}

function isLoanActionRoute() {
  return String(document.body?.dataset?.route || "").trim() === "loans";
}

export function bindKeyboardShortcuts(handlers = {}) {
  document.addEventListener("keydown", (event) => {
    if (shouldIgnoreShortcut(event)) return;

    const key = String(event.key || "").toLowerCase();
    const route = String(document.body?.dataset?.route || "").trim();

    if (key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (route !== "expenses") return;
      event.preventDefault();
      handlers.onFocusSearch?.();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (isLoanActionRoute()) {
      if (key === "m") {
        event.preventDefault();
        handlers.onOpenLoanLend?.();
        return;
      }
      if (key === "n") {
        event.preventDefault();
        handlers.onOpenLoanRepay?.();
        return;
      }
      return;
    }

    if (!isQuickActionRoute()) return;

    if (key === "c") {
      event.preventDefault();
      handlers.onOpenExpense?.();
      return;
    }

    if (key === "i") {
      event.preventDefault();
      handlers.onOpenIncome?.();
      return;
    }

    if (key === "t") {
      event.preventDefault();
      handlers.onOpenTransfer?.();
    }
  });
}

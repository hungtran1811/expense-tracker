import { useEffect } from "react";

type Handlers = {
  onExpense?: () => void;
  onIncome?: () => void;
  onTransfer?: () => void;
  onSearch?: () => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useAppShortcuts(handlers: Handlers) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        handlers.onExpense?.();
      } else if (key === "i") {
        event.preventDefault();
        handlers.onIncome?.();
      } else if (key === "t") {
        event.preventDefault();
        handlers.onTransfer?.();
      } else if (key === "/") {
        event.preventDefault();
        handlers.onSearch?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}

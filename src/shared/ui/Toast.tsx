import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastItem = { id: number; message: string; tone: "info" | "success" | "error" };

type ToastContextValue = {
  showToast: (message: string, tone?: ToastItem["tone"]) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.tone}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

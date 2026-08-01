import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "./Modal";

export type ConfirmOptions = {
  title: string;
  message?: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
};

export type AlertOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
};

type DialogState =
  | {
      mode: "confirm";
      options: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      mode: "alert";
      options: AlertOptions;
      resolve: (value: void) => void;
    }
  | null;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type Handler = ConfirmContextValue;

let externalHandler: Handler | null = null;

export function registerConfirmHandler(handler: Handler | null) {
  externalHandler = handler;
}

/** Dùng ngoài React (vd. auth.ts). Cần ConfirmProvider đã mount. */
export async function appConfirm(options: ConfirmOptions): Promise<boolean> {
  if (!externalHandler) {
    console.warn("ConfirmProvider chưa sẵn sàng.");
    return false;
  }
  return externalHandler.confirm(options);
}

export async function appAlert(options: AlertOptions): Promise<void> {
  if (!externalHandler) {
    console.warn("ConfirmProvider chưa sẵn sàng.");
    return;
  }
  return externalHandler.alert(options);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  const openRef = useRef(false);

  const closeWith = useCallback((value: boolean | void) => {
    setDialog((current) => {
      if (!current) return null;
      if (current.mode === "confirm") current.resolve(Boolean(value));
      else current.resolve();
      return null;
    });
    setBusy(false);
    openRef.current = false;
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      openRef.current = true;
      setDialog({ mode: "confirm", options, resolve });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      openRef.current = true;
      setDialog({ mode: "alert", options, resolve });
    });
  }, []);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  useEffect(() => {
    registerConfirmHandler(value);
    return () => registerConfirmHandler(null);
  }, [value]);

  const title = dialog?.options.title || "";
  const message = dialog?.options.message;
  const details = dialog?.mode === "confirm" ? dialog.options.details : undefined;
  const confirmLabel =
    dialog?.mode === "confirm"
      ? dialog.options.confirmLabel || "Xác nhận"
      : dialog?.options.confirmLabel || "Đã hiểu";
  const cancelLabel = dialog?.mode === "confirm" ? dialog.options.cancelLabel || "Hủy" : "Đóng";
  const tone = dialog?.mode === "confirm" ? dialog.options.tone || "danger" : "primary";

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={!!dialog}
        title={title}
        onClose={() => {
          if (!busy) closeWith(dialog?.mode === "confirm" ? false : undefined);
        }}
        footer={
          dialog?.mode === "confirm" ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => closeWith(false)}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  closeWith(true);
                }}
              >
                {confirmLabel}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => closeWith()}
            >
              {confirmLabel}
            </button>
          )
        }
      >
        <div className="stack">
          {message ? <p className="modal-copy">{message}</p> : null}
          {details?.length ? (
            <ul className="confirm-list">
              {details.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "./AuthProvider";
import { AUTH_LOCK } from "../shared/constants/keys";
import { getCurrentYm } from "../shared/lib/date";
import {
  DEFAULT_OWNER_LABELS,
  normalizeOwnerLabels,
  type OwnerLabels,
} from "../shared/lib/moneyOwner";
import { OwnerLabelsContext } from "../shared/hooks/useOwnerLabels";
import {
  getUserMoneyOwnerLabels,
  saveUserMoneyOwnerLabels,
} from "../services/firebase/firestore";

type WorkspaceContextValue = ReturnType<typeof useWorkspace> & {
  setMonth: (month: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** Single-tenant: mọi tài khoản được phép đều đọc/ghi sổ của UID chính. */
function resolveWorkspaceUid(authUid?: string | null) {
  if (!authUid) return undefined;
  return AUTH_LOCK.allowedUid || authUid;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentYm());
  const workspaceUid = resolveWorkspaceUid(user?.uid);
  const workspace = useWorkspace(workspaceUid, month);
  const [labels, setLabels] = useState<OwnerLabels>(DEFAULT_OWNER_LABELS);
  const [savingLabels, setSavingLabels] = useState(false);

  useEffect(() => {
    if (!workspaceUid) {
      setLabels(DEFAULT_OWNER_LABELS);
      return;
    }
    let cancelled = false;
    void getUserMoneyOwnerLabels(workspaceUid)
      .then((raw) => {
        if (!cancelled) setLabels(normalizeOwnerLabels(raw));
      })
      .catch(() => {
        if (!cancelled) setLabels(DEFAULT_OWNER_LABELS);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceUid]);

  const saveLabels = useCallback(
    async (next: Pick<OwnerLabels, "personal" | "mother">) => {
      if (!workspaceUid) return;
      const normalized = normalizeOwnerLabels(next);
      setSavingLabels(true);
      try {
        await saveUserMoneyOwnerLabels(workspaceUid, normalized);
        setLabels(normalized);
      } finally {
        setSavingLabels(false);
      }
    },
    [workspaceUid]
  );

  const value = useMemo(() => ({ ...workspace, setMonth }), [workspace, setMonth]);
  const ownerLabelsValue = useMemo(
    () => ({ labels, saveLabels, saving: savingLabels }),
    [labels, saveLabels, savingLabels]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      <OwnerLabelsContext.Provider value={ownerLabelsValue}>{children}</OwnerLabelsContext.Provider>
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  return ctx;
}

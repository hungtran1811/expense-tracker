import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "./AuthProvider";
import { AUTH_LOCK } from "../shared/constants/keys";
import { getCurrentYm } from "../shared/lib/date";

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

  const value = useMemo(() => ({ ...workspace, setMonth }), [workspace, setMonth]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  return ctx;
}

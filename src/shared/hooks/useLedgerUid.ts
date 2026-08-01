import { useAuth } from "../../app/AuthProvider";
import { AUTH_LOCK } from "../constants/keys";

/** UID Firestore của sổ chính (single-tenant), không phải UID đăng nhập shell. */
export function useLedgerUid() {
  const { user } = useAuth();
  if (!user) return undefined;
  return AUTH_LOCK.allowedUid || user.uid;
}

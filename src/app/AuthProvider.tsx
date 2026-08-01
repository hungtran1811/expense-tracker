import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  completeRedirectSignIn,
  signIn,
  signInWithEmail,
  signOutNow,
  watchAuth,
} from "../services/firebase/auth";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: typeof signIn;
  signInWithEmail: typeof signInWithEmail;
  signOut: typeof signOutNow;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void completeRedirectSignIn().catch(() => {
      /* ignore — user may not be mid-redirect */
    });
    const unsub = watchAuth((next) => {
      setUser(next);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signInWithEmail,
      signOut: signOutNow,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

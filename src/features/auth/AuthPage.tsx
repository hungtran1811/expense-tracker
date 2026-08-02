import { useState, type FormEvent } from "react";
import { useAuth } from "../../app/AuthProvider";

export function AuthPage() {
  const { signIn, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Email hoặc mật khẩu không đúng.");
      } else if (code === "auth/too-many-requests") {
        setError("Thử quá nhiều lần. Đợi một lát rồi thử lại.");
      } else {
        setError(err instanceof Error ? err.message : "Không thể đăng nhập.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      await signIn();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/unauthorized-domain") {
        setError("Google chưa được phép trên domain này. Hãy đăng nhập bằng email/mật khẩu.");
      } else {
        setError(err instanceof Error ? err.message : "Không thể đăng nhập Google.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img
          className="brand-logo brand-logo-lg"
          src="/img/brand-mark.svg"
          alt="Hung Tran Finance"
          width={64}
          height={64}
        />
        <h1>Hung Tran Finance</h1>
        <p>Hai dòng tiền rõ ràng: ví của bạn và ví của mẹ (ví dụ VP Bank), mỗi bên một bảng báo cáo riêng.</p>
        {error ? <div className="error-box">{error}</div> : null}

        <form className="auth-form" onSubmit={handleEmailSignIn}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="you@example.com"
            />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="••••••••"
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <div className="auth-divider">
          <span>hoặc</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => void handleGoogleSignIn()}
          disabled={loading}
        >
          Đăng nhập với Google
        </button>
      </div>
    </div>
  );
}

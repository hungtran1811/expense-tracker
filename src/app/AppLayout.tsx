import { useCallback, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useAppShortcuts } from "../shared/hooks/useAppShortcuts";
import { GlobalSearch } from "../shared/ui/GlobalSearch";

const links = [
  { to: "/", label: "Tổng quan", short: "Tổng", end: true },
  { to: "/expenses", label: "Chi tiêu", short: "Chi" },
  { to: "/reports", label: "Báo cáo", short: "BC" },
  { to: "/loans", label: "Cho mượn", short: "Mượn" },
  { to: "/manage", label: "Quản lý", short: "QL" },
];

export function AppLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const shortName = user?.email?.split("@")[0] || "Tài khoản";
  const [searchOpen, setSearchOpen] = useState(false);

  const openCompose = useCallback(
    (type: "expense" | "income" | "transfer") => {
      navigate("/", { state: { compose: type } });
    },
    [navigate]
  );

  const shortcutHandlers = useMemo(
    () => ({
      onExpense: () => openCompose("expense"),
      onIncome: () => openCompose("income"),
      onTransfer: () => openCompose("transfer"),
      onSearch: () => setSearchOpen(true),
    }),
    [openCompose]
  );

  useAppShortcuts(shortcutHandlers);

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="Hung Tran Finance">
          <img className="brand-logo" src="/img/brand-mark.svg" alt="" width={38} height={38} />
          <span className="brand-text">Hung Tran Finance</span>
        </NavLink>

        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <NavLink to="/downloads" className="btn btn-secondary btn-sm" title="Tải ứng dụng">
            Tải app
          </NavLink>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSearchOpen(true)}
            title="Tìm giao dịch (/)"
          >
            Tìm
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void signOut()}
            title={shortName}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="mobile-nav" aria-label="Điều hướng nhanh">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            <span>{link.short}</span>
          </NavLink>
        ))}
      </nav>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

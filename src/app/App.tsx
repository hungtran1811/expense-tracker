import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { AppLayout } from "./AppLayout";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { AuthPage } from "../features/auth/AuthPage";
import { DownloadsPage } from "../features/downloads/DownloadsPage";
import { HomePage } from "../features/home/HomePage";
import { ExpensesPage } from "../features/expenses/ExpensesPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { LoansPage } from "../features/loans/LoansPage";
import { ManagePage } from "../features/manage/ManagePage";

function ProtectedApp() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="loans" element={<LoansPage />} />
          <Route path="manage" element={<ManagePage />} />
          <Route path="downloads" element={<DownloadsPage signedIn />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}

function isDownloadsPath(pathname: string) {
  return pathname === "/downloads" || pathname.endsWith("/downloads");
}

export function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const onDownloads = isDownloadsPath(location.pathname);

  if (loading && !onDownloads) {
    return (
      <div className="auth-page">
        <div className="page-state-card">
          <div className="page-state-spinner" aria-hidden="true" />
          <p className="page-state-title">Đang khởi tạo ứng dụng...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (onDownloads) return <DownloadsPage />;
    return <AuthPage />;
  }

  return <ProtectedApp />;
}

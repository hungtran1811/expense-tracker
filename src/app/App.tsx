import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { AppLayout } from "./AppLayout";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { AuthPage } from "../features/auth/AuthPage";
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
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
    return <AuthPage />;
  }

  return <ProtectedApp />;
}

type Props = {
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
};

export function PageState({ loading, error, loadingText = "Đang tải..." }: Props) {
  if (loading) {
    return (
      <div className="page-state" role="status">
        <div className="page-state-card">
          <div className="page-state-spinner" aria-hidden="true" />
          <p className="page-state-title">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-state" role="alert">
        <div className="page-state-card is-error">
          <p className="page-state-title">Không tải được dữ liệu</p>
          <p className="page-state-body">{error}</p>
        </div>
      </div>
    );
  }

  return null;
}

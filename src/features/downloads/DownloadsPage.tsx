import { Link } from "react-router-dom";
import { APP_DOWNLOAD_VERSION, APP_DOWNLOADS } from "../../shared/constants/downloads";
import { PageHeader } from "../../shared/ui/PageHeader";

type Props = {
  signedIn?: boolean;
};

export function DownloadsPage({ signedIn = false }: Props) {
  return (
    <div className={signedIn ? undefined : "auth-page downloads-page"}>
      <div className={signedIn ? "stack-lg" : "downloads-shell"}>
        <PageHeader
          kicker={`Phiên bản ${APP_DOWNLOAD_VERSION}`}
          title="Tải ứng dụng"
          subtitle="Tải bản Windows, Android APK hoặc gói web tĩnh. Dùng phiên bản mới nhất (2.0.1+)."
          actions={
            signedIn ? (
              <Link to="/" className="btn btn-secondary btn-sm">
                Về tổng quan
              </Link>
            ) : (
              <Link to="/" className="btn btn-secondary btn-sm">
                Đăng nhập
              </Link>
            )
          }
        />

        <ul className="download-list">
          {APP_DOWNLOADS.map((item) => (
            <li key={item.id} className="download-item">
              <div className="download-meta">
                <strong>{item.title}</strong>
                <span>
                  {item.description} · {item.sizeLabel}
                </span>
              </div>
              {item.available ? (
                <a className="btn btn-primary btn-sm" href={item.href} download>
                  Tải về
                </a>
              ) : (
                <span className="btn btn-secondary btn-sm" aria-disabled="true">
                  Chưa sẵn sàng
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

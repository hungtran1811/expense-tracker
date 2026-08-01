import type { ReactNode } from "react";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ kicker, title, subtitle, actions }: Props) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        {kicker ? <div className="page-kicker">{kicker}</div> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

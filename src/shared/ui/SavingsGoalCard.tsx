import { formatCurrency } from "../lib/money";
import {
  normalizeSavingsGoalIconKey,
  SAVINGS_GOAL_ICON_LABELS,
  type SavingsGoalIconKey,
} from "../constants/savingsGoals";
import type { SavingsGoal } from "../types/finance";

type Props = {
  goal: SavingsGoal;
  onContribute?: () => void;
  compact?: boolean;
};

function GoalIcon({ iconKey }: { iconKey: SavingsGoalIconKey }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (iconKey) {
    case "house":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case "car":
      return (
        <svg {...common}>
          <path d="M3 13h18l-1.5-5.5A2 2 0 0 0 17.6 6H6.4a2 2 0 0 0-1.9 1.5L3 13Z" />
          <path d="M5 13v4h2.5M19 13v4h-2.5M7.5 17a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM19.5 17a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
      );
    case "travel":
      return (
        <svg {...common}>
          <path d="M10 20 3.5 13.5 14 3l7 7-10.5 10Z" />
          <path d="M14 3 17.5 6.5" />
          <path d="M3.5 13.5 7 17" />
        </svg>
      );
    case "education":
      return (
        <svg {...common}>
          <path d="M3 9.5 12 4l9 5.5-9 5.5L3 9.5Z" />
          <path d="M7 12v4.5c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5V12" />
          <path d="M21 10v6" />
        </svg>
      );
    case "wedding":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.2-7-10a3.5 3.5 0 0 1 6.2-2.2A3.5 3.5 0 0 1 19 10c0 5.8-7 10-7 10Z" />
        </svg>
      );
    case "emergency":
      return (
        <svg {...common}>
          <path d="M12 3 3.5 19h17L12 3Z" />
          <path d="M12 9v5" />
          <path d="M12 16.5h.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
  }
}

export function SavingsGoalCard({ goal, onContribute, compact }: Props) {
  const iconKey = normalizeSavingsGoalIconKey(goal.iconKey);
  const target = Math.max(0, Number(goal.targetAmount || 0));
  const current = Math.max(0, Number(goal.currentAmount || 0));
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const remainingPct = Math.max(0, Math.round(100 - pct));
  const remainingAmount = Math.max(0, target - current);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <article className={`savings-goal-card${compact ? " is-compact" : ""}`} data-icon={iconKey}>
      <div className="savings-goal-card-top">
        <div className="savings-goal-icon" aria-label={SAVINGS_GOAL_ICON_LABELS[iconKey]}>
          <GoalIcon iconKey={iconKey} />
        </div>
        <div className="savings-goal-ring" aria-hidden>
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle className="savings-goal-ring-track" cx="42" cy="42" r={radius} />
            <circle
              className="savings-goal-ring-fill"
              cx="42"
              cy="42"
              r={radius}
              style={{
                strokeDasharray: `${circumference}`,
                strokeDashoffset: `${offset}`,
              }}
            />
          </svg>
          <div className="savings-goal-ring-label">
            <strong>{Math.round(pct)}%</strong>
            <span>đã đạt</span>
          </div>
        </div>
      </div>

      <div className="savings-goal-body">
        <h3 className="savings-goal-name">{goal.name}</h3>
        <p className="savings-goal-amounts">
          <span className="u-money">{formatCurrency(current)}</span>
          <span className="savings-goal-sep">/</span>
          <span className="u-money">{formatCurrency(target)}</span>
        </p>
        <p className="savings-goal-remain">
          {remainingPct > 0 ? (
            <>
              Còn <strong>{remainingPct}%</strong> nữa · {formatCurrency(remainingAmount)}
            </>
          ) : (
            <strong className="savings-goal-done">Đã đạt mục tiêu</strong>
          )}
        </p>
      </div>

      {onContribute ? (
        <button type="button" className="btn btn-secondary btn-sm savings-goal-contribute" onClick={onContribute}>
          Góp nhanh
        </button>
      ) : null}
    </article>
  );
}

import { MONEY_OWNER_OPTIONS, type MoneyOwner } from "../lib/moneyOwner";

type Props = {
  value: MoneyOwner | "personal" | "mother";
  onChange: (value: "personal" | "mother") => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
};

export function MoneyOwnerSelector({
  value,
  onChange,
  disabled,
  label = "Nguồn tiền",
  hint,
}: Props) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {MONEY_OWNER_OPTIONS.map((option) => {
          const active = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={disabled}
              className={`segmented-btn${active ? ` active-${option.key}` : ""}`}
              onClick={() => onChange(option.key)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

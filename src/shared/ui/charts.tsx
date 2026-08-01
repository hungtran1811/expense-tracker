export type ChartSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
  valueText?: string;
};

type DonutChartProps = {
  segments: ChartSegment[];
  centerLabel?: string;
  centerValue?: string;
  emptyLabel?: string;
  size?: number;
};

export function DonutChart({
  segments,
  centerLabel = "Tổng",
  centerValue,
  emptyLabel = "Chưa có dữ liệu",
  size = 168,
}: DonutChartProps) {
  const positive = segments.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return <p className="chart-empty">{emptyLabel}</p>;
  }

  let cursor = 0;
  const gradient = positive
    .map((item) => {
      const start = cursor;
      const share = (item.value / total) * 100;
      cursor += share;
      return `${item.color} ${start}% ${cursor}%`;
    })
    .join(", ");

  return (
    <div className="donut-layout">
      <div
        className="donut-shell"
        style={{ width: size, height: size, background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label={centerLabel}
      >
        <div className="donut-center">
          <span className="donut-center-label">{centerLabel}</span>
          {centerValue ? <strong className="donut-center-value">{centerValue}</strong> : null}
        </div>
      </div>
      <ul className="donut-legend">
        {positive.map((item) => {
          const pct = (item.value / total) * 100;
          return (
            <li key={item.key} className="donut-legend-item">
              <span className="donut-swatch" style={{ background: item.color }} aria-hidden="true" />
              <span className="donut-legend-label u-ellipsis">{item.label}</span>
              <span className="donut-legend-meta">
                {item.valueText || `${pct.toFixed(0)}%`}
                <span className="donut-legend-pct">{pct.toFixed(0)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type ColumnPoint = {
  key: string;
  label: string;
  personal?: number;
  mother?: number;
  income?: number;
  expense?: number;
};

type ColumnChartProps = {
  points: ColumnPoint[];
  mode?: "owner-expense" | "income-expense";
  emptyLabel?: string;
};

export function ColumnChart({
  points,
  mode = "owner-expense",
  emptyLabel = "Chưa có dữ liệu",
}: ColumnChartProps) {
  const max = Math.max(
    1,
    ...points.map((point) => {
      if (mode === "income-expense") {
        return Math.max(point.income || 0, point.expense || 0);
      }
      return (point.personal || 0) + (point.mother || 0);
    })
  );

  if (!points.length) {
    return <p className="chart-empty">{emptyLabel}</p>;
  }

  return (
    <div className="column-chart" role="img" aria-label="Biểu đồ cột">
      <div className="column-chart-plot">
        {points.map((point) => {
          if (mode === "income-expense") {
            const incomeH = ((point.income || 0) / max) * 100;
            const expenseH = ((point.expense || 0) / max) * 100;
            return (
              <div key={point.key} className="column-group" title={point.label}>
                <div className="column-pair">
                  <div className="column-bar income" style={{ height: `${incomeH}%` }} />
                  <div className="column-bar expense" style={{ height: `${expenseH}%` }} />
                </div>
                <span className="column-label">{point.label}</span>
              </div>
            );
          }

          const personal = point.personal || 0;
          const mother = point.mother || 0;
          const total = personal + mother;
          const stackH = (total / max) * 100;
          return (
            <div key={point.key} className="column-group" title={point.label}>
              <div className="column-stack-wrap">
                {total > 0 ? (
                  <div className="column-stack" style={{ height: `${stackH}%` }}>
                    {mother > 0 ? (
                      <div className="column-bar mother" style={{ flex: mother }} />
                    ) : null}
                    {personal > 0 ? (
                      <div className="column-bar personal" style={{ flex: personal }} />
                    ) : null}
                  </div>
                ) : (
                  <div className="column-bar empty" />
                )}
              </div>
              <span className="column-label">{point.label}</span>
            </div>
          );
        })}
      </div>
      <div className="column-legend">
        {mode === "income-expense" ? (
          <>
            <span>
              <i className="column-swatch income" aria-hidden="true" /> Thu
            </span>
            <span>
              <i className="column-swatch expense" aria-hidden="true" /> Chi
            </span>
          </>
        ) : (
          <>
            <span>
              <i className="column-swatch personal" aria-hidden="true" /> Tôi
            </span>
            <span>
              <i className="column-swatch mother" aria-hidden="true" /> Mẹ
            </span>
          </>
        )}
      </div>
    </div>
  );
}

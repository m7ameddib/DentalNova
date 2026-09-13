import { formatMoney } from '@/utils/money';

interface ChartBar {
  label: string;
  valueCents: number;
}

export function SimpleMoneyChart({ title, bars }: { title: string; bars: ChartBar[] }) {
  const max = Math.max(...bars.map((b) => Math.abs(b.valueCents)), 1);

  return (
    <div className="simple-money-chart">
      <h3 className="simple-money-chart__title">{title}</h3>
      <ul className="simple-money-chart__bars">
        {bars.map((bar) => (
          <li key={bar.label}>
            <span className="simple-money-chart__label">{bar.label}</span>
            <span className="simple-money-chart__track">
              <span
                className="simple-money-chart__fill"
                style={{ width: `${Math.max(4, (Math.abs(bar.valueCents) / max) * 100)}%` }}
              />
            </span>
            <span className="simple-money-chart__value">{formatMoney(bar.valueCents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface PricePoint {
  day: string;
  value: number;
}

const PAD = 8;
const VIEW_W = 300;
const VIEW_H = 160;

export default function PriceChart({ points }: { points: PricePoint[] }) {
  if (points.length === 0) {
    return <div className="empty">No price history recorded yet</div>;
  }

  if (points.length === 1) {
    return (
      <div className="empty">
        <div className="stat-value">${points[0].value.toFixed(2)}</div>
        One data point so far — the chart fills in as prices refresh daily
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero, so give it a nominal band to sit mid-chart.
  const span = max - min || Math.max(1, max * 0.1);
  const innerH = VIEW_H - PAD * 2;

  const x = (i: number) => PAD + (i / (points.length - 1)) * (VIEW_W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / span) * innerH;

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const area =
    `M ${x(0)},${y(points[0].value)} ` +
    points.map((p, i) => `L ${x(i)},${y(p.value)}`).join(' ') +
    ` L ${x(points.length - 1)},${VIEW_H - PAD} L ${x(0)},${VIEW_H - PAD} Z`;

  const first = points[0].value;
  const last = points[points.length - 1].value;
  const delta = last - first;
  const pct = first !== 0 ? (delta / first) * 100 : 0;
  const color = delta >= 0 ? 'var(--success)' : 'var(--danger)';

  return (
    <div>
      <div className="progress-top">
        <span className="count">${last.toFixed(2)}</span>
        <span className="pct mono" style={{ color }}>
          {delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(2)} ({pct >= 0 ? '+' : ''}
          {pct.toFixed(1)}%)
        </span>
      </div>
      <svg
        width="100%"
        height={VIEW_H}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Collection value, ${points[0].day} to ${points[points.length - 1].day}`}
      >
        <defs>
          <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pc-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={x(points.length - 1)} cy={y(last)} r="3.5" fill={color} />
      </svg>
      <div className="progress-top">
        <span className="row-meta">{points[0].day}</span>
        <span className="row-meta">{points[points.length - 1].day}</span>
      </div>
    </div>
  );
}

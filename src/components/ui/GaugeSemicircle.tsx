import { useId } from 'react';

type Props = {
  value: number | null;
  label?: string;
  size?: number;
  strokeWidth?: number;
  formatValue?: (v: number | null) => string;
  caption?: string;
};

/**
 * Semicircle gauge (0-100%). The visual fill is clamped to 100%, but the numeric
 * label shows the real percentage even when it exceeds the meta.
 * Uses the single FMP red; track is a faint sand tone.
 */
export function GaugeSemicircle({
  value,
  label,
  size = 200,
  strokeWidth = 18,
  formatValue,
  caption,
}: Props) {
  const uid = useId();
  const gradientId = `gauge-grad-${uid}`;
  const width = size;
  const height = size / 2 + strokeWidth;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - strokeWidth;

  const trackPath = describeArc(cx, cy, r, -90, 90);

  const clamped =
    value === null || !Number.isFinite(value)
      ? null
      : Math.max(0, Math.min(1, value));

  const fillEndAngle = clamped === null ? -90 : -90 + clamped * 180;
  const fillPath =
    clamped === null || clamped <= 0
      ? null
      : describeArc(cx, cy, r, -90, fillEndAngle);

  const display =
    formatValue?.(value) ??
    (value === null || !Number.isFinite(value)
      ? '—'
      : `${(value * 100).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}%`);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label ?? 'Indicador'}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EE2A42" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#EE2A42" />
          </linearGradient>
        </defs>
        <path
          d={trackPath}
          fill="none"
          stroke="#DEDCD4"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="-mt-6 text-center">
        <p
          className="text-2xl tabular-nums text-ink"
          style={{
            fontFamily: '"Noto Serif", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 600,
          }}
        >
          {display}
        </p>
        {label && (
          <p className="mt-0.5 text-2xs font-semibold uppercase tracking-widest text-ink-3">
            {label}
          </p>
        )}
        {caption && <p className="mt-0.5 text-xs text-ink-3">{caption}</p>}
      </div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  const sweep = 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

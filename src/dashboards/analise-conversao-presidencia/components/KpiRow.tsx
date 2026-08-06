import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'accent' | 'success' | 'warning';
};

const TONE: Record<NonNullable<Props['tone']>, { chip: string; text: string }> = {
  neutral: { chip: 'bg-paper text-ink-3', text: 'text-ink' },
  accent: { chip: 'bg-fmp-muted text-fmp', text: 'text-ink' },
  success: { chip: 'bg-success-light text-success-dark', text: 'text-ink' },
  warning: { chip: 'bg-warning-light text-warning-dark', text: 'text-ink' },
};

export function KpiRow({ label, value, hint, icon: Icon, tone = 'neutral' }: Props) {
  const t = TONE[tone];
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-sm ${t.chip}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3 line-clamp-1">
            {label}
          </p>
          {hint && <p className="text-2xs text-ink-3 line-clamp-1">{hint}</p>}
        </div>
      </div>
      <span
        className="text-base tabular-nums text-ink"
        style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
      >
        {value}
      </span>
    </div>
  );
}

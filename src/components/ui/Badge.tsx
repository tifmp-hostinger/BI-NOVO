import type { ReactNode } from 'react';

type Variant = 'fmp' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STYLES: Record<Variant, string> = {
  fmp: 'bg-fmp-muted text-fmp ring-fmp/20',
  success: 'bg-success-light text-success-dark ring-success/20',
  warning: 'bg-warning-light text-warning-dark ring-warning/20',
  danger: 'bg-danger-light text-danger-dark ring-danger/20',
  info: 'bg-info-light text-info-dark ring-info/20',
  neutral: 'bg-paper text-ink-2 ring-line-2/50',
};

type Props = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

export function Badge({ variant = 'neutral', children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ring-1 ring-inset ${STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

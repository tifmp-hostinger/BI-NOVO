import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function BlockCard({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  footer,
  className = '',
}: Props) {
  return (
    <section
      className={`relative overflow-hidden rounded-md border border-line bg-white shadow-card animate-fade-in ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-fmp" />
      <header className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="rounded-sm bg-fmp-muted p-2.5 text-fmp">
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </div>
          )}
          <div className="min-w-0">
            <h3
              className="text-sm text-ink"
              style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </header>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <footer className="border-t border-line px-5 py-3 text-2xs font-semibold text-fmp">
          {footer}
        </footer>
      )}
    </section>
  );
}

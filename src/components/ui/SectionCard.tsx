import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Permite abrir o card em tela cheia (padrão: true). */
  expandable?: boolean;
};

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
  contentClassName = '',
  expandable = true,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const header = (
    <div className="flex items-start gap-3 min-w-0">
      {Icon && (
        <div className="rounded-sm bg-fmp-muted p-2 text-fmp">
          <Icon className="h-4 w-4" strokeWidth={2.4} />
        </div>
      )}
      <div className="min-w-0">
        <h3
          className="truncate text-sm font-semibold text-ink"
          style={{
            fontFamily: '"Noto Serif", serif',
            fontStyle: 'italic',
            fontWeight: 600,
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-ink-3 line-clamp-1">{subtitle}</p>
        )}
      </div>
    </div>
  );

  return (
    <section
      className={`rounded-md border border-line bg-white shadow-card animate-fade-in ${className}`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        {header}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {actions}
          {expandable && (
            <button
              type="button"
              aria-label={`Ampliar: ${title}`}
              title="Ampliar"
              onClick={() => setExpanded(true)}
              className="rounded-sm p-1.5 text-ink-3 transition hover:bg-paper hover:text-ink"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>
      <div className={`p-5 ${contentClassName}`}>{children}</div>

      {expanded &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-3 sm:p-8"
            onClick={() => setExpanded(false)}
          >
            <div
              className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                {header}
                <button
                  type="button"
                  aria-label="Fechar visualização ampliada"
                  title="Fechar (Esc)"
                  onClick={() => setExpanded(false)}
                  className="flex-shrink-0 rounded-sm p-1.5 text-ink-3 transition hover:bg-paper hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
              {/* !h-[65vh] força os ResponsiveContainer (altura inline fixa) a
                  crescerem dentro do modal. */}
              <div className="overflow-auto p-5 [&_.recharts-responsive-container]:!h-[65vh]">
                {children}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}

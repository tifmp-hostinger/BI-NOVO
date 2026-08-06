import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, HelpCircle, Minus } from 'lucide-react';

/**
 * Grade padrão para linhas de StatCard, em TODOS os dashboards.
 *
 * Usa container queries (`@sm:`/`@2xl:`/`@4xl:`), não media queries de
 * viewport (`sm:`/`lg:`/`xl:`): a contagem de colunas reage à largura REAL
 * do espaço disponível para a grade, não à largura da janela. Isso resolve
 * dois problemas que breakpoint por viewport nunca resolve:
 *   1. Colapsar o menu lateral muda a largura do container sem mudar a
 *      viewport — com media query a grade não reagia; com container query,
 *      sim.
 *   2. Uma tela com painel lateral fixo (filtros, funil) tem MENOS espaço
 *      para a grade do que a viewport sugere — media query não sabe disso;
 *      container query mede o espaço real.
 *
 * Nunca mais que 4 colunas, mesmo com 7-8 cards na linha (ModalidadePosTab,
 * GraduacaoTab): cards extras quebram para a linha de baixo em vez de
 * espremer a coluna até ficar ilegível.
 *
 * CSS não permite um elemento ser container E responder à própria query —
 * por isso são DUAS classes para DOIS elementos: `STAT_GRID_CONTAINER`
 * no wrapper (ex. o `<section>`) e `STAT_GRID_CLASSES` na grade em si
 * (um `<div>` filho direto, com os StatCards dentro).
 */
export const STAT_GRID_CONTAINER = '@container';
export const STAT_GRID_CLASSES =
  'grid grid-cols-1 gap-4 @sm:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4';

type Trend = { value: number; direction: 'up' | 'down' | 'flat' };
type ColorKey = 'fmp' | 'success' | 'warning' | 'danger' | 'info' | 'gray';

type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: Trend;
  color?: ColorKey;
  highlight?: boolean;
  index?: number;
  /** Explicação da métrica: vira um "?" discreto ao lado do rótulo. */
  hint?: string;
  /** Valor por extenso no hover, quando `value` está abreviado (ex. "R$ 872 mil"). */
  exactValue?: string;
};

const COLOR_STYLES: Record<
  ColorKey,
  { icon: string; bg: string; bar: string; text: string }
> = {
  fmp: { icon: 'text-fmp', bg: 'bg-fmp-muted', bar: 'bg-fmp', text: 'text-fmp' },
  success: { icon: 'text-success', bg: 'bg-success-light', bar: 'bg-success', text: 'text-success-dark' },
  warning: { icon: 'text-warning', bg: 'bg-warning-light', bar: 'bg-warning', text: 'text-warning-dark' },
  danger: { icon: 'text-danger', bg: 'bg-danger-light', bar: 'bg-danger', text: 'text-danger-dark' },
  info: { icon: 'text-info', bg: 'bg-info-light', bar: 'bg-info', text: 'text-info-dark' },
  gray: { icon: 'text-ink-3', bg: 'bg-paper', bar: 'bg-sand', text: 'text-ink-2' },
};

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'fmp',
  highlight = false,
  index = 0,
  hint,
  exactValue,
}: StatCardProps) {
  const styles = COLOR_STYLES[color];
  const TrendIcon =
    trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    trend?.direction === 'up' ? 'text-success' : trend?.direction === 'down' ? 'text-danger' : 'text-ink-3';

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-line bg-white p-5 shadow-card transition-all duration-200 hover:shadow-card-hover animate-slide-up ${
        highlight ? 'ring-1 ring-fmp/30' : ''
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-widest text-ink-3">
            {label}
            {hint && (
              <span
                tabIndex={0}
                role="note"
                aria-label={hint}
                title={hint}
                className="cursor-help rounded-full text-ink-3/70 transition hover:text-fmp focus:text-fmp focus:outline-none"
              >
                <HelpCircle className="h-3 w-3" strokeWidth={2.4} />
              </span>
            )}
          </p>
          <p
            className="mt-2 truncate text-2xl text-ink sm:text-3xl"
            style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600, lineHeight: 1.15 }}
            title={exactValue}
          >
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-ink-3 line-clamp-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`rounded-sm p-2.5 ${styles.bg}`}>
            <Icon className={`h-5 w-5 ${styles.icon}`} strokeWidth={2.2} />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1.5">
          <span className={`flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-2xs font-semibold ${trendColor}`}>
            <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
            {trend.value > 0 ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-2xs text-ink-3">vs. periodo anterior</span>
        </div>
      )}
    </div>
  );
}

export function StatCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="relative animate-slide-up overflow-hidden rounded-md border border-line bg-white p-5 shadow-card"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-paper">
        <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-fmp/50 to-transparent" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="relative h-2 w-20 overflow-hidden rounded bg-paper">
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          </div>
          <div className="relative h-7 w-24 overflow-hidden rounded bg-paper">
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          </div>
        </div>
        <div className="relative h-10 w-10 overflow-hidden rounded-sm bg-paper">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        </div>
      </div>
    </div>
  );
}

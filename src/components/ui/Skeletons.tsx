/**
 * Esqueletos de carregamento com efeito shimmer — a onda de luz atravessando
 * o bloco comunica "carregando" melhor que um cinza que apenas pisca, e evita
 * a leitura de "travou". O keyframe `shimmer` já existia no
 * tailwind.config.js e não estava sendo usado por ninguém.
 */
function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-paper ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

const ALTURAS_BARRAS = [45, 70, 35, 85, 55, 95, 40, 75, 60, 30, 80, 50];

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="w-full rounded-md border border-line bg-white p-4" style={{ height }}>
      <Shimmer className="h-3 w-1/3 rounded" />
      {/* Barras de altura variável: lembra a silhueta de um gráfico, então o
          usuário já entende o que vai aparecer ali. */}
      <div className="mt-4 flex h-[calc(100%-2.5rem)] items-end gap-2">
        {ALTURAS_BARRAS.map((h, i) => (
          <div key={i} className="flex-1" style={{ height: `${h}%` }}>
            <Shimmer className="h-full w-full rounded-t" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex animate-fade-in items-center gap-3 rounded-md border border-line bg-white p-3"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Shimmer className="h-9 w-9 rounded-sm" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-3 w-1/3 rounded" />
            <Shimmer className="h-2.5 w-1/2 rounded" />
          </div>
          <Shimmer className="h-4 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Loader de página inteira: anel pulsante em volta do spinner e, quando
 * informada, a etapa atual da carga — os dashboards baixam centenas de
 * milhares de linhas em lotes, e saber em que etapa está evita a sensação de
 * tela congelada.
 */
export function FullPageLoader({ mensagem }: { mensagem?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-fmp/20" />
          <span className="absolute inset-0 h-14 w-14 animate-spin rounded-full border-2 border-line border-t-fmp" />
          <span className="h-2.5 w-2.5 rounded-full bg-fmp" />
        </div>
        <p className="animate-fade-in text-xs text-ink-3">{mensagem ?? 'Carregando…'}</p>
      </div>
    </div>
  );
}

/**
 * Indicador das etapas de carga, para acompanhar o texto de progresso que os
 * dashboards já emitem ("etapa 2 de 4 …").
 */
export function LoadingSteps({ mensagem }: { mensagem: string }) {
  return (
    <div className="animate-fade-in rounded-md border border-line bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-fmp/25" />
          <span className="h-2 w-2 rounded-full bg-fmp" />
        </div>
        <p className="text-xs text-ink-2">{mensagem}</p>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-paper">
        <div className="h-full w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-fmp/30 via-fmp to-fmp/30" />
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  MapPin,
  Percent,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useDashboards } from '@/hooks/useDashboards';
import { ErrorState } from '@/components/ui/ErrorState';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  MapPin,
  GraduationCap,
  DollarSign,
  UserPlus,
  Activity,
  Users,
  Target,
  Percent,
  TrendingUp,
};

const ACCENT: Record<
  string,
  { chip: string; icon: string; badge: 'fmp' | 'success' }
> = {
  fmp: { chip: 'bg-fmp-muted', icon: 'text-fmp', badge: 'success' },
  emerald: { chip: 'bg-success-light', icon: 'text-success', badge: 'success' },
  amber: { chip: 'bg-warning-light', icon: 'text-warning', badge: 'success' },
  rose: { chip: 'bg-danger-light', icon: 'text-danger', badge: 'success' },
  info: { chip: 'bg-info-light', icon: 'text-info', badge: 'success' },
};

export function HomePage() {
  const { data, loading, error, refetch } = useDashboards();

  return (
    <AppShell title="Central de Dashboards" subtitle="Selecione um painel para comecar">
      <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Hero — dark editorial surface */}
        <section className="relative overflow-hidden rounded-lg hero-gradient p-6 text-cream shadow-card sm:p-10 animate-fade-in">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fmp/20 blur-3xl" />

          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="fmp-eyebrow text-fmp">
                Inteligencia institucional
              </span>
              <h1
                className="mt-4 text-2xl sm:text-3xl lg:text-4xl text-cream"
                style={{
                  fontFamily: '"Noto Serif", Georgia, serif',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  lineHeight: 1.04,
                }}
              >
                Uma central para todos os dashboards da FMP
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-cream/70 sm:text-base">
                Visao consolidada de indicadores academicos, financeiros,
                comerciais e geograficos, alimentada por carga agendada e
                pronta para novos modulos.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/dashboards/presenca-nacional"
                  className="inline-flex items-center gap-2 rounded-pill bg-fmp px-5 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-fmp-dark no-underline"
                >
                  <MapPin className="h-4 w-4" />
                  Abrir Presenca Nacional
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/dashboards/analise-conversao-presidencia"
                  className="inline-flex items-center gap-2 rounded-pill border border-cream/20 px-5 py-2.5 text-xs font-semibold text-cream transition-all hover:border-fmp hover:text-fmp no-underline"
                >
                  <Target className="h-4 w-4" />
                  Analise de Conversao
                </Link>
                <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-cream/50">
                  <BarChart3 className="h-3 w-3" />
                  {data.length} dashboards catalogados
                </span>
              </div>
            </div>

            <div className="hidden shrink-0 flex-col items-end gap-2 md:flex">
              <div className="rounded-lg border border-cream/15 bg-cream/5 p-4 backdrop-blur">
                <p className="text-2xs uppercase tracking-widest text-cream/50">
                  Atualizacao
                </p>
                <p
                  className="mt-1 text-lg text-cream"
                  style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                >
                  Carga agendada
                </p>
                <p className="mt-1 text-2xs text-cream/50">
                  Cada painel mostra ate quando ha dados
                </p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <ErrorState
            title="Nao foi possivel listar os dashboards"
            message={error}
            onRetry={refetch}
          />
        )}

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="fmp-eyebrow">Catalogo</span>
              <h2
                className="mt-1 text-xl text-ink"
                style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
              >
                Dashboards disponiveis
              </h2>
              <p className="mt-0.5 text-xs text-ink-3">
                Clique em um card para acessar os indicadores do painel.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-md border border-line bg-white shadow-card"
                />
              ))}

            {!loading &&
              data.map((d, i) => {
                const Icon = ICONS[d.icon] ?? LayoutDashboard;
                const accent = ACCENT[d.color] ?? ACCENT.fmp;
                const disabled = !d.is_active;

                const CardBody = (
                  <>
                    <div className="relative flex items-start justify-between gap-4">
                      <div className={`rounded-sm p-3 ${accent.chip}`}>
                        <Icon className={`h-5 w-5 ${accent.icon}`} strokeWidth={2.2} />
                      </div>
                      <Badge variant={disabled ? 'neutral' : accent.badge} className="uppercase">
                        {disabled ? 'Em breve' : 'Disponivel'}
                      </Badge>
                    </div>

                    <div className="relative mt-6 space-y-2">
                      <p className="text-2xs font-semibold uppercase tracking-widest text-sand">
                        {d.category}
                      </p>
                      <h3
                        className="text-base text-ink"
                        style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                      >
                        {d.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-ink-3 line-clamp-3">
                        {d.description}
                      </p>
                    </div>

                    <div className="relative mt-6 flex items-center justify-between border-t border-line pt-4">
                      <span className="text-2xs text-ink-3">
                        {disabled ? 'Aguardando ativacao' : 'Acessar dashboard'}
                      </span>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                          disabled
                            ? 'bg-paper text-sand'
                            : 'bg-fmp text-white group-hover:-translate-y-0.5 group-hover:shadow-glow'
                        }`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </div>
                  </>
                );

                const baseClass = `group relative overflow-hidden rounded-md border border-line bg-white p-5 shadow-card transition-all duration-200 animate-slide-up`;

                if (disabled) {
                  return (
                    <div
                      key={d.id}
                      style={{ animationDelay: `${i * 60}ms` }}
                      className={`${baseClass} cursor-not-allowed opacity-60`}
                    >
                      {CardBody}
                    </div>
                  );
                }
                return (
                  <Link
                    key={d.id}
                    to={`/dashboards/${d.slug}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className={`${baseClass} hover:-translate-y-0.5 hover:shadow-card-hover no-underline`}
                  >
                    {CardBody}
                  </Link>
                );
              })}
          </div>
        </section>

        {/* CTA strip */}
        <section className="flex flex-col gap-3 rounded-lg border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="rounded-sm bg-fmp-muted p-2 text-fmp">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p
                className="text-sm font-semibold text-ink"
                style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
              >
                Novos paineis em breve
              </p>
              <p className="text-xs text-ink-3">
                Camadas analiticas adicionais por curso, periodo e regiao serao
                incorporadas nas proximas evolucoes.
              </p>
            </div>
          </div>
          <Link
            to="/dashboards/presenca-nacional"
            className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-4 py-2 text-xs font-semibold text-cream transition-all hover:-translate-y-0.5 hover:bg-fmp no-underline"
          >
            Explorar Presenca Nacional
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Compass,
  Filter,
  GraduationCap,
  MapPin,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard, StatCardSkeleton, STAT_GRID_CLASSES, STAT_GRID_CONTAINER } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { ChartSkeleton } from '@/components/ui/Skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import { DataFreshness } from '@/components/ui/DataFreshness';
import { AtualizandoAviso } from '@/components/ui/AtualizandoAviso';
import { FONTES_POR_DASHBOARD, ritmoDoDataset } from '@/lib/dataFreshness';
import { EmptyState } from '@/components/ui/EmptyState';
import { BrazilStateMap } from '@/components/maps/BrazilStateMap';
import { StateDetailPanel } from '@/components/panels/StateDetailPanel';
import { useMatriculas } from '@/hooks/useMatriculas';
import { nameOf } from '@/lib/brStates';
import type { MatriculaSource } from '@/services/matriculasService';
import { CORES_CATEGORICAS } from '@/lib/chartColors';

const REGION_COLORS: Record<string, string> = {
  Sul: CORES_CATEGORICAS[0],
  Sudeste: CORES_CATEGORICAS[1],
  Nordeste: CORES_CATEGORICAS[2],
  'Centro-Oeste': CORES_CATEGORICAS[3],
  Norte: CORES_CATEGORICAS[4],
  Outros: '#BFBAA4',
};

const SOURCE_OPTIONS: Array<{
  value: MatriculaSource | 'all';
  label: string;
  icon: typeof Users;
}> = [
  { value: 'all', label: 'Tudo', icon: Sparkles },
  { value: 'pos', label: 'Pos-graduacao', icon: GraduationCap },
  { value: 'cursoslivres', label: 'Cursos Livres', icon: BookOpen },
];

const REGION_OPTIONS = ['Todas', 'Sul', 'Sudeste', 'Nordeste', 'Centro-Oeste', 'Norte'];

function fmtBRL(v: number) {
  if (v >= 1_000_000)
    return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (v >= 1_000)
    return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtInt(v: number) {
  return v.toLocaleString('pt-BR');
}

function chartTooltipStyle() {
  return {
    contentStyle: {
      background: 'rgba(255,255,255,0.98)',
      border: '1px solid #DEDCD4',
      borderRadius: 12,
      boxShadow: '0 18px 40px rgba(25,24,24,0.12)',
      padding: 10,
      fontSize: 12,
    } as const,
    labelStyle: {
      color: '#191818',
      fontWeight: 600,
      marginBottom: 4,
      fontSize: 12,
    } as const,
    itemStyle: { color: '#3A3838', fontSize: 12 } as const,
  };
}

export function PresencaNacionalPage() {
  const [source, setSource] = useState<MatriculaSource | 'all'>('all');
  const [region, setRegion] = useState<string>('');
  const [onlyMatriculados, setOnlyMatriculados] = useState(false);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);

  const { raw, stats, detailFor, loading, revalidando, error, refetch } = useMatriculas({
    source,
    region: region || undefined,
    onlyMatriculados,
  });

  const tt = useMemo(chartTooltipStyle, []);

  /**
   * Proxy de frescor por tabela, sobre `raw` (download completo, sem
   * filtro de usuário) — nunca dispara consulta nova. `raw` mistura as
   * duas fontes (Pós + Cursos Livres) num só array com `source`, então
   * separa por essa flag antes do max.
   */
  const freshnessRitmos = useMemo(
    () => ({
      stg_rm_matriculas_pos: ritmoDoDataset(
        raw.filter((m) => m.source === 'pos'),
        'data',
      ),
      stg_rm_matriculas_cursoslivres: ritmoDoDataset(
        raw.filter((m) => m.source === 'cursoslivres'),
        'data',
      ),
    }),
    [raw],
  );

  const detail = useMemo(
    () => (selectedUf ? detailFor(selectedUf) : null),
    [selectedUf, detailFor]
  );

  const topState = stats.byState[0];
  const topRegion = stats.byRegion[0];

  const conversion =
    stats.total > 0 ? Math.round((stats.matriculados / stats.total) * 100) : 0;

  return (
    <AppShell
      title="Presenca Nacional"
      subtitle="Distribuicao de matriculas por estado"
    >
      <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Hero — dark editorial */}
        <section className="relative overflow-hidden rounded-lg hero-gradient p-6 text-cream shadow-card sm:p-8 animate-fade-in">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fmp/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-2xs font-medium uppercase tracking-widest text-cream/60 transition hover:text-fmp no-underline"
              >
                <ArrowLeft className="h-3 w-3" />
                Central de Dashboards
              </Link>
              <div className="mt-2">
                <DataFreshness tabelas={FONTES_POR_DASHBOARD['presenca-nacional']} ritmos={freshnessRitmos} />
                <AtualizandoAviso visivel={revalidando} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-2xs font-medium uppercase tracking-widest text-cream/85 ring-1 ring-inset ring-cream/15">
                  <Compass className="h-3 w-3" />
                  Geointeligencia
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-2xs font-medium text-cream/85 ring-1 ring-inset ring-cream/15">
                  <MapPin className="h-3 w-3" />
                  {stats.ufsCount} UFs
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-2xs font-medium text-cream/85 ring-1 ring-inset ring-cream/15">
                  <Building2 className="h-3 w-3" />
                  {stats.cidadesCount} cidades
                </span>
              </div>
              <h1
                className="mt-3 text-2xl sm:text-3xl lg:text-4xl text-cream"
                style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 500 }}
              >
                Onde a FMP esta presente
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream/70">
                Mapa das matriculas de Pos-graduacao e Cursos Livres pelo
                Brasil. Clique em um estado para ver cursos, cidades,
                situacoes e faturamento.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg bg-cream/10 px-4 py-3 ring-1 ring-inset ring-cream/15 backdrop-blur">
                <p className="text-2xs uppercase tracking-widest text-cream/50">
                  Matriculas
                </p>
                <p
                  className="mt-1 text-2xl text-cream"
                  style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                >
                  {fmtInt(stats.total)}
                </p>
              </div>
              <div className="rounded-lg bg-cream/10 px-4 py-3 ring-1 ring-inset ring-cream/15 backdrop-blur">
                <p className="text-2xs uppercase tracking-widest text-cream/50">
                  Faturamento
                </p>
                <p
                  className="mt-1 text-2xl text-cream"
                  style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                >
                  {fmtBRL(stats.faturado)}
                </p>
              </div>
              <button
                type="button"
                onClick={refetch}
                className="inline-flex items-center gap-1.5 rounded-pill bg-fmp px-3.5 py-2 text-2xs font-medium text-white transition hover:bg-fmp-dark no-underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="relative z-20 flex flex-wrap items-center gap-3 rounded-md border border-line bg-white p-4 shadow-card animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <Filter className="h-4 w-4 text-fmp" />
            Fonte:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SOURCE_OPTIONS.map((opt) => {
              const active = source === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSource(opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-2xs font-semibold transition ${
                    active
                      ? 'bg-fmp text-white shadow-glow'
                      : 'bg-paper text-ink-2 hover:bg-sand/30'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="ml-2 h-6 w-px bg-line" />

          <div className="flex flex-wrap items-center gap-2">
            {REGION_OPTIONS.map((r) => {
              const value = r === 'Todas' ? '' : r;
              const active = region === value;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(value)}
                  className={`rounded-pill px-3 py-1.5 text-2xs font-semibold transition ${
                    active
                      ? 'bg-fmp text-white shadow-glow'
                      : 'bg-paper text-ink-2 hover:bg-sand/30'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>

          <label className="ml-auto inline-flex items-center gap-2 text-2xs font-semibold text-ink-2">
            <input
              type="checkbox"
              checked={onlyMatriculados}
              onChange={(e) => setOnlyMatriculados(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-line-2 text-fmp focus:ring-fmp"
            />
            Somente matriculados
          </label>
        </section>

        {error && (
          <ErrorState
            title="Nao foi possivel carregar as matriculas"
            message={error}
            onRetry={refetch}
          />
        )}

        {/* KPI row */}
        <section className={STAT_GRID_CONTAINER}>
          <div className={STAT_GRID_CLASSES}>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} index={i} />
              ))}
            {!loading && (
              <>
                <StatCard
                  index={0}
                  label="Total de matriculas"
                  value={fmtInt(stats.total)}
                  subtitle={`${fmtInt(stats.totalPos)} Pos + ${fmtInt(stats.totalLivres)} Livres`}
                  icon={Users}
                  color="fmp"
                  highlight
                />
                <StatCard
                  index={1}
                  label="UF lider"
                  value={topState ? nameOf(topState.uf) : '—'}
                  subtitle={
                    topState
                      ? `${fmtInt(topState.total)} matriculas em ${topState.uf}`
                      : ''
                  }
                  icon={MapPin}
                  color="gray"
                />
                <StatCard
                  index={2}
                  label="Faturamento total"
                  value={fmtBRL(stats.faturado)}
                  subtitle={`Ticket medio ${fmtBRL(stats.ticketMedio)}`}
                  icon={Wallet}
                  color="fmp"
                />
                <StatCard
                  index={3}
                  label="Taxa de matriculados"
                  value={`${conversion}%`}
                  subtitle={`${fmtInt(stats.matriculados)} matriculas ativas`}
                  icon={TrendingUp}
                  color="gray"
                />
              </>
            )}
          </div>
        </section>

        {/* Map + drill-down */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Mapa do Brasil"
            subtitle="Selecione um estado para explorar"
            icon={MapPin}
            actions={
              <div className="hidden items-center gap-2 sm:flex">
                {Object.entries(REGION_COLORS).slice(0, 5).map(([name, c]) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 text-2xs text-ink-3"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: c }}
                    />
                    {name}
                  </span>
                ))}
              </div>
            }
          >
            {loading ? (
              <ChartSkeleton height={520} />
            ) : stats.byState.length === 0 ? (
              <EmptyState
                title="Sem matriculas para exibir"
                message="Ajuste os filtros ou tente novamente."
              />
            ) : (
              <BrazilStateMap
                data={stats.byState}
                selectedUf={selectedUf}
                onSelect={setSelectedUf}
                height={520}
              />
            )}
          </SectionCard>

          <div className="lg:col-span-1">
            <StateDetailPanel
              uf={selectedUf}
              detail={detail}
              onClose={() => setSelectedUf(null)}
            />
          </div>
        </section>

        {/* Aggregated charts */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Top UFs por volume"
            subtitle="Ranking de matriculas por estado"
            icon={TrendingUp}
          >
            {loading ? (
              <ChartSkeleton height={320} />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={stats.byState.slice(0, 12)}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="barUf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EE2A42" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#D32238" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#DEDCD4"
                  />
                  <XAxis
                    dataKey="uf"
                    tick={{ fontSize: 11, fill: '#6E6B66' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6E6B66' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(238,42,66,0.05)' }}
                    contentStyle={tt.contentStyle}
                    labelStyle={tt.labelStyle}
                    itemStyle={tt.itemStyle}
                    formatter={(v: unknown) => [`${v} matriculas`, 'Total']}
                    labelFormatter={(label: unknown) => {
                      const uf = String(label ?? '');
                      return `${nameOf(uf)} (${uf})`;
                    }}
                  />
                  <Bar
                    dataKey="total"
                    fill="url(#barUf)"
                    radius={[8, 8, 4, 4]}
                    maxBarSize={36}
                    onClick={(d: unknown) => {
                      const row = d as { uf?: string };
                      if (row?.uf) setSelectedUf(row.uf);
                    }}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          <SectionCard
            title="Distribuicao por regiao"
            subtitle={topRegion ? `${topRegion.name} lidera` : 'Participacao regional'}
            icon={Compass}
          >
            {loading ? (
              <ChartSkeleton height={320} />
            ) : stats.byRegion.length === 0 ? (
              <EmptyState title="Sem dados" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Tooltip
                      contentStyle={tt.contentStyle}
                      itemStyle={tt.itemStyle}
                      formatter={(v: unknown) => [`${v} matriculas`, '']}
                    />
                    <Pie
                      data={stats.byRegion}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {stats.byRegion.map((r) => (
                        <Cell
                          key={r.name}
                          fill={REGION_COLORS[r.name] ?? '#BFBAA4'}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 space-y-1.5">
                  {stats.byRegion.map((r) => {
                    const pct =
                      stats.total > 0
                        ? Math.round((r.value / stats.total) * 100)
                        : 0;
                    return (
                      <li
                        key={r.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2 text-ink-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              background: REGION_COLORS[r.name] ?? '#BFBAA4',
                            }}
                          />
                          {r.name}
                        </span>
                        <span className="font-semibold text-ink">
                          {fmtInt(r.value)} <span className="text-ink-3">({pct}%)</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </SectionCard>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard
            title="Situacoes de matricula"
            subtitle="Estagio no funil academico"
          >
            {loading ? (
              <ChartSkeleton height={260} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stats.bySituacao.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="barSitu" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#EE2A42" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#EE2A42" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    horizontal={false}
                    stroke="#DEDCD4"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#6E6B66' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#3A3838' }}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(238,42,66,0.05)' }}
                    contentStyle={tt.contentStyle}
                    labelStyle={tt.labelStyle}
                    itemStyle={tt.itemStyle}
                    formatter={(v: unknown) => [`${v} matriculas`, 'Total']}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#barSitu)"
                    radius={[4, 8, 8, 4]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          <SectionCard
            title="Modalidades e niveis"
            subtitle="Composicao entre Pos-graduacao e Cursos Livres"
          >
            {loading ? (
              <ChartSkeleton height={260} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stats.byModalidade.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="barMod" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#EE2A42" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#B81E32" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    horizontal={false}
                    stroke="#DEDCD4"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#6E6B66' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#3A3838' }}
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(238,42,66,0.05)' }}
                    contentStyle={tt.contentStyle}
                    labelStyle={tt.labelStyle}
                    itemStyle={tt.itemStyle}
                    formatter={(v: unknown) => [`${v} matriculas`, 'Total']}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#barMod)"
                    radius={[4, 8, 8, 4]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </section>

        <section className="rounded-md border border-dashed border-fmp/30 bg-fmp-muted p-5 animate-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-sm bg-white p-2 text-fmp shadow-card">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p
                  className="text-sm font-semibold text-ink"
                  style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                >
                  Novos indicadores em breve
                </p>
                <p className="text-xs text-ink-3">
                  Camada por CEP, filtros por curso e comparativo temporal serao
                  adicionados nas proximas evolucoes.
                </p>
              </div>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-4 py-2 text-xs font-semibold text-cream transition-all hover:-translate-y-0.5 hover:bg-fmp no-underline"
            >
              Ver outros dashboards
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

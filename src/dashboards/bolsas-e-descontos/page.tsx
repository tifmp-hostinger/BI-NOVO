import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  Award,
  GraduationCap,
  Percent,
  RefreshCw,
  TrendingDown,
  Users,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard, StatCardSkeleton, STAT_GRID_CLASSES, STAT_GRID_CONTAINER } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { ChartSkeleton } from '@/components/ui/Skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import { DataFreshness } from '@/components/ui/DataFreshness';
import { AtualizandoAviso } from '@/components/ui/AtualizandoAviso';
import { FONTES_POR_DASHBOARD } from '@/lib/dataFreshness';
import { EmptyState } from '@/components/ui/EmptyState';
import { CORES_CATEGORICAS } from '@/lib/chartColors';
import { useBolsasDescontosData } from './hooks/useBolsasDescontosData';
import { BolsasFilterBar } from './components/BolsasFilterBar';
import { fmtBRLCompact, fmtInt, truncateLabel } from './formatters';
import type { BolsasFilters } from './types';

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

const FMP_RED = '#EE2A42';
const FMP_DARK = '#B81E32';
const NEUTRAL = '#BFBAA4';
const COLORS = CORES_CATEGORICAS;

type Tab = 'panorama' | 'evasao';

export function BolsasEDescontosPage() {
  const [tab, setTab] = useState<Tab>('panorama');
  const [filters, setFilters] = useState<BolsasFilters>({
    codperlet: [],
    ano: [],
    tipocurso: [],
    bolsaPadronizada: [],
  });

  const {
    filterOptions,
    optionsLoading,
    panorama,
    panoramaLoading,
    panoramaError,
    evasao,
    evasaoLoading,
    evasaoError,
    freshnessRitmos,
    revalidando,
    refetch,
  } = useBolsasDescontosData(filters);

  const tt = useMemo(chartTooltipStyle, []);
  const loading = tab === 'panorama' ? panoramaLoading : evasaoLoading;
  const error = tab === 'panorama' ? panoramaError : evasaoError;

  return (
    <AppShell
      title="Bolsas e Descontos"
      subtitle="Performance e retenção de benefícios financeiros"
    >
      <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Hero */}
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
                <DataFreshness tabelas={FONTES_POR_DASHBOARD['bolsas-e-descontos']} ritmos={freshnessRitmos} />
                <AtualizandoAviso visivel={revalidando} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-2xs font-medium uppercase tracking-widest text-cream/85 ring-1 ring-inset ring-cream/15">
                  <Percent className="h-3 w-3" />
                  Financeiro
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-2xs font-medium text-cream/85 ring-1 ring-inset ring-cream/15">
                  <Award className="h-3 w-3" />
                  Somente leitura
                </span>
              </div>
              <h1
                className="mt-3 text-2xl sm:text-3xl lg:text-4xl text-cream"
                style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 500 }}
              >
                Bolsas e Descontos
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream/70">
                Performance e retenção de matrículas com benefícios financeiros.
                Panorama geral de bolsas, descontos e faturamento, além da análise
                de evasão relacionada a benefícios.
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
        </section>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-md border border-line bg-white p-1 shadow-card w-fit">
          <button
            type="button"
            onClick={() => setTab('panorama')}
            className={`rounded-pill px-4 py-2 text-xs font-semibold transition ${
              tab === 'panorama'
                ? 'bg-fmp text-white shadow-glow'
                : 'text-ink-2 hover:bg-paper'
            }`}
          >
            Panorama Geral
          </button>
          <button
            type="button"
            onClick={() => setTab('evasao')}
            className={`rounded-pill px-4 py-2 text-xs font-semibold transition ${
              tab === 'evasao'
                ? 'bg-fmp text-white shadow-glow'
                : 'text-ink-2 hover:bg-paper'
            }`}
          >
            Evasão
          </button>
        </div>

        {/* Filters */}
        {!optionsLoading && filterOptions && (
          <BolsasFilterBar
            options={filterOptions}
            codperlet={filters.codperlet}
            ano={filters.ano}
            tipocurso={filters.tipocurso}
            bolsaPadronizada={filters.bolsaPadronizada}
            onCodperletChange={(v) => setFilters((f) => ({ ...f, codperlet: v }))}
            onAnoChange={(v) => setFilters((f) => ({ ...f, ano: v }))}
            onTipocursoChange={(v) => setFilters((f) => ({ ...f, tipocurso: v }))}
            onBolsaPadronizadaChange={(v) => setFilters((f) => ({ ...f, bolsaPadronizada: v }))}
          />
        )}

        {error && (
          <ErrorState
            title="Não foi possível carregar os dados"
            message={error}
            onRetry={refetch}
          />
        )}

        {/* Panorama Geral */}
        {tab === 'panorama' && (
          <>
            {/* KPI cards */}
            <section className={STAT_GRID_CONTAINER}>
              <div className={STAT_GRID_CLASSES}>
                {loading && Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} index={i} />)}
                {!loading && panorama && (
                  <>
                    <StatCard index={0} label="Matrículas" value={fmtInt(panorama.kpis.matriculas)} icon={Users} color="fmp" highlight />
                    <StatCard index={1} label="Bolsas" value={fmtInt(panorama.kpis.bolsas)} icon={Award} color="fmp" />
                    <StatCard index={2} label="Descontos" value={fmtInt(panorama.kpis.descontos)} icon={Percent} color="gray" />
                    <StatCard index={3} label="Formados" value={fmtInt(panorama.kpis.formados)} icon={GraduationCap} color="gray" />
                    <StatCard index={4} label="Fat. Original Previsto" value={fmtBRLCompact(panorama.kpis.fatOriginalPrevisto)} icon={Wallet} color="fmp" />
                    <StatCard index={5} label="Fat. Desconto Previsto" value={fmtBRLCompact(panorama.kpis.fatDescontoPrevisto)} icon={Wallet} color="gray" />
                  </>
                )}
              </div>
            </section>

            {/* Charts 2x2 */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* 1. Waterfall — Top 5 Descontos */}
              <SectionCard title="Top 5 Descontos com Maior Nº de Ocorrências" subtitle="Categoria: bolsa padronizada" icon={Percent}>
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : !panorama || panorama.topDescontos.length === 0 ? (
                  <EmptyState title="Sem dados para os filtros selecionados" />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={panorama.topDescontos} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="barDesc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                      <XAxis
                        dataKey="categoria"
                        tick={{ fontSize: 10, fill: '#6E6B66' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: string) => truncateLabel(v, 16)}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(238,42,66,0.05)' }}
                        contentStyle={tt.contentStyle}
                        labelStyle={tt.labelStyle}
                        itemStyle={tt.itemStyle}
                        formatter={(v: unknown) => [`${fmtInt(v as number)} ocorrências`, 'Descontos']}
                      />
                      <Bar dataKey="valor" fill="url(#barDesc)" radius={[8, 8, 4, 4]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              {/* 2. Area — Nº Ocorrências por Bolsa */}
              <SectionCard title="Nº Ocorrências por Bolsa" subtitle="Categoria: bolsa padronizada" icon={Award}>
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : !panorama || panorama.ocorrenciasBolsa.length === 0 ? (
                  <EmptyState title="Sem dados para os filtros selecionados" />
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(320, panorama.ocorrenciasBolsa.length * 22)}>
                    <BarChart
                      data={panorama.ocorrenciasBolsa}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="barOcorrencias" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#DEDCD4" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#6E6B66' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => fmtInt(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="categoria"
                        tick={{ fontSize: 10, fill: '#3A3838' }}
                        tickLine={false}
                        axisLine={false}
                        width={180}
                        tickFormatter={(v: string) => truncateLabel(v, 26)}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(238,42,66,0.05)' }}
                        contentStyle={tt.contentStyle}
                        labelStyle={tt.labelStyle}
                        itemStyle={tt.itemStyle}
                        formatter={(v: unknown) => [`${fmtInt(v as number)} ocorrências`, 'Bolsas']}
                      />
                      <Bar dataKey="valor" fill="url(#barOcorrencias)" radius={[4, 8, 8, 4]} maxBarSize={22}>
                        <LabelList
                          dataKey="valor"
                          position="right"
                          formatter={(v: unknown) => fmtInt(v as number)}
                          style={{ fontSize: 10, fill: '#3A3838', fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              {/* 3. Pie — Distribuição dos Benefícios Financeiros */}
              <SectionCard title="Distribuição dos Benefícios Financeiros" subtitle="Bolsas vs Descontos" icon={Percent}>
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : !panorama || panorama.distribuicao.length === 0 ||
                  panorama.distribuicao.every((d) => d.valor === 0) ? (
                  <EmptyState title="Sem dados para os filtros selecionados" />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Tooltip
                        contentStyle={tt.contentStyle}
                        labelStyle={tt.labelStyle}
                        itemStyle={tt.itemStyle}
                        formatter={(v: unknown) => [`${fmtInt(v as number)}`, '']}
                      />
                      <Pie
                        data={panorama.distribuicao}
                        dataKey="valor"
                        nameKey="categoria"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={55}
                        paddingAngle={3}
                        stroke="none"
                        label={(entry: unknown) => {
                          const e = entry as { categoria?: string; valor?: number };
                          return `${e.categoria ?? ''}: ${fmtInt(e.valor ?? 0)}`;
                        }}
                        labelLine={false}
                      >
                        <Cell fill={CORES_CATEGORICAS[0]} />
                        <Cell fill={CORES_CATEGORICAS[1]} />
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        formatter={(v: string) => <span className="text-xs text-ink-2">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              {/* 4. Columns — Top 5 Cursos de Maior Faturamento - Descontos */}
              <SectionCard title="Top 5 Cursos de Maior Faturamento - Descontos" subtitle="Categoria: curso" icon={Wallet}>
                {loading ? (
                  <ChartSkeleton height={320} />
                ) : !panorama || panorama.topCursosFat.length === 0 ? (
                  <EmptyState title="Sem dados para os filtros selecionados" />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={panorama.topCursosFat} layout="vertical" margin={{ top: 4, right: 80, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="barCurso" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#DEDCD4" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#6E6B66' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => fmtBRLCompact(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="categoria"
                        tick={{ fontSize: 10, fill: '#3A3838' }}
                        tickLine={false}
                        axisLine={false}
                        width={160}
                        tickFormatter={(v: string) => truncateLabel(v, 24)}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(238,42,66,0.05)' }}
                        contentStyle={tt.contentStyle}
                        labelStyle={tt.labelStyle}
                        itemStyle={tt.itemStyle}
                        formatter={(v: unknown) => [fmtBRLCompact(v as number), 'Faturamento']}
                      />
                      <Bar dataKey="valor" fill="url(#barCurso)" radius={[4, 8, 8, 4]} maxBarSize={28}>
                        <LabelList
                          dataKey="valor"
                          position="right"
                          formatter={(v: unknown) => fmtBRLCompact(v as number)}
                          style={{ fontSize: 11, fill: '#3A3838', fontWeight: 700 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            </section>
          </>
        )}

        {/* Evasão */}
        {tab === 'evasao' && (
          <>
            {/* Renúncia card */}
            <section className={STAT_GRID_CONTAINER}>
              <div className={STAT_GRID_CLASSES}>
                {loading && <StatCardSkeleton index={0} />}
                {!loading && evasao && (
                  <StatCard
                    index={0}
                    label="Renúncia de Valor - Evasão"
                    value={fmtBRLCompact(evasao.renunciaValorEvasao)}
                    subtitle="Soma do valor original das matrículas evadidas"
                    icon={TrendingDown}
                    color="danger"
                    highlight
                  />
                )}
              </div>
            </section>

            {/* Charts */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* 1. Funnel — Top 10 Benefícios com Maior Evasão (using radial bar as funnel approximation) */}
              <SectionCard title="Top 10 Benefícios Financeiros com Maior Evasão" subtitle="Categoria: bolsa padronizada" icon={TrendingDown}>
                {loading ? (
                  <ChartSkeleton height={360} />
                ) : !evasao || evasao.evasaoBeneficios.length === 0 ? (
                  <EmptyState title="Sem dados para os filtros selecionados" />
                ) : (
                  <ResponsiveContainer width="100%" height={380}>
                    <FunnelChart margin={{ top: 8, right: 180, left: 180, bottom: 8 }}>
                      <Tooltip
                        contentStyle={tt.contentStyle}
                        labelStyle={tt.labelStyle}
                        itemStyle={tt.itemStyle}
                        formatter={(v: unknown, _n: unknown, p: { payload?: { categoria?: string } }) => [
                          `${fmtInt(v as number)} evasões`,
                          p?.payload?.categoria ?? 'Evasão',
                        ]}
                      />
                      <Funnel
                        dataKey="valor"
                        nameKey="categoria"
                        data={evasao.evasaoBeneficios.map((r, i) => ({
                          ...r,
                          fill: `rgba(238,42,66,${Math.max(0.35, 1 - i * 0.07).toFixed(2)})`,
                        }))}
                        isAnimationActive
                        stroke="#fff"
                      >
                        <LabelList
                          position="left"
                          dataKey="categoria"
                          fill="#3A3838"
                          stroke="none"
                          fontSize={11}
                          fontWeight={600}
                          formatter={(v: unknown) => truncateLabel(String(v ?? ''), 24)}
                        />
                        <LabelList
                          position="right"
                          dataKey="valor"
                          fill="#B81E32"
                          stroke="none"
                          fontSize={11}
                          fontWeight={700}
                          formatter={(v: unknown) => fmtInt(v as number)}
                        />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              {/* 2. Combined — Evasão por Ano */}
              <SectionCard title="Evasão por Ano" subtitle="Colunas: matrículas com benefício | Linha: evasão" icon={TrendingDown}>
                {loading ? (
                  <ChartSkeleton height={360} />
                ) : !evasao || evasao.evasaoPorAno.length === 0 ? (
                  <EmptyState title="Sem dados para os filtros selecionados" />
                ) : (
                  <ResponsiveContainer width="100%" height={360}>
                    <ComposedChart data={evasao.evasaoPorAno} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="barAno" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                      <XAxis
                        dataKey="ano"
                        tick={{ fontSize: 11, fill: '#6E6B66' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: '#6E6B66' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#6E6B66' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={tt.contentStyle}
                        labelStyle={tt.labelStyle}
                        itemStyle={tt.itemStyle}
                        formatter={(v: unknown, name: unknown) => {
                          if (name === 'matBeneFin') return [`${fmtInt(v as number)}`, 'Mat. com Benefício'];
                          return [`${fmtInt(v as number)}`, 'Evasão'];
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        formatter={(v: string) => {
                          const label = v === 'matBeneFin' ? 'Mat. com Benefício' : 'Evasão';
                          return <span className="text-xs text-ink-2">{label}</span>;
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="matBeneFin"
                        fill="url(#barAno)"
                        radius={[8, 8, 4, 4]}
                        maxBarSize={36}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="evasaoBolsas"
                        stroke={NEUTRAL}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: NEUTRAL }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              {/* 3. Donut — Evasão por Modalidade */}
              <SectionCard title="Evasão com Benefícios Financeiros por Modalidade" subtitle="Categoria: tipo de curso" icon={GraduationCap}>
                {loading ? (
                  <ChartSkeleton height={360} />
                ) : !evasao || evasao.evasaoPorModalidade.length === 0 ||
                  evasao.evasaoPorModalidade.every((d) => d.valor === 0) ? (
                  <EmptyState title="Sem dados para os filtros selecionados" />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Tooltip
                          contentStyle={tt.contentStyle}
                          labelStyle={tt.labelStyle}
                          itemStyle={tt.itemStyle}
                          formatter={(v: unknown) => [`${fmtInt(v as number)} evasões`, '']}
                        />
                        <Pie
                          data={evasao.evasaoPorModalidade}
                          dataKey="valor"
                          nameKey="categoria"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={100}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {evasao.evasaoPorModalidade.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <ul className="mt-2 space-y-1.5">
                      {evasao.evasaoPorModalidade.map((r, i) => {
                        const total = evasao.evasaoPorModalidade.reduce((s, x) => s + x.valor, 0);
                        const pct = total > 0 ? Math.round((r.valor / total) * 100) : 0;
                        return (
                          <li key={r.categoria} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-ink-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: COLORS[i % COLORS.length] }}
                              />
                              {r.categoria}
                            </span>
                            <span className="font-semibold text-ink">
                              {fmtInt(r.valor)} <span className="text-ink-3">({pct}%)</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </SectionCard>
            </section>
          </>
        )}

        {/* Footer note */}
        <section className="rounded-md border border-dashed border-fmp/30 bg-fmp-muted p-5 animate-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-sm bg-white p-2 text-fmp shadow-card">
                <Award className="h-4 w-4" />
              </div>
              <div>
                <p
                  className="text-sm font-semibold text-ink"
                  style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                >
                  Regras herdadas do Power BI
                </p>
                <p className="text-xs text-ink-3">
                  Este dashboard preserva a lógica original do relatório homônimo,
                  incluindo inconsistências documentadas na migração de paridade.
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

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  GraduationCap,
  TrendingUp,
  Users,
  RefreshCw,
  Radio,
  Target,
  Calendar,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { SectionCard } from '@/components/ui/SectionCard';
import { ReorderableGrid, RItem } from '@/components/ui/ReorderableGrid';
import { GaugeSemicircle } from '@/components/ui/GaugeSemicircle';
import { STAT_GRID_CLASSES, STAT_GRID_CONTAINER } from '@/components/ui/StatCard';
import { ChartSkeleton, LoadingSteps } from '@/components/ui/Skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import { DataFreshness } from '@/components/ui/DataFreshness';
import { AtualizandoAviso } from '@/components/ui/AtualizandoAviso';
import { FONTES_POR_DASHBOARD } from '@/lib/dataFreshness';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAnaliseConversaoData } from './hooks/useAnaliseConversaoData';
import { ConversaoFilterBar } from './components/ConversaoFilterBar';
import { GraduacaoTab } from './components/GraduacaoTab';
import { RematriculaTab } from './components/RematriculaTab';
import { MestradoTab } from './components/MestradoTab';
import { EspecializacoesTab } from './components/EspecializacoesTab';
import { ModalidadePosTab } from './components/ModalidadePosTab';
import { CursosLivresTab } from './components/CursosLivresTab';
import { fmtBRLCompact, fmtInt, fmtPct, truncateLabel } from './formatters';
import type { ConversaoFilters } from './types';

type Tab =
  | 'geral'
  | 'leads'
  | 'graduacao'
  | 'rematricula'
  | 'especializacoes'
  | 'presencial'
  | 'ead'
  | 'cursoslivres'
  | 'mestrado';

const TABS: { id: Tab; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'leads', label: 'Leads' },
  { id: 'graduacao', label: 'Graduacao' },
  { id: 'rematricula', label: 'Rematricula' },
  { id: 'especializacoes', label: 'Especializacoes' },
  { id: 'presencial', label: 'Presencial' },
  { id: 'ead', label: 'EAD' },
  { id: 'cursoslivres', label: 'Cursos Livres' },
  { id: 'mestrado', label: 'Mestrado' },
];

const FMP_RED = '#EE2A42';
const FMP_DARK = '#B81E32';
const NEUTRAL = '#BFBAA4';

const OBS_PROCESSO_FINALIZADO = 'OBS.: Processo Seletivo Finalizado';

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

export function AnaliseDeConversaoPage() {
  const [tab, setTab] = useState<Tab>('geral');
  const [filters, setFilters] = useState<ConversaoFilters>({
    codperlet: [],
    ano: [],
    mes: [],
    dataInicio: null,
    dataFim: null,
  });

  const { loading, revalidando, error, progress, filterOptions, geralKpis, leadsData, graduacaoData, rematriculaData, mestradoData, especializacoesData, presencialData, eadData, cursosLivresData, freshnessRitmos, refetch } =
    useAnaliseConversaoData(filters, tab);

  const tt = useMemo(chartTooltipStyle, []);

  return (
    <AppShell
      title="Analise de Conversao"
      subtitle="Funil comercial academico completo - Graduacao, Especializacoes, Mestrado e Cursos Livres"
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
                <DataFreshness tabelas={FONTES_POR_DASHBOARD['analise-de-conversao']} ritmos={freshnessRitmos} />
                <AtualizandoAviso visivel={revalidando} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-2xs font-medium uppercase tracking-widest text-cream/85 ring-1 ring-inset ring-cream/15">
                  <Target className="h-3 w-3" />
                  Comercial
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-2xs font-medium text-cream/85 ring-1 ring-inset ring-cream/15">
                  <TrendingUp className="h-3 w-3" />
                  Somente leitura
                </span>
              </div>
              <h1
                className="mt-3 text-2xl sm:text-3xl lg:text-4xl text-cream"
                style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 500 }}
              >
                Analise de Conversao
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream/70">
                Funil comercial completo: leads, inscricoes e matriculas por processo,
                com paridade de regras herdadas do Power BI original.
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
        <div
          role="tablist"
          aria-label="Abas do dashboard"
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-line bg-white p-1 shadow-card sm:w-fit sm:flex-wrap sm:overflow-visible"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-pill px-4 py-2 text-xs font-semibold transition ${
                tab === t.id
                  ? 'bg-fmp text-white shadow-glow'
                  : 'text-ink-2 hover:bg-paper'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {!loading && filterOptions && (
          <ConversaoFilterBar
            options={filterOptions}
            filters={filters}
            onCodperletChange={(v) => setFilters((f) => ({ ...f, codperlet: v }))}
            onAnoChange={(v) => setFilters((f) => ({ ...f, ano: v }))}
            onMesChange={(v) => setFilters((f) => ({ ...f, mes: v }))}
            onDataInicioChange={(v) => setFilters((f) => ({ ...f, dataInicio: v }))}
            onDataFimChange={(v) => setFilters((f) => ({ ...f, dataFim: v }))}
          />
        )}

        {loading && progress && <LoadingSteps mensagem={progress} />}

        {error && (
          <ErrorState
            title="Nao foi possivel carregar os dados"
            message={error}
            onRetry={refetch}
          />
        )}

        {/* GERAL */}
        {tab === 'geral' && (
          <>
            {loading ? (
              <section className={STAT_GRID_CONTAINER}>
                <div className={STAT_GRID_CLASSES}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-56 animate-pulse rounded-md border border-line bg-white shadow-card" />
                  ))}
                </div>
              </section>
            ) : geralKpis ? (
              <>
                <section className={STAT_GRID_CONTAINER}>
                  <div className={STAT_GRID_CLASSES}>
                    <GaugeCard
                      label={`Graduacao | ${geralKpis.gradPeriodoAtual}`}
                      value={geralKpis.gradPctMetaAtual}
                      caption={`${fmtInt(geralKpis.gradMatEfetAtual)} / ${fmtInt(geralKpis.gradVagasAtual)} vagas`}
                      obsFinalizado
                    />
                    <GaugeCard
                      label={`Graduacao | ${geralKpis.gradPeriodoAnterior}`}
                      value={geralKpis.gradPctMetaAnterior}
                      caption={`${fmtInt(geralKpis.gradMatEfetAnterior)} / ${fmtInt(geralKpis.gradVagasAnterior)} vagas`}
                      obsFinalizado
                    />
                    <GaugeCard
                      label="Especializacoes | Meta"
                      value={geralKpis.especPctMeta}
                      caption={`${fmtBRLCompact(geralKpis.especFat)} / ${fmtBRLCompact(geralKpis.especMetaFat)} meta`}
                    />
                    <GaugeCard
                      label={`Mestrado ${geralKpis.mestAno} | Meta`}
                      value={geralKpis.mestPctMeta}
                      caption={`${fmtInt(geralKpis.mestMat)} / ${fmtInt(geralKpis.mestMeta)} meta`}
                    />
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <SectionCard title="Especializacoes - Faturamento EAD" icon={TrendingUp}>
                    <p
                      className="text-3xl text-ink"
                      style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                    >
                      {fmtBRLCompact(geralKpis.especFatEad)}
                    </p>
                    <p className="mt-1 text-xs text-ink-3">Pós EAD - BasePos</p>
                  </SectionCard>
                  <SectionCard title="Especializacoes - Faturamento Presencial" icon={TrendingUp}>
                    <p
                      className="text-3xl text-ink"
                      style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                    >
                      {fmtBRLCompact(geralKpis.especFatPres)}
                    </p>
                    <p className="mt-1 text-xs text-ink-3">Pós Presencial - BasePos</p>
                  </SectionCard>
                  <SectionCard title="Mestrado - Matriculas Efetivas" icon={GraduationCap}>
                    <p
                      className="text-3xl text-ink"
                      style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
                    >
                      {fmtInt(geralKpis.mestMat)}
                    </p>
                    <p className="mt-1 text-xs text-ink-3">Nova Matricula / Matriculado</p>
                  </SectionCard>
                </section>
              </>
            ) : null}
          </>
        )}

        {/* LEADS */}
        {tab === 'leads' && (
          <>
            {loading ? (
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ChartSkeleton key={i} height={360} />
                ))}
              </section>
            ) : leadsData ? (
              <>
                <ReorderableGrid storageKey="conv-reorder-leads" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <RItem rid="leads-grad">
                  <SectionCard
                    title="Comportamento - Leads Graduacao"
                    subtitle="Colunas: Leads | Linhas: Conv. Insc / Conv. Mat"
                    icon={Users}
                  >
                    {leadsData.gradMensal.every((d) => d.leads === 0) ? (
                      <EmptyState title="Sem dados de leads para os filtros selecionados" />
                    ) : (
                      <ResponsiveContainer width="100%" height={360}>
                        <ComposedChart data={leadsData.gradMensal} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <defs>
                            <linearGradient id="barLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                              <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                          <XAxis
                            dataKey="mesAno"
                            tick={{ fontSize: 9, fill: '#6E6B66' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: string) => truncateLabel(v, 10)}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={tt.contentStyle} labelStyle={tt.labelStyle} itemStyle={tt.itemStyle} />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            formatter={(v: string) => {
                              const labels: Record<string, string> = {
                                leads: 'Leads',
                                convLeadsInsc: 'Conv. Leads Insc',
                                convLeadsMat: 'Conv. Leads Mat',
                              };
                              return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>;
                            }}
                          />
                          <Bar dataKey="leads" fill="url(#barLeadsGrad)" radius={[8, 8, 4, 4]} maxBarSize={36} />
                          <Line type="monotone" dataKey="convLeadsInsc" stroke={NEUTRAL} strokeWidth={2.5} dot={{ r: 3, fill: NEUTRAL }} />
                          <Line type="monotone" dataKey="convLeadsMat" stroke={FMP_DARK} strokeWidth={2.5} dot={{ r: 3, fill: FMP_DARK }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </SectionCard>

                  </RItem>
                  <RItem rid="leads-espec">
                  <SectionCard
                    title="Comportamento - Leads Especializacoes"
                    subtitle="Colunas: Leads | Linhas: Conv. Insc / Conv. Mat"
                    icon={Users}
                  >
                    {leadsData.especMensal.every((d) => d.leads === 0) ? (
                      <EmptyState title="Sem dados de leads para os filtros selecionados" />
                    ) : (
                      <ResponsiveContainer width="100%" height={360}>
                        <ComposedChart data={leadsData.especMensal} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <defs>
                            <linearGradient id="barLeadsEspec" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                              <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                          <XAxis
                            dataKey="mesAno"
                            tick={{ fontSize: 9, fill: '#6E6B66' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: string) => truncateLabel(v, 10)}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={tt.contentStyle} labelStyle={tt.labelStyle} itemStyle={tt.itemStyle} />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            formatter={(v: string) => {
                              const labels: Record<string, string> = {
                                leads: 'Leads',
                                convLeadsInsc: 'Conv. Leads Insc',
                                convLeadsMat: 'Conv. Leads Mat',
                              };
                              return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>;
                            }}
                          />
                          <Bar dataKey="leads" fill="url(#barLeadsEspec)" radius={[8, 8, 4, 4]} maxBarSize={36} />
                          <Line type="monotone" dataKey="convLeadsInsc" stroke={NEUTRAL} strokeWidth={2.5} dot={{ r: 3, fill: NEUTRAL }} />
                          <Line type="monotone" dataKey="convLeadsMat" stroke={FMP_DARK} strokeWidth={2.5} dot={{ r: 3, fill: FMP_DARK }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </SectionCard>

                  </RItem>
                  <RItem rid="leads-mest">
                  <SectionCard
                    title="Comportamento - Leads Mestrado"
                    subtitle="Colunas: Leads | Linhas: Conv. Insc / Conv. Mat"
                    icon={Users}
                  >
                    {leadsData.mestMensal.every((d) => d.leads === 0) ? (
                      <EmptyState title="Sem dados de leads para os filtros selecionados" />
                    ) : (
                      <ResponsiveContainer width="100%" height={360}>
                        <ComposedChart data={leadsData.mestMensal} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <defs>
                            <linearGradient id="barLeadsMest" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                              <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                          <XAxis
                            dataKey="mesAno"
                            tick={{ fontSize: 9, fill: '#6E6B66' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: string) => truncateLabel(v, 10)}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={tt.contentStyle} labelStyle={tt.labelStyle} itemStyle={tt.itemStyle} />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            formatter={(v: string) => {
                              const labels: Record<string, string> = {
                                leads: 'Leads',
                                convLeadsInsc: 'Conv. Leads Insc',
                                convLeadsMat: 'Conv. Leads Mat',
                              };
                              return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>;
                            }}
                          />
                          <Bar dataKey="leads" fill="url(#barLeadsMest)" radius={[8, 8, 4, 4]} maxBarSize={36} />
                          <Line type="monotone" dataKey="convLeadsInsc" stroke={NEUTRAL} strokeWidth={2.5} dot={{ r: 3, fill: NEUTRAL }} />
                          <Line type="monotone" dataKey="convLeadsMat" stroke={FMP_DARK} strokeWidth={2.5} dot={{ r: 3, fill: FMP_DARK }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </SectionCard>

                  </RItem>
                  <RItem rid="leads-canal">
                  <SectionCard
                    title="Leads Gerados por Canal"
                    subtitle="Canal de origem x quantidade de leads"
                    icon={Radio}
                  >
                    {leadsData.leadsPorCanal.length === 0 ? (
                      <EmptyState title="Sem dados de canal para os filtros selecionados" />
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.max(300, leadsData.leadsPorCanal.length * 24)}>
                        <BarChart
                          data={leadsData.leadsPorCanal.slice(0, 20)}
                          layout="vertical"
                          margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
                        >
                          <defs>
                            <linearGradient id="barCanal" x1="0" y1="0" x2="1" y2="0">
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
                            formatter={(v: unknown) => [`${fmtInt(v as number)} leads`, 'Canal']}
                          />
                          <Bar dataKey="valor" fill="url(#barCanal)" radius={[4, 8, 8, 4]} maxBarSize={22}>
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
                  </RItem>

                  <RItem rid="leads-entrada" className="lg:col-span-2">
                <SectionCard
                  title="Entrada de Leads - Graduacao e Especializacoes"
                  subtitle="Comparativo mensal de leads por processo"
                  icon={Calendar}
                >
                  {leadsData.entradaGradEspec.every((d) => d.leads === 0 && d.convLeadsInsc === 0) ? (
                    <EmptyState title="Sem dados para os filtros selecionados" />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={leadsData.entradaGradEspec} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={FMP_RED} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="areaEspec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={NEUTRAL} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={NEUTRAL} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                        <XAxis
                          dataKey="mesAno"
                          tick={{ fontSize: 9, fill: '#6E6B66' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: string) => truncateLabel(v, 10)}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tt.contentStyle} labelStyle={tt.labelStyle} itemStyle={tt.itemStyle} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          formatter={(v: string) => {
                            const labels: Record<string, string> = { leads: 'Graduacao', convLeadsInsc: 'Especializacoes' };
                            return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>;
                          }}
                        />
                        <Area type="monotone" dataKey="leads" name="leads" stroke={FMP_RED} strokeWidth={2.5} fill="url(#areaGrad)" />
                        <Area type="monotone" dataKey="convLeadsInsc" name="convLeadsInsc" stroke={NEUTRAL} strokeWidth={2.5} fill="url(#areaEspec)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>
                  </RItem>
                </ReorderableGrid>
              </>
            ) : null}
          </>
        )}

        {/* GRADUACAO */}
        {tab === 'graduacao' && (
          <ErrorBoundary><GraduacaoTab loading={loading} data={graduacaoData} /></ErrorBoundary>
        )}

        {/* REMATRICULA */}
        {tab === 'rematricula' && (
          <ErrorBoundary><RematriculaTab loading={loading} data={rematriculaData} /></ErrorBoundary>
        )}

        {/* MESTRADO */}
        {tab === 'mestrado' && (
          <ErrorBoundary><MestradoTab loading={loading} data={mestradoData} /></ErrorBoundary>
        )}

        {/* ESPECIALIZACOES */}
        {tab === 'especializacoes' && (
          <ErrorBoundary><EspecializacoesTab loading={loading} data={especializacoesData} /></ErrorBoundary>
        )}

        {/* PRESENCIAL */}
        {tab === 'presencial' && (
          <ErrorBoundary><ModalidadePosTab loading={loading} data={presencialData} /></ErrorBoundary>
        )}

        {/* EAD */}
        {tab === 'ead' && (
          <ErrorBoundary><ModalidadePosTab loading={loading} data={eadData} /></ErrorBoundary>
        )}

        {/* CURSOS LIVRES */}
        {tab === 'cursoslivres' && (
          <ErrorBoundary><CursosLivresTab loading={loading} data={cursosLivresData} /></ErrorBoundary>
        )}
      </div>
    </AppShell>
  );
}

function GaugeCard({
  label,
  value,
  caption,
  obsFinalizado,
}: {
  label: string;
  value: number;
  caption?: string;
  obsFinalizado?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-md border border-line bg-white p-6 shadow-card animate-fade-in">
      <GaugeSemicircle
        value={value}
        label={label}
        size={220}
        formatValue={(v) => fmtPct(v)}
        caption={caption}
      />
      {obsFinalizado && (
        <p className="mt-3 text-2xs italic text-ink-3">{OBS_PROCESSO_FINALIZADO}</p>
      )}
    </div>
  );
}

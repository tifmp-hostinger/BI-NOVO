import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Users, Radio, DollarSign, GraduationCap, TrendingUp } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { ReorderableGrid, RItem } from '@/components/ui/ReorderableGrid';
import { StatCard, StatCardSkeleton, STAT_GRID_CLASSES, STAT_GRID_CONTAINER } from '@/components/ui/StatCard';
import { ChartSkeleton } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtBRLCompact, fmtInt, fmtPct, truncateLabel } from '../formatters';
import type { CursosLivresData } from '../types';

const FMP_RED = '#EE2A42';
const FMP_DARK = '#B81E32';
const NEUTRAL = '#BFBAA4';

function tt() {
  return {
    contentStyle: {
      background: 'rgba(255,255,255,0.98)',
      border: '1px solid #DEDCD4',
      borderRadius: 12,
      boxShadow: '0 18px 40px rgba(25,24,24,0.12)',
      padding: 10,
      fontSize: 12,
    } as const,
    labelStyle: { color: '#191818', fontWeight: 600, marginBottom: 4, fontSize: 12 } as const,
    itemStyle: { color: '#3A3838', fontSize: 12 } as const,
  };
}

type Props = {
  loading: boolean;
  data: CursosLivresData | null;
};

export function CursosLivresTab({ loading, data }: Props) {
  const tooltip = tt();

  if (loading) {
    return (
      <>
        <section className={STAT_GRID_CONTAINER}>
          <div className={STAT_GRID_CLASSES}>
            {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} index={i} />)}
          </div>
        </section>
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => <ChartSkeleton key={i} height={360} />)}
        </section>
      </>
    );
  }

  if (!data) return null;

  const maxLeads = data.leadsPorCanal[0]?.valor ?? 1;

  return (
    <>
      <section className={STAT_GRID_CONTAINER}>
        <div className={STAT_GRID_CLASSES}>
          <StatCard index={0} label="Leads" value={fmtInt(data.leads)} icon={Users} color="fmp" highlight />
          <StatCard index={1} label="Inscricoes" value={fmtInt(data.insc)} icon={Users} color="fmp" />
          <StatCard index={2} label="Matriculas" value={fmtInt(data.mat)} icon={GraduationCap} color="fmp" />
          <StatCard index={3} label="% Conversao" value={fmtPct(data.pctConversao)} icon={TrendingUp} color="gray" />
          <StatCard index={4} label="Faturamento" value={fmtBRLCompact(data.fat)} icon={DollarSign} color="fmp" />
        </div>
      </section>

      <ReorderableGrid storageKey="conv-reorder-cursoslivres" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RItem rid="funil-canal">
        <SectionCard title="Leads Gerados por Canal" subtitle="canal_nome x CL_Leads - Funil" icon={Radio}>
          {data.leadsPorCanal.length === 0 ? (
            <EmptyState title="Sem dados de canal para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, Math.min(data.leadsPorCanal.length, 12) * 36)}>
              <FunnelChart margin={{ top: 8, right: 180, left: 180, bottom: 8 }}>
                <Tooltip
                  contentStyle={tooltip.contentStyle}
                  labelStyle={tooltip.labelStyle}
                  itemStyle={tooltip.itemStyle}
                  formatter={(v: unknown, _n: unknown, p: { payload?: { categoria?: string; valor?: number } }) => {
                    const pctTopo = maxLeads > 0 ? Math.round(((p?.payload?.valor ?? 0) / maxLeads) * 100) : 0;
                    return [`${fmtInt(v as number)} leads (${pctTopo}% do topo)`, p?.payload?.categoria ?? 'Canal'];
                  }}
                />
                <Funnel
                  dataKey="valor"
                  nameKey="categoria"
                  data={data.leadsPorCanal.slice(0, 12).map((r, i) => ({
                    ...r,
                    fill: `rgba(238,42,66,${Math.max(0.35, 1 - i * 0.06).toFixed(2)})`,
                  }))}
                  isAnimationActive
                  stroke="#fff"
                >
                  <LabelList position="left" dataKey="categoria" fill="#3A3838" stroke="none" fontSize={11} fontWeight={600} formatter={(v: unknown) => truncateLabel(String(v ?? ''), 24)} />
                  <LabelList position="right" dataKey="valor" fill={FMP_DARK} stroke="none" fontSize={11} fontWeight={700} formatter={(v: unknown) => fmtInt(v as number)} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="insc-mat-mes">
        <SectionCard title="Inscricoes x Matriculas por Mes" subtitle="Mes x CL_Leads (colunas) + CL_Mat (linha)" icon={Users}>
          {data.inscVsMatMensal.length === 0 || data.inscVsMatMensal.every((d) => d.leads === 0 && d.mat === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={data.inscVsMatMensal} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="barCLLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                <XAxis dataKey="mesAno" tick={{ fontSize: 9, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncateLabel(v, 10)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown, name: unknown) => { if (name === 'mat') return [fmtInt(v as number), 'Matriculas']; return [fmtInt(v as number), 'Leads']; }} />
                <Bar dataKey="leads" fill="url(#barCLLeads)" radius={[8, 8, 4, 4]} maxBarSize={36} />
                <Line type="monotone" dataKey="mat" stroke={NEUTRAL} strokeWidth={2.5} dot={{ r: 4, fill: NEUTRAL }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="fat-curso" className="lg:col-span-2">
        <SectionCard title="Faturamento por Curso" subtitle="curso x CL_Fat ordenado desc" icon={DollarSign}>
          {data.fatPorCurso.length === 0 || data.fatPorCurso.every((d) => d.valor === 0) ? (
            <EmptyState title="Sem dados de faturamento para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, Math.min(data.fatPorCurso.length, 15) * 30)}>
              <BarChart data={data.fatPorCurso.slice(0, 15)} layout="vertical" margin={{ top: 4, right: 80, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="barCLFat" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#DEDCD4" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtBRLCompact(v)} />
                <YAxis type="category" dataKey="categoria" tick={{ fontSize: 10, fill: '#3A3838' }} tickLine={false} axisLine={false} width={200} tickFormatter={(v: string) => truncateLabel(v, 28)} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtBRLCompact(v as number), 'Faturamento']} />
                <Bar dataKey="valor" fill="url(#barCLFat)" radius={[4, 8, 8, 4]} maxBarSize={26}>
                  <LabelList dataKey="valor" position="right" formatter={(v: unknown) => fmtBRLCompact(v as number)} style={{ fontSize: 10, fill: '#3A3838', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        </RItem>
      </ReorderableGrid>
    </>
  );
}

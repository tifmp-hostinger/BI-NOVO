import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Cell,
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
import { TrendingUp, GraduationCap, DollarSign, Users } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { ReorderableGrid, RItem } from '@/components/ui/ReorderableGrid';
import { StatCard, StatCardSkeleton, STAT_GRID_CLASSES, STAT_GRID_CONTAINER } from '@/components/ui/StatCard';
import { GaugeSemicircle } from '@/components/ui/GaugeSemicircle';
import { ChartSkeleton } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtBRLCompact, fmtInt, fmtPct, truncateLabel } from '../formatters';
import type { EspecializacoesData } from '../types';
import { CORES_CATEGORICAS } from '@/lib/chartColors';

const FMP_RED = '#EE2A42';
const FMP_DARK = '#B81E32';
const NEUTRAL = '#BFBAA4';
const PIE_COLORS = CORES_CATEGORICAS;

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
  data: EspecializacoesData | null;
};

export function EspecializacoesTab({ loading, data }: Props) {
  const tooltip = tt();

  if (loading) {
    return (
      <>
        <section className={STAT_GRID_CONTAINER}>
          <div className={STAT_GRID_CLASSES}>
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} index={i} />)}
          </div>
        </section>
        <div className="h-56 animate-pulse rounded-md border border-line bg-white shadow-card" />
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <ChartSkeleton key={i} height={320} />)}
        </section>
      </>
    );
  }

  if (!data) return null;

  return (
    <>
      <section className={STAT_GRID_CONTAINER}>
        <div className={STAT_GRID_CLASSES}>
          <StatCard index={0} label="Leads" value={fmtInt(data.leads)} icon={Users} color="fmp" highlight />
          <StatCard index={1} label="Faturamento" value={fmtBRLCompact(data.fat)} icon={DollarSign} color="fmp" />
          <StatCard index={2} label="Meta Faturamento" value={fmtBRLCompact(data.metaFat)} icon={TrendingUp} color="gray" />
          <StatCard index={3} label="Matriculas" value={fmtInt(data.mat)} icon={GraduationCap} color="gray" />
        </div>
      </section>

      <div className="flex flex-col items-center rounded-md border border-line bg-white p-6 shadow-card animate-fade-in">
        <GaugeSemicircle
          value={data.pctMeta}
          label="Especializacoes | Meta Fat."
          size={220}
          formatValue={(v) => fmtPct(v)}
          caption={`${fmtBRLCompact(data.fat)} / ${fmtBRLCompact(data.metaFat)}`}
        />
      </div>

      <ReorderableGrid storageKey="conv-reorder-especializacoes" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RItem rid="fat-mes">
        <SectionCard title="Faturamento e Matriculas por Mes" subtitle="Mes fiscal x Espec_Fat (colunas) + Espec_Mat (linha)" icon={TrendingUp}>
          {data.fatMensal.length === 0 || data.fatMensal.every((d) => d.fat === 0 && d.mat === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={data.fatMensal} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="barEspecFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                <XAxis dataKey="mesAno" tick={{ fontSize: 9, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncateLabel(v, 10)} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtBRLCompact(v)} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown, name: unknown) => { if (name === 'mat') return [fmtInt(v as number), 'Matriculas']; return [fmtBRLCompact(v as number), 'Faturamento']; }} />
                <Legend verticalAlign="bottom" iconType="circle" formatter={(v: string) => { const labels: Record<string, string> = { fat: 'Faturamento', mat: 'Matriculas' }; return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>; }} />
                <Bar yAxisId="left" dataKey="fat" fill="url(#barEspecFat)" radius={[8, 8, 4, 4]} maxBarSize={36}>
                  <LabelList dataKey="fat" position="top" formatter={(v: unknown) => fmtBRLCompact(v as number)} style={{ fontSize: 8, fill: '#3A3838', fontWeight: 600 }} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="mat" stroke={NEUTRAL} strokeWidth={2.5} dot={{ r: 3, fill: NEUTRAL }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="fat-modalidade-mes">
        <SectionCard title="Faturamento por Modalidade de Ensino" subtitle="Mes x Espec_Fat_EAD + Espec_Fat_Pres + Espec_Mat (eixo sec.)" icon={TrendingUp}>
          {data.fatMensal.length === 0 || data.fatMensal.every((d) => d.fatEad === 0 && d.fatPres === 0 && d.mat === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={data.fatMensal} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                <XAxis dataKey="mesAno" tick={{ fontSize: 9, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncateLabel(v, 10)} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtBRLCompact(v)} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown, name: unknown) => { if (name === 'mat') return [fmtInt(v as number), 'Matriculas']; return [fmtBRLCompact(v as number), 'Faturamento']; }} />
                <Legend verticalAlign="bottom" iconType="circle" formatter={(v: string) => { const labels: Record<string, string> = { fatEad: 'EAD', fatPres: 'Presencial', mat: 'Matriculas' }; return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>; }} />
                <Line yAxisId="left" type="monotone" dataKey="fatEad" stroke={FMP_RED} strokeWidth={2.5} dot={{ r: 3, fill: FMP_RED }} />
                <Line yAxisId="left" type="monotone" dataKey="fatPres" stroke={NEUTRAL} strokeWidth={2.5} dot={{ r: 3, fill: NEUTRAL }} />
                <Line yAxisId="right" type="monotone" dataKey="mat" stroke={FMP_DARK} strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="top5-cursos">
        <SectionCard title="Top 5 Cursos com Maior Faturamento" subtitle="cursoreduzido x Espec_Fat" icon={DollarSign}>
          {data.top5CursosFat.length === 0 || data.top5CursosFat.every((d) => d.valor === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.top5CursosFat} layout="vertical" margin={{ top: 4, right: 80, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="barCursoEspec" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#DEDCD4" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtBRLCompact(v)} />
                <YAxis type="category" dataKey="categoria" tick={{ fontSize: 10, fill: '#3A3838' }} tickLine={false} axisLine={false} width={180} tickFormatter={(v: string) => truncateLabel(v, 24)} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtBRLCompact(v as number), 'Faturamento']} />
                <Bar dataKey="valor" fill="url(#barCursoEspec)" radius={[4, 8, 8, 4]} maxBarSize={28}>
                  <LabelList dataKey="valor" position="right" formatter={(v: unknown) => fmtBRLCompact(v as number)} style={{ fontSize: 11, fill: '#3A3838', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="pizzas">
        <div className="grid grid-cols-1 gap-4">
          <SectionCard title="% Faturamento por Modalidade" subtitle="EAD vs Presencial" icon={TrendingUp}>
            {data.fatPorModalidade.length === 0 || data.fatPorModalidade.every((d) => d.valor === 0) ? (
              <EmptyState title="Sem dados para os filtros selecionados" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtInt(v as number), '']} />
                  <Pie data={data.fatPorModalidade} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3} stroke="none" label={(entry: unknown) => { const e = entry as { categoria?: string; valor?: number }; const total = data.fatPorModalidade.reduce((s, x) => s + x.valor, 0); const pct = total > 0 ? Math.round(((e.valor ?? 0) / total) * 100) : 0; return `${e.categoria ?? ''}: ${pct}%`; }} labelLine={false}>
                    {data.fatPorModalidade.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          <SectionCard title="Faturamento por Estrutura Academica (TCC)" subtitle="TCC vs Sem TCC" icon={GraduationCap}>
            {data.fatPorTcc.length === 0 || data.fatPorTcc.every((d) => d.valor === 0) ? (
              <EmptyState title="Sem dados para os filtros selecionados" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtInt(v as number), '']} />
                  <Pie data={data.fatPorTcc} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3} stroke="none" label={(entry: unknown) => { const e = entry as { categoria?: string; valor?: number }; const total = data.fatPorTcc.reduce((s, x) => s + x.valor, 0); const pct = total > 0 ? Math.round(((e.valor ?? 0) / total) * 100) : 0; return `${e.categoria ?? ''}: ${pct}%`; }} labelLine={false}>
                    <Cell fill={CORES_CATEGORICAS[0]} />
                    <Cell fill={CORES_CATEGORICAS[1]} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>
        </RItem>
      </ReorderableGrid>
    </>
  );
}

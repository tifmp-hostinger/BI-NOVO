import {
  Bar,
  BarChart,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Users, GraduationCap, Radio, DollarSign } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { ReorderableGrid, RItem } from '@/components/ui/ReorderableGrid';
import { StatCard, StatCardSkeleton, STAT_GRID_CLASSES, STAT_GRID_CONTAINER } from '@/components/ui/StatCard';
import { GaugeSemicircle } from '@/components/ui/GaugeSemicircle';
import { ChartSkeleton } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtInt, fmtPct, truncateLabel } from '../formatters';
import type { MestradoData } from '../types';
import { CORES_CATEGORICAS } from '@/lib/chartColors';

const FMP_RED = '#EE2A42';
const FMP_DARK = '#B81E32';
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
  data: MestradoData | null;
};

export function MestradoTab({ loading, data }: Props) {
  const tooltip = tt();

  if (loading) {
    return (
      <>
        <section className={STAT_GRID_CONTAINER}>
          <div className={STAT_GRID_CLASSES}>
            {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} index={i} />)}
          </div>
        </section>
        <div className="h-56 animate-pulse rounded-md border border-line bg-white shadow-card" />
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => <ChartSkeleton key={i} height={360} />)}
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
          <StatCard index={1} label="Inscricoes" value={fmtInt(data.insc)} icon={Users} color="fmp" />
          <StatCard index={2} label="Matriculas" value={fmtInt(data.mat)} icon={GraduationCap} color="fmp" />
          <StatCard index={3} label="Taxa Paga" value={fmtInt(data.taxaPaga)} icon={DollarSign} color="gray" />
          <StatCard index={4} label="% Conversao" value={fmtPct(data.pctConversao)} icon={DollarSign} color="gray" />
        </div>
      </section>

      <div className="flex flex-col items-center rounded-md border border-line bg-white p-6 shadow-card animate-fade-in">
        <GaugeSemicircle
          value={data.pctMeta}
          label="Mestrado | Meta"
          size={220}
          formatValue={(v) => fmtPct(v)}
          caption={`${fmtInt(data.mat)} / 20 meta`}
        />
      </div>

      <ReorderableGrid storageKey="conv-reorder-mestrado" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RItem rid="insc-processo">
        <SectionCard title="Inscricoes por Processo Seletivo" subtitle="periodo_letivo x Mest_Insc" icon={Users}>
          {data.inscPorProcesso.length === 0 ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, data.inscPorProcesso.length * 32)}>
              <BarChart data={data.inscPorProcesso} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="barProcMest" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtInt(v)} />
                <YAxis type="category" dataKey="categoria" tick={{ fontSize: 10, fill: '#3A3838' }} tickLine={false} axisLine={false} width={160} tickFormatter={(v: string) => truncateLabel(v, 22)} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [`${fmtInt(v as number)} inscricoes`, 'Processo']} />
                <Bar dataKey="valor" fill="url(#barProcMest)" radius={[4, 8, 8, 4]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="status-insc">
        <SectionCard title="Status das Inscricoes" subtitle="statusps x Mest_Insc" icon={Users}>
          {data.statusInscricoes.length === 0 || data.statusInscricoes.every((d) => d.valor === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtInt(v as number), 'Inscricoes']} />
                  <Pie data={data.statusInscricoes} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} stroke="none">
                    {data.statusInscricoes.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1.5">
                {data.statusInscricoes.map((r, i) => {
                  const total = data.statusInscricoes.reduce((s, x) => s + x.valor, 0);
                  const pct = total > 0 ? Math.round((r.valor / total) * 100) : 0;
                  return (
                    <li key={r.categoria} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-ink-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {r.categoria}
                      </span>
                      <span className="font-semibold text-ink">{fmtInt(r.valor)} ({pct}%)</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="leads-canal" className="lg:col-span-2">
        <SectionCard title="Leads Gerados por Canal" subtitle="canal_nome x Mest_Leads - Funil" icon={Radio}>
          {data.leadsPorCanal.length === 0 ? (
            <EmptyState title="Sem dados de canal para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, data.leadsPorCanal.length * 36)}>
              <FunnelChart margin={{ top: 8, right: 180, left: 180, bottom: 8 }}>
                <Tooltip
                  contentStyle={tooltip.contentStyle}
                  labelStyle={tooltip.labelStyle}
                  itemStyle={tooltip.itemStyle}
                  formatter={(v: unknown, _n: unknown, p: { payload?: { categoria?: string } }) => [
                    `${fmtInt(v as number)} leads`,
                    p?.payload?.categoria ?? 'Canal',
                  ]}
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
      </ReorderableGrid>
    </>
  );
}

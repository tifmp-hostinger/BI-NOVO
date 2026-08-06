import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, Users, GraduationCap, DollarSign, BookOpen, Wallet, Percent } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { ReorderableGrid, RItem } from '@/components/ui/ReorderableGrid';
import { StatCard, StatCardSkeleton, STAT_GRID_CLASSES, STAT_GRID_CONTAINER } from '@/components/ui/StatCard';
import { ChartSkeleton } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { BrazilStateMap } from '@/components/maps/BrazilStateMap';
import { fmtBRLCompact, fmtInt, fmtPct, truncateLabel } from '../formatters';
import type { ModalidadePosData } from '../types';
import type { StateAgg } from '@/services/matriculasService';
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
  data: ModalidadePosData | null;
};

export function ModalidadePosTab({ loading, data }: Props) {
  const tooltip = tt();
  const [selectedUf, setSelectedUf] = useState<string | null>(null);

  if (loading) {
    return (
      <>
        <section className={STAT_GRID_CONTAINER}>
          <div className={STAT_GRID_CLASSES}>
            {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} index={i} />)}
          </div>
        </section>
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <ChartSkeleton key={i} height={320} />)}
        </section>
      </>
    );
  }

  if (!data) return null;

  const mapData: StateAgg[] = data.fatPorEstado.map((e) => ({
    uf: e.uf,
    total: Math.round(e.total),
    pos: 0,
    livres: 0,
    matriculados: 0,
    faturado: e.total,
    ticket: 0,
    region: '',
  }));

  return (
    <>
      <section className={STAT_GRID_CONTAINER}>
        <div className={STAT_GRID_CLASSES}>
          <StatCard index={0} label="Leads" value={fmtInt(data.leads)} icon={Users} color="fmp" highlight />
          <StatCard index={1} label="Inscricoes" value={fmtInt(data.insc)} icon={Users} color="fmp" />
          <StatCard index={2} label="Matriculas" value={fmtInt(data.mat)} icon={GraduationCap} color="fmp" />
          <StatCard index={3} label="Com TCC" value={fmtInt(data.comTcc)} icon={BookOpen} color="gray" />
          <StatCard index={4} label="Sem TCC" value={fmtInt(data.semTcc)} icon={BookOpen} color="gray" />
          <StatCard index={5} label="Faturamento" value={fmtBRLCompact(data.fat)} icon={DollarSign} color="fmp" />
          <StatCard index={6} label="Ticket Medio" value={fmtBRLCompact(data.tktMedio)} icon={Wallet} color="gray" />
          <StatCard index={7} label="Desc. Medio" value={fmtPct(data.descontoMedio)} icon={Percent} color="gray" />
        </div>
      </section>

      <ReorderableGrid storageKey={`conv-reorder-pos-${data.modalidade === 'Pós EAD' ? 'ead' : 'presencial'}`} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RItem rid="fat-curso">
        <SectionCard title={`Faturamento por Curso - ${data.modalidade}`} subtitle="cursoreduzido x faturamento" icon={DollarSign}>
          {data.fatPorCurso.length === 0 || data.fatPorCurso.every((d) => d.valor === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, Math.min(data.fatPorCurso.length, 15) * 28)}>
              <BarChart data={data.fatPorCurso.slice(0, 15)} layout="vertical" margin={{ top: 4, right: 80, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id={`barCurso${data.modalidade}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#DEDCD4" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtBRLCompact(v)} />
                <YAxis type="category" dataKey="categoria" tick={{ fontSize: 10, fill: '#3A3838' }} tickLine={false} axisLine={false} width={180} tickFormatter={(v: string) => truncateLabel(v, 24)} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtBRLCompact(v as number), 'Faturamento']} />
                <Bar dataKey="valor" fill={`url(#barCurso${data.modalidade})`} radius={[4, 8, 8, 4]} maxBarSize={24}>
                  <LabelList dataKey="valor" position="right" formatter={(v: unknown) => fmtBRLCompact(v as number)} style={{ fontSize: 10, fill: '#3A3838', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="top-descontos">
        <SectionCard title="TOP Descontos com Maior Faturamento" subtitle="bolsas x Espec_Fat" icon={TrendingUp}>
          {data.topDescontosFat.length === 0 || data.topDescontosFat.every((d) => d.valor === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, Math.min(data.topDescontosFat.length, 10) * 28)}>
              <BarChart data={data.topDescontosFat.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 80, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id={`barDesc${data.modalidade}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#DEDCD4" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtBRLCompact(v)} />
                <YAxis type="category" dataKey="categoria" tick={{ fontSize: 10, fill: '#3A3838' }} tickLine={false} axisLine={false} width={180} tickFormatter={(v: string) => truncateLabel(v, 24)} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtBRLCompact(v as number), 'Faturamento']} />
                <Bar dataKey="valor" fill={`url(#barDesc${data.modalidade})`} radius={[4, 8, 8, 4]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="planos-pgto">
        <SectionCard title="TOP 5 Planos de Pagamento" subtitle="codplanopgto x Espec_Fat" icon={Wallet}>
          {data.top5PlanosPgto.length === 0 || data.top5PlanosPgto.every((d) => d.valor === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtBRLCompact(v as number), '']} />
                  <Pie data={data.top5PlanosPgto} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} stroke="none">
                    {data.top5PlanosPgto.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1.5">
                {data.top5PlanosPgto.map((r, i) => {
                  const total = data.top5PlanosPgto.reduce((s, x) => s + x.valor, 0);
                  const pct = total > 0 ? Math.round((r.valor / total) * 100) : 0;
                  return (
                    <li key={r.categoria} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-ink-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {r.categoria}
                      </span>
                      <span className="font-semibold text-ink">{fmtBRLCompact(r.valor)} ({pct}%)</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="mapa-estado">
        <SectionCard title={`Faturamento por Estado - ${data.modalidade}`} subtitle="Intensidade de vermelho = faturamento" icon={TrendingUp}>
          {mapData.length === 0 ? (
            <EmptyState title="Sem dados de estado para os filtros selecionados" />
          ) : (
            <BrazilStateMap
              data={mapData}
              selectedUf={selectedUf}
              onSelect={setSelectedUf}
              height={420}
              metricFormat="currency"
              metricLabel="em faturamento"
            />
          )}
        </SectionCard>
        </RItem>
      </ReorderableGrid>
    </>
  );
}

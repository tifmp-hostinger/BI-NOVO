import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GraduationCap, Users, TrendingUp } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { ReorderableGrid, RItem } from '@/components/ui/ReorderableGrid';
import { StatCard, StatCardSkeleton, STAT_GRID_CLASSES, STAT_GRID_CONTAINER } from '@/components/ui/StatCard';
import { GaugeSemicircle } from '@/components/ui/GaugeSemicircle';
import { ChartSkeleton } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtInt, fmtPct, truncateLabel } from '../formatters';
import type { GraduacaoData } from '../types';
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
  data: GraduacaoData | null;
};

export function GraduacaoTab({ loading, data }: Props) {
  const tooltip = tt();

  if (loading) {
    return (
      <>
        <section className={STAT_GRID_CONTAINER}>
          <div className={STAT_GRID_CLASSES}>
            {Array.from({ length: 7 }).map((_, i) => <StatCardSkeleton key={i} index={i} />)}
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
          <StatCard index={1} label="Inscricoes" value={fmtInt(data.insc)} icon={Users} color="fmp" />
          <StatCard index={2} label="Mat. Efetivas" value={fmtInt(data.matEfet)} icon={GraduationCap} color="fmp" />
          <StatCard index={3} label="Vagas" value={fmtInt(data.vagas)} icon={TrendingUp} color="gray" />
          <StatCard index={4} label="Mat. Canceladas" value={fmtInt(data.matCanc)} icon={TrendingUp} color="gray" />
          <StatCard index={5} label="%Conv Insc/Leads" value={fmtPct(data.pctConvIxL)} icon={TrendingUp} color="gray" />
          <StatCard index={6} label="%Conv Mat/Insc" value={fmtPct(data.pctConvMxI)} icon={TrendingUp} color="gray" />
        </div>
      </section>

      <div className="flex flex-col items-center rounded-md border border-line bg-white p-6 shadow-card animate-fade-in">
        <GaugeSemicircle
          value={data.pctMeta}
          label="Graduacao | Meta"
          size={220}
          formatValue={(v) => fmtPct(v)}
          caption={`${fmtInt(data.matEfet)} / ${fmtInt(data.vagas)} vagas`}
        />
      </div>

      <ReorderableGrid storageKey="conv-reorder-graduacao" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RItem rid="pgt-bolsas">
        <SectionCard title="Matriculas Pagantes x Bolsistas" subtitle="Grad_Mat_Pgt vs Grad_Mat_Bolsas" icon={GraduationCap}>
          {data.pgtVsBolsas.every((d) => d.valor === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.pgtVsBolsas} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="barPgtBolsa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="categoria" tick={{ fontSize: 12, fill: '#3A3838' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtInt(v as number), 'Matriculas']} />
                <Bar dataKey="valor" fill="url(#barPgtBolsa)" radius={[8, 8, 4, 4]} maxBarSize={80} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="insc-turno">
        <SectionCard title="Inscricoes por Turno" subtitle="areainteresse x Grad_Insc" icon={Users}>
          {data.inscPorTurno.length === 0 || data.inscPorTurno.every((d) => d.valor === 0) ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [fmtInt(v as number), 'Inscricoes']} />
                <Pie data={data.inscPorTurno} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3} stroke="none" label={(entry: unknown) => { const e = entry as { categoria?: string; valor?: number }; return `${e.categoria ?? ''}: ${fmtInt(e.valor ?? 0)}`; }} labelLine={false}>
                  {data.inscPorTurno.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="insc-processo">
        <SectionCard title="Inscricoes por Processo Seletivo" subtitle="processoseletivo x Grad_Insc" icon={Users}>
          {data.inscPorProcesso.length === 0 ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, data.inscPorProcesso.length * 28)}>
              <BarChart data={data.inscPorProcesso} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="barProcGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtInt(v)} />
                <YAxis type="category" dataKey="categoria" tick={{ fontSize: 10, fill: '#3A3838' }} tickLine={false} axisLine={false} width={180} tickFormatter={(v: string) => truncateLabel(v, 26)} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [`${fmtInt(v as number)} inscricoes`, 'Processo']} />
                <Bar dataKey="valor" fill="url(#barProcGrad)" radius={[4, 8, 8, 4]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="mat-ingresso">
        <SectionCard title="Matriculas por Tipo de Ingresso" subtitle="tipoingresso x Grad_Mat_Efet" icon={GraduationCap}>
          {data.matPorTipoIngresso.length === 0 ? (
            <EmptyState title="Sem dados para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, data.matPorTipoIngresso.length * 28)}>
              <BarChart data={data.matPorTipoIngresso} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="barIngresso" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtInt(v)} />
                <YAxis type="category" dataKey="categoria" tick={{ fontSize: 10, fill: '#3A3838' }} tickLine={false} axisLine={false} width={180} tickFormatter={(v: string) => truncateLabel(v, 26)} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [`${fmtInt(v as number)} matriculas`, 'Ingresso']} />
                <Bar dataKey="valor" fill="url(#barIngresso)" radius={[4, 8, 8, 4]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        </RItem>

        <RItem rid="mat-dia" className="lg:col-span-2">
      <SectionCard title="Matriculas por Dia" subtitle="datamatricula x Grad_Mat_Efet" icon={TrendingUp}>
        {data.matPorDia.length === 0 ? (
          <EmptyState title="Sem dados para os filtros selecionados" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.matPorDia} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="barDia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <XAxis dataKey="data" tick={{ fontSize: 9, fill: '#6E6B66' }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(8) + '/' + v.slice(5, 7)} interval={Math.max(0, Math.floor(data.matPorDia.length / 12))} />
              <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} formatter={(v: unknown) => [`${fmtInt(v as number)} matriculas`, 'Dia']} />
              <Bar dataKey="valor" fill="url(#barDia)" radius={[4, 4, 2, 2]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
        </RItem>
      </ReorderableGrid>
    </>
  );
}

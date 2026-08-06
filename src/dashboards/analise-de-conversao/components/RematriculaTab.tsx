import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, RefreshCw, RotateCcw } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { ReorderableGrid, RItem } from '@/components/ui/ReorderableGrid';
import { ChartSkeleton } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import type { RematriculaData } from '../types';

const FMP_RED = '#EE2A42';
const FMP_DARK = '#B81E32';
const SAND = '#D8D5C8';
const STONE = '#BFBAA4';
const CLAY = '#A89B8C';

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
  data: RematriculaData | null;
};

export function RematriculaTab({ loading, data }: Props) {
  const tooltip = tt();

  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => <ChartSkeleton key={i} height={360} />)}
      </section>
    );
  }

  if (!data) return null;

  const evasaoEmpty = data.evasaoPorPeriodo.every(
    (d) => d.evJubilado === 0 && d.evEvadido === 0 && d.evCancelado === 0 && d.evTransferido === 0,
  );
  const reingressoEmpty = data.reingressoPorPeriodo.every(
    (d) => d.reingressoConf === 0 && d.reingressoAguard === 0,
  );
  const rematEmpty = data.rematriculaPorPeriodo.every(
    (d) => d.rematConf === 0 && d.rematNaoRealiz === 0,
  );

  return (
    <>
      <ReorderableGrid storageKey="conv-reorder-rematricula" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RItem rid="evasao">
        <SectionCard
          title="Rematricula - Composicao (Evasao)"
          subtitle="Colunas agrupadas por Periodo Letivo"
          icon={TrendingDown}
        >
          {evasaoEmpty ? (
            <EmptyState title="Sem dados de evasao para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={data.evasaoPorPeriodo} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(238,42,66,0.05)' }} contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} />
                <Legend verticalAlign="bottom" iconType="circle" formatter={(v: string) => { const labels: Record<string, string> = { evJubilado: 'Jubilado', evEvadido: 'Evadido', evCancelado: 'Cancelado', evTransferido: 'Transferido' }; return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>; }} />
                <Bar dataKey="evCancelado" stackId="a" fill={FMP_RED} radius={[0, 0, 0, 0]} maxBarSize={48} />
                <Bar dataKey="evEvadido" stackId="a" fill={CLAY} radius={[0, 0, 0, 0]} maxBarSize={48} />
                <Bar dataKey="evJubilado" stackId="a" fill={STONE} radius={[0, 0, 0, 0]} maxBarSize={48} />
                <Bar dataKey="evTransferido" stackId="a" fill={SAND} radius={[8, 8, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="reingresso">
        <SectionCard
          title="Reingresso - Comportamento"
          subtitle="Colunas: Confirmadas | Linha: Aguardando"
          icon={RefreshCw}
        >
          {reingressoEmpty ? (
            <EmptyState title="Sem dados de reingresso para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={data.reingressoPorPeriodo} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="barReingresso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} />
                <Legend verticalAlign="bottom" iconType="circle" formatter={(v: string) => { const labels: Record<string, string> = { reingressoConf: 'Confirmadas', reingressoAguard: 'Aguardando' }; return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>; }} />
                <Bar yAxisId="left" dataKey="reingressoConf" fill="url(#barReingresso)" radius={[8, 8, 4, 4]} maxBarSize={48} />
                <Line yAxisId="right" type="monotone" dataKey="reingressoAguard" stroke={STONE} strokeWidth={2.5} dot={{ r: 4, fill: STONE }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        </RItem>
        <RItem rid="rematricula">
        <SectionCard
          title="Rematricula - Composicao"
          subtitle="Colunas: Confirmada | Linha: Nao Realizada"
          icon={RotateCcw}
        >
          {rematEmpty ? (
            <EmptyState title="Sem dados de rematricula para os filtros selecionados" />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={data.rematriculaPorPeriodo} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="barRemat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltip.contentStyle} labelStyle={tooltip.labelStyle} itemStyle={tooltip.itemStyle} />
                <Legend verticalAlign="bottom" iconType="circle" formatter={(v: string) => { const labels: Record<string, string> = { rematConf: 'Confirmada', rematNaoRealiz: 'Nao Realizada' }; return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>; }} />
                <Bar yAxisId="left" dataKey="rematConf" fill="url(#barRemat)" radius={[8, 8, 4, 4]} maxBarSize={48} />
                <Line yAxisId="right" type="monotone" dataKey="rematNaoRealiz" stroke={STONE} strokeWidth={2.5} dot={{ r: 4, fill: STONE }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        </RItem>
      </ReorderableGrid>
    </>
  );
}

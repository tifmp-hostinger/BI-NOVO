import { useMemo } from 'react';
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
import {
  BookOpen,
  Building2,
  ChevronRight,
  GraduationCap,
  MapPin,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { StateDetail } from '@/services/matriculasService';
import { nameOf, regionOf } from '@/lib/brStates';
import { CORES_CATEGORICAS } from '@/lib/chartColors';

type Props = {
  uf: string | null;
  detail: StateDetail | null;
  onClose: () => void;
};

const SITU_COLORS = CORES_CATEGORICAS;

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function fmtInt(v: number) {
  return v.toLocaleString('pt-BR');
}

export function StateDetailPanel({ uf, detail, onClose }: Props) {
  const tt = useMemo(
    () => ({
      contentStyle: {
        background: 'rgba(255,255,255,0.98)',
        border: '1px solid #DEDCD4',
        borderRadius: 12,
        boxShadow: '0 18px 40px rgba(25,24,24,0.12)',
        padding: 10,
        fontSize: 12,
      } as const,
      labelStyle: { color: '#191818', fontWeight: 600, fontSize: 12 } as const,
      itemStyle: { color: '#3A3838', fontSize: 12 } as const,
    }),
    []
  );

  if (!uf || !detail) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed border-line bg-white p-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse-ring rounded-full bg-fmp/20" />
          <div className="relative rounded-full bg-fmp-muted p-4 text-fmp">
            <MapPin className="h-6 w-6" strokeWidth={2.2} />
          </div>
        </div>
        <h4
          className="mt-5 text-sm text-ink"
          style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
        >
          Selecione um estado no mapa
        </h4>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-3">
          Clique em qualquer marcador para ver o detalhamento dinamico com
          cursos, cidades, situacoes e faturamento.
        </p>
      </div>
    );
  }

  const region = regionOf(uf);
  const name = nameOf(uf);
  const cursosMax = detail.cursos[0]?.value ?? 1;

  return (
    <div
      key={uf}
      className="relative overflow-hidden rounded-md border border-line bg-white shadow-card animate-slide-right"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-fmp" />

      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="fmp-eyebrow text-2xs">{region}</span>
            <span className="h-1 w-1 rounded-full bg-sand" />
            <span className="text-2xs font-medium text-ink-3">{uf}</span>
          </div>
          <h3
            className="mt-1 text-lg text-ink"
            style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
          >
            {name}
          </h3>
          <p className="text-xs text-ink-3">
            Detalhamento dinamico das matriculas
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-3 transition hover:bg-paper hover:text-fmp"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3">
          <MicroStat
            icon={Users}
            label="Matriculas"
            value={fmtInt(detail.total)}
            color="fmp"
          />
          <MicroStat
            icon={GraduationCap}
            label="Pos-graduacao"
            value={fmtInt(detail.pos)}
            color="info"
          />
          <MicroStat
            icon={BookOpen}
            label="Cursos livres"
            value={fmtInt(detail.livres)}
            color="warning"
          />
          <MicroStat
            icon={Wallet}
            label="Faturamento"
            value={fmtBRL(detail.faturado)}
            color="success"
          />
        </div>

        <MetricStrip
          label="Ticket medio"
          value={fmtBRL(detail.ticketMedio)}
          secondary={`${fmtInt(detail.matriculados)} matriculados ativos`}
        />

        {detail.cursos.length > 0 && (
          <Section title="Top cursos" icon={GraduationCap}>
            <ul className="space-y-2">
              {detail.cursos.map((c, i) => {
                const pct = Math.round((c.value / cursosMax) * 100);
                return (
                  <li
                    key={c.name}
                    className="rounded-sm border border-line bg-paper p-3 animate-slide-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="line-clamp-1 text-xs font-semibold text-ink">
                        {c.name}
                      </p>
                      <span className="flex-shrink-0 text-2xs font-semibold text-fmp">
                        {c.value}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-white">
                      <div
                        className="h-full rounded-pill bg-fmp transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {c.faturado > 0 && (
                      <p className="mt-1 text-2xs text-ink-3">
                        {fmtBRL(c.faturado)} faturado
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {detail.cidades.length > 0 && (
          <Section title="Top cidades" icon={Building2}>
            <ul className="grid grid-cols-1 gap-1.5">
              {detail.cidades.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between rounded-sm border border-line bg-paper px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2 text-ink-2">
                    <ChevronRight className="h-3 w-3 text-fmp" />
                    <span className="line-clamp-1">{c.name}</span>
                  </span>
                  <span
                    className="font-semibold text-ink"
                    style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic' }}
                  >
                    {fmtInt(c.value)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {detail.situacoes.length > 0 && (
          <Section title="Situacoes de matricula">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Tooltip
                  contentStyle={tt.contentStyle}
                  itemStyle={tt.itemStyle}
                  formatter={(v: unknown) => [`${v}`, 'matriculas']}
                />
                <Pie
                  data={detail.situacoes}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="none"
                >
                  {detail.situacoes.map((_, i) => (
                    <Cell key={i} fill={SITU_COLORS[i % SITU_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 space-y-1">
              {detail.situacoes.slice(0, 5).map((s, i) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between text-2xs"
                >
                  <span className="flex items-center gap-2 text-ink-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: SITU_COLORS[i % SITU_COLORS.length],
                      }}
                    />
                    <span className="line-clamp-1">{s.name}</span>
                  </span>
                  <span className="font-semibold text-ink">
                    {fmtInt(s.value)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {detail.modalidades.length > 0 && (
          <Section title="Modalidade / Nivel">
            <ResponsiveContainer width="100%" height={Math.max(120, detail.modalidades.length * 28)}>
              <BarChart
                data={detail.modalidades}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="barModDet" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#EE2A42" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#B81E32" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <XAxis
                  type="number"
                  hide
                  tick={{ fontSize: 10, fill: '#6E6B66' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#3A3838' }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(238,42,66,0.05)' }}
                  contentStyle={tt.contentStyle}
                  itemStyle={tt.itemStyle}
                  formatter={(v: unknown) => [`${v}`, 'matriculas']}
                />
                <Bar
                  dataKey="value"
                  fill="url(#barModDet)"
                  radius={[4, 8, 8, 4]}
                  maxBarSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {detail.amostraAlunos.length > 0 && (
          <Section title="Amostra de alunos" icon={Users}>
            <ul className="divide-y divide-line rounded-sm border border-line bg-paper">
              {detail.amostraAlunos.map((a, i) => (
                <li
                  key={`${a.ra}-${i}`}
                  className="px-3 py-2 text-2xs"
                >
                  <p className="line-clamp-1 font-semibold text-ink">
                    {a.aluno || 'Aluno sem nome'}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-ink-3">
                    {a.curso}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sand">
                    <span>{a.cidade || '—'}</span>
                    <span className="h-1 w-1 rounded-full bg-sand" />
                    <span className="line-clamp-1">{a.situacao || '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-2 flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-fmp" strokeWidth={2.4} />}
        <h4 className="text-2xs font-semibold uppercase tracking-widest text-ink-3">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function MicroStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  color: 'fmp' | 'info' | 'success' | 'warning';
}) {
  const styles: Record<typeof color, { bg: string; text: string }> = {
    fmp: { bg: 'bg-fmp-muted', text: 'text-fmp' },
    info: { bg: 'bg-info-light', text: 'text-info-dark' },
    success: { bg: 'bg-success-light', text: 'text-success-dark' },
    warning: { bg: 'bg-warning-light', text: 'text-warning-dark' },
  };
  const s = styles[color];
  return (
    <div className="rounded-sm border border-line bg-paper p-3">
      <div className={`inline-flex rounded-sm p-1.5 ${s.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${s.text}`} strokeWidth={2.4} />
      </div>
      <p className="mt-2 text-2xs font-medium uppercase tracking-wider text-ink-3">
        {label}
      </p>
      <p
        className="mt-0.5 text-base text-ink"
        style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
      >
        {value}
      </p>
    </div>
  );
}

function MetricStrip({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-fmp/20 bg-fmp-muted p-4">
      <div>
        <p className="text-2xs font-semibold uppercase tracking-widest text-fmp">
          {label}
        </p>
        <p
          className="mt-0.5 text-xl text-ink"
          style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
        >
          {value}
        </p>
      </div>
      {secondary && (
        <p className="max-w-[45%] text-right text-2xs leading-tight text-ink-3">
          {secondary}
        </p>
      )}
    </div>
  );
}

import { Award, BookMarked, GraduationCap, TrendingUp, Users } from 'lucide-react';
import { GaugeSemicircle } from '@/components/ui/GaugeSemicircle';
import { BlockCard } from './BlockCard';
import { KpiRow } from './KpiRow';
import { fmtInt, fmtPercent } from '../formatters';
import type { GraduacaoKpis, PeriodoLetivo } from '../types';

type Props = {
  title: string;
  subtitle?: string;
  kpis: GraduacaoKpis | null;
  pletivos: PeriodoLetivo[];
  periodo: string;
  onPeriodoChange: (periodo: string) => void;
  loading?: boolean;
};

export function GraduacaoBlock({
  title,
  subtitle,
  kpis,
  pletivos,
  periodo,
  onPeriodoChange,
  loading,
}: Props) {
  const opcoes = pletivos
    .filter((p) => /^\d{2}-\d{2}$/.test(p.periodo))
    .map((p) => p.periodo);

  return (
    <BlockCard
      title={title}
      subtitle={subtitle}
      icon={GraduationCap}
      actions={
        <label className="flex items-center gap-2 rounded-pill border border-line bg-white px-3 py-1.5 text-2xs font-semibold text-ink-2">
          <span className="text-ink-3">Periodo</span>
          <select
            value={periodo}
            onChange={(e) => onPeriodoChange(e.target.value)}
            className="rounded-pill bg-transparent text-2xs font-semibold text-fmp focus:outline-none"
          >
            {opcoes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      }
      footer={
        kpis?.processoFinalizado ? 'OBS.: Processo Seletivo Finalizado' : null
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 flex items-center justify-center">
          <GaugeSemicircle
            value={loading ? null : kpis?.percentualMeta ?? null}
            label="% Meta"
            caption={
              kpis
                ? `${fmtInt(kpis.matriculas)} de ${fmtInt(kpis.vagas)} vagas`
                : undefined
            }
          />
        </div>
        <div className="lg:col-span-3">
          <KpiRow
            label="Vagas"
            value={kpis ? fmtInt(kpis.vagas) : '—'}
            icon={Award}
            tone="accent"
          />
          <KpiRow
            label="Leads (Rubeus)"
            value={kpis ? fmtInt(kpis.leads) : '—'}
            icon={Users}
          />
          <KpiRow
            label="Inscricoes"
            value={kpis ? fmtInt(kpis.inscricoes) : '—'}
            icon={BookMarked}
            hint={
              kpis
                ? `${fmtInt(kpis.inscricoesLead)} presentes em leads`
                : undefined
            }
          />
          <KpiRow
            label="Matriculas"
            value={kpis ? fmtInt(kpis.matriculas) : '—'}
            icon={GraduationCap}
            tone="success"
          />
          <KpiRow
            label="% Conversao"
            value={kpis ? fmtPercent(kpis.conversao) : '—'}
            icon={TrendingUp}
            tone={
              kpis && kpis.conversao !== null && kpis.conversao >= 0.5
                ? 'success'
                : 'warning'
            }
            hint="Matriculas / Inscricoes presentes em leads"
          />
        </div>
      </div>
    </BlockCard>
  );
}

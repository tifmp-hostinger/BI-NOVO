import { Award, BookMarked, GraduationCap, ScrollText, TrendingUp, Users } from 'lucide-react';
import { GaugeSemicircle } from '@/components/ui/GaugeSemicircle';
import { BlockCard } from './BlockCard';
import { KpiRow } from './KpiRow';
import { fmtInt, fmtPercent } from '../formatters';
import type { MestradoKpis } from '../types';

type Props = {
  kpis: MestradoKpis | null;
  anos: number[];
  ano: number;
  onAnoChange: (ano: number) => void;
  loading?: boolean;
};

export function MestradoBlock({ kpis, anos, ano, onAnoChange, loading }: Props) {
  return (
    <BlockCard
      title="Mestrado"
      subtitle="Funil por ano academico"
      icon={ScrollText}
      actions={
        <label className="flex items-center gap-2 rounded-pill border border-line bg-white px-3 py-1.5 text-2xs font-semibold text-ink-2">
          <span className="text-ink-3">Ano</span>
          <select
            value={ano}
            onChange={(e) => onAnoChange(Number(e.target.value))}
            className="rounded-pill bg-transparent text-2xs font-semibold text-fmp focus:outline-none"
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 flex items-center justify-center">
          <GaugeSemicircle
            value={loading ? null : kpis?.percentualMeta ?? null}
            label="% Meta"
            caption={
              kpis
                ? `${fmtInt(kpis.matriculas)} novas / meta ${fmtInt(kpis.meta)}`
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
            label="Meta"
            value={kpis ? fmtInt(kpis.meta) : '—'}
            icon={Award}
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
          />
          <KpiRow
            label="Matriculas"
            value={kpis ? fmtInt(kpis.matriculas) : '—'}
            icon={GraduationCap}
            tone="success"
            hint={
              kpis
                ? `${fmtInt(kpis.matriculasQualificadas)} qualificadas`
                : undefined
            }
          />
          <KpiRow
            label="% Conversao Inscritos"
            value={kpis ? fmtPercent(kpis.conversao) : '—'}
            icon={TrendingUp}
            tone={
              kpis && kpis.conversao !== null && kpis.conversao >= 0.6
                ? 'success'
                : 'warning'
            }
            hint="Regra Power BI: qualificadas / matriculas"
          />
        </div>
      </div>
    </BlockCard>
  );
}

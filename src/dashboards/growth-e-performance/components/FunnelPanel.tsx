import { fmtBRLCompact, fmtInt, fmtPct } from '../../analise-de-conversao/formatters';
import type { MediaMetrics, NegocioMetrics } from '../types';

function fmtOrDash(v: number | null, fmt: (n: number) => string): string {
  return v === null ? '--' : fmt(v);
}

/**
 * Painel direito: funil vertical Investimento → Leads → Inscritos →
 * Matrículas → Cancelados, com as métricas de mídia abaixo.
 */
export function FunnelPanel({ media, negocio }: { media: MediaMetrics; negocio: NegocioMetrics }) {
  const etapas = [
    { label: 'Investimento', valor: fmtBRLCompact(media.investimento), width: 'w-full' },
    { label: 'Leads', valor: fmtInt(media.leads), width: 'w-[88%]' },
    { label: 'Inscritos', valor: fmtInt(negocio.inscritos), width: 'w-[74%]' },
    { label: 'Matrículas', valor: fmtInt(negocio.matriculas), width: 'w-[60%]' },
    { label: 'Cancelados', valor: fmtInt(negocio.cancelamentos), width: 'w-[46%]' },
  ];

  const midia = [
    { label: 'Impressões', valor: fmtInt(media.impressoes) },
    { label: 'Alcance', valor: media.alcance === null ? '--' : fmtInt(media.alcance) },
    { label: 'Frequência', valor: fmtOrDash(media.frequencia, (n) => n.toFixed(2)) },
    { label: 'Clicks', valor: fmtInt(media.clicks) },
    { label: 'CTR', valor: fmtOrDash(media.ctr, fmtPct) },
    { label: 'CPC', valor: fmtOrDash(media.cpc, fmtBRLCompact) },
  ];

  return (
    <div className="rounded-md border border-line bg-white p-5 shadow-card animate-fade-in">
      <h3
        className="mb-4 text-sm font-semibold text-ink"
        style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic', fontWeight: 600 }}
      >
        Funil de Captação
      </h3>
      <div className="flex flex-col items-center gap-1.5">
        {etapas.map((e, i) => (
          <div key={e.label} className={`${e.width} min-w-[140px]`}>
            <div
              className="flex flex-col items-center rounded-md px-3 py-2 text-center"
              style={{
                background: `rgba(238,42,66,${(0.95 - i * 0.16).toFixed(2)})`,
              }}
            >
              <span className="text-2xs font-medium uppercase tracking-widest text-white/85">{e.label}</span>
              <span
                className="text-base font-semibold text-white"
                style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic' }}
              >
                {e.valor}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-3">
        {midia.map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-2xs font-medium uppercase tracking-widest text-ink-3">{m.label}</p>
            <p
              className="mt-0.5 text-sm font-semibold text-ink"
              style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic' }}
            >
              {m.valor}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

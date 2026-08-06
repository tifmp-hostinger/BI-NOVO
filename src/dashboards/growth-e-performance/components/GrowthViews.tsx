import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { ArrowUpDown } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { BrazilStateMap } from '@/components/maps/BrazilStateMap';
import type { StateAgg } from '@/services/matriculasService';
import { fmtBRLCompact, fmtInt, fmtPct, truncateLabel } from '../../analise-de-conversao/formatters';
import type {
  CampanhaRow,
  HorarioDatum,
  MapaUfDatum,
  OrigemData,
  OrigemDatum,
  SerieMensalDatum,
} from '../types';

const FMP_RED = '#EE2A42';
const FMP_DARK = '#B81E32';
const NEUTRAL = '#BFBAA4';

const TT = {
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

type ColunaCampanha = 'campanha' | 'plataforma' | 'leads' | 'investimento' | 'impressoes';

const COLUNAS_CAMPANHA: { id: ColunaCampanha; label: string; numerica: boolean }[] = [
  { id: 'campanha', label: 'Campanha', numerica: false },
  { id: 'plataforma', label: 'Plataforma', numerica: false },
  { id: 'leads', label: 'Leads', numerica: true },
  { id: 'investimento', label: 'Investimento', numerica: true },
  { id: 'impressoes', label: 'Impressões', numerica: true },
];

export function CampanhasView({ rows }: { rows: CampanhaRow[] }) {
  // Ordenação clicável: a tabela chega ordenada por investimento, mas comparar
  // campanhas por leads ou impressões exigia exportar para outro lugar.
  const [ordem, setOrdem] = useState<{ col: ColunaCampanha; desc: boolean }>({
    col: 'investimento',
    desc: true,
  });

  const ordenadas = useMemo(() => {
    const copia = [...rows];
    const { col, desc } = ordem;
    copia.sort((a, b) => {
      const va = a[col];
      const vb = b[col];
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR');
      return desc ? -cmp : cmp;
    });
    return copia;
  }, [rows, ordem]);

  if (rows.length === 0) return <EmptyState title="Sem campanhas para os filtros selecionados" />;

  const alternar = (col: ColunaCampanha) =>
    setOrdem((o) => (o.col === col ? { col, desc: !o.desc } : { col, desc: true }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line text-left text-2xs font-semibold uppercase tracking-widest text-ink-3">
            {COLUNAS_CAMPANHA.map((c) => {
              const ativa = ordem.col === c.id;
              return (
                <th key={c.id} className={`px-3 py-2 ${c.numerica ? 'text-right' : ''}`} aria-sort={ativa ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => alternar(c.id)}
                    title={`Ordenar por ${c.label}`}
                    className={`inline-flex items-center gap-1 uppercase tracking-widest transition hover:text-fmp ${
                      ativa ? 'text-fmp' : ''
                    } ${c.numerica ? 'flex-row-reverse' : ''}`}
                  >
                    {c.label}
                    <ArrowUpDown className={`h-3 w-3 ${ativa ? 'opacity-100' : 'opacity-30'}`} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((r) => (
            <tr
              key={`${r.plataforma}-${r.campanha}`}
              className="border-b border-line/60 text-ink-2 transition-colors hover:bg-paper"
            >
              <td className="max-w-[340px] truncate px-3 py-2" title={r.campanha}>{r.campanha}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold ${
                    r.plataforma === 'Google' ? 'bg-paper text-ink-2' : 'bg-fmp-muted text-fmp'
                  }`}
                >
                  {r.plataforma}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-semibold text-ink" title={fmtInt(r.leads)}>
                {fmtInt(r.leads)}
              </td>
              <td
                className="px-3 py-2 text-right"
                title={r.investimento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              >
                {fmtBRLCompact(r.investimento)}
              </td>
              <td className="px-3 py-2 text-right">{fmtInt(r.impressoes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-2xs text-ink-3">
        {ordenadas.length} campanha{ordenadas.length === 1 ? '' : 's'} · clique num cabeçalho para reordenar
      </p>
    </div>
  );
}

export function MapaView({ data }: { data: MapaUfDatum[] }) {
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  if (data.length === 0) {
    return (
      <EmptyState title="Não há investimento em Google Ads para os filtros selecionados. O mapa considera apenas o Google, única fonte com dado geográfico." />
    );
  }
  // Dupla codificação do esriVisual do BI: tamanho = investimento (métrica
  // principal), cor = conversões. `total` carrega o investimento e
  // `matriculados` transporta as conversões para o colorValue/tooltip.
  const mapData: StateAgg[] = data.map((d) => ({
    uf: d.uf,
    total: d.investimento,
    pos: 0,
    livres: 0,
    matriculados: d.conversoes,
    faturado: d.investimento,
    ticket: 0,
    region: '',
  }));
  return (
    <div>
      {/* HERANÇA §7.10: só Google — Meta não tem dimensão de estado no BI. */}
      <BrazilStateMap
        data={mapData}
        selectedUf={selectedUf}
        onSelect={setSelectedUf}
        height={420}
        metricLabel="em investimento"
        metricFormat="currency"
        colorValue={(agg) => agg.matriculados}
        secondaryLine={(agg) =>
          `${agg.matriculados.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} conversões`
        }
      />
      <p className="mt-2 text-2xs text-ink-3">
        Investimento por UF (tamanho da bolha) e conversões (intensidade de cor) — somente Google Ads
        (o Meta não entra no mapa, como no BI original).
      </p>
    </div>
  );
}

export function HorariosView({ data }: { data: HorarioDatum[] }) {
  if (data.every((d) => d.leads === 0)) {
    return <EmptyState title="Sem leads para os filtros selecionados" />;
  }
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="barHorario" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FMP_RED} stopOpacity={0.9} />
            <stop offset="100%" stopColor={FMP_DARK} stopOpacity={0.75} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
        <XAxis dataKey="faixa" tick={{ fontSize: 9, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#6E6B66' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtPct(v)}
        />
        <Tooltip
          contentStyle={TT.contentStyle}
          labelStyle={TT.labelStyle}
          itemStyle={TT.itemStyle}
          formatter={(v: unknown, name: unknown) =>
            name === 'taxaConv'
              ? [v === null ? '--' : fmtPct(v as number), 'Taxa de Conversão']
              : [fmtInt(v as number), 'Leads']
          }
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(v: string) => {
            const labels: Record<string, string> = { leads: 'Quantidade de Leads', taxaConv: 'Taxa de Conversão' };
            return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>;
          }}
        />
        <Bar yAxisId="left" dataKey="leads" fill="url(#barHorario)" radius={[8, 8, 4, 4]} maxBarSize={36} />
        {/* connectNulls={false}: faixas sem lead com status ficam como lacuna,
            em vez de uma linha em 0% que pareceria "converteu zero". */}
        <Line yAxisId="right" type="monotone" dataKey="taxaConv" stroke={NEUTRAL} strokeWidth={2.5} dot={{ r: 3, fill: NEUTRAL }} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Aba Origem — atribuição de primeiro toque.
 * ⚠️ NÃO existe no Power BI: é funcionalidade nova, sem número de referência
 * do BI para comparar. Por isso a aba explica o próprio conceito antes de
 * mostrar qualquer número.
 */
function OrigemLinha({ d, maxPessoas }: { d: OrigemDatum; maxPessoas: number }) {
  const larguraTotal = maxPessoas > 0 ? Math.max(2, (d.pessoas / maxPessoas) * 100) : 0;
  // A parte vermelha é a fração da própria barra que virou matrícula: o
  // comprimento total codifica volume, o preenchido codifica eficiência.
  const fracaoConvertida = d.pessoas > 0 ? (d.matriculas / d.pessoas) * 100 : 0;

  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-xs font-medium text-ink-2" title={d.nome}>
          {d.nome}
        </span>
        <span className="flex-shrink-0 text-2xs text-ink-3">
          <strong className="font-semibold text-ink">{fmtInt(d.pessoas)}</strong> pessoas ·{' '}
          <strong className="font-semibold text-ink">{fmtInt(d.matriculas)}</strong> matrículas ·{' '}
          {d.taxa === null ? (
            '--'
          ) : d.amostraPequena ? (
            <span
              className="text-ink-3"
              title="Poucas pessoas neste canal — a taxa oscila muito e não serve para comparação."
            >
              {fmtPct(d.taxa)} <em className="not-italic">(amostra pequena)</em>
            </span>
          ) : (
            <span className="font-semibold text-fmp">{fmtPct(d.taxa)}</span>
          )}
        </span>
      </div>
      <div className="mt-1 h-2.5 w-full">
        <div
          className="h-full overflow-hidden rounded-full"
          style={{ width: `${larguraTotal}%`, background: NEUTRAL }}
          aria-hidden="true"
        >
          <div className="h-full rounded-full" style={{ width: `${fracaoConvertida}%`, background: FMP_RED }} />
        </div>
      </div>
    </li>
  );
}

export function OrigemView({ data }: { data: OrigemData }) {
  if (data.totalPessoas === 0) {
    return <EmptyState title="Sem pessoas para os filtros selecionados" />;
  }
  const maxPlat = Math.max(...data.porPlataforma.map((d) => d.pessoas), 0);
  const maxCanal = Math.max(...data.porCanal.map((d) => d.pessoas), 0);

  return (
    <div className="space-y-6">
      {/* Texto de abertura — vem ANTES de qualquer número; sem ele a aba é
          indecifrável, já que conta pessoas e não interações. */}
      <p className="rounded-md border border-line bg-paper p-3 text-xs leading-relaxed text-ink-2">
        <strong className="font-semibold text-ink">
          Cada pessoa é contada uma vez, pelo canal em que apareceu pela primeira vez.
        </strong>{' '}
        Se alguém chegou por um anúncio e só se matriculou meses depois, depois de passar por um
        Action Day, o crédito fica com o anúncio. Por isso os números aqui são menores que os das
        outras abas: lá contamos interações, aqui contamos pessoas.
      </p>

      <section>
        <h4
          className="text-xs font-semibold text-ink"
          style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic' }}
          title="O canal em que a pessoa apareceu pela primeira vez no CRM. Toda a jornada dela é creditada a esse canal."
        >
          Por plataforma de mídia
        </h4>
        <p className="mt-0.5 text-2xs text-ink-3">
          <span title="Pessoas distintas, não interações. Alguém com 4 contatos conta 1.">
            {fmtInt(data.totalPessoas)} pessoas
          </span>{' '}
          ·{' '}
          <span title="Percentual de pessoas desse canal que viraram matrícula, em qualquer momento depois.">
            {fmtInt(data.totalMatriculas)} matrículas no total
          </span>
          . <span title="Pessoas que chegaram sem passar por anúncio do Meta ou do Google — inscrição direta, prospecção do time comercial, parcerias ou eventos.">
            &quot;Sem toque de mídia&quot; = nunca passou por anúncio.
          </span>
        </p>
        <ul className="mt-2 divide-y divide-line/60">
          {data.porPlataforma.map((d) => (
            <OrigemLinha key={d.nome} d={d} maxPessoas={maxPlat} />
          ))}
        </ul>
      </section>

      <section>
        <h4
          className="text-xs font-semibold text-ink"
          style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic' }}
        >
          Por canal de origem
        </h4>
        <p className="mt-0.5 text-2xs text-ink-3">
          Ordenado por matrículas — não por taxa, para que canais minúsculos não liderem a lista.
        </p>
        <ul className="mt-2 divide-y divide-line/60">
          {data.porCanal.map((d) => (
            <OrigemLinha key={d.nome} d={d} maxPessoas={maxCanal} />
          ))}
        </ul>
      </section>

      <p className="border-t border-line pt-3 text-2xs text-ink-3">
        Não é possível descer ao nível de campanha individual: o CRM registra a plataforma e a
        página de origem, mas não o identificador da campanha. Para isso seria necessário marcar as
        landing pages com UTM.
      </p>
    </div>
  );
}

export function SerieMensalView({ data, label }: { data: SerieMensalDatum[]; label: string }) {
  if (data.length === 0 || data.every((d) => d.valor === 0 && d.investimento === 0)) {
    return <EmptyState title="Sem dados para os filtros selecionados" />;
  }
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#DEDCD4" />
        <XAxis
          dataKey="mesAno"
          tick={{ fontSize: 9, fill: '#6E6B66' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => truncateLabel(v, 12)}
          interval="preserveStartEnd"
        />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6E6B66' }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#6E6B66' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtBRLCompact(v)}
        />
        <Tooltip
          contentStyle={TT.contentStyle}
          labelStyle={TT.labelStyle}
          itemStyle={TT.itemStyle}
          formatter={(v: unknown, name: unknown) =>
            name === 'investimento' ? [fmtBRLCompact(v as number), 'Investimento'] : [fmtInt(v as number), label]
          }
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(v: string) => {
            const labels: Record<string, string> = { valor: label, investimento: 'Investimento' };
            return <span className="text-xs text-ink-2">{labels[v] ?? v}</span>;
          }}
        />
        <Line yAxisId="left" type="monotone" dataKey="valor" stroke={FMP_RED} strokeWidth={2.5} dot={{ r: 3, fill: FMP_RED }} />
        <Line yAxisId="right" type="monotone" dataKey="investimento" stroke={NEUTRAL} strokeWidth={2.5} dot={{ r: 3, fill: NEUTRAL }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

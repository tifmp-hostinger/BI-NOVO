import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, HelpCircle } from 'lucide-react';
import {
  diasAtras,
  faltamRitmos,
  fetchFreshness,
  formataDataCurta,
  formataDataHora,
  type Freshness,
  type FreshnessResumo,
  type RitmoFonte,
} from '@/lib/dataFreshness';

const AJUDA =
  'Duas fontes de data: "Carga em" é quando o dado entrou no banco (carimbo real). ' +
  '"Dados até" é a data do registro mais recente na tabela — só as tabelas do RM não ' +
  'registram o momento da carga, então ali essa é a melhor referência disponível. ' +
  'O aviso de possível carga parada NÃO usa prazo fixo: compara o silêncio atual com o ' +
  'maior silêncio que aquela mesma fonte já teve no último ano. Fontes de ritmo irregular ' +
  '(Cursos Livres passa semanas sem inscrição; Graduação segue o ciclo do vestibular) ' +
  'não disparam alerta à toa. As cargas rodam por um processo agendado, fora da aplicação.';

const ESTILO: Record<string, string> = {
  ok: 'text-ink-3',
  atencao: 'text-warning-dark',
  atrasado: 'text-danger',
  desconhecido: 'italic text-ink-3',
  erro: 'text-warning-dark',
};

function rotuloFonte(f: Freshness): string {
  if (f.tipoSinal === 'sem-sinal' || !f.data) return 'Sem sinal de frescor';
  if (f.tipoSinal === 'carga') return `Carga em ${formataDataHora(f.data)}`;
  return `Dados até ${formataDataCurta(f.data)}`;
}

/** Nome curto da tabela para caber no rótulo. */
function nomeCurto(tabela: string): string {
  return tabela.replace(/^stg_(rm_)?/, '').replace(/_/g, ' ');
}

function rotulo(resumo: FreshnessResumo): string {
  const f = resumo.maisAntiga;
  if (!f || !f.data) {
    return resumo.status === 'erro' ? 'Não foi possível verificar a data da carga' : 'Sem sinal de frescor';
  }
  const base = rotuloFonte(f);

  // Só acusa carga parada quando alguma fonte saiu do PRÓPRIO ritmo. Uma data
  // antiga por si só não é sintoma: Cursos Livres passa semanas sem inscrição
  // e Graduação segue o ciclo do vestibular, ambos com a carga em dia.
  if (resumo.foraDoRitmo.length > 0) {
    const pior = resumo.foraDoRitmo[0];
    const dias = diasAtras(pior.horasAtras ?? 0);
    const extras = resumo.foraDoRitmo.length - 1;
    const sufixo = extras > 0 ? ` (+${extras} fonte${extras === 1 ? '' : 's'})` : '';
    return `${base} — ${nomeCurto(pior.tabela)} sem registro há ${dias} dias${sufixo}`;
  }

  if (f.tipoSinal === 'carga' && (resumo.status === 'atencao' || resumo.status === 'atrasado')) {
    const dias = diasAtras(f.horasAtras ?? 0);
    return `${base} — última carga há ${dias} dia${dias === 1 ? '' : 's'}`;
  }

  return base;
}

function linhaDetalhe(f: Freshness): string {
  if (f.tipoSinal === 'sem-sinal') return `${f.tabela}: sem coluna de data de carga nem proxy de conteúdo`;
  if (!f.data) return `${f.tabela}: não foi possível verificar`;
  if (f.tipoSinal === 'carga') return `${f.tabela}: carga em ${formataDataHora(f.data)}`;

  const dias = diasAtras(f.horasAtras ?? 0);
  const partes = [`${f.tabela}: dados até ${formataDataCurta(f.data)}`];

  if (f.sazonal) {
    partes.push('sazonal (janelas específicas do ano) — fora do aviso principal');
  } else if (f.maiorIntervaloDias != null) {
    // Mostrar a régua junto do número evita a leitura "21 dias parado = problema"
    // quando 21 dias é rotina para aquela fonte.
    partes.push(
      f.foraDoRitmo
        ? `sem registro há ${dias} dia(s) — acima do maior silêncio já visto nela (${f.maiorIntervaloDias} dia(s))`
        : `sem registro há ${dias} dia(s) — dentro do normal desta fonte (já teve ${f.maiorIntervaloDias} dia(s) de silêncio)`,
    );
  }
  return partes.join(' — ');
}

/**
 * Detalhamento completo, em 3 blocos, exibido no tooltip: permite dizer
 * "o RM está em dia, o Rubeus parou" sem abrir o banco.
 */
function montaDetalhe(resumo: FreshnessResumo): string {
  const comCarga = resumo.fontesFato.filter((f) => f.tipoSinal === 'carga');
  const semCarga = resumo.fontesFato.filter((f) => f.tipoSinal === 'proxy' || f.tipoSinal === 'sem-sinal');
  const blocos: string[] = [];

  if (comCarga.length > 0) {
    blocos.push(['Fontes com carimbo de carga:', ...comCarga.map((f) => `  ${linhaDetalhe(f)}`)].join('\n'));
  }
  if (semCarga.length > 0) {
    blocos.push(['Fontes sem carimbo:', ...semCarga.map((f) => `  ${linhaDetalhe(f)}`)].join('\n'));
  }
  if (resumo.fontesDominio.length > 0) {
    blocos.push(
      [
        'Tabelas de referência (editadas à mão, sem alerta):',
        ...resumo.fontesDominio.map((f) => `  ${linhaDetalhe(f)}`),
      ].join('\n'),
    );
  }
  return blocos.join('\n\n');
}

/**
 * Carimbo de frescor do dado, compartilhado pelos dashboards.
 * NUNCA cai em "agora" silenciosamente: quando a data não pode ser
 * determinada, o texto diz exatamente isso.
 *
 * `ritmos`: mapa tabela → { última data, maior silêncio já observado }, já
 * calculado pelo dashboard sobre o dataset que ele tem em memória (ver
 * `ritmoDoDataset` em lib/dataFreshness.ts). Sem isso as tabelas "sem
 * carimbo" aparecem como "sem sinal" — não disparamos consulta nova.
 */
export function DataFreshness({
  tabelas,
  ritmos = {},
}: {
  tabelas: string[];
  ritmos?: Record<string, RitmoFonte>;
}) {
  const [resumo, setResumo] = useState<FreshnessResumo | null>(null);
  const chave = tabelas.join('|');
  const chaveRitmos = Object.entries(ritmos)
    .map(([k, v]) => `${k}=${v?.ultima ? v.ultima.getTime() : ''}:${v?.maiorIntervaloDias ?? ''}`)
    .sort()
    .join('|');

  const aguardandoDataset = faltamRitmos(tabelas, ritmos);

  useEffect(() => {
    // Só calcula com o quadro completo: calcular antes mostraria um rótulo
    // baseado apenas nas tabelas com carimbo de carga, que depois mudaria
    // sozinho quando o dataset chegasse.
    if (aguardandoDataset) return;
    let vivo = true;
    fetchFreshness(chave.split('|'), ritmos)
      .then((r) => vivo && setResumo(r))
      .catch(() => {
        if (vivo) {
          setResumo({ maisAntiga: null, fontesFato: [], fontesDominio: [], status: 'erro', foraDoRitmo: [] });
        }
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, chaveRitmos, aguardandoDataset]);

  if (aguardandoDataset || !resumo) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-ink-3">
        <Clock className="h-3 w-3 animate-pulse" />
        Verificando data da carga…
      </span>
    );
  }

  const alerta = resumo.status === 'atrasado' || resumo.status === 'atencao';
  const detalhe = montaDetalhe(resumo);

  return (
    <span
      className={`inline-flex items-center gap-1 text-2xs ${ESTILO[resumo.status]}`}
      title={detalhe || undefined}
    >
      {alerta ? (
        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
      ) : (
        <Clock className="h-3 w-3 flex-shrink-0" />
      )}
      {rotulo(resumo)}
      <span
        tabIndex={0}
        role="note"
        aria-label={AJUDA}
        title={AJUDA}
        className="cursor-help text-ink-3/70 transition hover:text-fmp focus:text-fmp focus:outline-none"
      >
        <HelpCircle className="h-3 w-3" strokeWidth={2.4} />
      </span>
    </span>
  );
}

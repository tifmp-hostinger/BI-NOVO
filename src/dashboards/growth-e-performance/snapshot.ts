/**
 * Growth e Performance → DashboardSnapshot.
 *
 * Tradução pura do que o hook já calculou. NUNCA faz fetch, NUNCA recalcula:
 * se este arquivo derivar de `calculations.ts`, o plano passa a citar número
 * que não está na tela — o defeito mais caro possível neste módulo.
 */

import {
  avisaSnapshotGrande,
  dataBR,
  resumeFrescor,
  topN,
  type DashboardSnapshot,
  type Indicador,
  type Serie,
} from '@/lib/snapshotTypes';
import { FONTES_POR_DASHBOARD, type RitmoFonte } from '@/lib/dataFreshness';
import { AJUSTE_ALUNO_RA, AJUSTE_DATA } from './constants';
import type {
  CampanhaRow,
  GrowthFilters,
  MediaMetrics,
  NegocioMetrics,
  OrigemData,
  SerieMensalDatum,
} from './types';

const SLUG = 'growth-e-performance';
const TOP_CAMPANHAS = 12;
/** Mesmo mínimo do painel: taxa sobre menos de 50 pessoas não decide nada. */
const MINIMO_AMOSTRA = 50;

export type EntradaSnapshotGrowth = {
  filters: GrowthFilters;
  media: MediaMetrics | null;
  negocio: NegocioMetrics | null;
  campanhas: CampanhaRow[] | null;
  origem: OrigemData | null;
  serieLeads: SerieMensalDatum[] | null;
  serieMatriculas: SerieMensalDatum[] | null;
  freshnessRitmos: Record<string, RitmoFonte>;
};

/** "Pós EAD · Meta · 01/07/2026 a 31/07/2026 · fim de semana" */
function descreveRecorte(f: GrowthFilters): string {
  const partes: string[] = [f.produto];
  if (f.fonte && f.fonte !== 'Todos') partes.push(f.fonte);

  const de = dataBR(f.dataInicio);
  const ate = dataBR(f.dataFim);
  if (de && ate) partes.push(`${de} a ${ate}`);
  else if (de) partes.push(`a partir de ${de}`);
  else if (ate) partes.push(`até ${ate}`);

  if (f.periodoLetivo.length > 0) partes.push(`períodos: ${f.periodoLetivo.join(', ')}`);
  if (f.fimDeSemana) partes.push(f.fimDeSemana.toLowerCase());
  return partes.join(' · ');
}

/** Mês de referência do recorte — dimensão de escopo da memória (§5.3.1). */
function mesDeReferencia(f: GrowthFilters): number | null {
  const base = f.dataFim ?? f.dataInicio;
  if (!base) return null;
  const mes = Number(base.split('-')[1]);
  return Number.isFinite(mes) && mes >= 1 && mes <= 12 ? mes : null;
}

function indicadores(
  media: MediaMetrics | null,
  negocio: NegocioMetrics | null,
): Indicador[] {
  const out: Indicador[] = [];

  if (media) {
    out.push(
      {
        chave: 'cpl',
        rotulo: 'Custo para atrair um interessado',
        valor: media.cpl,
        unidade: 'brl',
        glossario:
          'Investimento em anúncio dividido pelo número de pessoas que demonstraram interesse no recorte.',
      },
      {
        chave: 'investimento',
        rotulo: 'Investimento em anúncios',
        valor: media.investimento,
        unidade: 'brl',
      },
      { chave: 'leads', rotulo: 'Pessoas interessadas', valor: media.leads, unidade: 'int' },
      { chave: 'clicks', rotulo: 'Cliques', valor: media.clicks, unidade: 'int' },
      {
        chave: 'ctr',
        rotulo: 'Taxa de clique',
        valor: media.ctr,
        unidade: 'pct',
        glossario: 'Cliques divididos por vezes que o anúncio apareceu.',
      },
      {
        chave: 'frequencia',
        rotulo: 'Vezes que a mesma pessoa viu o anúncio',
        valor: media.frequencia,
        unidade: 'ratio',
        glossario:
          'Frequência alta com resultado caindo indica público cansado — só o Meta informa este número.',
      },
    );
  }

  if (negocio) {
    out.push(
      { chave: 'matriculas', rotulo: 'Matrículas', valor: negocio.matriculas, unidade: 'int' },
      { chave: 'inscritos', rotulo: 'Inscrições', valor: negocio.inscritos, unidade: 'int' },
      { chave: 'faturamento', rotulo: 'Faturamento', valor: negocio.faturamento, unidade: 'brl' },
      {
        chave: 'cac',
        rotulo: 'Custo para conseguir uma matrícula',
        valor: negocio.cac,
        unidade: 'brl',
        glossario: 'Investimento em anúncio dividido pelo número de matrículas do recorte.',
      },
      {
        chave: 'ticket_medio',
        rotulo: 'Valor médio por matrícula',
        valor: negocio.ticketMedio,
        unidade: 'brl',
      },
      {
        chave: 'roas',
        rotulo: 'Retorno sobre o investimento',
        valor: negocio.roas,
        unidade: 'ratio',
        glossario: 'Quantas vezes o faturamento cobre o que foi gasto em anúncio.',
      },
      {
        chave: 'taxa_conversao',
        rotulo: 'Conversão de inscrição em matrícula',
        valor: negocio.taxaConv,
        unidade: 'pct',
      },
      {
        chave: 'cancelamentos',
        rotulo: 'Cancelamentos',
        valor: negocio.cancelamentos,
        unidade: 'int',
      },
    );
  }

  return out;
}

function series(e: EntradaSnapshotGrowth): Serie[] {
  const out: Serie[] = [];

  if (e.campanhas && e.campanhas.length > 0) {
    out.push({
      chave: 'campanhas_leads',
      rotulo: 'Campanhas por pessoas interessadas',
      eixo: 'categoria',
      pontos: topN(e.campanhas, TOP_CAMPANHAS, (c) => c.campanha, (c) => c.leads),
      truncadaEm: e.campanhas.length > TOP_CAMPANHAS ? TOP_CAMPANHAS : undefined,
    });
    out.push({
      chave: 'campanhas_investimento',
      rotulo: 'Campanhas por investimento',
      eixo: 'categoria',
      pontos: topN(e.campanhas, TOP_CAMPANHAS, (c) => c.campanha, (c) => c.investimento),
      truncadaEm: e.campanhas.length > TOP_CAMPANHAS ? TOP_CAMPANHAS : undefined,
    });
  }

  if (e.origem) {
    out.push({
      chave: 'origem_canal',
      rotulo: 'Conversão por canal de origem',
      eixo: 'categoria',
      pontos: e.origem.porCanal.map((o) => ({ r: o.nome, v: o.taxa })),
    });
    out.push({
      chave: 'origem_plataforma',
      rotulo: 'Conversão por plataforma',
      eixo: 'categoria',
      pontos: e.origem.porPlataforma.map((o) => ({ r: o.nome, v: o.taxa })),
    });
  }

  if (e.serieLeads) {
    out.push({
      chave: 'leads_mes',
      rotulo: 'Pessoas interessadas por mês',
      eixo: 'tempo',
      pontos: e.serieLeads.map((p) => ({ r: p.mesAno, v: p.valor })),
    });
  }

  if (e.serieMatriculas) {
    out.push({
      chave: 'matriculas_mes',
      rotulo: 'Matrículas por mês',
      eixo: 'tempo',
      pontos: e.serieMatriculas.map((p) => ({ r: p.mesAno, v: p.valor })),
    });
  }

  return out;
}

/**
 * Regras herdadas do BI que mudam a leitura. Sem isto, o agente aponta como
 * anomalia aquilo que é regra documentada — e queima a confiança do gestor
 * logo na primeira semana.
 */
function observacoes(e: EntradaSnapshotGrowth): string[] {
  const obs: string[] = [
    'Quatro campanhas do Meta são removidas antes de qualquer cálculo, por regra herdada do Power BI.',
    `Taxa de conversão calculada sobre menos de ${MINIMO_AMOSTRA} pessoas não sustenta decisão — sinalize a incerteza em vez de recomendar mudança.`,
    'O Google não informa alcance nem frequência: esses números existem apenas para o Meta.',
  ];

  const canaisFracos = (e.origem?.porCanal ?? []).filter((o) => o.amostraPequena);
  if (canaisFracos.length > 0) {
    obs.push(
      `Neste recorte, ${canaisFracos.length} canal(is) ficaram abaixo do mínimo de amostra: ${canaisFracos
        .map((c) => c.nome)
        .join(', ')}.`,
    );
  }

  if (!AJUSTE_ALUNO_RA) {
    obs.push(
      `Ajuste manual de faturamento do Pós (data ${AJUSTE_DATA}) NÃO está aplicado — falta configuração no deploy. O faturamento pode divergir do Power BI.`,
    );
  }

  return obs;
}

export function buildGrowthSnapshot(e: EntradaSnapshotGrowth): DashboardSnapshot {
  const snapshot: DashboardSnapshot = {
    versao: 1,
    slug: SLUG,
    titulo: 'Growth e Performance',
    geradoEm: new Date().toISOString(),
    recorte: {
      descricao: descreveRecorte(e.filters),
      filtros: {
        produto: e.filters.produto,
        fonte: e.filters.fonte,
        dataInicio: e.filters.dataInicio,
        dataFim: e.filters.dataFim,
        periodoLetivo: e.filters.periodoLetivo,
        fimDeSemana: e.filters.fimDeSemana,
      },
      produto: e.filters.produto,
      mesReferencia: mesDeReferencia(e.filters),
    },
    frescor: resumeFrescor(FONTES_POR_DASHBOARD[SLUG] ?? [], e.freshnessRitmos),
    indicadores: indicadores(e.media, e.negocio),
    series: series(e),
    observacoes: observacoes(e),
  };

  avisaSnapshotGrande(snapshot);
  return snapshot;
}

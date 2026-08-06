/**
 * Catálogo dos painéis que o Plano de Ação sabe ler.
 *
 * O snapshot do painel ATIVO é montado pela própria página, que já tem tudo em
 * memória. Este registro serve para o caso "o agente quer olhar outro painel":
 * carrega o dataset por `carregaComCache` (que devolve o cache do aquecimento
 * na hora, sem consulta nova) e monta o snapshot.
 *
 * DEVE usar `import()` dinâmico: sem isso, `calculations.ts` dos cinco painéis
 * (mais de 130 KB só em Growth e Análise de Conversão) entra no bundle inicial
 * e o code-splitting do §4 do SPECS vai por água abaixo.
 */

import type { DashboardSnapshot } from '@/lib/snapshotTypes';
import type { GrowthDataset } from '@/dashboards/growth-e-performance/types';

export type PainelLegivel = {
  slug: string;
  titulo: string;
  /** Uma frase dizendo o que se responde com este painel — vai para o prompt. */
  sobre: string;
  /** Monta o snapshot no recorte padrão do painel. */
  montar: () => Promise<DashboardSnapshot>;
};

export const PAINEIS_LEGIVEIS: PainelLegivel[] = [
  {
    slug: 'growth-e-performance',
    titulo: 'Growth e Performance',
    sobre:
      'Anúncios pagos, jornada do interessado e faturamento por produto: custo para atrair, custo por matrícula, retorno do investimento e desempenho por campanha e canal.',
    montar: async () => {
      const [{ buildGrowthSnapshot }, { fetchGrowthData }, calc, freshness, cache] =
        await Promise.all([
          import('@/dashboards/growth-e-performance/snapshot'),
          import('@/dashboards/growth-e-performance/queries'),
          import('@/dashboards/growth-e-performance/calculations'),
          import('@/lib/dataFreshness'),
          import('@/lib/carregaComCache'),
        ]);

      const { DATA_INICIO_DEFAULT } = await import('@/dashboards/growth-e-performance/constants');
      const filters = {
        produto: 'Pós EAD' as const,
        fonte: null,
        dataInicio: DATA_INICIO_DEFAULT,
        dataFim: null,
        periodoLetivo: [] as string[],
        fimDeSemana: null,
      };

      // Array em vez de `let`: a análise de fluxo do TypeScript não enxerga
      // atribuição feita dentro do callback e estreitaria a variável para
      // `never` logo depois da guarda.
      const recebidos: GrowthDataset[] = [];
      await cache.carregaComCache<GrowthDataset>({
        chave: 'growth-e-performance',
        tabelas: freshness.FONTES_POR_DASHBOARD['growth-e-performance'],
        baixar: () => fetchGrowthData(undefined, true),
        mostrar: (d) => {
          recebidos.push(d);
        },
      });

      // A última entrega é a mais fresca: `mostrar` pode ser chamado duas vezes
      // (cache primeiro, rede depois).
      const ds = recebidos[recebidos.length - 1];
      if (!ds) throw new Error('Não foi possível carregar Growth e Performance.');
      const media = calc.computeMediaMetrics(ds, filters);
      const negocio = calc.computeNegocioMetrics(ds, filters, media);

      return buildGrowthSnapshot({
        filters,
        media,
        negocio,
        campanhas: calc.computeCampanhas(ds, filters),
        origem: calc.computeOrigem(ds, filters),
        serieLeads: null,
        serieMatriculas: null,
        freshnessRitmos: {
          stg_google_ads: freshness.ritmoDoDataset(ds.google, 'date'),
          stg_rm_matriculas_pos: freshness.ritmoDoDataset(ds.matPos, 'datadematricula'),
          stg_rm_matriculas_grad: freshness.ritmoDoDataset(ds.matGrad, 'datamatricula'),
          stg_rm_matriculas_mestrado: freshness.ritmoDoDataset(ds.matMestrado, 'datamatricula'),
          stg_rm_matriculas_cursoslivres: freshness.ritmoDoDataset(ds.matCL, 'data_contrato'),
          stg_rm_inscricoes_graduacao: freshness.ritmoDoDataset(ds.inscGrad, 'data'),
          stg_rm_inscricoes_mestrado: freshness.ritmoDoDataset(ds.inscMestrado, 'data'),
          stg_rm_inscricoes_pos: freshness.ritmoDeDatasets([
            { rows: ds.inscPosEad, coluna: 'data' },
            { rows: ds.inscPosPresencial, coluna: 'data' },
          ]),
          stg_rm_inscricoes_cursoslivres: freshness.ritmoDoDataset(ds.inscCL, 'data'),
        },
      });
    },
  },
];

export function painelPorSlug(slug: string): PainelLegivel | undefined {
  return PAINEIS_LEGIVEIS.find((p) => p.slug === slug);
}

/** Índice enxuto para o prompt: o agente escolhe o que abrir sem baixar nada. */
export function catalogoParaPrompt(): Array<{ slug: string; titulo: string; sobre: string }> {
  return PAINEIS_LEGIVEIS.map(({ slug, titulo, sobre }) => ({ slug, titulo, sobre }));
}

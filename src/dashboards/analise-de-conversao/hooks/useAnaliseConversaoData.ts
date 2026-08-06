import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearDashboardCache, fetchDashboardData } from '../queries';
import { FONTES_POR_DASHBOARD, ritmoDoDataset, type RitmoFonte } from '@/lib/dataFreshness';
import { carregaComCache } from '@/lib/carregaComCache';
import {
  buildFilterOptions,
  computeCursosLivresData,
  computeEspecializacoesData,
  computeGeralKpis,
  computeGraduacaoData,
  computeLeadsData,
  computeMestradoData,
  computeModalidadePosData,
  computeRematriculaData,
} from '../calculations';
import type {
  ConversaoFilters,
  CursosLivresData,
  DashboardDataset,
  EspecializacoesData,
  FilterOptions,
  GeralKpis,
  GraduacaoData,
  LeadsData,
  MestradoData,
  ModalidadePosData,
  RematriculaData,
} from '../types';

export type ConversaoTab =
  | 'geral'
  | 'leads'
  | 'graduacao'
  | 'rematricula'
  | 'especializacoes'
  | 'presencial'
  | 'ead'
  | 'cursoslivres'
  | 'mestrado';

type State = {
  dataset: DashboardDataset | null;
  loading: boolean;
  error: string | null;
  progress: string | null;
  /** Há dado do cache na tela e um download rodando por trás. */
  revalidando: boolean;
};

const CHAVE_CACHE = 'analise-de-conversao';

/**
 * Recebe a aba ativa: cada bloco de dados só é computado quando a sua aba
 * está visível. Antes, qualquer mudança de filtro recalculava as 9 abas de
 * uma vez (varrendo centenas de milhares de linhas ~10x), travando a UI.
 */
export function useAnaliseConversaoData(filters: ConversaoFilters, tab: ConversaoTab) {
  const [state, setState] = useState<State>({
    dataset: null,
    loading: true,
    error: null,
    progress: null,
    revalidando: false,
  });

  const load = useCallback(async (forceRefresh: boolean) => {
    setState((s) => ({ ...s, loading: true, error: null, progress: null }));
    try {
      await carregaComCache<DashboardDataset>({
        chave: CHAVE_CACHE,
        tabelas: FONTES_POR_DASHBOARD['analise-de-conversao'],
        forcar: forceRefresh,
        baixar: () =>
          fetchDashboardData((etapa, total, descricao) => {
            setState((s) => ({
              ...s,
              progress: `Carregando dados — etapa ${etapa} de ${total} (${descricao})`,
            }));
          }, true),
        mostrar: (dataset) =>
          setState((s) => ({ ...s, dataset, loading: false, error: null, progress: null })),
        aoIniciarDownload: (temDadoNaTela) =>
          setState((s) => ({ ...s, loading: !temDadoNaTela, revalidando: temDadoNaTela })),
      });
      setState((s) => ({ ...s, loading: false, revalidando: false, progress: null }));
    } catch (err) {
      // Preserva o dado do cache na tela: rede caindo não deve apagar leitura válida.
      setState((s) => ({
        ...s,
        loading: false,
        revalidando: false,
        progress: null,
        error: err instanceof Error ? err.message : 'Erro ao carregar dados',
      }));
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refetch = useCallback(() => {
    clearDashboardCache();
    load(true);
  }, [load]);

  const filterOptions: FilterOptions | null = useMemo(() => {
    if (!state.dataset) return null;
    return buildFilterOptions(state.dataset);
  }, [state.dataset]);

  const geralKpis: GeralKpis | null = useMemo(() => {
    if (!state.dataset || tab !== 'geral') return null;
    return computeGeralKpis(state.dataset, filters);
  }, [state.dataset, filters, tab]);

  const leadsData: LeadsData | null = useMemo(() => {
    if (!state.dataset || tab !== 'leads') return null;
    return computeLeadsData(state.dataset, filters);
  }, [state.dataset, filters, tab]);

  const graduacaoData: GraduacaoData | null = useMemo(() => {
    if (!state.dataset || tab !== 'graduacao') return null;
    return computeGraduacaoData(state.dataset, filters);
  }, [state.dataset, filters, tab]);

  const rematriculaData: RematriculaData | null = useMemo(() => {
    if (!state.dataset || tab !== 'rematricula') return null;
    return computeRematriculaData(state.dataset, filters);
  }, [state.dataset, filters, tab]);

  const mestradoData: MestradoData | null = useMemo(() => {
    if (!state.dataset || tab !== 'mestrado') return null;
    return computeMestradoData(state.dataset, filters);
  }, [state.dataset, filters, tab]);

  const especializacoesData: EspecializacoesData | null = useMemo(() => {
    if (!state.dataset || tab !== 'especializacoes') return null;
    return computeEspecializacoesData(state.dataset, filters);
  }, [state.dataset, filters, tab]);

  const presencialData: ModalidadePosData | null = useMemo(() => {
    if (!state.dataset || tab !== 'presencial') return null;
    return computeModalidadePosData(state.dataset, filters, 'Pós Presencial');
  }, [state.dataset, filters, tab]);

  const eadData: ModalidadePosData | null = useMemo(() => {
    if (!state.dataset || tab !== 'ead') return null;
    return computeModalidadePosData(state.dataset, filters, 'Pós EAD');
  }, [state.dataset, filters, tab]);

  const cursosLivresData: CursosLivresData | null = useMemo(() => {
    if (!state.dataset || tab !== 'cursoslivres') return null;
    return computeCursosLivresData(state.dataset, filters);
  }, [state.dataset, filters, tab]);

  /**
   * Proxy de frescor por tabela, sobre o dataset SEM filtro de usuário
   * (state.dataset é o download completo) — nunca dispara consulta nova.
   */
  const freshnessRitmos = useMemo((): Record<string, RitmoFonte> => {
    const ds = state.dataset;
    if (!ds) return {};
    return {
      stg_rm_matriculas_grad: ritmoDoDataset(ds.matriculasGrad, 'datamatricula'),
      stg_rm_matriculas_mestrado: ritmoDoDataset(ds.matriculasMestrado, 'datamatricula'),
      stg_rm_matriculas_pos: ritmoDoDataset(ds.matriculasPos, 'datadematricula'),
      stg_rm_matriculas_cursoslivres: ritmoDoDataset(ds.matriculasCursosLives, 'data_contrato'),
      stg_rm_inscricoes_graduacao: ritmoDoDataset(ds.inscricoesGrad, 'datainscricao'),
      stg_rm_inscricoes_mestrado: ritmoDoDataset(ds.inscricoesMestrado, 'datainscricao'),
      stg_rm_inscricoes_pos: ritmoDoDataset(ds.inscricoesPos, 'datainscricao'),
      stg_rm_inscricoes_cursoslivres: ritmoDoDataset(ds.clInscPorDia, 'data'),
    };
  }, [state.dataset]);

  return {
    loading: state.loading,
    revalidando: state.revalidando,
    error: state.error,
    progress: state.progress,
    filterOptions,
    geralKpis,
    leadsData,
    graduacaoData,
    rematriculaData,
    mestradoData,
    especializacoesData,
    presencialData,
    eadData,
    cursosLivresData,
    freshnessRitmos,
    refetch,
  };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearGrowthCache, fetchGrowthData } from '../queries';
import { avisaAjusteManualAusente } from '../constants';
import {
  computeCampanhas,
  computeHorarios,
  computeMapa,
  computeMediaMetrics,
  computeNegocioMetrics,
  computeOrigem,
  computeSerieMensal,
} from '../calculations';
import { FONTES_POR_DASHBOARD, ritmoDeDatasets, ritmoDoDataset, type RitmoFonte } from '@/lib/dataFreshness';
import { carregaComCache } from '@/lib/carregaComCache';
import type { GrowthDataset, GrowthFilters, GrowthView } from '../types';

type State = {
  dataset: GrowthDataset | null;
  loading: boolean;
  error: string | null;
  progress: string | null;
  /** Há dado na tela (vindo do cache) e um download rodando por trás. */
  revalidando: boolean;
};

const CHAVE_CACHE = 'growth-e-performance';

/**
 * A visão ativa entra como dependência para computar apenas o que está na
 * tela (mesmo padrão do analise-de-conversao).
 */
export function useGrowthData(filters: GrowthFilters, view: GrowthView) {
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
      await carregaComCache<GrowthDataset>({
        chave: CHAVE_CACHE,
        tabelas: FONTES_POR_DASHBOARD['growth-e-performance'],
        forcar: forceRefresh,
        // forceRefresh=true sempre: o cache em memória de queries.ts já foi
        // consultado por carregaComCache através do cache persistente.
        baixar: () =>
          fetchGrowthData((etapa, total, descricao) => {
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
      setState((s) => ({
        // Mantém na tela o que veio do cache: falha de rede não deve apagar
        // um dado válido que o usuário já está lendo.
        ...s,
        loading: false,
        revalidando: false,
        progress: null,
        error: err instanceof Error ? err.message : 'Erro ao carregar dados',
      }));
    }
  }, []);

  useEffect(() => {
    // Sem a env var do ajuste manual o faturamento do Pós diverge do BI em
    // silêncio — avisa uma vez na inicialização do dashboard.
    avisaAjusteManualAusente();
    load(false);
  }, [load]);

  const refetch = useCallback(() => {
    clearGrowthCache();
    load(true);
  }, [load]);

  const media = useMemo(() => {
    if (!state.dataset) return null;
    return computeMediaMetrics(state.dataset, filters);
  }, [state.dataset, filters]);

  const negocio = useMemo(() => {
    if (!state.dataset || !media) return null;
    return computeNegocioMetrics(state.dataset, filters, media);
  }, [state.dataset, filters, media]);

  const campanhas = useMemo(() => {
    if (!state.dataset || view !== 'campanhas') return null;
    return computeCampanhas(state.dataset, filters);
  }, [state.dataset, filters, view]);

  const mapa = useMemo(() => {
    if (!state.dataset || view !== 'mapa') return null;
    return computeMapa(state.dataset, filters);
  }, [state.dataset, filters, view]);

  const horarios = useMemo(() => {
    if (!state.dataset || view !== 'horarios') return null;
    return computeHorarios(state.dataset, filters);
  }, [state.dataset, filters, view]);

  const origem = useMemo(() => {
    if (!state.dataset || view !== 'origem') return null;
    return computeOrigem(state.dataset, filters);
  }, [state.dataset, filters, view]);

  const serieLeads = useMemo(() => {
    if (!state.dataset || view !== 'leads') return null;
    return computeSerieMensal(state.dataset, filters, 'leads');
  }, [state.dataset, filters, view]);

  const serieMatriculas = useMemo(() => {
    if (!state.dataset || view !== 'matriculas') return null;
    return computeSerieMensal(state.dataset, filters, 'matriculas');
  }, [state.dataset, filters, view]);

  /**
   * Proxy de frescor por tabela, calculado sobre o dataset SEM filtro de
   * usuário (state.dataset é o download completo) — nunca dispara consulta
   * nova. Ver dataFreshness.ts.
   */
  const freshnessRitmos = useMemo((): Record<string, RitmoFonte> => {
    const ds = state.dataset;
    if (!ds) return {};
    return {
      stg_google_ads: ritmoDoDataset(ds.google, 'date'),
      stg_rm_matriculas_grad: ritmoDoDataset(ds.matGrad, 'datamatricula'),
      stg_rm_matriculas_mestrado: ritmoDoDataset(ds.matMestrado, 'datamatricula'),
      stg_rm_matriculas_pos: ritmoDoDataset(ds.matPos, 'datadematricula'),
      stg_rm_matriculas_cursoslivres: ritmoDoDataset(ds.matCL, 'data_contrato'),
      stg_rm_inscricoes_graduacao: ritmoDoDataset(ds.inscGrad, 'data'),
      stg_rm_inscricoes_mestrado: ritmoDoDataset(ds.inscMestrado, 'data'),
      // A tabela de inscrições do Pós chega partida em EAD e Presencial:
      // o ritmo precisa ser medido sobre a união dos dois.
      stg_rm_inscricoes_pos: ritmoDeDatasets([
        { rows: ds.inscPosEad, coluna: 'data' },
        { rows: ds.inscPosPresencial, coluna: 'data' },
      ]),
      stg_rm_inscricoes_cursoslivres: ritmoDoDataset(ds.inscCL, 'data'),
    };
  }, [state.dataset]);

  return {
    loading: state.loading,
    revalidando: state.revalidando,
    error: state.error,
    progress: state.progress,
    pletivo: state.dataset?.pletivo ?? [],
    media,
    negocio,
    campanhas,
    mapa,
    horarios,
    origem,
    serieLeads,
    serieMatriculas,
    freshnessRitmos,
    refetch,
  };
}

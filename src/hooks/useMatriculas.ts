import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  aggregate,
  detailForState,
  listMatriculas,
  type Matricula,
  type MatriculaSource,
} from '@/services/matriculasService';
import { regionOf } from '@/lib/brStates';
import { FONTES_POR_DASHBOARD } from '@/lib/dataFreshness';
import { carregaComCache } from '@/lib/carregaComCache';

const CHAVE_CACHE = 'presenca-nacional';

export type MatriculaFilters = {
  source?: MatriculaSource | 'all';
  region?: string;
  onlyMatriculados?: boolean;
};

type State = {
  raw: Matricula[];
  loading: boolean;
  error: string | null;
  /** Há dado do cache na tela e um download rodando por trás. */
  revalidando: boolean;
};

export function useMatriculas(filters: MatriculaFilters) {
  const [state, setState] = useState<State>({
    raw: [],
    loading: true,
    error: null,
    revalidando: false,
  });

  const load = useCallback(async (forcar = false) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await carregaComCache<Matricula[]>({
        chave: CHAVE_CACHE,
        tabelas: FONTES_POR_DASHBOARD['presenca-nacional'],
        forcar,
        baixar: () => listMatriculas(),
        mostrar: (raw) => setState((s) => ({ ...s, raw, loading: false, error: null })),
        aoIniciarDownload: (temDadoNaTela) =>
          setState((s) => ({ ...s, loading: !temDadoNaTela, revalidando: temDadoNaTela })),
      });
      setState((s) => ({ ...s, loading: false, revalidando: false }));
    } catch (err) {
      // Preserva o que veio do cache em vez de esvaziar a tela.
      setState((s) => ({
        ...s,
        loading: false,
        revalidando: false,
        error: err instanceof Error ? err.message : 'Erro ao carregar matriculas',
      }));
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const filtered = useMemo(() => {
    let d = state.raw;
    if (filters.source && filters.source !== 'all') {
      d = d.filter((m) => m.source === filters.source);
    }
    if (filters.region) {
      d = d.filter((m) => regionOf(m.estado) === filters.region);
    }
    if (filters.onlyMatriculados) {
      d = d.filter((m) => m.situacao.toLowerCase().startsWith('matricula'));
    }
    return d;
  }, [state.raw, filters.source, filters.onlyMatriculados, filters.region]);

  const stats = useMemo(() => aggregate(filtered), [filtered]);

  const detailFor = useCallback(
    (uf: string) => detailForState(filtered, uf),
    [filtered]
  );

  return {
    raw: state.raw,
    filtered,
    loading: state.loading,
    revalidando: state.revalidando,
    error: state.error,
    stats,
    detailFor,
    // Botão "Atualizar": ignora o cache de propósito.
    refetch: () => load(true),
  };
}

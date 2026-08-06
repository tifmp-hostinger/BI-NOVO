import { useCallback, useEffect, useState } from 'react';
import type { Dashboard } from '@/lib/supabase';
import { listDashboards } from '@/services/dashboardService';

type State = {
  data: Dashboard[];
  loading: boolean;
  error: string | null;
};

export function useDashboards() {
  const [state, setState] = useState<State>({
    data: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await listDashboards();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Erro ao carregar dashboards',
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}

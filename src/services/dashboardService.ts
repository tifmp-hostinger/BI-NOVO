import { supabase, type Dashboard } from '@/lib/supabase';
import { SAMPLE_DASHBOARDS } from '@/lib/sampleData';

/*
 * Sobre o fallback abaixo: ele NÃO é o padrão perigoso de "dado fictício com
 * cara de real". SAMPLE_DASHBOARDS contém exatamente os 5 dashboards que
 * existem — é o catálogo de navegação da aplicação, não número de negócio.
 * Nenhuma métrica sai daqui, e a tabela `dashboards` sequer existe neste
 * projeto Supabase, então este é o catálogo de verdade.
 *
 * O fallback silencioso que precisava sumir era o do cepService (dados de CEP
 * sintéticos passando por reais) — aquele arquivo foi REMOVIDO junto com a
 * página órfã que o usava.
 */

/**
 * Dashboards registrados em código que podem ainda não existir na tabela
 * `dashboards` do banco. Sem este merge, um dashboard novo fica roteado mas
 * invisível no menu.
 */
const LOCAL_DASHBOARD_SLUGS = new Set(['growth-e-performance']);

function mergeLocalDashboards(fromDb: Dashboard[]): Dashboard[] {
  const dbSlugs = new Set(fromDb.map((d) => d.slug));
  const missing = SAMPLE_DASHBOARDS.filter(
    (d) => LOCAL_DASHBOARD_SLUGS.has(d.slug) && !dbSlugs.has(d.slug),
  );
  if (missing.length === 0) return fromDb;
  return [...fromDb, ...missing].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * A tabela `dashboards` NÃO existe neste projeto Supabase — o catálogo vive em
 * SAMPLE_DASHBOARDS. Cada consulta a ela devolvia PGRST205 ("Could not find
 * the table 'public.dashboards' in the schema cache"): o código tratava o erro
 * em silêncio e caía no fallback, mas o navegador registra o 404 no console a
 * cada navegação, o que parecia falha do app sem ser.
 *
 * Depois da primeira resposta de "tabela ausente" paramos de perguntar. Se um
 * dia a tabela for criada, basta recarregar a página: a primeira consulta
 * volta a funcionar e o banco passa a mandar no catálogo de novo — nenhuma
 * mudança de código é necessária.
 */
let tabelaAusente = false;

/** PGRST205 = tabela inexistente; 42P01 = undefined_table no Postgres. */
function ehTabelaAusente(code: string | undefined): boolean {
  return code === 'PGRST205' || code === '42P01';
}

export async function listDashboards(): Promise<Dashboard[]> {
  if (tabelaAusente) return SAMPLE_DASHBOARDS;
  try {
    const { data, error } = await supabase
      .from('dashboards')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      if (ehTabelaAusente(error.code)) tabelaAusente = true;
      return SAMPLE_DASHBOARDS;
    }
    if (!data || data.length === 0) return SAMPLE_DASHBOARDS;
    return mergeLocalDashboards(data as Dashboard[]);
  } catch {
    return SAMPLE_DASHBOARDS;
  }
}

export async function getDashboardBySlug(slug: string): Promise<Dashboard | null> {
  const local = () => SAMPLE_DASHBOARDS.find((d) => d.slug === slug) ?? null;
  if (tabelaAusente) return local();
  try {
    const { data, error } = await supabase
      .from('dashboards')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      if (ehTabelaAusente(error.code)) tabelaAusente = true;
      return local();
    }
    return (data as Dashboard | null) ?? local();
  } catch {
    return local();
  }
}

import { FONTES_POR_DASHBOARD } from '@/lib/dataFreshness';
import { carregaComCache } from '@/lib/carregaComCache';

/**
 * Aquecimento em segundo plano: assim que o usuário loga, baixa e guarda os
 * datasets dos painéis ANTES de ele clicar em qualquer um — enquanto ele
 * ainda está olhando a Central de Dashboards. Objetivo: abrir um painel e já
 * estar pronto, como um BI.
 *
 * Decisões:
 * - SEQUENCIAL, um painel por vez: aquecer os cinco em paralelo somaria à
 *   concorrência do painel que o usuário abrir (o paginador já usa 3
 *   requisições simultâneas; o free tier falhava com 8).
 * - Mais LEVES primeiro (medido: Presença 2 requisições, Presidência 9,
 *   Bolsas 15, Conversão 32, Growth 34): maximiza o número de painéis
 *   prontos nos primeiros segundos.
 * - `import()` dinâmico por painel: o código de cada dashboard permanece em
 *   chunk próprio (code-splitting preservado) — e o aquecimento ainda ganha
 *   de brinde o chunk JS já baixado quando o usuário abrir a tela.
 * - `apenasAquecer`: com o cache já válido, a checagem lê só a entrada meta
 *   (barata) — não desserializa dezenas de MB a cada login para concluir
 *   "nada a fazer".
 * - Se o usuário abrir um painel no meio do aquecimento, o download é
 *   compartilhado (dedup em carregaComCache), nunca duplicado.
 * - Falha aqui NUNCA pode afetar o app: cada painel é try/catch e o erro é
 *   apenas registrado no console.
 */
const ALVOS: Array<{
  chave: keyof typeof FONTES_POR_DASHBOARD;
  baixar: () => Promise<unknown>;
  /** Aquecimento adicional após o principal (ex.: sub-cache por seleção). */
  extras?: () => Promise<void>;
}> = [
  {
    chave: 'presenca-nacional',
    baixar: async () => (await import('@/services/matriculasService')).listMatriculas(),
  },
  {
    chave: 'analise-conversao-presidencia',
    baixar: async () =>
      (await import('@/dashboards/analise-conversao-presidencia/hooks/useAnaliseConversaoData')).baixarBasePresidencia(),
    // Os cartões de leads fazem um segundo download, parametrizado pela
    // seleção — aquece a seleção PADRÃO para o painel abrir 100% pronto.
    extras: async () =>
      (await import('@/dashboards/analise-conversao-presidencia/hooks/useAnaliseConversaoData')).aqueceLeadsRubeusPadrao(),
  },
  {
    chave: 'bolsas-e-descontos',
    baixar: async () =>
      (await import('@/dashboards/bolsas-e-descontos/hooks/useBolsasDescontosData')).baixarDatasetBolsas(),
  },
  {
    chave: 'analise-de-conversao',
    baixar: async () =>
      (await import('@/dashboards/analise-de-conversao/queries')).fetchDashboardData(undefined, true),
  },
  {
    chave: 'growth-e-performance',
    baixar: async () =>
      (await import('@/dashboards/growth-e-performance/queries')).fetchGrowthData(undefined, true),
  },
];

let iniciado = false;

/** Dispara o aquecimento uma única vez por sessão de página. Idempotente. */
export function iniciaAquecimentoDashboards(): void {
  if (iniciado) return;
  iniciado = true;

  void (async () => {
    for (const alvo of ALVOS) {
      try {
        await carregaComCache<unknown>({
          chave: alvo.chave,
          tabelas: FONTES_POR_DASHBOARD[alvo.chave],
          baixar: alvo.baixar,
          mostrar: () => {},
          apenasAquecer: true,
        });
        await alvo.extras?.();
      } catch (e) {
        // Painel que falhou no aquecimento carrega normalmente quando aberto.
        console.debug('[aquecimento] painel adiado:', alvo.chave, e);
      }
    }
  })();
}

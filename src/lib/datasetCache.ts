/**
 * Cache dos datasets dos dashboards no navegador (IndexedDB).
 *
 * Motivação: cada painel baixa as tabelas brutas e calcula no cliente — o de
 * Bolsas sozinho são ~129 mil linhas / ~38 MB em ~129 requisições. Havia cache
 * apenas em memória, que morre a cada F5 ou aba nova, então na prática o
 * usuário esperava esse download quase toda vez.
 *
 * Estratégia: mostrar o dado guardado IMEDIATAMENTE e revalidar atrás
 * ("stale-while-revalidate"). O download novo só acontece quando há motivo.
 *
 * Por que IndexedDB e não localStorage: localStorage é síncrono, guarda texto e
 * estoura em poucos MB — travaria a interface e não caberia. IndexedDB é
 * assíncrono e guarda o objeto direto.
 *
 * Por que não há horário de atualização: a carga não roda em hora fixa nem
 * todo dia (medido: 27/07 11:47, 29/07 12:25, 31/07 09:14, 03/08 14:50).
 * Qualquer horário fixo estaria errado na maioria dos dias. Ver `cacheValido`.
 */

const NOME_BANCO = 'fmp-bi-cache';
const NOME_STORE = 'datasets';

/**
 * Muda quando o FORMATO do dataset muda (colunas novas, tipos diferentes).
 * Sem isso, um cache antigo alimentaria cálculos novos com dados incompletos —
 * erro silencioso, o pior tipo. Incremente ao alterar as queries.
 */
export const VERSAO_CACHE = 1;

export type EntradaCache<T> = {
  dataset: T;
  /** Carimbos de carga conhecidos no momento da gravação. */
  assinatura: string;
  /** Momento da gravação (epoch ms). */
  gravadoEm: number;
  versao: number;
};

/**
 * Cópia leve dos campos de validade, gravada sob `meta:<chave>` junto com o
 * dataset. Existe para o aquecimento em segundo plano: checar se um painel já
 * está quente NÃO deve exigir desserializar o dataset inteiro (o de Bolsas
 * tem dezenas de MB — seria trave de main thread na tela inicial, a cada
 * login, só para concluir "nada a fazer").
 */
export type MetaCache = {
  assinatura: string;
  gravadoEm: number;
  versao: number;
};

function chaveMeta(chave: string): string {
  return `meta:${chave}`;
}

let avisoQuotaEmitido = false;

function abre(versao?: number): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = versao === undefined ? indexedDB.open(NOME_BANCO) : indexedDB.open(NOME_BANCO, versao);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(NOME_STORE)) db.createObjectStore(NOME_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    // Navegação privada ou armazenamento bloqueado: segue sem cache, não quebra.
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function abreBanco(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return abre().then((db) => {
    if (!db) return null;
    if (db.objectStoreNames.contains(NOME_STORE)) return db;
    // Banco existe mas sem a store: acontece se algo abriu o banco antes do
    // app criar a estrutura (abrir um IndexedDB inexistente JÁ o cria, vazio).
    // Sem isto o upgrade nunca mais dispararia e o cache falharia para sempre,
    // em silêncio. Reabrir com versão+1 força o upgrade e cria a store.
    const proximaVersao = db.version + 1;
    db.close();
    return abre(proximaVersao);
  });
}

function comStore<R>(
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<R>,
): Promise<R | null> {
  return abreBanco().then(
    (db) =>
      new Promise<R | null>((resolve) => {
        if (!db) return resolve(null);
        let req: IDBRequest<R>;
        try {
          req = fn(db.transaction(NOME_STORE, modo).objectStore(NOME_STORE));
        } catch {
          db.close();
          return resolve(null);
        }
        req.onsuccess = () => {
          resolve(req.result);
          db.close();
        };
        req.onerror = () => {
          // QuotaExceededError entra aqui: o dataset é grande demais para o
          // espaço disponível. Seguir sem cache é degradação aceitável.
          if (!avisoQuotaEmitido) {
            avisoQuotaEmitido = true;
            console.warn('[cache] não foi possível usar o cache local:', req.error?.name);
          }
          resolve(null);
          db.close();
        };
      }),
  );
}

/** Dia civil local, para a regra de validade. */
function diaCivil(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * O cache serve se: mesmo formato, mesmos carimbos de carga e mesmo dia civil.
 *
 * A regra do dia cobre as tabelas do RM, que NÃO têm carimbo de carga — para
 * elas não há como perguntar "mudou?" de forma barata, então o cache nunca
 * atravessa a virada do dia sem uma reconferência.
 */
export function cacheValido(
  entrada: MetaCache | null,
  assinaturaAtual: string | null,
): boolean {
  if (!entrada) return false;
  if (entrada.versao !== VERSAO_CACHE) return false;
  // Assinatura desconhecida (falha ao consultar): não dá para afirmar que o
  // cache está atual, então rebaixa — erra-se para o lado do dado correto.
  if (assinaturaAtual === null) return false;
  if (entrada.assinatura !== assinaturaAtual) return false;
  return diaCivil(entrada.gravadoEm) === diaCivil(Date.now());
}

/** Lê só a entrada meta — barata, para o aquecimento decidir se há trabalho. */
export async function leMeta(chave: string): Promise<MetaCache | null> {
  const bruto = await comStore<MetaCache>(
    'readonly',
    (s) => s.get(chaveMeta(chave)) as IDBRequest<MetaCache>,
  );
  if (!bruto || typeof bruto !== 'object') return null;
  if (bruto.versao !== VERSAO_CACHE) return null;
  return bruto;
}

export async function leCache<T>(chave: string): Promise<EntradaCache<T> | null> {
  const bruto = await comStore<EntradaCache<T>>('readonly', (s) => s.get(chave) as IDBRequest<EntradaCache<T>>);
  if (!bruto || typeof bruto !== 'object') return null;
  if (bruto.versao !== VERSAO_CACHE) return null;
  return bruto;
}

export async function gravaCache<T>(chave: string, dataset: T, assinatura: string): Promise<void> {
  const gravadoEm = Date.now();
  const entrada: EntradaCache<T> = { dataset, assinatura, gravadoEm, versao: VERSAO_CACHE };
  const meta: MetaCache = { assinatura, gravadoEm, versao: VERSAO_CACHE };

  // Dataset e meta na MESMA transação: gravar um sem o outro deixaria o
  // aquecimento (que lê só a meta) em desacordo com o que a tela lê.
  const db = await abreBanco();
  if (!db) return;
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(NOME_STORE, 'readwrite');
    } catch {
      db.close();
      return resolve();
    }
    const store = tx.objectStore(NOME_STORE);
    store.put(entrada, chave);
    store.put(meta, chaveMeta(chave));
    tx.oncomplete = () => {
      resolve();
      db.close();
    };
    tx.onerror = tx.onabort = () => {
      if (!avisoQuotaEmitido) {
        avisoQuotaEmitido = true;
        console.warn('[cache] não foi possível gravar o cache local:', tx.error?.name);
      }
      resolve();
      db.close();
    };
  });
}

export async function limpaCache(chave: string): Promise<void> {
  await comStore('readwrite', (s) => s.delete(chave) as IDBRequest<undefined>);
  await comStore('readwrite', (s) => s.delete(chaveMeta(chave)) as IDBRequest<undefined>);
}

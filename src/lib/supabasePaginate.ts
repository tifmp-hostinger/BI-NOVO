import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 1000;
// Concurrency reduzida: muitas requisições paralelas no Supabase free tier
// causavam falhas intermitentes de carga (era 8).
const PAGE_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500];

type Where = { column: string; value: string };
type WhereIn = { column: string; values: string[] };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  table: string,
  columns: string,
  from: number,
  where?: Where,
  whereIn?: WhereIn,
): Promise<unknown[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let q = supabase.from(table).select(columns);
      if (where) q = q.eq(where.column, where.value);
      if (whereIn) q = q.in(whereIn.column, whereIn.values);
      const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as unknown[];
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
      }
    }
  }
  throw lastError;
}

/**
 * Carrega todas as linhas paginando até vir uma página menor que PAGE_SIZE.
 * Sem count exact (era caro em tabelas grandes e podia estourar timeout);
 * com retry/backoff por página e concorrência limitada.
 */
export async function loadAllFrom(
  table: string,
  columns: string,
  where?: Where,
  whereIn?: WhereIn,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let offset = 0;
  for (;;) {
    const batch: Promise<unknown[]>[] = [];
    for (let i = 0; i < PAGE_CONCURRENCY; i++) {
      batch.push(fetchPage(table, columns, offset + i * PAGE_SIZE, where, whereIn));
    }
    const results = await Promise.all(batch);
    let sawShortPage = false;
    for (const rows of results) {
      out.push(...rows);
      if (rows.length < PAGE_SIZE) {
        sawShortPage = true;
        break;
      }
    }
    if (sawShortPage) break;
    offset += PAGE_CONCURRENCY * PAGE_SIZE;
  }
  return out;
}

export function normalizeCodperlet(cp: string | null | undefined): string {
  return (cp ?? '').replace(/^_/, '').trim();
}

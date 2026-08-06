/**
 * Formatters pt-BR reutilizaveis para o dashboard Analise de Conversao.
 * Nao usar parseFloat direto em valores monetarios brasileiros.
 */

export function parseBRNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const raw = String(v).trim();
  if (!raw) return null;

  // Detecta formato pt-BR ("1.600.000,00") vs. formato en ("1600000.00")
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  let normalized = raw;

  if (hasComma && hasDot) {
    // 1.600.000,00 -> 1600000.00
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // 1600,00 -> 1600.00
    normalized = raw.replace(',', '.');
  } else if (hasDot) {
    // Pode ser "1.600" (pt-BR sem centavos) ou "1600.00" (en).
    // Se ha exatamente uma casa decimal com 3 digitos depois, e separador
    // de milhar; caso contrario, e separador decimal.
    const parts = raw.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = raw.replace(/\./g, '');
    }
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('pt-BR');
}

export function fmtPercent(
  v: number | null | undefined,
  digits = 2
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function fmtBRL(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });
}

/** Compacta valores altos: 800000 -> "R$ 800 mil", 1600000 -> "R$ 1,60 mi". */
export function fmtBRLCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} mi`;
  }
  if (abs >= 1_000) {
    return `R$ ${(v / 1_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} mil`;
  }
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });
}

/** Normaliza string para comparacao: NFD strip acento + lowercase + trim + colapsa espacos. */
export function normalizeStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai ano-semestre de "Vestibular 2026/1 - ...": retorna "26-01" ou null. */
export function derivePeriodoFromProcessoGrad(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = v.match(/(\d{4})\s*\/\s*([12])/);
  if (!m) return null;
  const yy = m[1].slice(-2);
  const s = m[2] === '1' ? '01' : '02';
  return `${yy}-${s}`;
}

/**
 * Deriva periodo do processoseletivo do Mestrado (regra herdada do Power BI).
 * Ordem importa: "Complementar" tem precedencia.
 */
export function derivePeriodoFromProcessoMestrado(
  v: string | null | undefined
): string | null {
  if (!v) return null;
  const s = v;
  if (/complementar/i.test(s)) return '26-01';
  if (/2024/.test(s)) return '24-01';
  if (/2025/.test(s)) return '25-01';
  if (/2026/.test(s)) return '26-01';
  return null;
}

/** Remove eventual prefixo "_" do codperlet: "_26-01" -> "26-01". */
export function normalizeCodperlet(v: string | null | undefined): string {
  if (!v) return '';
  return v.replace(/^_+/, '').trim();
}

export function anoFromPeriodo(periodo: string): number | null {
  const m = periodo.match(/^(\d{2})-\d{2}$/);
  if (!m) return null;
  const yy = Number(m[1]);
  return 2000 + yy;
}

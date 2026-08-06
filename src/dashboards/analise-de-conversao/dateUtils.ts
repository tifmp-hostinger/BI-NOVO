export function parseFlexibleDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;

  const dmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function toISODate(s: string | null | undefined): string | null {
  const d = parseFlexibleDate(s);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateInRange(
  s: string | null | undefined,
  inicio: string | null,
  fim: string | null,
): boolean {
  if (!inicio && !fim) return true;
  const iso = toISODate(s);
  if (!iso) return false;
  if (inicio && iso < inicio) return false;
  if (fim && iso > fim) return false;
  return true;
}

export function parseDecimal(s: string | number | null | undefined): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
}

export function codperletToAno(cp: string | null | undefined): number | null {
  if (!cp) return null;
  const cleaned = cp.replace(/^_/, '').trim();
  const m = cleaned.match(/^(\d{2})/);
  if (!m) return null;
  return 2000 + Number(m[1]);
}

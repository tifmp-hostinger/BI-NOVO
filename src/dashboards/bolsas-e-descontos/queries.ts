import { loadAllFrom, normalizeCodperlet } from '@/lib/supabasePaginate';
import type { MatriculadoRow, RawBolsaRow, RawDimBeneficio } from './types';

function toMatriculadoRows(rows: unknown[], colunaData: string): MatriculadoRow[] {
  const out: MatriculadoRow[] = [];
  for (const raw of rows) {
    const r = raw as { ra: string | null; codperlet: string | null } & Record<string, string | null>;
    if (!r.ra) continue;
    out.push({ ra: r.ra, codperletNorm: normalizeCodperlet(r.codperlet), data: r[colunaData] ?? null });
  }
  return out;
}

export async function fetchDimBeneficio(): Promise<RawDimBeneficio[]> {
  const rows = await loadAllFrom(
    'dim_tipo_beneficio',
    'valor_original_rm, tipo_beneficio_padronizado',
  );
  return rows as RawDimBeneficio[];
}

export async function fetchBolsasRaw(): Promise<RawBolsaRow[]> {
  const cols =
    'ra, curso, codperlet, situacao_curso, situacao_matriculapl, bolsa, codplanopgto, valororiginal, valordoliq, data_matricula';
  const rows = await loadAllFrom('stg_rm_matriculas_bolsas', cols);
  return rows as RawBolsaRow[];
}



export async function fetchMatriculadosGrad(): Promise<MatriculadoRow[]> {
  const rows = await loadAllFrom('stg_rm_matriculas_grad', 'ra, codperlet, datamatricula', {
    column: 'situacao',
    value: 'Matriculado',
  });
  return toMatriculadoRows(rows, 'datamatricula');
}

export async function fetchMatriculadosPos(): Promise<MatriculadoRow[]> {
  const rows = await loadAllFrom('stg_rm_matriculas_pos', 'ra, codperlet, datadematricula', {
    column: 'situacao',
    value: 'Matriculado',
  });
  return toMatriculadoRows(rows, 'datadematricula');
}

export async function fetchMatriculadosMestrado(): Promise<MatriculadoRow[]> {
  const rows = await loadAllFrom(
    'stg_rm_matriculas_mestrado',
    'ra, codperlet, datamatricula',
    { column: 'situacao', value: 'Matriculado' },
  );
  return toMatriculadoRows(rows, 'datamatricula');
}

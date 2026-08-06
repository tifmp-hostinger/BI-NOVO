import type {
  BolsasFilters,
  ChartDatum,
  DimBeneficioMap,
  EnrichedBolsaRow,
  EvasaoPorAnoDatum,
  FilterOptions,
  MatriculadoRow,
  MatriculadosData,
  PanoramaKpis,
  RawBolsaRow,
  RawDimBeneficio,
  TipoCurso,
} from './types';

const EVASAO_STATUSES = new Set<string>([
  'Cancelado – Curso',
  'Cancelado - Curso (Assin_Cont)',
  'Evadido Curso',
  'Transferido de Instituição',
]);

export function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
}

function parseValor(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normCodperlet(cp: string | null | undefined): string {
  if (!cp) return '';
  return cp.replace(/^_/, '').trim();
}

function anoFromCodperlet(cpNorm: string): number | null {
  const m = cpNorm.match(/^(\d{2})/);
  if (!m) return null;
  return 2000 + parseInt(m[1], 10);
}

function tipoCursoFromCurso(curso: string | null | undefined): TipoCurso {
  const c = curso ?? '';
  if (c === 'Direito') return 'Graduação';
  if (c === 'Mestrado Academico T.E.D.I') return 'Mestrado';
  if (c === 'Curso Preparação Concurso MP') return 'Curso Preparatório';
  return 'Pós Graduação';
}

export function buildDimMap(dim: RawDimBeneficio[]): DimBeneficioMap {
  const m: DimBeneficioMap = new Map();
  for (const r of dim) {
    const key = normalize(r.valor_original_rm ?? '');
    if (!key) continue;
    m.set(key, r.tipo_beneficio_padronizado ?? '');
  }
  return m;
}

function classifyTipoBeneficio(bolsaNorm: string): string {
  if (bolsaNorm.includes('DESCONTO')) return 'Desconto';
  if (bolsaNorm.includes('BOLSA')) return 'Bolsa';
  if (bolsaNorm.includes('SEM BOLSA')) return 'Sem Bolsa';
  return 'Pagamento Integral';
}

export function enrichBolsaRows(
  raw: RawBolsaRow[],
  dimMap: DimBeneficioMap,
): EnrichedBolsaRow[] {
  const out: EnrichedBolsaRow[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const bolsaNorm = normalize(r.bolsa ?? '');
    const cpNorm = normCodperlet(r.codperlet);
    const padronizada = dimMap.get(bolsaNorm) || bolsaNorm;
    out[i] = {
      ra: r.ra,
      curso: r.curso,
      codperlet: r.codperlet,
      codperletNorm: cpNorm,
      ano: anoFromCodperlet(cpNorm),
      situacaoCurso: r.situacao_curso,
      situacaoMatriculaPl: r.situacao_matriculapl,
      bolsa: r.bolsa,
      bolsaPadronizada: padronizada,
      tipoBeneficio: classifyTipoBeneficio(bolsaNorm),
      tipoCurso: tipoCursoFromCurso(r.curso),
      codplanopgto: r.codplanopgto,
      valorOriginal: parseValor(r.valororiginal),
      valorDoLiq: parseValor(r.valordoliq),
    };
  }
  return out;
}

export function applyFilters(
  rows: EnrichedBolsaRow[],
  filters: BolsasFilters,
): EnrichedBolsaRow[] {
  return rows.filter((r) => {
    if (filters.codperlet.length > 0 && !filters.codperlet.includes(r.codperletNorm)) return false;
    if (filters.ano.length > 0 && (r.ano === null || !filters.ano.includes(r.ano))) return false;
    if (filters.tipocurso.length > 0 && !filters.tipocurso.includes(r.tipoCurso)) return false;
    if (
      filters.bolsaPadronizada.length > 0 &&
      !filters.bolsaPadronizada.includes(r.bolsaPadronizada)
    ) {
      return false;
    }
    return true;
  });
}

export function computeMatriculasCount(
  m: MatriculadosData,
  filters: BolsasFilters,
): number {
  const set = new Set<string>();
  const add = (list: MatriculadoRow[]) => {
    for (const r of list) {
      if (!r.ra) continue;
      if (filters.codperlet.length > 0 && !filters.codperlet.includes(r.codperletNorm))
        continue;
      if (filters.ano.length > 0) {
        const a = anoFromCodperlet(r.codperletNorm);
        if (a === null || !filters.ano.includes(a)) continue;
      }
      set.add(r.ra);
    }
  };
  add(m.grad);
  add(m.pos);
  add(m.mestrado);
  return set.size;
}

/* =====================================================================
   Shared evasão logic — EvasãoBolsas metric

   EvasãoBolsas = COUNT(DISTINCT ra WHERE situacao='Cancelado - Curso (Assin_Cont)')
               + COUNT(DISTINCT codplanopgto WHERE situacao='Cancelado – Curso')
               + COUNT(rows WHERE situacao='Evadido Curso')
               + COUNT(rows WHERE situacao='Transferido de Instituição')

   The DISTINCT for ra and codplanopgto is computed WITHIN each group
   (not globally), so grouped counts (by tipocurso, bolsaPadronizada, ano)
   are correct.
   ===================================================================== */

type EvasaoAcc = {
  raCancelado: Set<string>;
  planoCancelado: Set<string>;
  evadido: number;
  transf: number;
};

function newEvasaoAcc(): EvasaoAcc {
  return {
    raCancelado: new Set<string>(),
    planoCancelado: new Set<string>(),
    evadido: 0,
    transf: 0,
  };
}

function accEvasao(acc: EvasaoAcc, r: EnrichedBolsaRow): void {
  if (!r.situacaoCurso || !EVASAO_STATUSES.has(r.situacaoCurso)) return;
  if (r.situacaoCurso === 'Cancelado - Curso (Assin_Cont)' && r.ra) {
    acc.raCancelado.add(r.ra);
  }
  if (r.situacaoCurso === 'Cancelado – Curso' && r.codplanopgto) {
    acc.planoCancelado.add(r.codplanopgto);
  }
  if (r.situacaoCurso === 'Evadido Curso') acc.evadido += 1;
  if (r.situacaoCurso === 'Transferido de Instituição') acc.transf += 1;
}

function evasaoTotal(acc: EvasaoAcc): number {
  return acc.raCancelado.size + acc.planoCancelado.size + acc.evadido + acc.transf;
}

export type EvasaoBreakdown = {
  raCanceladoCount: number;
  planoCanceladoCount: number;
  evadido: number;
  transf: number;
  total: number;
};

export function computeEvasaoTotal(rows: EnrichedBolsaRow[]): EvasaoBreakdown {
  const acc = newEvasaoAcc();
  for (const r of rows) accEvasao(acc, r);
  return {
    raCanceladoCount: acc.raCancelado.size,
    planoCanceladoCount: acc.planoCancelado.size,
    evadido: acc.evadido,
    transf: acc.transf,
    total: evasaoTotal(acc),
  };
}

export function computeEvasaoByGroup(
  rows: EnrichedBolsaRow[],
  keyFn: (r: EnrichedBolsaRow) => string | null,
): ChartDatum[] {
  const groups = new Map<string, EvasaoAcc>();
  for (const r of rows) {
    if (!r.situacaoCurso || !EVASAO_STATUSES.has(r.situacaoCurso)) continue;
    const k = keyFn(r);
    if (!k) continue;
    let acc = groups.get(k);
    if (!acc) {
      acc = newEvasaoAcc();
      groups.set(k, acc);
    }
    accEvasao(acc, r);
  }
  return Array.from(groups, ([categoria, acc]) => ({
    categoria,
    valor: evasaoTotal(acc),
  }));
}

/* =====================================================================
   KPIs
   ===================================================================== */

export function computePanoramaKpis(
  filtered: EnrichedBolsaRow[],
  matriculados: MatriculadosData,
  filters: BolsasFilters,
): PanoramaKpis {
  let bolsas = 0;
  let descontos = 0;
  let formados = 0;
  let fatOriginal = 0;
  let fatDesconto = 0;
  let fatDescontoMat = 0;
  let renuncia = 0;

  for (const r of filtered) {
    const isMat = r.situacaoMatriculaPl === 'Matriculado';
    const isForm = r.situacaoMatriculaPl === 'Formado';
    const isBolsa = r.tipoBeneficio === 'Bolsa';
    const isDesc = r.tipoBeneficio === 'Desconto';

    if (isMat && isBolsa) bolsas += 1;
    if (isMat && isDesc) descontos += 1;
    if (isForm) formados += 1;

    fatOriginal += r.valorOriginal;
    fatDesconto += r.valorDoLiq;

    if (isMat && isDesc) fatDescontoMat += r.valorOriginal;

    if (r.situacaoCurso && EVASAO_STATUSES.has(r.situacaoCurso)) {
      renuncia += r.valorOriginal;
    }
  }

  const evasao = computeEvasaoTotal(filtered);
  const matBeneFin = bolsas + descontos;

  return {
    matriculas: computeMatriculasCount(matriculados, filters),
    bolsas,
    descontos,
    formados,
    fatOriginalPrevisto: fatOriginal,
    fatDescontoPrevisto: fatDesconto,
    matricCancelado: evasao.raCanceladoCount + evasao.planoCanceladoCount,
    matricEvadido: evasao.evadido,
    matricTransferencia: evasao.transf,
    evasaoBolsas: evasao.total,
    fatDescontoMatriculado: fatDescontoMat,
    matBeneFin,
    renunciaValorEvasao: renuncia,
  };
}

/* =====================================================================
   Chart computations
   ===================================================================== */

function groupCount(
  rows: EnrichedBolsaRow[],
  key: (r: EnrichedBolsaRow) => string,
): ChartDatum[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m, ([categoria, valor]) => ({ categoria, valor }));
}

function groupSum(
  rows: EnrichedBolsaRow[],
  key: (r: EnrichedBolsaRow) => string,
  value: (r: EnrichedBolsaRow) => number,
): ChartDatum[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + value(r));
  }
  return Array.from(m, ([categoria, valor]) => ({ categoria, valor }));
}

export function computeTopDescontos(rows: EnrichedBolsaRow[]): ChartDatum[] {
  return groupCount(
    rows.filter((r) => r.tipoBeneficio === 'Desconto'),
    (r) => r.bolsaPadronizada,
  )
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
}

export function computeOcorrenciasBolsa(rows: EnrichedBolsaRow[]): ChartDatum[] {
  const all = groupCount(
    rows.filter((r) => r.tipoBeneficio === 'Bolsa'),
    (r) => r.bolsaPadronizada,
  ).sort((a, b) => b.valor - a.valor);
  const TOP = 15;
  if (all.length <= TOP) return all;
  const top = all.slice(0, TOP);
  const outrosValor = all.slice(TOP).reduce((s, x) => s + x.valor, 0);
  if (outrosValor > 0) top.push({ categoria: 'Outros', valor: outrosValor });
  return top;
}

export function computeDistribuicaoBeneficios(
  rows: EnrichedBolsaRow[],
): ChartDatum[] {
  let bolsas = 0;
  let descontos = 0;
  for (const r of rows) {
    if (r.situacaoMatriculaPl !== 'Matriculado') continue;
    if (r.tipoBeneficio === 'Bolsa') bolsas += 1;
    else if (r.tipoBeneficio === 'Desconto') descontos += 1;
  }
  return [
    { categoria: 'Bolsas', valor: bolsas },
    { categoria: 'Descontos', valor: descontos },
  ];
}

export function computeTopCursosFaturamento(
  rows: EnrichedBolsaRow[],
): ChartDatum[] {
  const filtered = rows.filter(
    (r) =>
      r.tipoBeneficio === 'Desconto' &&
      r.situacaoMatriculaPl === 'Matriculado' &&
      !!r.curso,
  );
  return groupSum(
    filtered,
    (r) => r.curso ?? '',
    (r) => r.valorOriginal,
  )
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
}

export function computeEvasaoBeneficios(
  rows: EnrichedBolsaRow[],
): ChartDatum[] {
  return computeEvasaoByGroup(rows, (r) => r.bolsaPadronizada)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
}

export function computeEvasaoPorAno(
  rows: EnrichedBolsaRow[],
): EvasaoPorAnoDatum[] {
  const matBeneFinMap = new Map<number, number>();
  const evasaoMap = new Map<number, EvasaoAcc>();

  for (const r of rows) {
    if (r.ano === null) continue;

    if (
      (r.tipoBeneficio === 'Bolsa' || r.tipoBeneficio === 'Desconto') &&
      r.situacaoMatriculaPl === 'Matriculado'
    ) {
      matBeneFinMap.set(r.ano, (matBeneFinMap.get(r.ano) ?? 0) + 1);
    }

    if (!r.situacaoCurso || !EVASAO_STATUSES.has(r.situacaoCurso)) continue;
    let acc = evasaoMap.get(r.ano);
    if (!acc) {
      acc = newEvasaoAcc();
      evasaoMap.set(r.ano, acc);
    }
    accEvasao(acc, r);
  }

  const anos = new Set<number>([...matBeneFinMap.keys(), ...evasaoMap.keys()]);
  return Array.from(anos, (ano) => ({
    ano,
    matBeneFin: matBeneFinMap.get(ano) ?? 0,
    evasaoBolsas: evasaoTotal(evasaoMap.get(ano) ?? newEvasaoAcc()),
  })).sort((a, b) => a.ano - b.ano);
}

export function computeEvasaoPorModalidade(
  rows: EnrichedBolsaRow[],
): ChartDatum[] {
  return computeEvasaoByGroup(rows, (r) => r.tipoCurso);
}

export function computeFilterOptions(rows: EnrichedBolsaRow[]): FilterOptions {
  const cp = new Set<string>();
  const anos = new Set<number>();
  const tc = new Set<string>();
  const bp = new Set<string>();
  for (const r of rows) {
    if (r.codperletNorm) cp.add(r.codperletNorm);
    if (r.ano !== null) anos.add(r.ano);
    if (r.tipoCurso) tc.add(r.tipoCurso);
    if (r.bolsaPadronizada) bp.add(r.bolsaPadronizada);
  }
  return {
    codperletOptions: Array.from(cp).sort((a, b) => b.localeCompare(a)),
    anoOptions: Array.from(anos).sort((a, b) => b - a),
    tipocursoOptions: Array.from(tc).sort(),
    bolsaPadronizadaOptions: Array.from(bp).sort(),
  };
}

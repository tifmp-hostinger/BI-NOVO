import { supabase } from '@/lib/supabase';
import { regionOf } from '@/lib/brStates';
import { parseDecimal } from '@/dashboards/analise-de-conversao/dateUtils';

export type MatriculaSource = 'pos' | 'cursoslivres';

export type Matricula = {
  source: MatriculaSource;
  estado: string;
  cidade: string;
  curso: string;
  situacao: string;
  modalidade: string;
  aluno: string;
  ra: string;
  ticket: number;
  faturado: number;
  data: string;
};

async function fetchAll<T>(
  table: string,
  columns: string
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as unknown as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
    if (out.length > 50000) break;
  }
  return out;
}

type PosRow = {
  estado: string | null;
  cidade: string | null;
  curso: string | null;
  situacao: string | null;
  modalidadepos: string | null;
  aluno: string | null;
  ra: string | null;
  ticketmediocurso: string | null;
  faturadoliq: string | null;
  datadematricula: string | null;
};

type LivreRow = {
  estado: string | null;
  cidade: string | null;
  curso: string | null;
  situacao_matricula: string | null;
  nivel_ensino: string | null;
  aluno: string | null;
  ra: string | null;
  valor_curso_com_desconto: string | null;
  valor_baixado: string | null;
  data_contrato: string | null;
};

export async function listMatriculas(): Promise<Matricula[]> {
  const [pos, livres] = await Promise.all([
    fetchAll<PosRow>(
      'stg_rm_matriculas_pos',
      'estado, cidade, curso, situacao, modalidadepos, aluno, ra, ticketmediocurso, faturadoliq, datadematricula'
    ),
    fetchAll<LivreRow>(
      'stg_rm_matriculas_cursoslivres',
      'estado, cidade, curso, situacao_matricula, nivel_ensino, aluno, ra, valor_curso_com_desconto, valor_baixado, data_contrato'
    ),
  ]);

  const posMatriculas: Matricula[] = pos.map((r) => ({
    source: 'pos',
    estado: (r.estado ?? '').trim().toUpperCase(),
    cidade: (r.cidade ?? '').trim(),
    curso: (r.curso ?? '').trim(),
    situacao: (r.situacao ?? '').trim(),
    modalidade: (r.modalidadepos ?? '').trim() || 'Pos-graduacao',
    aluno: (r.aluno ?? '').trim(),
    ra: (r.ra ?? '').trim(),
    ticket: parseDecimal(r.ticketmediocurso),
    faturado: parseDecimal(r.faturadoliq),
    data: (r.datadematricula ?? '').trim(),
  }));

  const livreMatriculas: Matricula[] = livres.map((r) => ({
    source: 'cursoslivres',
    estado: (r.estado ?? '').trim().toUpperCase(),
    cidade: (r.cidade ?? '').trim(),
    curso: (r.curso ?? '').trim(),
    situacao: (r.situacao_matricula ?? '').trim(),
    modalidade: (r.nivel_ensino ?? '').trim() || 'Curso Livre',
    aluno: (r.aluno ?? '').trim(),
    ra: (r.ra ?? '').trim(),
    ticket: parseDecimal(r.valor_curso_com_desconto),
    faturado: parseDecimal(r.valor_baixado),
    data: (r.data_contrato ?? '').trim(),
  }));

  return [...posMatriculas, ...livreMatriculas].filter((m) => m.estado);
}

export type StateAgg = {
  uf: string;
  total: number;
  pos: number;
  livres: number;
  matriculados: number;
  faturado: number;
  ticket: number;
  region: string;
};

export type Aggregates = {
  total: number;
  totalPos: number;
  totalLivres: number;
  matriculados: number;
  faturado: number;
  ticketMedio: number;
  byState: StateAgg[];
  byRegion: Array<{ name: string; value: number }>;
  bySituacao: Array<{ name: string; value: number }>;
  byModalidade: Array<{ name: string; value: number }>;
  ufsCount: number;
  cidadesCount: number;
};

export function aggregate(data: Matricula[]): Aggregates {
  const stateMap = new Map<string, StateAgg>();
  const regionMap = new Map<string, number>();
  const situMap = new Map<string, number>();
  const modaMap = new Map<string, number>();
  const cidades = new Set<string>();

  let totalPos = 0;
  let totalLivres = 0;
  let matriculados = 0;
  let faturado = 0;
  let ticketSum = 0;
  let ticketCount = 0;

  for (const m of data) {
    let s = stateMap.get(m.estado);
    if (!s) {
      s = {
        uf: m.estado,
        total: 0,
        pos: 0,
        livres: 0,
        matriculados: 0,
        faturado: 0,
        ticket: 0,
        region: regionOf(m.estado),
      };
      stateMap.set(m.estado, s);
    }
    s.total += 1;
    if (m.source === 'pos') {
      s.pos += 1;
      totalPos += 1;
    } else {
      s.livres += 1;
      totalLivres += 1;
    }
    if (m.faturado > 0) {
      s.faturado += m.faturado;
      faturado += m.faturado;
    }
    if (m.ticket > 0) {
      s.ticket += m.ticket;
      ticketSum += m.ticket;
      ticketCount += 1;
    }
    if (m.situacao.toLowerCase().startsWith('matricula')) {
      s.matriculados += 1;
      matriculados += 1;
    }

    regionMap.set(s.region, (regionMap.get(s.region) ?? 0) + 1);

    const sit = m.situacao || 'Nao informado';
    situMap.set(sit, (situMap.get(sit) ?? 0) + 1);

    const mod = m.modalidade || 'Nao informado';
    modaMap.set(mod, (modaMap.get(mod) ?? 0) + 1);

    if (m.cidade) cidades.add(`${m.estado}-${m.cidade}`);
  }

  const byState = Array.from(stateMap.values())
    .map((s) => ({
      ...s,
      ticket: s.ticket && s.pos + s.livres > 0 ? s.ticket / (s.pos + s.livres) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const byRegion = Array.from(regionMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const bySituacao = Array.from(situMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const byModalidade = Array.from(modaMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    total: data.length,
    totalPos,
    totalLivres,
    matriculados,
    faturado,
    ticketMedio: ticketCount > 0 ? ticketSum / ticketCount : 0,
    byState,
    byRegion,
    bySituacao,
    byModalidade,
    ufsCount: stateMap.size,
    cidadesCount: cidades.size,
  };
}

export type StateDetail = {
  uf: string;
  total: number;
  pos: number;
  livres: number;
  faturado: number;
  ticketMedio: number;
  matriculados: number;
  cursos: Array<{ name: string; value: number; faturado: number }>;
  cidades: Array<{ name: string; value: number }>;
  situacoes: Array<{ name: string; value: number }>;
  modalidades: Array<{ name: string; value: number }>;
  amostraAlunos: Array<{ ra: string; aluno: string; curso: string; cidade: string; situacao: string }>;
};

export function detailForState(data: Matricula[], uf: string): StateDetail {
  const rows = data.filter((m) => m.estado === uf);
  const cursoMap = new Map<string, { count: number; faturado: number }>();
  const cidMap = new Map<string, number>();
  const situMap = new Map<string, number>();
  const modaMap = new Map<string, number>();

  let pos = 0;
  let livres = 0;
  let faturado = 0;
  let ticketSum = 0;
  let ticketCount = 0;
  let matriculados = 0;

  for (const m of rows) {
    if (m.source === 'pos') pos += 1;
    else livres += 1;
    if (m.faturado > 0) faturado += m.faturado;
    if (m.ticket > 0) {
      ticketSum += m.ticket;
      ticketCount += 1;
    }
    if (m.situacao.toLowerCase().startsWith('matricula')) matriculados += 1;

    const curso = m.curso || 'Nao informado';
    const cur = cursoMap.get(curso) ?? { count: 0, faturado: 0 };
    cur.count += 1;
    cur.faturado += m.faturado > 0 ? m.faturado : 0;
    cursoMap.set(curso, cur);

    if (m.cidade) cidMap.set(m.cidade, (cidMap.get(m.cidade) ?? 0) + 1);
    situMap.set(m.situacao || 'Nao informado', (situMap.get(m.situacao || 'Nao informado') ?? 0) + 1);
    modaMap.set(m.modalidade || 'Nao informado', (modaMap.get(m.modalidade || 'Nao informado') ?? 0) + 1);
  }

  const cursos = Array.from(cursoMap.entries())
    .map(([name, v]) => ({ name, value: v.count, faturado: v.faturado }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const cidades = Array.from(cidMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const situacoes = Array.from(situMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const modalidades = Array.from(modaMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const amostra = rows.slice(0, 8).map((m) => ({
    ra: m.ra,
    aluno: m.aluno,
    curso: m.curso,
    cidade: m.cidade,
    situacao: m.situacao,
  }));

  return {
    uf,
    total: rows.length,
    pos,
    livres,
    faturado,
    ticketMedio: ticketCount > 0 ? ticketSum / ticketCount : 0,
    matriculados,
    cursos,
    cidades,
    situacoes,
    modalidades,
    amostraAlunos: amostra,
  };
}

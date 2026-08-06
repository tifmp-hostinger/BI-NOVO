import { supabase } from '@/lib/supabase';
import type {
  InscricaoRow,
  MatriculaGradRow,
  MatriculaMestradoRow,
  MatriculaPosRow,
  MetaMestrado,
  MetaPos,
  PeriodoLetivo,
  RubeusLead,
} from './types';

const PAGE_SIZE = 1000;
const HARD_CAP = 60_000;

/**
 * Paginacao generica: o Supabase nao retorna mais de 1000 registros por chamada.
 * O caller monta a query e devolve a promise da faixa selecionada.
 */
async function paginate<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await build(from, to);
    if (error) throw error as Error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (out.length >= HARD_CAP) break;
  }
  return out;
}

// ---------------- Periodos letivos (pletivo) ----------------

export async function listPletivos(): Promise<PeriodoLetivo[]> {
  const { data, error } = await supabase
    .from('pletivo')
    .select(
      'periodo_letivo, data_inicio_matricula, data_fim_matricula, data_conclusao_curso, indice, numero_vagas'
    )
    .order('indice', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    periodo: r.periodo_letivo as string,
    data_inicio_matricula: r.data_inicio_matricula as string | null,
    data_fim_matricula: r.data_fim_matricula as string | null,
    data_conclusao_curso: r.data_conclusao_curso as string | null,
    indice: r.indice as number,
    numero_vagas: r.numero_vagas as number | null,
  }));
}

export async function listMetasMestrado(): Promise<MetaMestrado[]> {
  const { data, error } = await supabase
    .from('meta_mestrado')
    .select('ano, vagas, meta')
    .order('ano', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MetaMestrado[];
}

export async function listMetasPos(): Promise<MetaPos[]> {
  const { data, error } = await supabase
    .from('meta_pos')
    .select('ano, mes_numero, mes_nome, meta')
    .order('ano', { ascending: true })
    .order('mes_numero', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ano: r.ano as number,
    mes_numero: r.mes_numero as number,
    mes_nome: r.mes_nome as string,
    meta:
      r.meta === null || r.meta === undefined
        ? null
        : typeof r.meta === 'number'
        ? r.meta
        : Number(String(r.meta).replace(',', '.')),
  }));
}

// ---------------- Rubeus (leads) ----------------

export async function fetchRubeusLeadsGraduacao(
  dataInicio: string,
  dataFim: string
): Promise<RubeusLead[]> {
  return paginate<RubeusLead>((from, to) =>
    supabase
      .from('rubeus_registros_personalizada')
      .select('processo, pessoa_nome, momento_date, momento_ano')
      .eq('processo', 'Graduação')
      .gte('momento_date', dataInicio)
      .lte('momento_date', dataFim)
      .range(from, to)
  );
}

export async function fetchRubeusLeadsMestrado(ano: number): Promise<RubeusLead[]> {
  return paginate<RubeusLead>((from, to) =>
    supabase
      .from('rubeus_registros_personalizada')
      .select('processo, pessoa_nome, momento_date, momento_ano')
      .eq('processo', 'Mestrado')
      .eq('momento_ano', ano)
      .range(from, to)
  );
}

// ---------------- Inscricoes ----------------

export async function fetchInscricoesGraduacao(): Promise<InscricaoRow[]> {
  return paginate<InscricaoRow>((from, to) =>
    supabase
      .from('stg_rm_inscricoes_graduacao')
      .select('nome, cpf, processoseletivo, datainscricao')
      .range(from, to)
  );
}

export async function fetchInscricoesMestrado(): Promise<InscricaoRow[]> {
  return paginate<InscricaoRow>((from, to) =>
    supabase
      .from('stg_rm_inscricoes_mestrado')
      .select('nome, cpf, processoseletivo, datainscricao')
      .range(from, to)
  );
}

// ---------------- Matriculas ----------------

export async function fetchMatriculasGraduacao(): Promise<MatriculaGradRow[]> {
  return paginate<MatriculaGradRow>((from, to) =>
    supabase
      .from('stg_rm_matriculas_grad')
      .select('ra, aluno, codperlet, situacao, tipomatricula, datamatricula')
      .range(from, to)
  );
}

export async function fetchMatriculasMestrado(): Promise<MatriculaMestradoRow[]> {
  return paginate<MatriculaMestradoRow>((from, to) =>
    supabase
      .from('stg_rm_matriculas_mestrado')
      .select('ra, aluno, codperlet, situacao, tipomatricula, datamatricula')
      .range(from, to)
  );
}

export async function fetchMatriculasPos(): Promise<MatriculaPosRow[]> {
  return paginate<MatriculaPosRow>((from, to) =>
    supabase
      .from('stg_rm_matriculas_pos')
      .select(
        'aluno, ra, curso, processoseletivo, descontoaluno, situacao, bolsas, bolsa3, databaixa, datacancelamentomatricula, faturadoliq, datadematricula'
      )
      .range(from, to)
  );
}



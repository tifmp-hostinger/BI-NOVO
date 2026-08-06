import { loadAllFrom, normalizeCodperlet } from '@/lib/supabasePaginate';
import { supabase } from '@/lib/supabase';
import { toISODate } from './dateUtils';
import type {
  ClInscDia,
  DashboardDataset,
  RawInscricaoCursosLivesRow,
  RawInscricaoGradRow,
  RawInscricaoMestradoRow,
  RawInscricaoPosRow,
  RawMatriculaBolsaRow,
  RawMatriculaCursosLivesRow,
  RawMatriculaGradRow,
  RawMatriculaMestradoRow,
  RawMatriculaPosRow,
  RawMetaPosRow,
  RawPletivoRow,
  RawRubeusRow,
} from './types';

// Cache em nível de módulo: navegar para outro dashboard e voltar NÃO refaz
// o download (~200k linhas). O botão "Atualizar" usa clearDashboardCache().
let cachedDataset: DashboardDataset | null = null;

export function clearDashboardCache(): void {
  cachedDataset = null;
}

export type LoadProgress = (etapa: number, totalEtapas: number, descricao: string) => void;

const TOTAL_ETAPAS = 4;

/**
 * Carrega os dados em 4 lotes SEQUENCIAIS (não tudo em paralelo) para não
 * estourar o limite de requisições simultâneas do Supabase free tier.
 */
export async function fetchDashboardData(
  onProgress?: LoadProgress,
  forceRefresh = false,
): Promise<DashboardDataset> {
  if (cachedDataset && !forceRefresh) return cachedDataset;

  // Lote 1 — tabelas pequenas (metas/pletivo) + rubeus
  onProgress?.(1, TOTAL_ETAPAS, 'Carregando leads e metas');
  // meta_graduacao e meta_mestrado NÃO são consultadas: este dashboard usa a
  // constante MEST_META (herança do BI) e não lê a meta de graduação. Baixá-las
  // era tráfego sem uso.
  const [pletivo, metaPos, rubeus] = [
    await loadPletivo(),
    await loadMetaPos(),
    await loadRubeus(),
  ];

  // Lote 2 — graduação e mestrado
  onProgress?.(2, TOTAL_ETAPAS, 'Carregando graduação e mestrado');
  const [matriculasGrad, inscricoesGrad, inscricoesMestrado, matriculasMestrado] = [
    await loadMatriculasGrad(),
    await loadInscricoesGrad(),
    await loadInscricoesMestrado(),
    await loadMatriculasMestrado(),
  ];

  // Lote 3 — pós/especializações + bolsas (já filtrada no servidor)
  onProgress?.(3, TOTAL_ETAPAS, 'Carregando especializações');
  const [matriculasPos, inscricoesPos, matriculasBolsas] = [
    await loadMatriculasPos(),
    await loadInscricoesPos(),
    await loadMatriculasBolsas(),
  ];

  // Lote 4 — cursos livres (a tabela de inscrições tem 100k+ linhas;
  // agregamos por dia logo após o fetch e descartamos o array bruto)
  onProgress?.(4, TOTAL_ETAPAS, 'Carregando cursos livres');
  const clInscPorDia = await loadClInscAgregado();
  const matriculasCursosLives = await loadMatriculasCursosLives();

  cachedDataset = {
    rubeus,
    matriculasGrad,
    inscricoesGrad,
    inscricoesPos,
    inscricoesMestrado,
    matriculasMestrado,
    matriculasPos,
    clInscPorDia,
    matriculasCursosLives,
    matriculasBolsas,
    pletivo,
    metaPos,
  };
  return cachedDataset;
}

async function loadRubeus(): Promise<RawRubeusRow[]> {
  const cols = 'momento_date,momento_ano,processo,pessoa_nome,canal_nome,etapa_nome';
  const rows = await loadAllFrom('rubeus_registros_personalizada', cols);
  return rows as RawRubeusRow[];
}

async function loadMatriculasGrad(): Promise<RawMatriculaGradRow[]> {
  const cols = 'ra,aluno,codperlet,situacao,tipomatricula,tipoingresso,datamatricula';
  const rows = await loadAllFrom('stg_rm_matriculas_grad', cols);
  return rows as RawMatriculaGradRow[];
}

async function loadInscricoesGrad(): Promise<RawInscricaoGradRow[]> {
  const cols = 'cpf,nome,areainteresse,processoseletivo,datainscricao,statusps';
  const rows = await loadAllFrom('stg_rm_inscricoes_graduacao', cols);
  return rows as RawInscricaoGradRow[];
}

async function loadInscricoesPos(): Promise<RawInscricaoPosRow[]> {
  const cols = 'cpf,processoseletivo,statusps,datainscricao';
  const rows = await loadAllFrom('stg_rm_inscricoes_pos', cols);
  return rows as RawInscricaoPosRow[];
}

async function loadInscricoesMestrado(): Promise<RawInscricaoMestradoRow[]> {
  const cols = 'cpf,nome,processoseletivo,datainscricao,statusps,periodo_letivo';
  try {
    const rows = await loadAllFrom('stg_rm_inscricoes_mestrado', cols);
    return rows as RawInscricaoMestradoRow[];
  } catch {
    const fallback = await loadAllFrom('stg_rm_inscricoes_mestrado', 'cpf,nome,processoseletivo,datainscricao,statusps');
    return fallback as RawInscricaoMestradoRow[];
  }
}

async function loadMatriculasMestrado(): Promise<RawMatriculaMestradoRow[]> {
  const cols = 'ra,aluno,codperlet,situacao,tipomatricula,datamatricula';
  const rows = await loadAllFrom('stg_rm_matriculas_mestrado', cols);
  return rows as RawMatriculaMestradoRow[];
}

async function loadMatriculasPos(): Promise<RawMatriculaPosRow[]> {
  const cols =
    'ra,aluno,curso,cursoreduzido,codperlet,situacao,descontoaluno,modalidadepos,distanciapresencial,bolsas,bolsa3,databaixa,datadematricula,datacancelamentomatricula,faturadobruto,faturadoliq,codplanopgto,tcc,estado,processoseletivo';
  const rows = await loadAllFrom('stg_rm_matriculas_pos', cols);
  return rows as RawMatriculaPosRow[];
}

const SITUACAO_CL_MATRICULADO = new Set(['Matricula', 'Matriculado']);

/**
 * stg_rm_inscricoes_cursoslivres tem 100k+ linhas. Buscamos só 3 colunas e
 * agregamos por dia imediatamente, descartando o array bruto (memória).
 */
async function loadClInscAgregado(): Promise<ClInscDia[]> {
  const cols = 'numeroinscricao,situacao_matricula,datainscricao';
  const rows = (await loadAllFrom('stg_rm_inscricoes_cursoslivres', cols)) as RawInscricaoCursosLivesRow[];
  const porDia = new Map<string, { total: number; mat: number }>();
  for (const r of rows) {
    const iso = toISODate(r.datainscricao) ?? '';
    const entry = porDia.get(iso) ?? { total: 0, mat: 0 };
    entry.total += 1;
    if (SITUACAO_CL_MATRICULADO.has((r.situacao_matricula ?? '').trim())) entry.mat += 1;
    porDia.set(iso, entry);
  }
  return Array.from(porDia.entries())
    .map(([data, v]) => ({ data, total: v.total, mat: v.mat }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

async function loadMatriculasCursosLives(): Promise<RawMatriculaCursosLivesRow[]> {
  const cols = 'curso,situacao_matricula,valor_curso_com_desconto,data_contrato,aluno';
  const rows = await loadAllFrom('stg_rm_matriculas_cursoslivres', cols);
  return rows as RawMatriculaCursosLivesRow[];
}

const BOLSAS_INCENTIVO_VALUES = [
  'BOLSA INCENTIVO EDUCACIONAL',
  'BOLSA SOCIOECONÔMICA',
];

async function loadMatriculasBolsas(): Promise<RawMatriculaBolsaRow[]> {
  // Filtro NO SERVIDOR: só as 2 bolsas usadas na regra "bolsista"
  // (reduz ~129k linhas para ~9,5k).
  const rows = await loadAllFrom(
    'stg_rm_matriculas_bolsas',
    'ra,bolsa',
    undefined,
    { column: 'bolsa', values: BOLSAS_INCENTIVO_VALUES },
  );
  return rows as RawMatriculaBolsaRow[];
}

async function loadPletivo(): Promise<RawPletivoRow[]> {
  const { data, error } = await supabase.from('pletivo').select('*').order('indice');
  if (error) throw error;
  return (data ?? []) as RawPletivoRow[];
}

async function loadMetaPos(): Promise<RawMetaPosRow[]> {
  const { data, error } = await supabase.from('meta_pos').select('*');
  if (error) throw error;
  return (data ?? []) as RawMetaPosRow[];
}

export { normalizeCodperlet };

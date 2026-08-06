/**
 * Regras de negocio herdadas do modelo Power BI.
 * Centralizadas neste arquivo para manter os componentes visuais limpos.
 * Divergencias e observacoes: docs/analise-conversao-presidencia-observacoes.md
 */

import { normalizeStr } from './formatters';

// -------- Processos (Rubeus) --------

export const RUBEUS_PROCESSO_GRADUACAO = 'Graduação';
export const RUBEUS_PROCESSO_MESTRADO = 'Mestrado';
export const RUBEUS_PROCESSO_POS = 'Pós Graduação';

// -------- Situacoes / matriculas --------

export const MATRICULA_SITUACAO_ATIVA = 'Matriculado';
export const MATRICULA_TIPO_NOVA = 'Nova Matricula';

/**
 * O RM não atualiza a linha "Matriculado" quando o aluno cancela — grava uma
 * SEGUNDA linha para o mesmo RA com esta situação. Sem checar isso, contar
 * por "existe linha com situacao=Matriculado" conta quem já cancelou (a
 * linha antiga continua lá). Confirmado no banco: todo RA com esta situação
 * também tem uma linha "Matriculado" para o mesmo período.
 */
export const MATRICULA_SITUACAO_CANCELADA = 'Cancelado – Curso';

/**
 * Situacoes consideradas "qualificacao" no Mestrado (para conversao).
 */
export const MESTRADO_SITUACOES_QUALIFICADAS = [
  'Matriculado',
  'Matriculado- Pendente Contrato',
];

// -------- Especializacoes (Pos) --------

/**
 * Situacoes excluidas do faturamento de Pos (regra Power BI).
 * Comparacao normalizada (sem acento, minusculo) para tolerar variacoes.
 */
export const POS_SITUACOES_EXCLUIDAS_NORMALIZED = new Set(
  [
    'Óbito',
    'Evadido Curso',
    'Formado',
    'Troca de Ciclo',
    'Transferência Interna',
    'Pré Matricula',
  ].map(normalizeStr)
);

export const POS_CURSO_EXCLUIDO_NORMALIZED = normalizeStr(
  'Pós-graduação em Direito Público (ead)'
);

export const POS_DESCONTOALUNO_VALIDO = 'Pagante';

/*
 * Exceções nominais do Power BI trocadas por RA: o nome completo é dado
 * pessoal e ficava visível no código e no bundle. Cada RA cobre exatamente o
 * mesmo conjunto de registros que o nome cobria — validado no banco antes da
 * troca (contagem por nome == contagem por RA, 1 RA por pessoa, sem homônimo).
 */

/** Alunos excluidos globalmente (regra Power BI). */
export const POS_ALUNOS_EXCLUIDOS_RA = new Set(['21100143']);

/** Alunos excluidos apenas do EAD (regra Power BI). */
export const POS_ALUNOS_EXCLUIDOS_EAD_RA = new Set(['26063775']);

/** Alunos "testes" identificados por substring (regra Power BI). */
export const POS_ALUNO_TESTE_SUBSTR = 'teste';

/**
 * Excecoes aa regra "excluir se bolsas contem TROCA DE PL".
 * Estes alunos permanecem incluidos mesmo com TROCA DE PL nas bolsas.
 */
export const POS_TROCA_DE_PL_EXCECOES_RA = new Set(['26064143']);

/** Alunos com tratamento especial de cancelamentos EAD. */
export const POS_EAD_CANCEL_EXCECOES_RA = new Set(['26064137']);

/**
 * Data limite de cancelamentos EAD que muda tratamento (regra Power BI).
 * Cancelamentos posteriores a esta data recebem regra especifica.
 */
export const POS_EAD_DATA_LIMITE_CANCEL = '2026-06-01';

/**
 * Processoseletivo -> modalidade (regra estrita herdada do Power BI).
 */
export function modalidadePos(processoseletivo: string | null | undefined):
  | 'Pos Presencial'
  | 'Pos EAD' {
  const raw = (processoseletivo ?? '').trim();
  if (raw === 'Inscrição Pós Graduação Presencial') return 'Pos Presencial';
  return 'Pos EAD';
}

/** Regra 1.7: registro passa nas exclusoes gerais do faturamento. */
export function passesPosExclusoesGerais(row: {
  aluno?: string | null;
  /** Identifica as excecoes nominais herdadas do BI sem expor o nome. */
  ra?: string | null;
  curso?: string | null;
  descontoaluno?: string | null;
  situacao?: string | null;
  bolsas?: string | null;
  bolsa3?: string | null;
}): boolean {
  const aluno = row.aluno ?? '';
  const alunoN = normalizeStr(aluno);
  const cursoN = normalizeStr(row.curso ?? '');
  const descontoaluno = (row.descontoaluno ?? '').trim();
  const situacaoN = normalizeStr(row.situacao ?? '');

  if (descontoaluno !== POS_DESCONTOALUNO_VALIDO) return false;
  if (cursoN === POS_CURSO_EXCLUIDO_NORMALIZED) return false;
  if (POS_SITUACOES_EXCLUIDAS_NORMALIZED.has(situacaoN)) return false;
  if (alunoN.includes(POS_ALUNO_TESTE_SUBSTR)) return false;
  if (POS_ALUNOS_EXCLUIDOS_RA.has((row.ra ?? '').trim())) return false;

  const bolsasStr = `${row.bolsas ?? ''} ${row.bolsa3 ?? ''}`;
  if (/TROCA DE PL/i.test(bolsasStr)) {
    if (!POS_TROCA_DE_PL_EXCECOES_RA.has((row.ra ?? '').trim())) return false;
  }

  return true;
}

/** Verifica se o registro esta excluido especificamente do EAD (identificado por RA). */
export function isExcluidoEad(ra: string | null | undefined): boolean {
  return POS_ALUNOS_EXCLUIDOS_EAD_RA.has((ra ?? '').trim());
}

/**
 * Calculos puros do dashboard Analise de Conversao - Presidencia.
 * Todas as funcoes sao determinasticas: entram linhas brutas do Supabase, saem KPIs.
 * As regras de negocio herdadas do Power BI estao em rules.ts (com o rationale
 * documentado em docs/analise-conversao-presidencia-observacoes.md).
 */

import {
  anoFromPeriodo,
  derivePeriodoFromProcessoGrad,
  derivePeriodoFromProcessoMestrado,
  normalizeCodperlet,
  normalizeStr,
  parseBRNumber,
} from './formatters';
import {
  MATRICULA_SITUACAO_ATIVA,
  MATRICULA_SITUACAO_CANCELADA,
  MATRICULA_TIPO_NOVA,
  MESTRADO_SITUACOES_QUALIFICADAS,
  POS_EAD_CANCEL_EXCECOES_RA,
  POS_EAD_DATA_LIMITE_CANCEL,
  isExcluidoEad,
  modalidadePos,
  passesPosExclusoesGerais,
} from './rules';
import type {
  EspecializacoesKpis,
  GraduacaoKpis,
  InscricaoRow,
  MatriculaGradRow,
  MatriculaMestradoRow,
  MatriculaPosRow,
  MestradoKpis,
  MetaMestrado,
  MetaPos,
  PeriodoLetivo,
  RubeusLead,
} from './types';

// -------------------- Graduacao --------------------

export function computeGraduacaoKpis(
  periodo: string,
  pletivo: PeriodoLetivo | null,
  rubeus: RubeusLead[],
  inscricoes: InscricaoRow[],
  matriculas: MatriculaGradRow[]
): GraduacaoKpis {
  const vagas = pletivo?.numero_vagas ?? 0;

  // Rubeus ja e filtrado por processo=Graduacao e faixa de datas na query.
  // Aqui apenas contamos (regra Power BI: COUNT, nao DISTINCT).
  const leads = rubeus.length;

  // Inscricoes do periodo: derivar por processoseletivo "YYYY/S".
  const inscricoesPeriodo = inscricoes.filter(
    (r) => derivePeriodoFromProcessoGrad(r.processoseletivo) === periodo
  );

  // Distinct por CPF (fallback: nome normalizado).
  const cpfsDistintos = new Set<string>();
  for (const r of inscricoesPeriodo) {
    const key = (r.cpf ?? '').trim() || normalizeStr(r.nome);
    if (key) cpfsDistintos.add(key);
  }
  const inscricoes_ = cpfsDistintos.size;

  // Inscricoes_lead: inscricoes cujo nome aparece no rubeus (denominador da conversao).
  const nomesLead = new Set<string>();
  for (const r of rubeus) {
    const n = normalizeStr(r.pessoa_nome);
    if (n) nomesLead.add(n);
  }
  const inscritosNoLead = new Set<string>();
  for (const r of inscricoesPeriodo) {
    const nome = normalizeStr(r.nome);
    if (nome && nomesLead.has(nome)) {
      const key = (r.cpf ?? '').trim() || nome;
      inscritosNoLead.add(key);
    }
  }
  const inscricoesLead = inscritosNoLead.size;

  // O RM não atualiza a linha "Matriculado" ao cancelar — grava uma segunda
  // linha para o mesmo RA com situacao=Cancelado. Sem descontar por RA (não
  // só por linha), a linha antiga ainda contava quem já cancelou.
  const rasCanceladosNoPeriodo = new Set<string>();
  for (const m of matriculas) {
    if ((m.situacao ?? '').trim() !== MATRICULA_SITUACAO_CANCELADA) continue;
    if ((m.tipomatricula ?? '').trim() !== MATRICULA_TIPO_NOVA) continue;
    if (normalizeCodperlet(m.codperlet) !== periodo) continue;
    const ra = (m.ra ?? '').trim();
    if (ra) rasCanceladosNoPeriodo.add(ra);
  }

  // Matriculas: situacao=Matriculado + tipomatricula=Nova Matricula + codperlet=periodo, distinct RA.
  const rasDistintos = new Set<string>();
  for (const m of matriculas) {
    if ((m.situacao ?? '').trim() !== MATRICULA_SITUACAO_ATIVA) continue;
    if ((m.tipomatricula ?? '').trim() !== MATRICULA_TIPO_NOVA) continue;
    if (normalizeCodperlet(m.codperlet) !== periodo) continue;
    const ra = (m.ra ?? '').trim();
    if (ra && !rasCanceladosNoPeriodo.has(ra)) rasDistintos.add(ra);
  }
  const matriculasCount = rasDistintos.size;

  const conversao = inscricoesLead > 0 ? matriculasCount / inscricoesLead : null;
  const percentualMeta = vagas > 0 ? matriculasCount / vagas : null;

  const hoje = new Date().toISOString().slice(0, 10);
  const processoFinalizado =
    !!pletivo?.data_fim_matricula && pletivo.data_fim_matricula < hoje;

  return {
    periodo,
    vagas,
    leads,
    inscricoes: inscricoes_,
    inscricoesLead,
    matriculas: matriculasCount,
    conversao,
    percentualMeta,
    processoFinalizado,
  };
}

// -------------------- Mestrado --------------------

export function computeMestradoKpis(
  ano: number,
  meta: MetaMestrado | null,
  rubeus: RubeusLead[],
  inscricoes: InscricaoRow[],
  matriculas: MatriculaMestradoRow[]
): MestradoKpis {
  const vagas = meta?.vagas ?? 0;
  const metaValor = meta?.meta ?? 0;

  // Rubeus ja filtrado por processo=Mestrado e momento_ano=ano na query.
  const leads = rubeus.length;

  // Inscricoes: derivar periodo por processoseletivo; contar as que pertencem ao ano.
  // Regra Power BI: "Complementar" tem precedencia e mapeia para 26-01.
  const yyAlvo = String(ano).slice(-2);
  const inscricoesAno = inscricoes.filter((r) => {
    const p = derivePeriodoFromProcessoMestrado(r.processoseletivo);
    return p !== null && p.startsWith(yyAlvo);
  });

  const cpfsInsc = new Set<string>();
  for (const r of inscricoesAno) {
    const key = (r.cpf ?? '').trim() || normalizeStr(r.nome);
    if (key) cpfsInsc.add(key);
  }
  const inscricoesCount = cpfsInsc.size;

  // Matriculas: Nova Matricula + Matriculado + codperlet do ano; distinct RA.
  // Qualificadas: RA distintos cuja situacao pertence a MESTRADO_SITUACOES_QUALIFICADAS.
  // Desconto de cancelamento (ver MATRICULA_SITUACAO_CANCELADA): o RM grava
  // uma segunda linha ao cancelar, a linha "Matriculado" antiga fica — sem
  // descontar por RA, ela contaria (e "qualificaria") quem já cancelou.
  const rasCanceladosNoAno = new Set<string>();
  for (const m of matriculas) {
    const cod = normalizeCodperlet(m.codperlet);
    if (!cod.startsWith(yyAlvo)) continue;
    if ((m.tipomatricula ?? '').trim() !== MATRICULA_TIPO_NOVA) continue;
    if ((m.situacao ?? '').trim() !== MATRICULA_SITUACAO_CANCELADA) continue;
    const ra = (m.ra ?? '').trim();
    if (ra) rasCanceladosNoAno.add(ra);
  }

  const rasNovas = new Set<string>();
  const rasQualificados = new Set<string>();
  for (const m of matriculas) {
    const cod = normalizeCodperlet(m.codperlet);
    if (!cod.startsWith(yyAlvo)) continue;
    const situacao = (m.situacao ?? '').trim();
    const tipo = (m.tipomatricula ?? '').trim();
    const ra = (m.ra ?? '').trim();
    if (!ra || rasCanceladosNoAno.has(ra)) continue;

    if (tipo === MATRICULA_TIPO_NOVA && situacao === MATRICULA_SITUACAO_ATIVA) {
      rasNovas.add(ra);
    }
    if (MESTRADO_SITUACOES_QUALIFICADAS.includes(situacao)) {
      rasQualificados.add(ra);
    }
  }

  const matriculasCount = rasNovas.size;
  const matriculasQualificadas = rasQualificados.size;

  // Conversao (regra herdada do Power BI): matriculas_qualificadas / matriculas_total
  // O label historico "% Conversao Inscritos" nao corresponde aa formula real;
  // preservamos o comportamento e documentamos em docs/*-observacoes.md.
  const conversao =
    matriculasCount > 0 ? matriculasQualificadas / matriculasCount : null;
  const percentualMeta = metaValor > 0 ? matriculasCount / metaValor : null;

  return {
    ano,
    vagas,
    meta: metaValor,
    leads,
    inscricoes: inscricoesCount,
    matriculas: matriculasCount,
    matriculasQualificadas,
    conversao,
    percentualMeta,
  };
}

// -------------------- Especializacoes (Pos) --------------------

function isDateInSelection(iso: string | null | undefined, ano: number, meses: number[]): boolean {
  if (!iso) return false;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return false;
  return y === ano && meses.includes(m);
}

/**
 * Regra de cancelamento herdada:
 * - Se possui datacancelamentomatricula: registro NAO conta para o faturamento
 *   (mesmo pagante), EXCETO alunos da lista de excecoes E cancelamentos aa partir
 *   de POS_EAD_DATA_LIMITE_CANCEL na modalidade EAD.
 */
function cancelamentoImpedeFaturamento(row: MatriculaPosRow, modalidade: string): boolean {
  const cancel = (row.datacancelamentomatricula ?? '').trim();
  if (!cancel) return false;

  if (POS_EAD_CANCEL_EXCECOES_RA.has((row.ra ?? '').trim())) return false;

  // EAD: cancelamentos aa partir da data limite mantem o faturamento.
  if (modalidade === 'Pos EAD' && cancel >= POS_EAD_DATA_LIMITE_CANCEL) return false;

  return true;
}

export function computeEspecializacoesKpis(
  ano: number,
  meses: number[],
  metaPos: MetaPos[],
  matriculasPos: MatriculaPosRow[]
): EspecializacoesKpis {
  const mesesUnicos = Array.from(new Set(meses)).sort((a, b) => a - b);

  // Meta: soma apenas meses selecionados no ano; ignora nulos.
  let meta: number | null = null;
  const metasFiltradas = metaPos.filter(
    (r) => r.ano === ano && mesesUnicos.includes(r.mes_numero) && r.meta !== null
  );
  if (metasFiltradas.length > 0) {
    meta = metasFiltradas.reduce((acc, r) => acc + (r.meta ?? 0), 0);
  }

  // Dedup EAD por (aluno, curso): apenas primeira ocorrencia soma.
  const eadVistos = new Set<string>();

  let faturamentoPresencial = 0;
  let faturamentoEad = 0;

  for (const row of matriculasPos) {
    if (!isDateInSelection(row.databaixa, ano, mesesUnicos)) continue;
    if (!passesPosExclusoesGerais(row)) continue;

    const modalidade = modalidadePos(row.processoseletivo);

    if (modalidade === 'Pos EAD' && isExcluidoEad(row.ra)) continue;
    if (cancelamentoImpedeFaturamento(row, modalidade)) continue;

    const valor = parseBRNumber(row.faturadoliq) ?? 0;
    if (!valor) continue;

    if (modalidade === 'Pos EAD') {
      const key = `${normalizeStr(row.aluno)}|${normalizeStr(row.curso)}`;
      if (eadVistos.has(key)) continue;
      eadVistos.add(key);
      faturamentoEad += valor;
    } else {
      faturamentoPresencial += valor;
    }
  }

  const faturamentoTotal = faturamentoPresencial + faturamentoEad;
  const percentualMeta =
    meta && meta > 0 ? faturamentoTotal / meta : null;

  return {
    ano,
    meses: mesesUnicos,
    meta,
    faturamentoPresencial,
    faturamentoEad,
    faturamentoTotal,
    percentualMeta,
  };
}

// helper exportado para o hook decidir a faixa de data ao chamar as queries.
export function graduacaoDateRangeFromPletivos(
  pletivos: PeriodoLetivo[],
  periodo: string
): { dataInicio: string; dataFim: string } | null {
  const p = pletivos.find((x) => x.periodo === periodo);
  if (!p) return null;
  const dataFim = p.data_fim_matricula ?? p.data_conclusao_curso ?? undefined;
  if (!p.data_inicio_matricula || !dataFim) return null;
  return { dataInicio: p.data_inicio_matricula, dataFim };
}

// re-export util para o hook nao precisar reimportar formatters
export { anoFromPeriodo };

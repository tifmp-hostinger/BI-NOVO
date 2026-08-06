export type PeriodoLetivo = {
  periodo: string;
  data_inicio_matricula: string | null;
  data_fim_matricula: string | null;
  data_conclusao_curso: string | null;
  indice: number;
  numero_vagas: number | null;
};

export type MetaMestrado = { ano: number; vagas: number; meta: number };
export type MetaPos = {
  ano: number;
  mes_numero: number;
  mes_nome: string;
  meta: number | null;
};

export type GraduacaoKpis = {
  periodo: string;
  vagas: number;
  leads: number;
  inscricoes: number;
  inscricoesLead: number;
  matriculas: number;
  conversao: number | null;
  percentualMeta: number | null;
  processoFinalizado: boolean;
};

export type MestradoKpis = {
  ano: number;
  vagas: number;
  meta: number;
  leads: number;
  inscricoes: number;
  matriculas: number;
  matriculasQualificadas: number;
  conversao: number | null;
  percentualMeta: number | null;
};

export type EspecializacoesKpis = {
  ano: number;
  meses: number[];
  meta: number | null;
  faturamentoPresencial: number;
  faturamentoEad: number;
  faturamentoTotal: number;
  percentualMeta: number | null;
};

export type RubeusLead = {
  processo: string | null;
  pessoa_nome: string | null;
  momento_date: string | null;
  momento_ano: number | null;
};

export type InscricaoRow = {
  nome: string | null;
  cpf: string | null;
  processoseletivo: string | null;
  datainscricao: string | null;
};

export type MatriculaGradRow = {
  ra: string | null;
  aluno: string | null;
  codperlet: string | null;
  situacao: string | null;
  tipomatricula: string | null;
  /** Só para o proxy de frescor (dataFreshness.ts) — não usado nos cálculos. */
  datamatricula: string | null;
};

export type MatriculaMestradoRow = MatriculaGradRow;

export type MatriculaPosRow = {
  /** Identifica as exceções herdadas do BI sem expor o nome do aluno. */
  ra?: string | null;
  aluno: string | null;
  curso: string | null;
  processoseletivo: string | null;
  descontoaluno: string | null;
  situacao: string | null;
  bolsas: string | null;
  bolsa3: string | null;
  databaixa: string | null;
  datacancelamentomatricula: string | null;
  faturadoliq: string | null;
  /** Só para o proxy de frescor (dataFreshness.ts) — não usado nos cálculos. */
  datadematricula: string | null;
};

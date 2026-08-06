export type RawRubeusRow = {
  momento_date: string | null;
  momento_ano: string | number | null;
  processo: string | null;
  pessoa_nome: string | null;
  canal_nome: string | null;
  etapa_nome: string | null;
};

export type RawMatriculaGradRow = {
  ra: string | null;
  aluno: string | null;
  codperlet: string | null;
  situacao: string | null;
  tipomatricula: string | null;
  tipoingresso: string | null;
  datamatricula: string | null;
};

export type RawInscricaoGradRow = {
  cpf: string | null;
  nome: string | null;
  areainteresse: string | null;
  processoseletivo: string | null;
  datainscricao: string | null;
  statusps: string | null;
};

export type RawInscricaoPosRow = {
  cpf: string | null;
  processoseletivo: string | null;
  statusps: string | null;
  datainscricao: string | null;
};

export type RawInscricaoMestradoRow = {
  cpf: string | null;
  nome: string | null;
  processoseletivo: string | null;
  datainscricao: string | null;
  statusps: string | null;
  periodo_letivo: string | null;
};

export type RawMatriculaMestradoRow = {
  ra: string | null;
  aluno: string | null;
  codperlet: string | null;
  situacao: string | null;
  tipomatricula: string | null;
  datamatricula: string | null;
};

export type RawMatriculaPosRow = {
  ra: string | null;
  aluno: string | null;
  curso: string | null;
  cursoreduzido: string | null;
  codperlet: string | null;
  situacao: string | null;
  descontoaluno: string | null;
  modalidadepos: string | null;
  distanciapresencial: string | null;
  bolsas: string | null;
  bolsa3: string | null;
  databaixa: string | null;
  datadematricula: string | null;
  datacancelamentomatricula: string | null;
  faturadobruto: string | null;
  faturadoliq: string | null;
  codplanopgto: string | null;
  tcc: string | null;
  estado: string | null;
  processoseletivo: string | null;
};

export type RawInscricaoCursosLivesRow = {
  numeroinscricao: string | null;
  situacao_matricula: string | null;
  datainscricao: string | null;
};

/**
 * Agregado diário das inscrições de Cursos Livres (106k+ linhas brutas são
 * agregadas logo após o fetch e descartadas, para reduzir memória).
 * total = nº de inscrições no dia; mat = nº com situacao_matricula em
 * {'Matricula','Matriculado'}.
 */
export type ClInscDia = {
  data: string;
  total: number;
  mat: number;
};

export type RawMatriculaCursosLivesRow = {
  curso: string | null;
  situacao_matricula: string | null;
  valor_curso_com_desconto: string | null;
  data_contrato: string | null;
  aluno: string | null;
};

export type RawMatriculaBolsaRow = {
  ra: string | null;
  bolsa: string | null;
};

export type RawPletivoRow = {
  periodo_letivo: string;
  data_inicio_matricula: string | null;
  data_fim_matricula: string | null;
  data_conclusao_curso: string | null;
  indice: number | null;
  numero_vagas: number | null;
  numero_bolsas: number | null;
};

export type RawMetaGraduacaoRow = {
  periodo_letivo: string;
  meta: number;
};

export type RawMetaMestradoRow = {
  ano: number;
  vagas: number;
  meta: number;
};

export type RawMetaPosRow = {
  ano: number;
  mes_numero: number;
  mes_nome: string;
  meta: number;
};

export type ConversaoFilters = {
  codperlet: string[];
  ano: number[];
  mes: number[];
  dataInicio: string | null;
  dataFim: string | null;
};

export type FilterOptions = {
  codperletOptions: string[];
  anoOptions: number[];
  mesOptions: { numero: number; nome: string }[];
};

export type CalendarEntry = {
  date: string;
  ano: number;
  mes: number;
  mesNome: string;
  ordemFiscal: number;
};

export type GaugeDatum = {
  label: string;
  value: number;
  caption?: string;
};

export type LeadsMensalDatum = {
  mesAno: string;
  ordemFiscal: number;
  leads: number;
  convLeadsInsc: number;
  convLeadsMat: number;
};

export type ChartDatum = {
  categoria: string;
  valor: number;
};

export type GeralKpis = {
  gradPctMetaAtual: number;
  gradPctMetaAnterior: number;
  gradPeriodoAtual: string;
  gradPeriodoAnterior: string;
  gradMatEfetAtual: number;
  gradVagasAtual: number;
  gradMatEfetAnterior: number;
  gradVagasAnterior: number;
  especPctMeta: number;
  especFat: number;
  especFatEad: number;
  especFatPres: number;
  especMetaFat: number;
  mestPctMeta: number;
  mestMat: number;
  mestMeta: number;
  mestAno: number;
};

export type LeadsData = {
  gradMensal: LeadsMensalDatum[];
  especMensal: LeadsMensalDatum[];
  mestMensal: LeadsMensalDatum[];
  leadsPorCanal: ChartDatum[];
  entradaGradEspec: LeadsMensalDatum[];
};

export type GraduacaoData = {
  leads: number;
  insc: number;
  matEfet: number;
  vagas: number;
  matCanc: number;
  matPre: number;
  matBolsas: number;
  matPgt: number;
  pctMeta: number;
  pctConvIxL: number;
  pctConvMxI: number;
  pctConvMxL: number;
  pgtVsBolsas: ChartDatum[];
  inscPorTurno: ChartDatum[];
  inscPorProcesso: ChartDatum[];
  matPorTipoIngresso: ChartDatum[];
  matPorDia: { data: string; valor: number }[];
};

export type RematriculaData = {
  evasaoPorPeriodo: {
    periodo: string;
    evJubilado: number;
    evEvadido: number;
    evCancelado: number;
    evTransferido: number;
  }[];
  reingressoPorPeriodo: {
    periodo: string;
    reingressoConf: number;
    reingressoAguard: number;
  }[];
  rematriculaPorPeriodo: {
    periodo: string;
    rematConf: number;
    rematNaoRealiz: number;
  }[];
};

export type EspecializacoesMensalDatum = {
  mesAno: string;
  ordemFiscal: number;
  fat: number;
  mat: number;
  fatEad: number;
  fatPres: number;
};

export type EspecializacoesData = {
  leads: number;
  fat: number;
  fatEad: number;
  fatPres: number;
  metaFat: number;
  pctMeta: number;
  mat: number;
  tktMedio: number;
  tktMedioEad: number;
  tktMedioPres: number;
  descontoMedio: number;
  fatMensal: EspecializacoesMensalDatum[];
  top5CursosFat: ChartDatum[];
  fatPorModalidade: ChartDatum[];
  fatPorTcc: ChartDatum[];
};

export type ModalidadePosData = {
  modalidade: 'Pós Presencial' | 'Pós EAD';
  leads: number;
  insc: number;
  mat: number;
  comTcc: number;
  semTcc: number;
  fat: number;
  tktMedio: number;
  descontoMedio: number;
  fatPorCurso: ChartDatum[];
  topDescontosFat: ChartDatum[];
  top5PlanosPgto: ChartDatum[];
  fatPorEstado: { uf: string; total: number }[];
};

export type CursosLivresData = {
  leads: number;
  insc: number;
  mat: number;
  pctConversao: number;
  fat: number;
  leadsPorCanal: ChartDatum[];
  inscVsMatMensal: { mesAno: string; ordemFiscal: number; leads: number; mat: number }[];
  fatPorCurso: ChartDatum[];
};

export type MestradoData = {
  leads: number;
  insc: number;
  mat: number;
  taxaPaga: number;
  taxaAPagar: number;
  pctConversao: number;
  pctMeta: number;
  inscPorProcesso: ChartDatum[];
  statusInscricoes: ChartDatum[];
  leadsPorCanal: ChartDatum[];
};

export type DashboardDataset = {
  rubeus: RawRubeusRow[];
  matriculasGrad: RawMatriculaGradRow[];
  inscricoesGrad: RawInscricaoGradRow[];
  inscricoesPos: RawInscricaoPosRow[];
  inscricoesMestrado: RawInscricaoMestradoRow[];
  matriculasMestrado: RawMatriculaMestradoRow[];
  matriculasPos: RawMatriculaPosRow[];
  clInscPorDia: ClInscDia[];
  matriculasCursosLives: RawMatriculaCursosLivesRow[];
  matriculasBolsas: RawMatriculaBolsaRow[];
  pletivo: RawPletivoRow[];
  metaPos: RawMetaPosRow[];
};

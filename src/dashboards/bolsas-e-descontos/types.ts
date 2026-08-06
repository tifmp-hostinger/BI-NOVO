export type BolsasFilters = {
  codperlet: string[];
  ano: number[];
  tipocurso: string[];
  bolsaPadronizada: string[];
};

export type FilterOptions = {
  codperletOptions: string[];
  anoOptions: number[];
  tipocursoOptions: string[];
  bolsaPadronizadaOptions: string[];
};

export type PanoramaKpis = {
  matriculas: number;
  bolsas: number;
  descontos: number;
  formados: number;
  fatOriginalPrevisto: number;
  fatDescontoPrevisto: number;
  matricCancelado: number;
  matricEvadido: number;
  matricTransferencia: number;
  evasaoBolsas: number;
  fatDescontoMatriculado: number;
  matBeneFin: number;
  renunciaValorEvasao: number;
};

export type ChartDatum = {
  categoria: string;
  valor: number;
};

export type EvasaoPorAnoDatum = {
  ano: number;
  matBeneFin: number;
  evasaoBolsas: number;
};

export type RawBolsaRow = {
  ra: string | null;
  curso: string | null;
  codperlet: string | null;
  situacao_curso: string | null;
  situacao_matriculapl: string | null;
  bolsa: string | null;
  codplanopgto: string | null;
  valororiginal: string | number | null;
  valordoliq: string | number | null;
  /** Só para o proxy de frescor (dataFreshness.ts) — não usado nos cálculos. */
  data_matricula: string | null;
};

export type RawDimBeneficio = {
  valor_original_rm: string | null;
  tipo_beneficio_padronizado: string | null;
};

export type TipoCurso =
  | 'Graduação'
  | 'Mestrado'
  | 'Curso Preparatório'
  | 'Pós Graduação';

export type EnrichedBolsaRow = {
  ra: string | null;
  curso: string | null;
  codperlet: string | null;
  codperletNorm: string;
  ano: number | null;
  situacaoCurso: string | null;
  situacaoMatriculaPl: string | null;
  bolsa: string | null;
  bolsaPadronizada: string;
  tipoBeneficio: string;
  tipoCurso: TipoCurso;
  codplanopgto: string | null;
  valorOriginal: number;
  valorDoLiq: number;
};

export type MatriculadoRow = {
  ra: string;
  codperletNorm: string;
  /** Só para o proxy de frescor (dataFreshness.ts) — não usado nos cálculos. */
  data: string | null;
};

export type MatriculadosData = {
  grad: MatriculadoRow[];
  pos: MatriculadoRow[];
  mestrado: MatriculadoRow[];
};

export type DimBeneficioMap = Map<string, string>;

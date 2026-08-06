import type { Produto } from './constants';
import type { RawPletivoRow } from '../analise-de-conversao/types';

export type RawMetaAdsRow = {
  date_start: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  impressions: string | null;
  clicks: string | null;
  spend: string | null;
  reach: string | null;
  action_type: string | null;
  value: string | null;
};

export type RawGoogleAdsRow = {
  date: string | null;
  geotargetstate: string | null;
  campaign_name: string | null;
  impressions: string | null;
  clicks: string | null;
  costmicros: string | null;
  conversions: string | null;
};

export type RawRubeusGrowthRow = {
  /** ID da pessoa. É `bigint` no Postgres, então o PostgREST devolve NÚMERO
   *  em JSON — daí o `string | number`. O agrupamento da aba Origem usa SÓ
   *  este campo, nunca pessoa_nome (privacidade). */
  pessoa: string | number | null;
  /** timestamptz completo — ordena a jornada (momento_date só tem o dia). */
  momento: string | null;
  momento_date: string | null;
  momento_hora: string | null;
  nome_dia: string | null;
  processo: string | null;
  canal_nome: string | null;
  fonte_action: string | null;
  status_oportunidade: string | null;
};

/** Grad e Mestrado compartilham o mesmo shape (mesmas colunas no RM). */
export type RawMatGradMestRow = {
  aluno: string | null;
  /** Desempate estável de DataReferencia (ver fatPorRef). */
  codcontrato: string | null;
  situacao: string | null;
  tipomatricula: string | null;
  datamatricula: string | null;
  datacontrato: string | null;
  datacancelamentocontrato: string | null;
  faturadoliq: string | null;
};

export type RawMatPosGrowthRow = {
  aluno: string | null;
  /** Identifica as exceções nominais herdadas do BI sem expor o nome. */
  ra: string | null;
  curso: string | null;
  situacao: string | null;
  processoseletivo: string | null;
  descontoaluno: string | null;
  distanciapresencial: string | null;
  bolsas: string | null;
  bolsa3: string | null;
  /** Desempate estável quando duas databaixa empatam (ver faturamentoPos). */
  codplanopgto: string | null;
  databaixa: string | null;
  datacancelamentomatricula: string | null;
  inscricaodata: string | null;
  faturadoliq: string | null;
  /** Só para o proxy de frescor (dataFreshness.ts) — não usado nos cálculos. */
  datadematricula: string | null;
};

export type RawMatCLGrowthRow = {
  aluno: string | null;
  databaixa: string | null;
  valor_curso_com_desconto: string | null;
  /** Só para o proxy de frescor (dataFreshness.ts) — não usado nos cálculos. */
  data_contrato: string | null;
};

/** Inscrições agregadas por dia logo após o fetch (memória). */
export type InscPorDia = { data: string; total: number };

export type GrowthDataset = {
  meta: RawMetaAdsRow[];
  google: RawGoogleAdsRow[];
  rubeus: RawRubeusGrowthRow[];
  matGrad: RawMatGradMestRow[];
  matMestrado: RawMatGradMestRow[];
  matPos: RawMatPosGrowthRow[];
  matCL: RawMatCLGrowthRow[];
  inscGrad: InscPorDia[];
  /** stg_rm_inscricoes_pos separada por processoseletivo (ver queries.ts). */
  inscPosEad: InscPorDia[];
  inscPosPresencial: InscPorDia[];
  inscMestrado: InscPorDia[];
  inscCL: InscPorDia[];
  pletivo: RawPletivoRow[];
};

export type Fonte = 'Google' | 'Meta' | 'Todos';

export type GrowthFilters = {
  produto: Produto;
  /** null = sem filtro de fonte (leads contam registros do Rubeus — §5.2). */
  fonte: Fonte | null;
  dataInicio: string | null;
  dataFim: string | null;
  periodoLetivo: string[];
  fimDeSemana: 'Fim de Semana' | 'Dia de Semana' | null;
};

export type GrowthView = 'campanhas' | 'mapa' | 'horarios' | 'leads' | 'matriculas' | 'origem';

/** Uma linha da aba Origem (agregado por canal ou por plataforma). */
export type OrigemDatum = {
  nome: string;
  pessoas: number;
  matriculas: number;
  /** null quando não há pessoas no recorte. */
  taxa: number | null;
  /** true quando pessoas < 50 — taxa sem significado estatístico. */
  amostraPequena: boolean;
};

export type OrigemData = {
  porPlataforma: OrigemDatum[];
  porCanal: OrigemDatum[];
  totalPessoas: number;
  totalMatriculas: number;
};

export type MediaMetrics = {
  leadsGoogle: number;
  leadsMeta: number;
  investimentoGoogle: number;
  investimentoMeta: number;
  impressoesGoogle: number;
  impressoesMeta: number;
  clicksGoogle: number;
  clicksMeta: number;
  alcanceMeta: number;
  /** Combinados conforme o seletor Fonte */
  investimento: number;
  impressoes: number;
  clicks: number;
  /** null = "--" (Google não expõe reach) */
  alcance: number | null;
  cpl: number | null;
  cpc: number | null;
  ctr: number | null;
  frequencia: number | null;
  leads: number;
};

export type NegocioMetrics = {
  matriculas: number;
  faturamento: number;
  cancelamentos: number;
  inscritos: number;
  cac: number | null;
  ticketMedio: number | null;
  taxaConv: number | null;
  roas: number | null;
  roasMidia: number | null;
  conversaoRubeus: number | null;
};

export type CampanhaRow = {
  campanha: string;
  plataforma: 'Google' | 'Meta';
  leads: number;
  investimento: number;
  impressoes: number;
};

export type HorarioDatum = {
  inicio: number;
  faixa: string;
  leads: number;
  /** null = sem lead com status na faixa (o gráfico abre lacuna). */
  taxaConv: number | null;
};

export type SerieMensalDatum = {
  cod: number;
  mesAno: string;
  valor: number;
  investimento: number;
};

export type MapaUfDatum = { uf: string; conversoes: number; investimento: number };

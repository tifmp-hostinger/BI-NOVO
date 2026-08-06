import { parseDecimal, toISODate } from '../analise-de-conversao/dateUtils';
import {
  EXCECAO_TROCA_PL_RA,
  EXCLUSOES_FATURAMENTO_POS_RA,
} from '../analise-de-conversao/calculations';
import {
  AJUSTE_ALUNO_RA,
  AJUSTE_DATA,
  CAMPANHAS_META_EXCLUIDAS,
  META_LEAD_ACTIONS,
  REGION_ID_UF,
  buildMesAnoCalendar,
  classificaFimDeSemana,
  faixaHora,
} from './constants';
import type {
  CampanhaRow,
  GrowthDataset,
  GrowthFilters,
  HorarioDatum,
  MapaUfDatum,
  MediaMetrics,
  NegocioMetrics,
  OrigemData,
  OrigemDatum,
  RawMatGradMestRow,
  SerieMensalDatum,
} from './types';

const num = parseDecimal;

// ---------------------------------------------------------------------------
// Classificação de Modalidade (§4)
// ---------------------------------------------------------------------------

/** Substitui TODAS as ocorrências (target do projeto não tem replaceAll). */
function replaceAll(s: string, busca: string, troca: string): string {
  return s.split(busca).join(troca);
}

/**
 * Réplica do Text.Proper do Power Query: capitaliza a primeira letra de cada
 * sequência alfabética — ou seja, depois de QUALQUER caractere não-alfabético,
 * não só depois de espaço. É isso que faz '[ACT] - ARWARNESS' virar
 * '[Act] - Arwarness' e casar com o replace da regra do Google; capitalizando
 * só após espaço o resultado seria '[act] - Arwarness' e a campanha (582 mil
 * impressões) ficaria sem modalidade.
 */
function properCase(s: string): string {
  const lower = s.toLowerCase();
  let out = '';
  let anteriorEhLetra = false;
  for (const ch of lower) {
    const ehLetra = ch.toLowerCase() !== ch.toUpperCase();
    out += ehLetra && !anteriorEhLetra ? ch.toUpperCase() : ch;
    anteriorEhLetra = ehLetra;
  }
  return out;
}

/**
 * Blocos de modalidade conhecidos (após remover colchetes e aplicar
 * Text.Proper) → resultado final. Precisa produzir EXATAMENTE o mesmo que a
 * cadeia de replaces de substring; validado contra as 77 campanhas do banco.
 */
const MODALIDADE_BLOCO_EXATO: Record<string, string> = {
  Grad: 'Graduação',
  Graduação: 'Graduação',
  Pós: 'Pós EAD',
  'Pós Presencial': 'Pós Presencial',
  'Pós Pres': 'Pós Presencial',
  'Curso Livre': 'Cursos Livres',
  'Cursos Livres': 'Cursos Livres',
  Ia: 'Cursos Livres',
  Mestrado: 'Mestrado',
  'Nova Marca': 'Nova Marca',
};

/**
 * Modalidade a partir de campaign_name do Meta (regra COMPLETA — a
 * nomenclatura mudou ~dez/2025 e convivem dois padrões no banco).
 *
 * A ordem dos replaces importa e são substituições de SUBSTRING:
 * '[PÓS PRESENCIAL]' → 'Pós Presencial' → o replace de 'Pós' o transforma em
 * 'Pós EAD Presencial' → o replace seguinte conserta. O passo final
 * 'Pós EAD EAD'→'Pós EAD' desfaz a reaplicação do passo 5 sobre o que já
 * virou 'Pós EAD' no passo 3. Não reordenar.
 *
 * HERANÇA (preservar, não consertar): campanhas com '[LP]' no 3º bloco viram
 * 'Lp' e uma vira 'Palestra' — modalidades fora da lista canônica que somem
 * da segmentação, como no BI (R$ 6.049,63 + R$ 4.455,01 no histórico). Não
 * criar categoria "Outros" nem forçar modalidade.
 */
export function modalidadeMeta(campaignName: string | null | undefined): string {
  const nome = campaignName ?? '';
  const blocos = nome.split(' - ');
  // Objetivo = texto antes do primeiro " - " (a string inteira se não houver)
  const objetivo = blocos[0] ?? '';
  // Modalidade = 3º bloco, removendo colchetes, depois Title Case
  const bloco3 = blocos[2] ?? '';
  let mod = properCase(replaceAll(replaceAll(bloco3, '[', ''), ']', '').trim());

  // Atalho por IGUALDADE do bloco inteiro para os valores conhecidos. Os
  // replaces abaixo são de SUBSTRING e são frágeis: um bloco '[GRADUAÇÃO]'
  // por extenso viraria 'Graduaçãouação' e a campanha sumiria do dashboard.
  // Hoje todas as campanhas usam as formas curtas; o mapa evita a regressão
  // sem alterar nenhum resultado atual.
  const exato = MODALIDADE_BLOCO_EXATO[mod];
  if (exato) return exato;

  mod = replaceAll(mod, 'Grad', 'Graduação');
  mod = replaceAll(mod, 'Ia', 'Cursos Livres');
  mod = replaceAll(mod, 'Pós', 'Pós EAD');
  mod = replaceAll(mod, 'Pós EAD Presencial', 'Pós Presencial');
  mod = replaceAll(mod, 'Curso Livre', 'Cursos Livres');
  mod = replaceAll(mod, 'Pós EAD Pres', 'Pós Presencial');

  // FALLBACK (padrão antigo de nomenclatura, sem blocos " - "): texto após a
  // ÚLTIMA ocorrência de "] " no Objetivo, depois o texto antes do 1º espaço.
  if (!mod) {
    const idx = objetivo.lastIndexOf('] ');
    const resto = (idx >= 0 ? objetivo.slice(idx + 2) : objetivo).trim();
    const sp = resto.indexOf(' ');
    mod = sp >= 0 ? resto.slice(0, sp) : resto;
  }

  // Replaces finais — aplicados SEMPRE (daí o 'Pós EAD EAD' de correção).
  mod = replaceAll(mod, 'Pós', 'Pós EAD');
  mod = replaceAll(mod, 'Pós EAD Presencial', 'Pós Presencial');
  mod = replaceAll(mod, 'Pós EAD EAD', 'Pós EAD');
  return mod;
}

/**
 * Modalidade a partir de campaign_name do Google (§4.2). Os replaces de
 * 'Especializações Presenciais' e '[Act] - Arwarness' precisam rodar ANTES do
 * replace final 'Especialização'→'Pós Presencial' — a ordem abaixo garante
 * isso.
 *
 * HERANÇA: o corte no primeiro ' |' descarta o sufixo do nome, então TODA
 * campanha 'ARWARNESS' cai em '[Act] - Arwarness' e vira Pós Presencial —
 * inclusive a '[ACT] - ARWARNESS | CONT | FMP GRADUAÇÃO EM DIREITO', que é
 * de Graduação. É o comportamento do BI e está embutido nos números de
 * referência; preservar.
 */
export function modalidadeGoogle(campaignName: string | null | undefined): string {
  let s = replaceAll(campaignName ?? '', '[ACT] - SEARCH | CONT | FMP ', '');
  const idx = s.indexOf(' |');
  if (idx >= 0) s = s.slice(0, idx);
  s = properCase(s.trim());
  s = replaceAll(s, 'Pós Graduação', 'Pós EAD');
  s = replaceAll(s, 'Especializações Presenciais', 'Especialização');
  s = replaceAll(s, '[Act] - Arwarness', 'Especialização');
  s = replaceAll(s, 'Especialização', 'Pós Presencial');
  s = replaceAll(s, ' 2026/2', '');
  return s.trim();
}

/**
 * Modalidade de um lead do Rubeus (§4.3).
 * 🔴 processoNormalizado é obrigatório: o Power Query fazia o replace final
 * 'Pós Graduação'→'Pós' que a carga do n8n NÃO replicou — o banco tem 21k+
 * linhas com 'Pós Graduação' (57% do total). Sem normalizar, esses leads
 * sumiriam de todo o dashboard.
 */
export function modalidadeLead(
  processo: string | null | undefined,
  canalNome: string | null | undefined,
): string {
  if ((canalNome ?? '').trim() === 'Action Day - Especialização Presencial') {
    return 'Pós Presencial';
  }
  const p = (processo ?? '').trim();
  const processoNormalizado = p === 'Pós Graduação' ? 'Pós' : p;
  return processoNormalizado === 'Pós' ? 'Pós EAD' : processoNormalizado;
}

// ---------------------------------------------------------------------------
// Linhas classificadas — calculadas UMA vez por dataset (WeakMap)
// ---------------------------------------------------------------------------

type MetaClassified = {
  dateIso: string;
  modalidade: string;
  adsetId: string;
  campanha: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  isLeadAction: boolean;
  value: number;
};

type GoogleClassified = {
  dateIso: string;
  modalidade: string;
  campanha: string;
  uf: string | null;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

type RubeusClassified = {
  dateIso: string;
  modalidade: string;
  faixaInicio: number | null;
  faixaRotulo: string | null;
  fimDeSemana: 'Fim de Semana' | 'Dia de Semana';
  ganho: boolean;
  temStatus: boolean;
  isCRM: boolean;
};

type ClassifiedData = {
  meta: MetaClassified[];
  google: GoogleClassified[];
  rubeus: RubeusClassified[];
};

const classifiedCache = new WeakMap<GrowthDataset, ClassifiedData>();

function getClassified(ds: GrowthDataset): ClassifiedData {
  const cached = classifiedCache.get(ds);
  if (cached) return cached;

  const meta: MetaClassified[] = [];
  for (const r of ds.meta) {
    // Campanhas removidas ANTES de qualquer cálculo (regra do PBI) —
    // igualdade exata da string, espaços duplos preservados (§B.2).
    if (CAMPANHAS_META_EXCLUIDAS.has(r.campaign_name ?? '')) continue;
    const dateIso = toISODate(r.date_start);
    if (!dateIso) continue;
    meta.push({
      dateIso,
      modalidade: modalidadeMeta(r.campaign_name),
      adsetId: (r.adset_id ?? '').trim(),
      campanha: (r.campaign_name ?? '').trim(),
      // HERANÇA CORRIGIDA §7.1: o Power Query dividia spend por 100, o que
      // deflacionava o investimento em 100× (e inflava ROAS em 100×). O dado
      // real da API já vem em reais — spend é usado CRU. Correção aprovada.
      spend: num(r.spend),
      impressions: num(r.impressions),
      reach: num(r.reach),
      clicks: num(r.clicks),
      isLeadAction: META_LEAD_ACTIONS.has((r.action_type ?? '').trim()),
      value: num(r.value),
    });
  }

  const google: GoogleClassified[] = [];
  for (const r of ds.google) {
    const dateIso = toISODate(r.date);
    if (!dateIso) continue;
    const geo = (r.geotargetstate ?? '').trim();
    const regionId = geo.includes('/') ? geo.slice(geo.lastIndexOf('/') + 1) : geo;
    google.push({
      dateIso,
      modalidade: modalidadeGoogle(r.campaign_name),
      campanha: (r.campaign_name ?? '').trim(),
      uf: REGION_ID_UF[regionId] ?? null,
      cost: num(r.costmicros) / 1_000_000,
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      conversions: num(r.conversions),
    });
  }

  const rubeus: RubeusClassified[] = [];
  for (const r of ds.rubeus) {
    const dateIso = toISODate(r.momento_date);
    if (!dateIso) continue;
    const fx = faixaHora(r.momento_hora);
    const status = (r.status_oportunidade ?? '').trim();
    rubeus.push({
      dateIso,
      modalidade: modalidadeLead(r.processo, r.canal_nome),
      faixaInicio: fx?.inicio ?? null,
      faixaRotulo: fx?.rotulo ?? null,
      fimDeSemana: classificaFimDeSemana(r.nome_dia, r.momento_hora),
      ganho: status === 'Ganho',
      temStatus: status !== '',
      isCRM: (r.canal_nome ?? '').trim() === 'CRM',
    });
  }

  const out: ClassifiedData = { meta, google, rubeus };
  classifiedCache.set(ds, out);
  return out;
}

// ---------------------------------------------------------------------------
// Jornada por pessoa (aba Origem)
//
// ⚠️ ESTA ABA NÃO EXISTE NO POWER BI. É funcionalidade nova, construída sobre
// dado que já está no banco — não há paridade a manter nem número do BI para
// comparar. Não "corrigir" para bater com o relatório publicado.
//
// A tabela do Rubeus é uma lista de MOMENTOS, não de pessoas: 37,5 mil
// registros para bem menos gente. As outras abas contam registros; aqui
// agrupamos por pessoa e creditamos o primeiro toque (first-touch).
// ---------------------------------------------------------------------------

export type Jornada = {
  canalOrigem: string;
  plataforma: string;
  modalidade: string;
  /** Data do PRIMEIRO toque — é ela que decide se a pessoa entra no recorte. */
  dataPrimeiroToque: string;
  fimDeSemana: 'Fim de Semana' | 'Dia de Semana';
  converteu: boolean;
  isCRM: boolean;
};

const PLATAFORMA_SEM_MIDIA = 'Sem toque de mídia';

/**
 * Plataforma a partir do texto de fonte_action. 'NULL' vem como STRING no
 * banco (22.915 registros), não como null de verdade.
 */
function plataformaDeFonte(fonte: string | null | undefined): string | null {
  const f = (fonte ?? '').trim();
  if (!f || f.toUpperCase() === 'NULL') return null;
  const low = f.toLowerCase();
  if (low.includes('facebook') || low.includes('audience')) return 'Meta';
  if (low.includes('google')) return 'Google';
  if (low.includes('indireta')) return 'Mídia Indireta';
  return null;
}

const jornadasCache = new WeakMap<GrowthDataset, Jornada[]>();

/**
 * Reconstrói a jornada de cada pessoa UMA vez por dataset (WeakMap): varre os
 * 37,5 mil registros só na primeira chamada. A jornada não muda com o filtro —
 * o que muda é quais pessoas entram no recorte.
 *
 * Privacidade: agrupa por `pessoa` (ID numérico), NUNCA por pessoa_nome.
 */
function getJornadas(ds: GrowthDataset): Jornada[] {
  const cached = jornadasCache.get(ds);
  if (cached) return cached;

  type Acc = {
    primeiroMomento: string;
    canalOrigem: string;
    modalidade: string;
    dataPrimeiroToque: string;
    fimDeSemana: 'Fim de Semana' | 'Dia de Semana';
    isCRM: boolean;
    /** momento do primeiro registro COM fonte de mídia preenchida */
    momentoMidia: string | null;
    plataforma: string | null;
    converteu: boolean;
  };

  const porPessoa = new Map<string, Acc>();

  for (const r of ds.rubeus) {
    // String(): `pessoa` é bigint no banco e chega como número.
    const pessoa = String(r.pessoa ?? '').trim();
    if (!pessoa) continue;
    const momento = String(r.momento ?? '').trim();
    if (!momento) continue;
    const dataIso = toISODate(r.momento_date) ?? toISODate(r.momento);
    if (!dataIso) continue;

    const ganho = (r.status_oportunidade ?? '').trim() === 'Ganho';
    const plat = plataformaDeFonte(r.fonte_action);
    const canal = (r.canal_nome ?? 'Não informado').trim();

    const atual = porPessoa.get(pessoa);
    if (!atual) {
      porPessoa.set(pessoa, {
        primeiroMomento: momento,
        canalOrigem: canal,
        modalidade: modalidadeLead(r.processo, r.canal_nome),
        dataPrimeiroToque: dataIso,
        fimDeSemana: classificaFimDeSemana(r.nome_dia, r.momento_hora),
        isCRM: canal === 'CRM',
        momentoMidia: plat ? momento : null,
        plataforma: plat,
        // Converteu = teve 'Ganho' em QUALQUER momento da jornada, não só no
        // primeiro toque.
        converteu: ganho,
      });
      continue;
    }

    if (ganho) atual.converteu = true;

    // Primeiro toque: menor `momento` da jornada.
    if (momento < atual.primeiroMomento) {
      atual.primeiroMomento = momento;
      atual.canalOrigem = canal;
      atual.modalidade = modalidadeLead(r.processo, r.canal_nome);
      atual.dataPrimeiroToque = dataIso;
      atual.fimDeSemana = classificaFimDeSemana(r.nome_dia, r.momento_hora);
      atual.isCRM = canal === 'CRM';
    }

    // Plataforma: primeira fonte_action PREENCHIDA da jornada. Não é
    // necessariamente a do primeiro toque — quem entra por um canal sem fonte
    // (Ficha de Inscrição, Action Day) e depois vem por anúncio é creditado à
    // mídia. É o que o rótulo "Sem toque de mídia" significa: nunca passou por
    // anúncio em momento nenhum.
    if (plat && (!atual.momentoMidia || momento < atual.momentoMidia)) {
      atual.momentoMidia = momento;
      atual.plataforma = plat;
    }
  }

  const out: Jornada[] = [];
  for (const a of porPessoa.values()) {
    out.push({
      canalOrigem: a.canalOrigem,
      plataforma: a.plataforma ?? PLATAFORMA_SEM_MIDIA,
      modalidade: a.modalidade,
      dataPrimeiroToque: a.dataPrimeiroToque,
      fimDeSemana: a.fimDeSemana,
      converteu: a.converteu,
      isCRM: a.isCRM,
    });
  }
  jornadasCache.set(ds, out);
  return out;
}

// ---------------------------------------------------------------------------
// Janela de datas e filtros
// ---------------------------------------------------------------------------

function inRange(iso: string | null, ini: string | null, fim: string | null): boolean {
  if (!iso) return false;
  if (ini && iso < ini) return false;
  if (fim && iso > fim) return false;
  return true;
}

/** fimDoMes(a) < fimDoMes(b) ⟺ o mês de a antecede o mês de b. */
function eomLt(aIso: string, bIso: string): boolean {
  return aIso.slice(0, 7) < bIso.slice(0, 7);
}

/** Janelas de matrícula dos períodos letivos selecionados (mesmo padrão do analise-de-conversao). */
function pletivoWindows(ds: GrowthDataset, filters: GrowthFilters): { ini: string; fim: string }[] {
  if (filters.periodoLetivo.length === 0) return [];
  const sel = new Set(filters.periodoLetivo);
  return ds.pletivo
    .filter((p) => sel.has(p.periodo_letivo) && p.data_inicio_matricula && p.data_fim_matricula)
    .map((p) => ({ ini: String(p.data_inicio_matricula), fim: String(p.data_fim_matricula) }));
}

/**
 * FILTRO DE PÁGINA do PBI: Rubeus[canal_nome] EXCLUI 'CRM' nas abas
 * Graduação, Mestrado e Pós EAD — corta ~32% da base de leads (11.894 de
 * 37.520 registros). NÃO se aplica a Pós Presencial nem Cursos Livres; a
 * assimetria muda a base de comparação entre abas e é HERANÇA INTENCIONAL —
 * não "consertar" adicionando a exclusão nas outras abas.
 */
const PRODUTOS_EXCLUEM_CRM = new Set(['Graduação', 'Mestrado', 'Pós EAD']);

function filterRubeus(ds: GrowthDataset, filters: GrowthFilters): RubeusClassified[] {
  const windows = pletivoWindows(ds, filters);
  return getClassified(ds).rubeus.filter((r) => {
    // Filtro de página d_modalidade[Modalidade] (sempre ativo, não é limpo
    // pelo "Limpar filtros" — só os slicers são).
    if (r.modalidade !== filters.produto) return false;
    if (PRODUTOS_EXCLUEM_CRM.has(filters.produto) && r.isCRM) return false;
    if (!inRange(r.dateIso, filters.dataInicio, filters.dataFim)) return false;
    if (filters.fimDeSemana && r.fimDeSemana !== filters.fimDeSemana) return false;
    if (windows.length > 0 && !windows.some((w) => r.dateIso >= w.ini && r.dateIso <= w.fim)) {
      return false;
    }
    return true;
  });
}

function filterMeta(ds: GrowthDataset, filters: GrowthFilters): MetaClassified[] {
  return getClassified(ds).meta.filter(
    (r) => r.modalidade === filters.produto && inRange(r.dateIso, filters.dataInicio, filters.dataFim),
  );
}

function filterGoogle(ds: GrowthDataset, filters: GrowthFilters): GoogleClassified[] {
  return getClassified(ds).google.filter(
    (r) => r.modalidade === filters.produto && inRange(r.dateIso, filters.dataInicio, filters.dataFim),
  );
}

// ---------------------------------------------------------------------------
// §5.1 — Dedup obrigatória do Meta antes de qualquer soma
// ---------------------------------------------------------------------------

/**
 * spend/impressions/reach/clicks se repetem em cada linha de ação do mesmo
 * (date_start, adset_id). Somar direto multiplicaria o investimento pelo
 * número de tipos de ação — soma-se UM valor por par, pegando o MAX.
 */
function dedupMetaSum(rows: MetaClassified[], field: 'spend' | 'impressions' | 'reach' | 'clicks'): number {
  const porAdsetDia = new Map<string, number>();
  for (const r of rows) {
    // Sem adset_id não há como deduplicar: agrupar tudo numa chave só faria o
    // Math.max descartar o resto e SUBESTIMAR o investimento. Hoje não há
    // linha assim no banco; a guarda evita erro silencioso se passar a haver.
    if (!r.adsetId) continue;
    const k = `${r.dateIso}|${r.adsetId}`;
    porAdsetDia.set(k, Math.max(porAdsetDia.get(k) ?? 0, r[field]));
  }
  let total = 0;
  for (const v of porAdsetDia.values()) total += v;
  return total;
}

function leadsMetaSum(rows: MetaClassified[]): number {
  let total = 0;
  for (const r of rows) if (r.isLeadAction) total += r.value;
  return total;
}

// ---------------------------------------------------------------------------
// §5.2 — Métricas de mídia
// ---------------------------------------------------------------------------

export function computeMediaMetrics(ds: GrowthDataset, filters: GrowthFilters): MediaMetrics {
  const g = filterGoogle(ds, filters);
  const m = filterMeta(ds, filters);

  const leadsGoogle = g.reduce((s, r) => s + r.conversions, 0);
  const investimentoGoogle = g.reduce((s, r) => s + r.cost, 0);
  const impressoesGoogle = g.reduce((s, r) => s + r.impressions, 0);
  const clicksGoogle = g.reduce((s, r) => s + r.clicks, 0);

  const investimentoMeta = dedupMetaSum(m, 'spend');
  const impressoesMeta = dedupMetaSum(m, 'impressions');
  const alcanceMeta = dedupMetaSum(m, 'reach');
  const clicksMeta = dedupMetaSum(m, 'clicks');
  const leadsMeta = leadsMetaSum(m);

  const fonte = filters.fonte;
  const investimento =
    fonte === 'Google' ? investimentoGoogle : fonte === 'Meta' ? investimentoMeta : investimentoGoogle + investimentoMeta;
  const impressoes =
    fonte === 'Google' ? impressoesGoogle : fonte === 'Meta' ? impressoesMeta : impressoesGoogle + impressoesMeta;
  const clicks = fonte === 'Google' ? clicksGoogle : fonte === 'Meta' ? clicksMeta : clicksGoogle + clicksMeta;

  // HERANÇA §7.2: 'alcance' no modo Todos devolve só o Meta (Google Ads não
  // expõe reach). Como 'impressoes' no mesmo modo soma Google + Meta, a
  // frequência mistura bases e fica inflada — comportamento do BI, preservado.
  const alcance = fonte === 'Google' ? null : alcanceMeta;

  // HERANÇA §7.3: sem filtro de Fonte, 'leads' conta REGISTROS do Rubeus
  // (CRM, inclui orgânico/indicação); com filtro, usa conversões de mídia.
  // CPL no estado default divide gasto de mídia por leads totais do CRM.
  const leads =
    fonte === null
      ? filterRubeus(ds, filters).length
      : fonte === 'Google'
        ? leadsGoogle
        : fonte === 'Meta'
          ? leadsMeta
          : leadsGoogle + leadsMeta;

  return {
    leadsGoogle,
    leadsMeta,
    investimentoGoogle,
    investimentoMeta,
    impressoesGoogle,
    impressoesMeta,
    clicksGoogle,
    clicksMeta,
    alcanceMeta,
    investimento,
    impressoes,
    clicks,
    alcance,
    cpl: leads > 0 ? investimento / leads : null,
    cpc: clicks > 0 ? investimento / clicks : null,
    ctr: impressoes > 0 ? clicks / impressoes : null,
    frequencia: alcance && alcance > 0 ? impressoes / alcance : null,
    leads,
  };
}

// ---------------------------------------------------------------------------
// §5.3 — Métricas de negócio por produto
// ---------------------------------------------------------------------------

const SITUACOES_EXCLUIR_FAT_POS = new Set([
  'Óbito',
  'Evadido Curso',
  'Formado',
  'Troca de Ciclo',
  'Transferência Interna',
  // HERANÇA (medida DAX Faturamento_Pos): filtro morto — o valor real no
  // banco é 'Pré-Matrícula' (hífen + acento); esta string sem hífen/acento
  // nunca casa. Preservada EXATA. Atenção: o FILTRO DE PÁGINA do Pós EAD usa
  // a grafia correta 'Pré-Matrícula' e FUNCIONA (exclui as 61 linhas) — as
  // duas strings coexistem de propósito, não unificar (§3 do adendo).
  'Pré Matricula',
]);

/**
 * FILTRO DE PÁGINA da aba Pós EAD (situações excluídas) — aqui a grafia é a
 * correta do banco ('Pré-Matrícula' com hífen e acento) e o filtro casa.
 */
const SITUACOES_EXCLUIR_PAGINA_POS_EAD = new Set([
  'Evadido Curso',
  'Formado',
  'Óbito',
  'Pré-Matrícula',
  'Transferência Interna',
  'Troca de Ciclo',
]);

const PS_EXCLUIDO_PAGINA_POS_EAD = 'Inscrição Pós Graduação EAD - Direito Público';

/**
 * FILTROS DE PÁGINA do PBI para f_matriculas_pos, por aba. Sempre ativos —
 * o "Limpar filtros" não os desliga. Modalidade_Pos segue a decisão do §4.4:
 * distanciapresencial 'D' = Pós EAD, 'P' = Pós Presencial.
 *
 * ⚠ ASSIMETRIA INTENCIONAL (herança — NÃO "consertar"): Pós Presencial tem SÓ
 * modalidade + Pagante; não filtra situacao nem processoseletivo, e não
 * exclui 'CRM' do Rubeus. Na prática as pré-matrículas entram no Presencial
 * e são excluídas no EAD (§3 do adendo).
 */
function passaFiltroPaginaPos(r: GrowthDataset['matPos'][number], produto: string): boolean {
  const dp = (r.distanciapresencial ?? '').trim().toUpperCase();
  if (produto === 'Pós EAD') {
    if (dp !== 'D') return false;
    if ((r.descontoaluno ?? '').trim() !== 'Pagante') return false;
    if ((r.processoseletivo ?? '').trim() === PS_EXCLUIDO_PAGINA_POS_EAD) return false;
    if (SITUACOES_EXCLUIR_PAGINA_POS_EAD.has((r.situacao ?? '').trim())) return false;
    return true;
  }
  // Pós Presencial: só isto mesmo.
  if (dp !== 'P') return false;
  if ((r.descontoaluno ?? '').trim() !== 'Pagante') return false;
  return true;
}

type PosWindow = { ini: string | null; fim: string | null; origemInscricao?: boolean };

function faturamentoPos(
  basePagina: GrowthDataset['matPos'],
  ds: GrowthDataset,
  w: PosWindow,
): number {
  // Filtros da MEDIDA (§5.3) aplicados sobre a base já restrita pelos filtros
  // de página da aba. A restrição de modalidade vem do filtro de página
  // (Modalidade_Pos via distanciapresencial, decisão do §4.4) — o antigo 'D'
  // fixo da medida foi substituído por ela.
  //
  // TODO (aguardando decisão do dono do projeto): o faturamento da aba Pós
  // Presencial diverge do BI de propósito, e a decisão é qual dos dois manter.
  //  - No BI, a medida Faturamento_Pos filtra Modalidade_Pos = 'Pós EAD'
  //    internamente; cruzado com o filtro de página Modalidade =
  //    'Pós Presencial', sobra quase nada: R$ 7.840,56 de faturamento,
  //    ROAS 0,24 e ticket médio de R$ 280,02 para uma especialização
  //    presencial — números irreais, que ninguém consegue usar (é o defeito
  //    herdado documentado em §7.4).
  //  - O comportamento atual do app calcula o faturamento real dos alunos
  //    presenciais (~R$ 292 mil, ticket ~R$ 10 mil), que é o financeiramente
  //    correto e coerente com o preço do produto.
  //  - A divergência decorre da decisão já tomada de classificar modalidade de
  //    Pós por distanciapresencial em vez de processoseletivo (§4.4).
  // As MATRÍCULAS já batem com o BI (29 vs 28); só o valor diverge.
  // Mantido o comportamento atual até a decisão.
  const candidatos = basePagina.filter((r) => {
    if ((r.curso ?? '').trim() === 'Pós-graduação em Direito Público (ead)') return false;
    if ((r.descontoaluno ?? '').trim() !== 'Pagante') return false;
    if (SITUACOES_EXCLUIR_FAT_POS.has((r.situacao ?? '').trim())) return false;
    if (EXCLUSOES_FATURAMENTO_POS_RA.has((r.ra ?? '').trim())) return false;
    const bolsas = (r.bolsas ?? '').toUpperCase();
    const bolsa3 = (r.bolsa3 ?? '').toUpperCase();
    if ((bolsas.includes('TROCA DE PL') || bolsa3.includes('TROCA DE PL')) && (r.ra ?? '').trim() !== EXCECAO_TROCA_PL_RA) {
      return false;
    }
    const baixa = toISODate(r.databaixa);
    if (!baixa || !inRange(baixa, w.ini, w.fim)) return false;
    if (w.origemInscricao) {
      const insc = toISODate(r.inscricaodata);
      if (!insc || !inRange(insc, w.ini, w.fim)) return false;
    }
    return true;
  });

  // Dedup por (aluno, curso): manter só o registro de maior databaixa
  // posterior ao último cancelamento do par.
  // TODO: confirmar com o BI publicado o ramo "cancelamento fora do período
  // com mais de um registro do par no período" — implementado como descarte
  // do par quando nenhum registro sobrevive ao último cancelamento.
  const porPar = new Map<string, typeof candidatos>();
  for (const r of candidatos) {
    const k = `${(r.aluno ?? '').trim()}|${(r.curso ?? '').trim()}`;
    const arr = porPar.get(k);
    if (arr) arr.push(r);
    else porPar.set(k, [r]);
  }

  let total = 0;
  for (const grupo of porPar.values()) {
    let ultimoCancel: string | null = null;
    for (const r of grupo) {
      const c = toISODate(r.datacancelamentomatricula);
      if (c && (!ultimoCancel || c > ultimoCancel)) ultimoCancel = c;
    }
    let escolhido: (typeof grupo)[number] | null = null;
    let melhorBaixa = '';
    for (const r of grupo) {
      const baixa = toISODate(r.databaixa) ?? '';
      if (ultimoCancel && baixa <= ultimoCancel) continue;
      // Empate de databaixa: desempata pelo maior codplanopgto. Sem critério
      // estável, a ordem de chegada das páginas (concorrência 3 no
      // supabasePaginate) mudaria o resultado entre recargas.
      if (
        baixa > melhorBaixa ||
        (baixa === melhorBaixa &&
          escolhido !== null &&
          String(r.codplanopgto ?? '') > String(escolhido.codplanopgto ?? ''))
      ) {
        melhorBaixa = baixa;
        escolhido = r;
      }
    }
    // Sem divisor: os valores no Supabase já estão em reais (decimais com
    // ponto → CAST direto, conforme o CLAUDE.md). Os divisores do Power Query
    // do PBIP exportado estão defasados em relação à carga atual.
    if (escolhido) total += num(escolhido.faturadoliq);
  }

  // HERANÇA §7.6: ajuste manual amarrado a 28/05/2026 — soma um valor extra
  // sempre que o período selecionado contém essa data. RA do aluno vem de
  // variável de ambiente (§6, identificado por RA, nunca nome — ver
  // constants.ts); cruzamento só em memória, nunca renderizar.
  // TODO: confirmar se o ajuste manual respeita os filtros de página da aba
  // (aqui varre a tabela completa, como a medida original).
  if (!w.origemInscricao && AJUSTE_ALUNO_RA && inRange(AJUSTE_DATA, w.ini, w.fim)) {
    for (const r of ds.matPos) {
      if ((r.ra ?? '').trim() !== AJUSTE_ALUNO_RA) continue;
      if (toISODate(r.databaixa) !== AJUSTE_DATA) continue;
      total += num(r.faturadoliq);
    }
  }

  return total;
}


// ---------------------------------------------------------------------------
// Bases e contagens compartilhadas
//
// Extraídas para que a série mensal conte matrículas sem recalcular
// faturamento (que ela descarta) — e para que a regra de contagem exista em
// UM lugar só, sem risco de os dois caminhos divergirem.
// ---------------------------------------------------------------------------

function basePaginaPos(ds: GrowthDataset, produto: string): GrowthDataset['matPos'] {
  // O Power Query de f_matriculas_pos removia alunos com 'teste' no nome —
  // são 27 linhas hoje, que inflavam Matrículas, Faturamento, CAC e Ticket.
  return ds.matPos.filter((r) => !isTeste(r.aluno) && passaFiltroPaginaPos(r, produto));
}

function contagemPos(
  base: GrowthDataset['matPos'],
  ini: string | null,
  fim: string | null,
): { matriculas: number; cancelamentos: number } {
  // HERANÇA §7.9: contagem de LINHAS — aluno com 2 contratos conta 2 vezes.
  let matriculas = 0;
  let cancelamentos = 0;
  for (const r of base) {
    const baixa = toISODate(r.databaixa);
    if (!baixa || !inRange(baixa, ini, fim)) continue;
    const cancel = toISODate(r.datacancelamentomatricula);
    if (!(cancel && inRange(cancel, ini, fim))) matriculas++;
    if (cancel && eomLt(baixa, cancel)) cancelamentos++;
  }
  return { matriculas, cancelamentos };
}

/**
 * Base de Grad/Mestrado: exclui alunos de teste e aplica os FILTROS DE PÁGINA
 * da aba (tipomatricula 'Nova Matricula' + situações incluídas). No Mestrado o
 * PBI tem um SEGUNDO filtro na mesma coluna (EXCLUI 'Formado'), redundante na
 * prática, mas reproduzido de propósito.
 */
function baseGradMest(rows: RawMatGradMestRow[], produto: string): RawMatGradMestRow[] {
  const mestrado = produto === 'Mestrado';
  const situacoesPagina = mestrado ? SITUACOES_PAGINA_MEST : SITUACOES_PAGINA_GRAD;
  return rows.filter((r) => {
    if (isTeste(r.aluno)) return false;
    if ((r.tipomatricula ?? '').trim() !== 'Nova Matricula') return false;
    const sit = (r.situacao ?? '').trim();
    if (!situacoesPagina.has(sit)) return false;
    if (mestrado && sit === 'Formado') return false;
    return true;
  });
}

function contagemGradMest(
  base: RawMatGradMestRow[],
  ini: string | null,
  fim: string | null,
): { matriculas: number; cancelamentos: number } {
  const alunosMat = new Set<string>();
  // O RM não atualiza a linha "Matriculado" ao cancelar — grava uma segunda
  // linha para o mesmo aluno com a data de cancelamento preenchida. A linha
  // antiga (sem cancelamento) segue existindo e, sem este desconto por
  // ALUNO (não por linha), continuava contando quem já cancelou dentro da
  // própria janela — o `if` abaixo nunca "retirava" o que a linha antiga
  // já tinha somado.
  const alunosCanceladosNoPeriodo = new Set<string>();
  let cancelamentos = 0;
  for (const r of base) {
    const mat = toISODate(r.datamatricula);
    if (!mat || !inRange(mat, ini, fim)) continue;
    const cancel = toISODate(r.datacancelamentocontrato);
    const aluno = (r.aluno ?? '').trim();
    if (aluno) alunosMat.add(aluno);
    if (cancel && inRange(cancel, ini, fim) && aluno) alunosCanceladosNoPeriodo.add(aluno);
    if (cancel && eomLt(mat, cancel)) cancelamentos++;
  }
  for (const aluno of alunosCanceladosNoPeriodo) alunosMat.delete(aluno);
  return { matriculas: alunosMat.size, cancelamentos };
}

function contagemCL(
  ds: GrowthDataset,
  ini: string | null,
  fim: string | null,
): { matriculas: number; faturamento: number } {
  // HERANÇA §7.7: matriculasCL NÃO desconta cancelamentos (diferente de Pós e
  // Grad/Mest). HERANÇA §7.9: contagem de linhas, não de alunos distintos.
  let matriculas = 0;
  let faturamento = 0;
  for (const r of ds.matCL) {
    // O Power Query de f_matriculas_CL removia alunos com 'teste' no nome.
    if (isTeste(r.aluno)) continue;
    const baixa = toISODate(r.databaixa);
    if (!baixa || !inRange(baixa, ini, fim)) continue;
    matriculas++;
    faturamento += num(r.valor_curso_com_desconto); // sem divisor — já em reais
  }
  return { matriculas, faturamento };
}

/**
 * SÓ a contagem de matrículas, sem faturamento nem varredura do Rubeus.
 * A série mensal chama isto por mês; usar computeNegocioMetrics ali fazia
 * faturamentoPos rodar 2x por mês (sobre 8,7 mil linhas, com dedup por
 * aluno+curso) e o resultado era descartado.
 */
export function contaMatriculas(ds: GrowthDataset, filters: GrowthFilters): number {
  const ini = filters.dataInicio;
  const fim = filters.dataFim;
  switch (filters.produto) {
    case 'Pós EAD':
    case 'Pós Presencial':
      return contagemPos(basePaginaPos(ds, filters.produto), ini, fim).matriculas;
    case 'Graduação':
      return contagemGradMest(baseGradMest(ds.matGrad, filters.produto), ini, fim).matriculas;
    case 'Mestrado':
      return contagemGradMest(baseGradMest(ds.matMestrado, filters.produto), ini, fim).matriculas;
    case 'Cursos Livres':
      return contagemCL(ds, ini, fim).matriculas;
  }
}

function computePosNegocio(
  ds: GrowthDataset,
  filters: GrowthFilters,
  media: MediaMetrics,
): NegocioMetrics {
  const ini = filters.dataInicio;
  const fim = filters.dataFim;

  // FILTROS DE PÁGINA do PBI (adendo §2): restringem a base ANTES das
  // medidas. A MEDIDA matriculasPos continua sem filtro próprio de
  // modalidade (herança §7.4) — quem segmenta a aba é o filtro de página
  // Modalidade_Pos ('D'/'P') aplicado aqui.
  // HERANÇA §7.9: contagem de LINHAS — aluno com 2 contratos conta 2 vezes.
  // O Power Query de f_matriculas_pos removia alunos com 'teste' no nome —
  // são 27 linhas hoje, que inflavam Matrículas, Faturamento, CAC e Ticket.
  const basePagina = basePaginaPos(ds, filters.produto);
  const { matriculas, cancelamentos } = contagemPos(basePagina, ini, fim);

  const faturamento = faturamentoPos(basePagina, ds, { ini, fim });
  const fatMidia = faturamentoPos(basePagina, ds, { ini, fim, origemInscricao: true }); // ROAS Mídia: origem = inscricaodata

  // Inscritos por modalidade: stg_rm_inscricoes_pos separada por
  // processoseletivo contendo 'Presencial' (ver queries.ts) — sem isso as duas
  // abas mostrariam o total somado de Pós.
  const inscritos = countInsc(
    filters.produto === 'Pós Presencial' ? ds.inscPosPresencial : ds.inscPosEad,
    ini,
    fim,
  );
  const rub = filterRubeus(ds, filters);

  return derive(matriculas, faturamento, cancelamentos, inscritos, fatMidia, media, rub);
}

function isTeste(aluno: string | null): boolean {
  return /teste/i.test(aluno ?? '');
}

function dataRef(r: RawMatGradMestRow): string {
  const mat = toISODate(r.datamatricula) ?? '1900-01-01';
  const cancel = toISODate(r.datacancelamentocontrato) ?? '1900-01-01';
  return mat > cancel ? mat : cancel;
}

// FILTROS DE PÁGINA do PBI para f_matriculas_grad_mest (adendo §2).
// 'Cancelado – Curso' usa TRAVESSÃO (U+2013), não hífen — existem no banco
// 'Cancelado - Curso' (hífen, 41 linhas) e 'Cancelado - Curso (Assin_Cont)'
// (68 linhas) que NÃO entram. 'Matriculado- Pendente Contrato' sem espaço
// antes do hífen é o valor real do banco. 'Nova Matricula' sem acento está
// correto (é o valor do banco) e corta bastante: de 6.737 linhas de
// graduação sobram 746.
const SITUACOES_PAGINA_GRAD = new Set([
  'Matriculado',
  'Matriculado- Pendente Contrato',
  'Cancelado – Curso',
]);
const SITUACOES_PAGINA_MEST = new Set(['Matriculado', 'Cancelado – Curso']);

function computeGradMestNegocio(
  rows: RawMatGradMestRow[],
  inscritos: number,
  filters: GrowthFilters,
  media: MediaMetrics,
  rub: RubeusClassified[],
): NegocioMetrics {
  const ini = filters.dataInicio;
  const fim = filters.dataFim;
  const base = baseGradMest(rows, filters.produto);
  const { matriculas, cancelamentos } = contagemGradMest(base, ini, fim);

  const fatPorRef = (origemContrato: boolean): number => {
    // por aluno, faturadoliq do registro de maior DataReferencia no período
    const porAluno = new Map<string, { ref: string; fat: number; contrato: string }>();
    for (const r of base) {
      const ref = dataRef(r);
      if (!inRange(ref, ini, fim)) continue;
      if (origemContrato) {
        const contrato = toISODate(r.datacontrato);
        if (!contrato || !inRange(contrato, ini, fim)) continue;
      }
      const aluno = (r.aluno ?? '').trim();
      if (!aluno) continue;
      const atual = porAluno.get(aluno);
      const contrato = String(r.codcontrato ?? '');
      // '>' (não '>=') + desempate por maior codcontrato: mesmo critério
      // estável usado em faturamentoPos.
      if (!atual || ref > atual.ref || (ref === atual.ref && contrato > atual.contrato)) {
        // Sem divisor — ver comentário em faturamentoPos.
        porAluno.set(aluno, { ref, fat: num(r.faturadoliq), contrato });
      }
    }
    let total = 0;
    for (const v of porAluno.values()) total += v.fat;
    return total;
  };

  const faturamento = fatPorRef(false);
  const fatMidia = fatPorRef(true); // ROAS Mídia: origem = datacontrato

  return derive(matriculas, faturamento, cancelamentos, inscritos, fatMidia, media, rub);
}

function computeCLNegocio(
  ds: GrowthDataset,
  filters: GrowthFilters,
  media: MediaMetrics,
): NegocioMetrics {
  const ini = filters.dataInicio;
  const fim = filters.dataFim;
  const { matriculas, faturamento } = contagemCL(ds, ini, fim);

  const inscritos = countInsc(ds.inscCL, ini, fim);
  const rub = filterRubeus(ds, filters);
  // ROAS Mídia CL: origem = databaixa — mesma janela da base, logo o
  // faturamento restrito coincide com o principal.
  // Cancelados: a tabela de CL não traz coluna de cancelamento no grão usado.
  // TODO: confirmar com o BI publicado a medida de cancelados de Cursos Livres.
  return derive(matriculas, faturamento, 0, inscritos, faturamento, media, rub);
}

// Inscritos (§7.8): o BI usava MIN() — no Pós, MIN() de coluna de TEXTO — o
// que não devolve número de inscritos. Implementado como COUNT.
// TODO: confirmar com o BI publicado.
function countInsc(dias: { data: string; total: number }[], ini: string | null, fim: string | null): number {
  let total = 0;
  for (const d of dias) if (inRange(d.data, ini, fim)) total += d.total;
  return total;
}

function derive(
  matriculas: number,
  faturamento: number,
  cancelamentos: number,
  inscritos: number,
  fatMidia: number,
  media: MediaMetrics,
  rub: RubeusClassified[],
): NegocioMetrics {
  let comStatus = 0;
  let ganhos = 0;
  for (const r of rub) {
    if (r.temStatus) comStatus++;
    if (r.ganho) ganhos++;
  }
  return {
    matriculas,
    faturamento,
    cancelamentos,
    inscritos,
    cac: matriculas > 0 ? media.investimento / matriculas : null,
    ticketMedio: matriculas > 0 ? faturamento / matriculas : null,
    taxaConv: media.leads > 0 ? matriculas / media.leads : null,
    roas: media.investimento > 0 ? faturamento / media.investimento : null,
    roasMidia: media.investimento > 0 ? fatMidia / media.investimento : null,
    conversaoRubeus: comStatus > 0 ? ganhos / comStatus : null,
  };
}

export function computeNegocioMetrics(
  ds: GrowthDataset,
  filters: GrowthFilters,
  media: MediaMetrics,
): NegocioMetrics {
  switch (filters.produto) {
    case 'Pós EAD':
    case 'Pós Presencial':
      return computePosNegocio(ds, filters, media);
    case 'Graduação':
      return computeGradMestNegocio(
        ds.matGrad,
        countInsc(ds.inscGrad, filters.dataInicio, filters.dataFim),
        filters,
        media,
        filterRubeus(ds, filters),
      );
    case 'Mestrado':
      return computeGradMestNegocio(
        ds.matMestrado,
        countInsc(ds.inscMestrado, filters.dataInicio, filters.dataFim),
        filters,
        media,
        filterRubeus(ds, filters),
      );
    case 'Cursos Livres':
      return computeCLNegocio(ds, filters, media);
  }
}

// ---------------------------------------------------------------------------
// Visões
// ---------------------------------------------------------------------------

export function computeCampanhas(ds: GrowthDataset, filters: GrowthFilters): CampanhaRow[] {
  const out: CampanhaRow[] = [];

  if (filters.fonte !== 'Meta') {
    const porCampanha = new Map<string, CampanhaRow>();
    for (const r of filterGoogle(ds, filters)) {
      const row = porCampanha.get(r.campanha) ?? {
        campanha: r.campanha,
        plataforma: 'Google' as const,
        leads: 0,
        investimento: 0,
        impressoes: 0,
      };
      row.leads += r.conversions;
      row.investimento += r.cost;
      row.impressoes += r.impressions;
      porCampanha.set(r.campanha, row);
    }
    out.push(...porCampanha.values());
  }

  if (filters.fonte !== 'Google') {
    const porCampanha = new Map<string, MetaClassified[]>();
    for (const r of filterMeta(ds, filters)) {
      const arr = porCampanha.get(r.campanha);
      if (arr) arr.push(r);
      else porCampanha.set(r.campanha, [r]);
    }
    for (const [campanha, rows] of porCampanha) {
      out.push({
        campanha,
        plataforma: 'Meta',
        leads: leadsMetaSum(rows),
        investimento: dedupMetaSum(rows, 'spend'),
        impressoes: dedupMetaSum(rows, 'impressions'),
      });
    }
  }

  return out.sort((a, b) => b.investimento - a.investimento);
}

/**
 * HERANÇA §7.10: o mapa plota SÓ o Google (conversions/cost) — Meta não entra,
 * e a dimensão de região deriva do próprio Google, então estado sem
 * investimento Google não aparece. Preservado.
 */
export function computeMapa(ds: GrowthDataset, filters: GrowthFilters): MapaUfDatum[] {
  const porUf = new Map<string, MapaUfDatum>();
  for (const r of filterGoogle(ds, filters)) {
    if (!r.uf) continue;
    const row = porUf.get(r.uf) ?? { uf: r.uf, conversoes: 0, investimento: 0 };
    row.conversoes += r.conversions;
    row.investimento += r.cost;
    porUf.set(r.uf, row);
  }
  // Ordena por INVESTIMENTO: no PBI o mapa é um esriVisual de bolhas onde
  // Size = Sum(cost) (rótulo "Investimento") e Color = Sum(conversions).
  return Array.from(porUf.values()).sort((a, b) => b.investimento - a.investimento);
}

export function computeHorarios(ds: GrowthDataset, filters: GrowthFilters): HorarioDatum[] {
  const porFaixa = new Map<number, { rotulo: string; leads: number; ganhos: number; comStatus: number }>();
  for (let inicio = 0; inicio < 24; inicio += 2) {
    const pad = (n: number) => String(n).padStart(2, '0');
    porFaixa.set(inicio, { rotulo: `${pad(inicio)}:00 - ${pad((inicio + 2) % 24)}:00`, leads: 0, ganhos: 0, comStatus: 0 });
  }
  for (const r of filterRubeus(ds, filters)) {
    if (r.faixaInicio === null) continue;
    const fx = porFaixa.get(r.faixaInicio);
    if (!fx) continue;
    fx.leads++;
    if (r.temStatus) fx.comStatus++;
    if (r.ganho) fx.ganhos++;
  }
  // Ordenar por início da faixa — alfabético quebraria (ex.: "04:00" < "10:00" ok, mas "22:00" > "04:00").
  return Array.from(porFaixa.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([inicio, v]) => ({
      inicio,
      faixa: v.rotulo,
      leads: v.leads,
      // null (e não 0) para o gráfico abrir lacuna em vez de desenhar
      // uma linha em 0% onde simplesmente não há lead com status.
      taxaConv: v.comStatus > 0 ? v.ganhos / v.comStatus : null,
    }));
}

const AMOSTRA_MINIMA = 50;

function montaLinha(nome: string, pessoas: number, matriculas: number): OrigemDatum {
  return {
    nome,
    pessoas,
    matriculas,
    taxa: pessoas > 0 ? matriculas / pessoas : null,
    // Abaixo de 50 pessoas a taxa oscila demais para servir de comparação — a
    // linha aparece, mas marcada (nunca escondida).
    amostraPequena: pessoas < AMOSTRA_MINIMA,
  };
}

/**
 * Aba Origem: atribuição de primeiro toque, uma linha por canal/plataforma.
 * Respeita os mesmos filtros das outras abas.
 *
 * ⚠️ A exclusão de canal_nome='CRM' em Graduação/Mestrado/Pós EAD vale aqui
 * também (via PRODUTOS_EXCLUEM_CRM): o card de Leads dessas abas exclui CRM, e
 * se o canal aparecesse só aqui o usuário não conseguiria reconciliar os
 * totais. Por isso o canal CRM não aparece nessas três abas — é proposital.
 */
export function computeOrigem(ds: GrowthDataset, filters: GrowthFilters): OrigemData {
  const windows = pletivoWindows(ds, filters);
  const excluiCRM = PRODUTOS_EXCLUEM_CRM.has(filters.produto);

  const porPlataforma = new Map<string, { pessoas: number; matriculas: number }>();
  const porCanal = new Map<string, { pessoas: number; matriculas: number }>();
  let totalPessoas = 0;
  let totalMatriculas = 0;

  for (const j of getJornadas(ds)) {
    if (j.modalidade !== filters.produto) continue;
    if (excluiCRM && j.isCRM) continue;
    if (!inRange(j.dataPrimeiroToque, filters.dataInicio, filters.dataFim)) continue;
    if (filters.fimDeSemana && j.fimDeSemana !== filters.fimDeSemana) continue;
    if (
      windows.length > 0 &&
      !windows.some((w) => j.dataPrimeiroToque >= w.ini && j.dataPrimeiroToque <= w.fim)
    ) {
      continue;
    }

    totalPessoas++;
    if (j.converteu) totalMatriculas++;

    const p = porPlataforma.get(j.plataforma) ?? { pessoas: 0, matriculas: 0 };
    p.pessoas++;
    if (j.converteu) p.matriculas++;
    porPlataforma.set(j.plataforma, p);

    const c = porCanal.get(j.canalOrigem) ?? { pessoas: 0, matriculas: 0 };
    c.pessoas++;
    if (j.converteu) c.matriculas++;
    porCanal.set(j.canalOrigem, c);
  }

  // Ordenar por MATRÍCULAS, não por taxa: canais minúsculos com taxa alta
  // liderariam a lista e enganariam a leitura.
  const ordena = (m: Map<string, { pessoas: number; matriculas: number }>) =>
    Array.from(m.entries())
      .map(([nome, v]) => montaLinha(nome, v.pessoas, v.matriculas))
      .sort((a, b) => b.matriculas - a.matriculas || b.pessoas - a.pessoas);

  return {
    porPlataforma: ordena(porPlataforma),
    porCanal: ordena(porCanal),
    totalPessoas,
    totalMatriculas,
  };
}

/**
 * Série mensal de Leads (ou Matrículas) + Investimento, eixo Mês Ano Ext.
 *
 * No Power BI original este gráfico ficava numa página com slicer próprio e
 * IGNORAVA o filtro de data global — o card respondia ao slicer, o visual
 * não. Aqui os dois convivem num painel único, então esse desalinhamento
 * lia como bug (usuário mudava a data e o gráfico não se mexia). A pedido
 * do usuário (27/07/2026) o gráfico passou a RESPEITAR dataInicio/dataFim,
 * saindo da paridade estrita: meses fora do período somem do eixo, e o mês
 * de borda (quando o filtro corta no meio dele) soma só os dias dentro do
 * recorte. Os demais filtros (produto/página, Fonte, Período Letivo, Fim de
 * Semana) já valiam antes e continuam valendo.
 */
export function computeSerieMensal(
  ds: GrowthDataset,
  filters: GrowthFilters,
  tipo: 'leads' | 'matriculas',
): SerieMensalDatum[] {
  const cal = buildMesAnoCalendar();
  const out: SerieMensalDatum[] = [];

  for (const c of cal) {
    const mIni = `${c.ano}-${String(c.mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(c.ano, c.mes, 0).getDate();
    const mFim = `${c.ano}-${String(c.mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    // Interseção do mês com o filtro de data ativo. Sem interseção, o mês
    // não entra no gráfico — é exatamente o "sumir do eixo" que o usuário
    // pediu ao filtrar um período menor.
    const janelaIni = filters.dataInicio && filters.dataInicio > mIni ? filters.dataInicio : mIni;
    const janelaFim = filters.dataFim && filters.dataFim < mFim ? filters.dataFim : mFim;
    if (janelaIni > janelaFim) continue;

    const fMes: GrowthFilters = { ...filters, dataInicio: janelaIni, dataFim: janelaFim };
    const media = computeMediaMetrics(ds, fMes);
    let valor = 0;
    if (tipo === 'leads') {
      valor = media.leads; // herda a semântica do seletor Fonte (§7.3)
    } else {
      valor = contaMatriculas(ds, fMes);
    }
    out.push({ cod: c.cod, mesAno: c.label, valor, investimento: media.investimento });
  }

  return out.sort((a, b) => a.cod - b.cod);
}

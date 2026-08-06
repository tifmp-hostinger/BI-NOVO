import { supabase } from '@/lib/supabase';
import { parseFlexibleDate } from '@/dashboards/analise-de-conversao/dateUtils';

/**
 * Frescor do dado exibido — quando a carga entrou no banco, não quando a
 * página foi aberta.
 *
 * Duas fontes de sinal, nunca misturadas:
 * - `colunaCarga`: carimbo REAL de quando a linha foi gravada/atualizada
 *   (ex. `atualizado_em`). Quando existe, é a fonte da verdade.
 * - `colunaConteudo`: PROXY — a maior data de negócio já presente na
 *   tabela (ex. `datamatricula`). Não afirma quando a carga rodou, só que
 *   o registro mais novo é daquela data. Um fim de semana sem matrícula
 *   produz proxy "atrasado" com a carga em dia — isso é esperado, por isso
 *   os limiares do proxy são mais frouxos e o texto nunca diz "carga
 *   parada", só "pode haver carga parada".
 *
 * Tabelas de DOMÍNIO (`meta_*`, `pletivo`, `dim_tipo_beneficio`) são
 * editadas à mão e não representam uma esteira de carga — nunca entram no
 * cálculo do rótulo principal, só aparecem no detalhamento como
 * "tabelas de referência", sem alerta de atraso.
 *
 * O proxy de conteúdo NUNCA dispara uma consulta nova: os dashboards já
 * baixam essas tabelas inteiras para calcular os indicadores, então o
 * proxy é computado sobre o dataset que já está em memória (ver
 * `maiorDataDoDataset` abaixo) e passado para `fetchFreshness` via
 * `proxiesEmMemoria`. Só as tabelas com `colunaCarga` justificam consulta
 * dedicada — e é uma linha cada.
 */

export type PapelTabela = 'fato' | 'dominio';

export type FonteConfig = {
  tabela: string;
  papel: PapelTabela;
  /** Carimbo real de carga (`atualizado_em` ou equivalente). */
  colunaCarga?: string;
  /** Proxy: maior data de negócio na tabela. Calculado em memória — nunca via query dedicada. */
  colunaConteudo?: string;
  /** Documentação do formato de `colunaConteudo` — o parser (`parseFlexibleDate`) já detecta os dois sozinho. */
  formatoConteudo?: 'iso' | 'br';
  /**
   * Fonte de negócio genuinamente sazonal (ex. inscrição de Mestrado —
   * confirmado com o time: é ~1 janela de admissão por ano, não uma
   * esteira contínua). Fica de fora da disputa pelo rótulo principal
   * (`maisAntiga`) — um proxy "atrasado" aqui é o normal do calendário, não
   * sinal de carga parada — mas continua aparecendo no detalhamento, com
   * nota explicando o motivo, nunca escondida.
   */
  sazonal?: boolean;
};

/**
 * Registro único de todas as tabelas conhecidas. Checado no schema em
 * 28/07/2026.
 *
 * ⚠️ Duas tabelas — `stg_rm_inscricoes_graduacao` e `stg_rm_inscricoes_mestrado`
 * — tinham sido classificadas como "sem proxy utilizável" (só `periodo_letivo`)
 * numa versão anterior deste levantamento. Reconferido direto no banco: as
 * duas têm `datainscricao` 100% preenchida (3.461/3.461 e 489/489, datas
 * plausíveis até 2026-07-26). Corrigido aqui para usar o proxy real —
 * reportado como divergência, não aplicado às cegas.
 */
export const REGISTRO_FONTES: Record<string, FonteConfig> = {
  // ---- Domínio: editadas à mão, sem esteira de carga, sem alerta ----
  meta_graduacao: { tabela: 'meta_graduacao', papel: 'dominio', colunaCarga: 'atualizado_em' },
  meta_mestrado: { tabela: 'meta_mestrado', papel: 'dominio', colunaCarga: 'atualizado_em' },
  meta_pos: { tabela: 'meta_pos', papel: 'dominio', colunaCarga: 'atualizado_em' },
  pletivo: { tabela: 'pletivo', papel: 'dominio', colunaCarga: 'atualizado_em' },
  dim_tipo_beneficio: { tabela: 'dim_tipo_beneficio', papel: 'dominio', colunaCarga: 'atualizado_em' },

  // ---- Fato com carimbo real de carga ----
  stg_meta_ads: { tabela: 'stg_meta_ads', papel: 'fato', colunaCarga: 'atualizado_em' },
  rubeus_registros_personalizada: {
    tabela: 'rubeus_registros_personalizada',
    papel: 'fato',
    colunaCarga: 'atualizado_em',
  },

  // ---- Fato sem carimbo, com proxy de conteúdo (formato ISO) ----
  stg_google_ads: { tabela: 'stg_google_ads', papel: 'fato', colunaConteudo: 'date', formatoConteudo: 'iso' },
  stg_rh_infofolha: {
    tabela: 'stg_rh_infofolha',
    papel: 'fato',
    colunaConteudo: 'recmodifiedon',
    formatoConteudo: 'iso',
  },
  stg_rm_matriculas_cursoslivres: {
    tabela: 'stg_rm_matriculas_cursoslivres',
    papel: 'fato',
    colunaConteudo: 'data_contrato',
    formatoConteudo: 'iso',
  },
  stg_rm_inscricoes_pos: {
    tabela: 'stg_rm_inscricoes_pos',
    papel: 'fato',
    colunaConteudo: 'datainscricao',
    formatoConteudo: 'iso',
  },
  stg_rm_matriculas_pos: {
    tabela: 'stg_rm_matriculas_pos',
    papel: 'fato',
    colunaConteudo: 'datadematricula',
    formatoConteudo: 'iso',
  },
  stg_rm_inscricoes_cursoslivres: {
    tabela: 'stg_rm_inscricoes_cursoslivres',
    papel: 'fato',
    colunaConteudo: 'datainscricao',
    formatoConteudo: 'iso',
  },
  stg_rm_inscricoes_graduacao: {
    tabela: 'stg_rm_inscricoes_graduacao',
    papel: 'fato',
    colunaConteudo: 'datainscricao',
    formatoConteudo: 'iso',
  },
  // Sazonal: confirmado com o time em 29/07/2026 — Mestrado tem ~1 janela de
  // admissão por ano; a próxima abre nos próximos meses (fim de ano). Um
  // proxy de meses sem inscrição nova aqui é esperado, não indício de carga
  // parada — por isso não disputa o rótulo principal (ver `sazonal` em
  // fetchFreshness). Antes desta tabela ter proxy, o badge nem a via (não
  // tinha atualizado_em) e por isso nunca tinha aparecido esse aviso.
  stg_rm_inscricoes_mestrado: {
    tabela: 'stg_rm_inscricoes_mestrado',
    papel: 'fato',
    colunaConteudo: 'datainscricao',
    formatoConteudo: 'iso',
    sazonal: true,
  },

  // ---- Fato sem carimbo, com proxy de conteúdo (formato dd/mm/yyyy) ----
  // Verificado no banco: max() textual dessas colunas devolve lixo (ex.
  // stg_rm_matriculas_bolsas: max textual = "31/12/2022", max real = 2026-07-06).
  // NUNCA comparar como texto — sempre via parseFlexibleDate.
  stg_rm_matriculas_grad: {
    tabela: 'stg_rm_matriculas_grad',
    papel: 'fato',
    colunaConteudo: 'datamatricula',
    formatoConteudo: 'br',
  },
  stg_rm_matriculas_mestrado: {
    tabela: 'stg_rm_matriculas_mestrado',
    papel: 'fato',
    colunaConteudo: 'datamatricula',
    formatoConteudo: 'br',
  },
  stg_rm_matriculas_bolsas: {
    tabela: 'stg_rm_matriculas_bolsas',
    papel: 'fato',
    colunaConteudo: 'data_matricula',
    formatoConteudo: 'br',
  },

  // ---- Fato sem carimbo e sem proxy utilizável (schema conferido: só têm periodo_letivo) ----
  stg_rm_matriculas_cadeiras: { tabela: 'stg_rm_matriculas_cadeiras', papel: 'fato' },
  stg_rm_evasao_motor: { tabela: 'stg_rm_evasao_motor', papel: 'fato' },
  stg_rm_evasao_inadimplencia: { tabela: 'stg_rm_evasao_inadimplencia', papel: 'fato' },
  stg_rm_rh_infofuncionarios: { tabela: 'stg_rm_rh_infofuncionarios', papel: 'fato' },
};

/**
 * Fontes de cada dashboard. Cada tabela listada aqui precisa existir em
 * REGISTRO_FONTES — senão vira "sem sinal" por omissão de cadastro, não
 * por ausência real de coluna.
 */
export const FONTES_POR_DASHBOARD: Record<string, string[]> = {
  'presenca-nacional': ['stg_rm_matriculas_pos', 'stg_rm_matriculas_cursoslivres'],
  'analise-conversao-presidencia': [
    'rubeus_registros_personalizada', 'pletivo', 'meta_mestrado', 'meta_pos',
    'stg_rm_matriculas_grad', 'stg_rm_matriculas_mestrado', 'stg_rm_matriculas_pos',
    'stg_rm_inscricoes_graduacao', 'stg_rm_inscricoes_mestrado',
  ],
  'bolsas-e-descontos': [
    'dim_tipo_beneficio', 'stg_rm_matriculas_bolsas',
    'stg_rm_matriculas_grad', 'stg_rm_matriculas_pos', 'stg_rm_matriculas_mestrado',
  ],
  'analise-de-conversao': [
    'rubeus_registros_personalizada', 'pletivo',
    'meta_graduacao', 'meta_mestrado', 'meta_pos',
    'stg_rm_matriculas_grad', 'stg_rm_matriculas_mestrado', 'stg_rm_matriculas_pos',
    'stg_rm_matriculas_cursoslivres', 'stg_rm_inscricoes_graduacao',
    'stg_rm_inscricoes_mestrado', 'stg_rm_inscricoes_pos', 'stg_rm_inscricoes_cursoslivres',
  ],
  'growth-e-performance': [
    'rubeus_registros_personalizada', 'stg_meta_ads', 'stg_google_ads', 'pletivo',
    'stg_rm_matriculas_grad', 'stg_rm_matriculas_mestrado', 'stg_rm_matriculas_pos',
    'stg_rm_matriculas_cursoslivres', 'stg_rm_inscricoes_graduacao',
    'stg_rm_inscricoes_mestrado', 'stg_rm_inscricoes_pos', 'stg_rm_inscricoes_cursoslivres',
  ],
};

/**
 * True enquanto algum dataset esperado ainda não chegou. Sem isso o rótulo
 * é calculado só com as tabelas que têm carimbo de carga (elas resolvem numa
 * consulta rápida), aparece um valor e, quando o dashboard termina de baixar
 * os dados, o rótulo TROCA na frente do usuário — parecendo erro.
 */
export function faltamRitmos(
  tabelas: string[],
  ritmos: Record<string, RitmoFonte>,
): boolean {
  return tabelas.some((t) => REGISTRO_FONTES[t]?.colunaConteudo && !ritmos[t]);
}

export type TipoSinal = 'carga' | 'proxy' | 'sem-sinal';

/**
 * Ritmo observado de uma fonte: até quando ela tem registro e qual o maior
 * silêncio que ela já teve no último ano.
 *
 * Existe porque limiar fixo em dias não funciona aqui. Medido no banco em
 * 31/07/2026, o maior intervalo sem registro novo varia por fonte:
 * Google Ads 1 dia, matrículas do Pós 5, bolsas 10, inscrições de Cursos
 * Livres 35, matrículas de Graduação 84 (ciclo de vestibular). Um limiar
 * único de 14 dias acusava "carga parada" em Cursos Livres — que passa
 * semanas sem inscrição por natureza — e ao mesmo tempo seria frouxo demais
 * para o Google Ads, que carrega todo dia.
 */
export type RitmoFonte = {
  /** Data do registro mais recente. */
  ultima: Date | null;
  /** Maior silêncio (em dias) entre registros consecutivos no último ano. */
  maiorIntervaloDias: number | null;
};

export type Freshness = {
  tabela: string;
  papel: PapelTabela;
  tipoSinal: TipoSinal;
  /** Carimbo real (tipoSinal='carga') ou maior data de conteúdo (tipoSinal='proxy'). */
  data: Date | null;
  horasAtras: number | null;
  /** Sazonal (ver FonteConfig.sazonal) — fora da disputa por `maisAntiga`. */
  sazonal: boolean;
  /** Maior silêncio já observado nesta fonte (proxy). Null para carga/sem sinal. */
  maiorIntervaloDias?: number | null;
  /** Dias de silêncio tolerados antes de acusar atraso, derivado do ritmo da própria fonte. */
  limiteDias?: number | null;
  /** True quando o silêncio atual supera o que essa fonte já teve. */
  foraDoRitmo?: boolean;
};

export type StatusFrescor = 'ok' | 'atencao' | 'atrasado' | 'desconhecido' | 'erro';

export type FreshnessResumo = {
  /**
   * Fonte que dá o rótulo principal. Prioriza carimbo REAL de carga: ele
   * responde "a esteira rodou?", que é a pergunta do indicador. A data de
   * conteúdo responde outra coisa ("houve movimento de negócio?") e, sozinha,
   * faz um painel saudável parecer parado — é o alerta de ritmo, não o
   * rótulo, que trata disso. Sem nenhuma fonte com carimbo, cai para a data
   * de conteúdo mais antiga.
   */
  maisAntiga: Freshness | null;
  /** Todas as tabelas de fato (carga + proxy + sem-sinal), para o detalhamento. */
  fontesFato: Freshness[];
  /** Tabelas de domínio, mostradas à parte, sem alerta. */
  fontesDominio: Freshness[];
  status: StatusFrescor;
  /** Fontes cujo silêncio atual supera o maior silêncio já observado nelas. */
  foraDoRitmo: Freshness[];
};

const HORA_MS = 3_600_000;

/**
 * Cache por tabela com validade curta: várias telas compartilham fontes e o
 * banco é free tier, mas a resposta AGORA decide se o cache de dataset vale
 * (assinaturaCarga) — e dashboard é o tipo de aba que fica aberta o dia
 * inteiro. Sem expiração, a pergunta "a carga mudou?" seria respondida com a
 * memória da abertura da aba: carga ao meio-dia passaria despercebida até um
 * F5. Com 5 minutos, o custo segue ínfimo (consultas de 1 linha) e uma carga
 * nova é percebida na navegação seguinte.
 */
const TTL_SINAL_MS = 5 * 60_000;

type SinalMemo<T> = { p: Promise<T>; em: number };

function vigente<T>(m: SinalMemo<T> | undefined): m is SinalMemo<T> {
  return !!m && Date.now() - m.em < TTL_SINAL_MS;
}

const cache = new Map<string, SinalMemo<Date | null>>();

export function limparCacheFrescor(): void {
  cache.clear();
  cacheConteudo.clear();
}

/**
 * Uma linha só por tabela: `select <col> order by <col> desc limit 1`.
 * Não pagina e não traz o dataset. Usado SÓ para colunaCarga — o proxy de
 * conteúdo nunca dispara consulta (vem do dataset já em memória).
 */
function buscaUltimaCarga(tabela: string, coluna: string): Promise<Date | null> {
  const emCache = cache.get(tabela);
  if (vigente(emCache)) return emCache.p;

  const p = (async () => {
    const { data, error } = await supabase
      .from(tabela)
      .select(coluna)
      .order(coluna, { ascending: false })
      .limit(1);
    if (error) throw error;
    const linha = data?.[0] as unknown as Record<string, string> | undefined;
    const valor = linha?.[coluna];
    if (!valor) return null;
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  })();

  cache.set(tabela, { p, em: Date.now() });
  // Um erro não pode ficar preso no cache: a próxima tentativa deve reconsultar.
  p.catch(() => cache.delete(tabela));
  return p;
}

/**
 * Proxy de conteúdo: maior data válida de uma coluna, sobre um dataset que
 * o dashboard JÁ tem em memória (sem filtro de data do usuário — senão o
 * proxy vira reflexo do filtro, não do estado da carga). Reaproveita
 * `parseFlexibleDate` (mesmo parser dos cálculos de negócio) porque ele já
 * detecta ISO e dd/mm/yyyy sozinho — comparar como string aqui reproduziria
 * o bug documentado em REGISTRO_FONTES (max textual de dd/mm/yyyy é lixo).
 */
export function maiorDataDoDataset<T>(
  rows: readonly T[] | undefined | null,
  coluna: keyof T,
): Date | null {
  return ritmoDoDataset(rows, coluna).ultima;
}

const DIA_MS = 86_400_000;
/** Janela de história usada para medir o ritmo da fonte. */
const JANELA_RITMO_DIAS = 365;
/** Piso: mesmo uma fonte diária ganha alguma folga antes de acusar atraso. */
const LIMITE_MINIMO_DIAS = 3;
/** Margem sobre o maior silêncio já visto — não acusar quando apenas empata o recorde. */
const MARGEM_RITMO = 0.25;
const MARGEM_MINIMA_DIAS = 2;

/**
 * Mede até quando a fonte tem registro E qual o maior silêncio que ela já
 * teve, sobre o dataset que o dashboard já baixou (sem consulta nova e sem
 * o filtro de data do usuário — senão o ritmo viraria reflexo do filtro).
 *
 * Só considera os últimos 365 dias: o ritmo de anos anteriores não diz nada
 * sobre a operação de hoje.
 */
export function ritmoDoDataset<T>(
  rows: readonly T[] | undefined | null,
  coluna: keyof T,
): RitmoFonte {
  return ritmoDeDatasets([{ rows, coluna }]);
}

/**
 * Mesma medida, quando UMA tabela é alimentada por mais de um dataset em
 * memória (ex.: inscrições do Pós chegam separadas em EAD e Presencial).
 * Une os dias antes de medir — calcular cada parte e combinar depois daria
 * um silêncio maior que o real, já que um dia ativo só no EAD também é um
 * dia ativo da tabela.
 */
export function ritmoDeDatasets<T>(
  entradas: Array<{ rows: readonly T[] | undefined | null; coluna: keyof T }>,
): RitmoFonte {
  const hoje = Date.now();
  const limiteJanela = hoje - JANELA_RITMO_DIAS * DIA_MS;

  // Dias distintos: importa "houve registro neste dia", não quantos — mil
  // matrículas num dia e uma só contam igual para o ritmo.
  const dias = new Set<number>();
  let ultima: Date | null = null;

  for (const { rows, coluna } of entradas) {
    if (!rows) continue;
    for (const r of rows) {
      const d = parseFlexibleDate(r[coluna] as unknown as string | null | undefined);
      if (!d) continue;
      const t = d.getTime();
      if (!ultima || t > ultima.getTime()) ultima = d;
      if (t >= limiteJanela && t <= hoje) dias.add(Math.floor(t / DIA_MS));
    }
  }

  if (dias.size < 2) return { ultima, maiorIntervaloDias: null };

  const ordenados = Array.from(dias).sort((a, b) => a - b);
  let maiorIntervalo = 0;
  for (let i = 1; i < ordenados.length; i++) {
    const gap = ordenados[i] - ordenados[i - 1];
    if (gap > maiorIntervalo) maiorIntervalo = gap;
  }

  return { ultima, maiorIntervaloDias: maiorIntervalo };
}

/**
 * Quantos dias de silêncio essa fonte pode ter sem que isso signifique
 * problema — derivado do maior silêncio que ela mesma já teve.
 */
export function limiteDeSilencio(maiorIntervaloDias: number | null): number | null {
  if (maiorIntervaloDias === null) return null;
  const margem = Math.max(MARGEM_MINIMA_DIAS, Math.ceil(maiorIntervaloDias * MARGEM_RITMO));
  return Math.max(LIMITE_MINIMO_DIAS, maiorIntervaloDias + margem);
}

/**
 * Resumo do frescor das tabelas que alimentam um dashboard.
 *
 * `proxiesEmMemoria`: mapa tabela → maior data de conteúdo, já calculado
 * pelo dashboard sobre o dataset que ele já baixou (ver `maiorDataDoDataset`).
 * Obrigatório para toda tabela com `colunaConteudo` — sem ele, a tabela
 * aparece como "sem sinal" em vez de disparar uma consulta nova.
 */
export async function fetchFreshness(
  tabelas: string[],
  ritmosEmMemoria: Record<string, RitmoFonte> = {},
): Promise<FreshnessResumo> {
  const fontesFato: Freshness[] = [];
  const fontesDominio: Freshness[] = [];
  let houveErro = false;

  await Promise.all(
    tabelas.map(async (tabela) => {
      const cfg = REGISTRO_FONTES[tabela];

      if (!cfg) {
        fontesFato.push({ tabela, papel: 'fato', tipoSinal: 'sem-sinal', data: null, horasAtras: null, sazonal: false });
        return;
      }

      const destino = cfg.papel === 'dominio' ? fontesDominio : fontesFato;
      const sazonal = !!cfg.sazonal;

      if (cfg.colunaCarga) {
        try {
          const data = await buscaUltimaCarga(tabela, cfg.colunaCarga);
          destino.push({
            tabela,
            papel: cfg.papel,
            tipoSinal: 'carga',
            data,
            horasAtras: data ? (Date.now() - data.getTime()) / HORA_MS : null,
            sazonal,
          });
        } catch {
          houveErro = true;
          destino.push({ tabela, papel: cfg.papel, tipoSinal: 'carga', data: null, horasAtras: null, sazonal });
        }
        return;
      }

      if (cfg.colunaConteudo) {
        const ritmo = ritmosEmMemoria[tabela];
        const data = ritmo?.ultima ?? null;
        const horasAtras = data ? (Date.now() - data.getTime()) / HORA_MS : null;
        const maiorIntervaloDias = ritmo?.maiorIntervaloDias ?? null;
        const limite = limiteDeSilencio(maiorIntervaloDias);
        destino.push({
          tabela,
          papel: cfg.papel,
          tipoSinal: 'proxy',
          data,
          horasAtras,
          sazonal,
          maiorIntervaloDias,
          limiteDias: limite,
          // Sem histórico suficiente para medir o ritmo, não acusa nada:
          // afirmar atraso sem base seria pior que ficar calado.
          foraDoRitmo:
            horasAtras !== null && limite !== null ? horasAtras / 24 > limite : false,
        });
        return;
      }

      destino.push({ tabela, papel: cfg.papel, tipoSinal: 'sem-sinal', data: null, horasAtras: null, sazonal });
    }),
  );

  const ordenaPorData = (a: Freshness, b: Freshness) => {
    if (a.data && b.data) return a.data.getTime() - b.data.getTime();
    if (a.data) return -1;
    if (b.data) return 1;
    return a.tabela.localeCompare(b.tabela);
  };
  fontesFato.sort(ordenaPorData);
  fontesDominio.sort(ordenaPorData);

  // O rótulo principal olha só para fato, e nunca para uma fonte sazonal —
  // ela fica só no detalhamento (ver DataFreshness.tsx).
  const candidatas = fontesFato.filter((f) => f.data !== null && !f.sazonal);
  const ordenadasPorData = [...candidatas].sort((a, b) => a.data!.getTime() - b.data!.getTime());
  // Entre as que têm carimbo real, a mais atrasada; só sem nenhuma delas
  // recorre ao proxy de conteúdo.
  const maisAntiga =
    ordenadasPorData.find((f) => f.tipoSinal === 'carga') ?? ordenadasPorData[0] ?? null;

  // Fontes efetivamente fora do próprio ritmo — é isto, e não a data absoluta,
  // que caracteriza suspeita de carga parada.
  const foraDoRitmo = candidatas.filter((f) => f.foraDoRitmo);

  let status: StatusFrescor;
  if (!maisAntiga) {
    status = houveErro ? 'erro' : 'desconhecido';
  } else if (foraDoRitmo.length > 0) {
    // Quanto o pior caso ultrapassou o próprio limite decide atenção x atraso.
    const pior = foraDoRitmo.reduce((a, f) => {
      const ra = (a.horasAtras ?? 0) / 24 / (a.limiteDias || 1);
      const rf = (f.horasAtras ?? 0) / 24 / (f.limiteDias || 1);
      return rf > ra ? f : a;
    });
    const razao = (pior.horasAtras ?? 0) / 24 / (pior.limiteDias || 1);
    status = razao > 2 ? 'atrasado' : 'atencao';
  } else {
    // Fontes com carimbo real de carga ainda usam limiar em horas: ali a
    // ausência de carga recente é literal, não inferida de movimento.
    const comCarga = candidatas.filter((f) => f.tipoSinal === 'carga');
    const piorCarga = comCarga.sort((a, b) => (b.horasAtras ?? 0) - (a.horasAtras ?? 0))[0];
    const h = piorCarga?.horasAtras ?? 0;
    status = !piorCarga ? 'ok' : h < 24 ? 'ok' : h <= 72 ? 'atencao' : 'atrasado';
  }

  // Pior primeiro: o rótulo mostra só o primeiro e conta os demais.
  foraDoRitmo.sort(
    (a, b) =>
      (b.horasAtras ?? 0) / 24 / (b.limiteDias || 1) - (a.horasAtras ?? 0) / 24 / (a.limiteDias || 1),
  );

  return { maisAntiga, fontesFato, fontesDominio, status, foraDoRitmo };
}

/**
 * Assinatura barata do estado da carga: os carimbos reais das tabelas do
 * dashboard, concatenados. Uma consulta de UMA linha por tabela com carimbo
 * (compartilhada com o indicador de frescor pelo cache de promessas acima),
 * então perguntar "mudou?" custa milissegundos em vez dos megabytes do
 * dataset.
 *
 * Tabelas sem carimbo (todas as do RM) não entram: para elas a validade é
 * por dia civil, em datasetCache.cacheValido.
 *
 * Falha de rede devolve string vazia de propósito: sem sinal confiável, o
 * cache é considerado inválido e o dado é rebaixado — errar para o lado de
 * mostrar dado atual.
 */
const cacheConteudo = new Map<string, SinalMemo<string | null>>();

/**
 * Maior valor da coluna de conteúdo, numa consulta de UMA linha — mesmo
 * padrão de `buscaUltimaCarga`, que já é usado e verificado.
 *
 * Serve de sinal de novidade para as tabelas do RM, que não têm carimbo de
 * carga. Só vale para colunas em formato ISO (`aaaa-mm-dd`), onde a ordenação
 * textual coincide com a cronológica; em dd/mm/aaaa ela devolveria lixo (o
 * registro está documentado em REGISTRO_FONTES), então essas ficam de fora e
 * dependem da validade por dia civil.
 *
 * Detecta "chegou registro mais novo", não "a carga rodou" — e para decidir
 * se vale rebaixar o dataset é justamente o que importa: sem registro novo,
 * o download traria o mesmo conteúdo.
 */
function buscaMaiorConteudo(tabela: string, coluna: string): Promise<string | null> {
  const emCache = cacheConteudo.get(tabela);
  if (vigente(emCache)) return emCache.p;

  const p = (async () => {
    const { data, error } = await supabase
      .from(tabela)
      .select(coluna)
      .order(coluna, { ascending: false, nullsFirst: false })
      .limit(1);
    if (error) throw error;
    const linha = data?.[0] as unknown as Record<string, string> | undefined;
    return linha?.[coluna] ?? null;
  })();

  cacheConteudo.set(tabela, { p, em: Date.now() });
  p.catch(() => cacheConteudo.delete(tabela));
  return p;
}

export async function assinaturaCarga(
  tabelas: string[],
  opcoes: { ignorarCache?: boolean } = {},
): Promise<string | null> {
  const fontes = tabelas.map((t) => REGISTRO_FONTES[t]).filter((c): c is FonteConfig => !!c);
  const comCarimbo = fontes.filter((c) => c.colunaCarga);
  // Sem carimbo: usa a maior data de conteúdo, quando a coluna é ISO.
  const porConteudo = fontes.filter(
    (c) => !c.colunaCarga && c.colunaConteudo && c.formatoConteudo === 'iso',
  );

  if (fontes.length === 0) return 'sem-fontes';

  // Depois de um download demorado, o valor em cache pode ser anterior à
  // carga que acabou de rodar. Gravar essa assinatura antiga junto do dado
  // novo faria a próxima visita achar que mudou e rebaixar tudo à toa.
  if (opcoes.ignorarCache) {
    comCarimbo.forEach((c) => cache.delete(c.tabela));
    porConteudo.forEach((c) => cacheConteudo.delete(c.tabela));
  }

  try {
    const partes = await Promise.all([
      ...comCarimbo.map(async (c) => {
        const d = await buscaUltimaCarga(c.tabela, c.colunaCarga!);
        return `${c.tabela}=${d ? d.getTime() : 'null'}`;
      }),
      ...porConteudo.map(async (c) => {
        const v = await buscaMaiorConteudo(c.tabela, c.colunaConteudo!);
        return `${c.tabela}#${v ?? 'null'}`;
      }),
    ]);
    return partes.sort().join('|');
  } catch {
    // null = "não sei". NUNCA devolver string aqui: uma string de falha seria
    // gravada no cache e passaria a casar consigo mesma nas visitas
    // seguintes, deixando o cache eternamente "válido". Quem chama trata
    // null como cache inválido e não grava assinatura nenhuma.
    return null;
  }
}

export function formataDataHora(d: Date): string {
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Rótulo curto (dd/mm) para o proxy de conteúdo — deliberadamente menos preciso que formataDataHora. */
export function formataDataCurta(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function diasAtras(horas: number): number {
  return Math.floor(horas / 24);
}

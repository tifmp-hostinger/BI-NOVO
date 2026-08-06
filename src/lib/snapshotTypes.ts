/**
 * Contrato entre um dashboard e o módulo Plano de Ação.
 *
 * A LLM lê o **estado calculado** da tela — nunca o banco, nunca a imagem.
 * Consequências, todas deliberadas:
 *
 * - O agente enxerga exatamente o número que o gestor está vendo. A regra de
 *   negócio continua morando em `calculations.ts` (paridade com o Power BI,
 *   SPECS §12); nada é recalculado num segundo lugar.
 * - Nenhuma consulta nova: o aquecimento (§7.3) já baixou os datasets.
 * - Privacidade (§13) sobrevive por construção: snapshot é agregado, jamais
 *   linha crua.
 *
 * Ver `docs/plano-de-acao-arquitetura.md` §3.
 */

import {
  REGISTRO_FONTES,
  formataDataCurta,
  limiteDeSilencio,
  type RitmoFonte,
} from '@/lib/dataFreshness';

/** Teto de tamanho por painel. Acima disso, corte série antes de indicador. */
export const LIMITE_SNAPSHOT_BYTES = 15_000;

export type UnidadeIndicador = 'brl' | 'pct' | 'int' | 'ratio' | 'horas';

export type Indicador = {
  /** Estável e em minúsculas — é a chave da guarda de números e do escopo de memória. */
  chave: string;
  rotulo: string;
  /** `null` = sem dado. NUNCA 0 no lugar de vazio (SPECS §11). */
  valor: number | null;
  unidade: UnidadeIndicador;
  meta?: number | null;
  /** Variação relativa contra o período anterior (0,38 = +38%). */
  variacaoPeriodoAnterior?: number | null;
  /** Recorte sem significância estatística — o agente DEVE sinalizar. */
  amostraPequena?: boolean;
  /** Uma frase explicando a métrica, em português de gente. */
  glossario?: string;
};

export type Serie = {
  chave: string;
  rotulo: string;
  eixo: 'tempo' | 'categoria';
  /** `r` = rótulo do ponto, `v` = valor. Nomes curtos: isto vai para o prompt. */
  pontos: Array<{ r: string; v: number | null }>;
  /** Preenchido quando houve top-N. Série cortada sem aviso vira tendência inventada. */
  truncadaEm?: number;
};

export type FrescorSnapshot = {
  /** Nome humano da fonte — `stg_meta_ads` nunca chega à tela nem ao prompt. */
  fonte: string;
  /** Frase pronta: "atualizado até 05/08" ou "sem sinal de atualização". */
  sinal: string;
  /** True quando o silêncio passou do maior já observado naquela fonte. */
  alerta: boolean;
};

export type DashboardSnapshot = {
  versao: 1;
  slug: string;
  titulo: string;
  geradoEm: string;
  recorte: {
    /** Legível: "Pós EAD · Meta · 01/07 a 31/07/2026". */
    descricao: string;
    filtros: Record<string, string | string[] | number | null>;
    /** Produto e mês de referência — dimensões de escopo da memória (§5.3.1). */
    produto?: string | null;
    mesReferencia?: number | null;
  };
  frescor: FrescorSnapshot[];
  indicadores: Indicador[];
  series: Serie[];
  /** Regras herdadas do Power BI que mudam a leitura. Sem elas o agente
   *  "descobre" como anomalia aquilo que é regra documentada. */
  observacoes: string[];
};

/** Assinatura de um builder de snapshot. Cada dashboard exporta o seu. */
export type ConstrutorSnapshot<T> = (entrada: T) => DashboardSnapshot;

// ------------------------------------------------------------------ helpers

/**
 * Nome humano das fontes. O léxico do time de dados não chega ao usuário nem
 * ao prompt (SPECS do módulo, §7.4). Fonte ausente aqui cai no próprio nome —
 * que é sinal de cadastro faltando, não de erro em runtime.
 */
const NOME_HUMANO_FONTE: Record<string, string> = {
  stg_meta_ads: 'anúncios do Meta',
  stg_google_ads: 'anúncios do Google',
  rubeus_registros_personalizada: 'jornada dos interessados (Rubeus)',
  stg_rm_matriculas_grad: 'matrículas da Graduação',
  stg_rm_matriculas_mestrado: 'matrículas do Mestrado',
  stg_rm_matriculas_pos: 'matrículas do Pós',
  stg_rm_matriculas_cursoslivres: 'matrículas de Cursos Livres',
  stg_rm_matriculas_bolsas: 'bolsas e descontos',
  stg_rm_inscricoes_graduacao: 'inscrições da Graduação',
  stg_rm_inscricoes_mestrado: 'inscrições do Mestrado',
  stg_rm_inscricoes_pos: 'inscrições do Pós',
  stg_rm_inscricoes_cursoslivres: 'inscrições de Cursos Livres',
  pletivo: 'períodos letivos',
  meta_graduacao: 'metas da Graduação',
  meta_mestrado: 'metas do Mestrado',
  meta_pos: 'metas do Pós',
  dim_tipo_beneficio: 'tipos de benefício',
};

export function nomeHumanoDaFonte(tabela: string): string {
  return NOME_HUMANO_FONTE[tabela] ?? tabela;
}

const DIA_MS = 86_400_000;

/**
 * Frescor em linguagem de gente, a partir dos ritmos que o hook já calculou.
 *
 * NUNCA dispara consulta: `ritmos` vem do dataset em memória (§7.2 do SPECS).
 * O alerta compara o silêncio atual com o maior silêncio já observado naquela
 * mesma fonte — nunca com um prazo fixo. Fonte sazonal fica fora do alerta.
 */
export function resumeFrescor(
  tabelas: readonly string[],
  ritmos: Record<string, RitmoFonte>,
): FrescorSnapshot[] {
  const agora = Date.now();
  return tabelas.map((tabela) => {
    const cfg = REGISTRO_FONTES[tabela];
    const ritmo = ritmos[tabela];
    const nome = nomeHumanoDaFonte(tabela);

    if (!ritmo?.ultima) {
      // "Sem sinal" é a resposta honesta. NUNCA supor "atualizado agora".
      return { fonte: nome, sinal: 'sem sinal de atualização', alerta: false };
    }

    const diasParado = Math.floor((agora - ritmo.ultima.getTime()) / DIA_MS);
    const limite = limiteDeSilencio(ritmo.maiorIntervaloDias);
    const alerta = !cfg?.sazonal && limite !== null && diasParado > limite;

    const sinal = alerta
      ? `sem dado novo desde ${formataDataCurta(ritmo.ultima)} — mais do que o normal desta fonte`
      : `atualizado até ${formataDataCurta(ritmo.ultima)}`;

    return { fonte: nome, sinal, alerta };
  });
}

/** Top-N por valor, já no formato de ponto de série. */
export function topN<T>(
  linhas: readonly T[],
  n: number,
  rotulo: (linha: T) => string,
  valor: (linha: T) => number | null,
): Array<{ r: string; v: number | null }> {
  return [...linhas]
    .sort((a, b) => (valor(b) ?? -Infinity) - (valor(a) ?? -Infinity))
    .slice(0, n)
    .map((l) => ({ r: rotulo(l), v: valor(l) }));
}

/** dd/mm/aaaa a partir de ISO. Nunca compara data como texto (SPECS §15.7). */
export function dataBR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return null;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Tamanho real do snapshot. Usado em desenvolvimento para não estourar o teto
 * sem ninguém perceber — snapshot gordo é conta de token todo dia.
 */
export function tamanhoSnapshot(s: DashboardSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(s)).length;
}

export function avisaSnapshotGrande(s: DashboardSnapshot): void {
  const bytes = tamanhoSnapshot(s);
  if (bytes > LIMITE_SNAPSHOT_BYTES) {
    console.warn(
      `[snapshot] ${s.slug} ocupa ${bytes} bytes (teto ${LIMITE_SNAPSHOT_BYTES}) — corte série antes de indicador`,
    );
  }
}

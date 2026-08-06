/**
 * Growth e Performance — dimensões e constantes (em código, não no banco).
 * Migração do Power BI homônimo; heranças documentadas em cada ponto.
 */

export type Produto =
  | 'Graduação'
  | 'Mestrado'
  | 'Pós EAD'
  | 'Pós Presencial'
  | 'Cursos Livres';

export const PRODUTOS: { id: string; label: Produto }[] = [
  { id: 'graduacao', label: 'Graduação' },
  { id: 'mestrado', label: 'Mestrado' },
  { id: 'pos-ead', label: 'Pós EAD' },
  { id: 'pos-presencial', label: 'Pós Presencial' },
  { id: 'cursos-livres', label: 'Cursos Livres' },
];

/**
 * Padrão único do seletor de datas para as 5 abas: o domínio completo do
 * calendário (01/10/2025 até hoje). O PBIP salvou um intervalo diferente em
 * cada aba (último estado do autor, não um padrão intencional) — no app usamos
 * um único padrão coerente.
 */
export const DATA_INICIO_DEFAULT = '2025-10-01';

/**
 * De-para region_id → UF, derivado de stg_google_ads.geotargetstate
 * (region_id = texto após a última "/").
 */
export const REGION_ID_UF: Record<string, string> = {
  '21232': 'AC', '20086': 'AL', '21226': 'AP', '20087': 'AM', '20088': 'BA',
  '20089': 'CE', '20090': 'DF', '20091': 'ES', '20092': 'GO', '20093': 'MA',
  '20096': 'MT', '20095': 'MS', '20094': 'MG', '20097': 'PA', '20098': 'PB',
  '20101': 'PR', '20099': 'PE', '20100': 'PI', '20102': 'RJ', '20103': 'RN',
  '20104': 'RS', '21227': 'RO', '21228': 'RR', '20105': 'SC', '20106': 'SP',
  '21229': 'SE', '21230': 'TO',
};

const MESES_EXT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export type MesAnoEntry = {
  /** ex.: 202510 — chave de ordenação; alfabético quebraria o eixo */
  cod: number;
  /** ex.: "Outubro - 25" */
  label: string;
  ano: number;
  mes: number;
};

/**
 * Calendário do dashboard: 2025-10-01 até hoje, com `Mês Ano Ext` ordenado
 * por `Cod_MesAno` (202510, 202511, ...) — é o eixo dos gráficos de linha.
 */
export function buildMesAnoCalendar(): MesAnoEntry[] {
  const out: MesAnoEntry[] = [];
  const hoje = new Date();
  let ano = 2025;
  let mes = 10;
  for (;;) {
    out.push({
      cod: ano * 100 + mes,
      label: `${MESES_EXT[mes - 1]} - ${String(ano).slice(2)}`,
      ano,
      mes,
    });
    if (ano === hoje.getFullYear() && mes === hoje.getMonth() + 1) break;
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
    if (ano > hoje.getFullYear() + 1) break;
  }
  return out;
}

/**
 * Faixa Hora do gráfico de horários: faixas de 2h a partir da hora par,
 * derivadas de momento_hora (HH:MM:SS) do Rubeus. Ordenar por `inicio`,
 * nunca alfabeticamente.
 */
export function faixaHora(momentoHora: string | null | undefined): { inicio: number; rotulo: string } | null {
  const m = (momentoHora ?? '').match(/^(\d{1,2})/);
  if (!m) return null;
  const hora = Number(m[1]);
  if (!Number.isFinite(hora) || hora < 0 || hora > 23) return null;
  const inicio = hora % 2 === 1 ? hora - 1 : hora;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { inicio, rotulo: `${pad(inicio)}:00 - ${pad((inicio + 2) % 24)}:00` };
}

/**
 * Fim de Semana (filtro do painel): sábado, domingo, ou sexta a partir das
 * 18:00 = 'Fim de Semana'; o resto = 'Dia de Semana'. Derivado de
 * nome_dia + momento_hora do Rubeus.
 */
export function classificaFimDeSemana(
  nomeDia: string | null | undefined,
  momentoHora: string | null | undefined,
): 'Fim de Semana' | 'Dia de Semana' {
  const dia = (nomeDia ?? '').toLowerCase();
  if (dia.startsWith('sábado') || dia.startsWith('sabado') || dia.startsWith('domingo')) {
    return 'Fim de Semana';
  }
  if (dia.startsWith('sexta')) {
    const m = (momentoHora ?? '').match(/^(\d{1,2})/);
    if (m && Number(m[1]) >= 18) return 'Fim de Semana';
  }
  return 'Dia de Semana';
}

/**
 * Campanhas Meta removidas ANTES de qualquer cálculo (regra do PBI original).
 * Comparação por igualdade EXATA da string — os espaços duplos fazem parte
 * dos nomes reais; não normalizar. Juntas somam R$ 94.752,46 no histórico.
 */
export const CAMPANHAS_META_EXCLUIDAS = new Set([
  'DOT  [FMP] [WHATSAPP] Pós Setembro',
  '[CAD] - [ACT] - [PÓS PRESENCIAL] - [FMP] -  CURSOS PRESENCIAIS ABRIL/26',
  '[CONV] - [ACT] - [PÓS PRESENCIAL] - [FMP] - [LP] -  CURSOS PRESENCIAIS ABRIL/26',
  '[CONV] - [ACT] - [PÓS PRES] - [FMP] -  [SITE] - Pós Presencial',
]);

/**
 * Ações do Meta que contam como lead (leadsMeta = SUM(value) destas).
 */
export const META_LEAD_ACTIONS = new Set([
  'complete_registration',
  'lead',
  'onsite_conversion.messaging_conversation_started_7d',
]);

/**
 * Ajuste manual de faturamento (§6/§7.6 do levantamento), identificado por RA
 * em vez de nome — encontrado em auto revisão (29/07/2026): a versão anterior
 * usava VITE_GROWTH_AJUSTE_ALUNO com o NOME do aluno. Variável VITE_ é
 * embutida no bundle JS público em tempo de build (mesmo problema já corrigido
 * em EXCLUSOES_FATURAMENTO_POS_RA/EXCECAO_TROCA_PL_RA — "fora do Git" não
 * significa "fora do navegador"). RA não identifica a pessoa a quem lê o
 * código, então pode ficar na env var com segurança.
 *
 * ⚠️ Ação pendente: o operador do deploy precisa configurar
 * VITE_GROWTH_AJUSTE_ALUNO_RA (o RA, não o nome) no EasyPanel — a variável
 * antiga não é mais lida. Até lá, o ajuste fica ausente com o aviso abaixo,
 * nunca aplicado por engano ao aluno errado.
 */
export const AJUSTE_ALUNO_RA = (import.meta.env.VITE_GROWTH_AJUSTE_ALUNO_RA ?? '') as string;
export const AJUSTE_DATA = (import.meta.env.VITE_GROWTH_AJUSTE_DATA ?? '2026-05-28') as string;

let avisoAjusteEmitido = false;

/**
 * Sem a env var o ajuste manual simplesmente não é aplicado e o faturamento do
 * Pós diverge do BI SEM nenhum sinal — o pior tipo de defeito. Avisa uma única
 * vez na inicialização. Nunca loga o valor da variável.
 */
export function avisaAjusteManualAusente(): void {
  if (avisoAjusteEmitido || AJUSTE_ALUNO_RA) return;
  avisoAjusteEmitido = true;
  console.warn(
    '[growth] VITE_GROWTH_AJUSTE_ALUNO_RA não configurada — ajuste manual de faturamento do Pós não será aplicado',
  );
}

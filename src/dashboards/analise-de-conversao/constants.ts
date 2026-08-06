const MESES_PT = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const ANOS = [2024, 2025, 2026];

/**
 * Janela de dados do Power BI original: a tabela `calendário` do modelo ia de
 * 01/11/2024 a 31/12/2026, e as medidas de Especializações usavam
 * MIN/MAX(calendário) como janela SEMPRE — nada anterior a nov/2024 era
 * contado, mesmo sem filtro selecionado. Estes valores são o padrão quando o
 * usuário não escolhe Data Início/Fim.
 */
export const DATA_INICIO_PADRAO = '2024-11-01';
export const DATA_FIM_PADRAO = '2026-12-31';

export function buildCalendar(): import('./types').CalendarEntry[] {
  const out: import('./types').CalendarEntry[] = [];
  for (const ano of ANOS) {
    for (let mes = 1; mes <= 12; mes++) {
      const date = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const ordemFiscal = mes >= 11 ? mes - 10 : mes + 2;
      out.push({
        date,
        ano,
        mes,
        mesNome: MESES_PT[mes - 1],
        ordemFiscal,
      });
    }
  }
  return out;
}

export const CALENDAR = buildCalendar();

export const MES_OPTIONS = CALENDAR.filter((c) => c.ano === 2025).map((c) => ({
  numero: c.mes,
  nome: c.mesNome,
}));

export function fiscalLabel(ano: number, mes: number): string {
  const nome = MESES_PT[mes - 1];
  return `${ano} ${nome}`;
}

export function fiscalSortKey(ano: number, mes: number): number {
  return ano * 100 + (mes >= 11 ? mes - 10 : mes + 2);
}

/**
 * Meta anual de matrículas do Mestrado — VALOR FIXO herdado do Power BI.
 * Origem: %2A%2AMedidas.tmdl:794, `measure Mest_Meta = 20`.
 *
 * Fase 1 = paridade: o valor NÃO é alterado. Registrado aqui porque estava
 * duplicado em dois pontos do calculations.ts, sem comentário, com risco de
 * divergirem numa manutenção futura.
 *
 * ⚠️ A tabela `meta_mestrado` EXISTE no banco e tem a meta, mas este
 * dashboard não a consulta — o BI original usava a constante. O dashboard
 * Presidência lê a tabela corretamente. Trocar aqui mudaria o número, então
 * fica como pendência de Fase 2.
 */
export const MEST_META = 20;

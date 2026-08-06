import { loadAllFrom } from '@/lib/supabasePaginate';
import { supabase } from '@/lib/supabase';
import { toISODate } from '../analise-de-conversao/dateUtils';
import type { RawPletivoRow } from '../analise-de-conversao/types';
import type {
  GrowthDataset,
  InscPorDia,
  RawGoogleAdsRow,
  RawMatCLGrowthRow,
  RawMatGradMestRow,
  RawMatPosGrowthRow,
  RawMetaAdsRow,
  RawRubeusGrowthRow,
} from './types';

// Cache em nível de módulo: navegar para outro dashboard e voltar não refaz
// o download. O botão "Atualizar" usa clearGrowthCache().
let cachedDataset: GrowthDataset | null = null;

export function clearGrowthCache(): void {
  cachedDataset = null;
}

export type LoadProgress = (etapa: number, totalEtapas: number, descricao: string) => void;

const TOTAL_ETAPAS = 4;

/**
 * Agrega inscrições por dia logo após o fetch e descarta o array bruto —
 * stg_rm_inscricoes_cursoslivres tem 110k+ linhas.
 * Herança §7.11: o Power Query truncava essa tabela em 100.000 linhas; aqui
 * não há teto, então o app tende a mostrar MAIS inscritos que o BI. Esperado.
 */
function agregaPorDia(datas: (string | null)[]): InscPorDia[] {
  const porDia = new Map<string, number>();
  for (const d of datas) {
    const iso = toISODate(d);
    if (!iso) continue;
    porDia.set(iso, (porDia.get(iso) ?? 0) + 1);
  }
  return Array.from(porDia.entries())
    .map(([data, total]) => ({ data, total }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

async function loadInscPorDia(table: string): Promise<InscPorDia[]> {
  const rows = (await loadAllFrom(table, 'datainscricao')) as { datainscricao: string | null }[];
  return agregaPorDia(rows.map((r) => r.datainscricao));
}

/**
 * stg_rm_inscricoes_pos não tem coluna de modalidade: a separação é pelo texto
 * de processoseletivo — contém 'Presencial' (case-insensitive) = Pós
 * Presencial, senão Pós EAD. Sem isso, as duas abas mostrariam o total
 * somado de Pós.
 */
async function loadInscPosSeparadas(): Promise<{ ead: InscPorDia[]; presencial: InscPorDia[] }> {
  const rows = (await loadAllFrom('stg_rm_inscricoes_pos', 'datainscricao,processoseletivo')) as {
    datainscricao: string | null;
    processoseletivo: string | null;
  }[];
  const ead: (string | null)[] = [];
  const presencial: (string | null)[] = [];
  for (const r of rows) {
    if ((r.processoseletivo ?? '').toLowerCase().includes('presencial')) {
      presencial.push(r.datainscricao);
    } else {
      ead.push(r.datainscricao);
    }
  }
  return { ead: agregaPorDia(ead), presencial: agregaPorDia(presencial) };
}

/**
 * Carrega em 4 lotes sequenciais (não tudo em paralelo) para não estourar o
 * limite de requisições simultâneas do Supabase — mesmo padrão do
 * analise-de-conversao.
 */
export async function fetchGrowthData(
  onProgress?: LoadProgress,
  forceRefresh = false,
): Promise<GrowthDataset> {
  if (cachedDataset && !forceRefresh) return cachedDataset;

  // Lote 1 — pletivo + CRM (Rubeus)
  onProgress?.(1, TOTAL_ETAPAS, 'Carregando leads do CRM');
  const pletivo = await loadPletivo();
  const rubeus = (await loadAllFrom(
    'rubeus_registros_personalizada',
    'pessoa,momento,momento_date,momento_hora,nome_dia,processo,canal_nome,fonte_action,status_oportunidade',
  )) as RawRubeusGrowthRow[];

  // Lote 2 — mídia paga
  onProgress?.(2, TOTAL_ETAPAS, 'Carregando mídia (Google e Meta)');
  const google = (await loadAllFrom(
    'stg_google_ads',
    'date,geotargetstate,campaign_name,impressions,clicks,costmicros,conversions',
  )) as RawGoogleAdsRow[];
  const meta = (await loadAllFrom(
    'stg_meta_ads',
    'date_start,campaign_name,adset_id,impressions,clicks,spend,reach,action_type,value',
  )) as RawMetaAdsRow[];

  // Lote 3 — matrículas
  onProgress?.(3, TOTAL_ETAPAS, 'Carregando matrículas');
  const gradMestCols =
    'aluno,codcontrato,situacao,tipomatricula,datamatricula,datacontrato,datacancelamentocontrato,faturadoliq';
  const matGrad = (await loadAllFrom('stg_rm_matriculas_grad', gradMestCols)) as RawMatGradMestRow[];
  const matMestrado = (await loadAllFrom('stg_rm_matriculas_mestrado', gradMestCols)) as RawMatGradMestRow[];
  const matPos = (await loadAllFrom(
    'stg_rm_matriculas_pos',
    'aluno,ra,curso,situacao,processoseletivo,descontoaluno,distanciapresencial,bolsas,bolsa3,codplanopgto,databaixa,datacancelamentomatricula,inscricaodata,faturadoliq,datadematricula',
  )) as RawMatPosGrowthRow[];
  const matCL = (await loadAllFrom(
    'stg_rm_matriculas_cursoslivres',
    'aluno,databaixa,valor_curso_com_desconto,data_contrato',
  )) as RawMatCLGrowthRow[];

  // Lote 4 — inscrições (agregadas por dia; CL tem 110k+ linhas)
  onProgress?.(4, TOTAL_ETAPAS, 'Carregando inscrições');
  const inscGrad = await loadInscPorDia('stg_rm_inscricoes_graduacao');
  const inscPos = await loadInscPosSeparadas();
  const inscMestrado = await loadInscPorDia('stg_rm_inscricoes_mestrado');
  const inscCL = await loadInscPorDia('stg_rm_inscricoes_cursoslivres');

  cachedDataset = {
    meta,
    google,
    rubeus,
    matGrad,
    matMestrado,
    matPos,
    matCL,
    inscGrad,
    inscPosEad: inscPos.ead,
    inscPosPresencial: inscPos.presencial,
    inscMestrado,
    inscCL,
    pletivo,
  };
  return cachedDataset;
}

async function loadPletivo(): Promise<RawPletivoRow[]> {
  const { data, error } = await supabase.from('pletivo').select('*').order('indice');
  if (error) throw error;
  return (data ?? []) as RawPletivoRow[];
}

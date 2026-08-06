/*
# Bolsas e Descontos — Otimização de RPCs (statement timeout)

## Problema
4 RPCs (`panorama_kpis`, `evasao_beneficios`, `evasao_por_ano`,
`evasao_por_modalidade`) usavam subconsultas correlatas que re-escaneavam
a view `vw_bolsas_descontos` (129K linhas + regex + hash join) N vezes
por grupo. Isso excedia o timeout de 3s da API REST do Supabase
(erro 57014 "canceling statement due to statement timeout").

## Solução
Reescrita das 4 funções usando agregação condicional single-pass
(COUNT/SUM com cláusula FILTER) em vez de subconsultas correlatas.
Cada função agora faz uma única varredura da view em vez de N+1.

## O que mudou
- `rpc_bolsas_panorama_kpis`: 13 subconsultas → 1 scan com FILTER
- `rpc_bolsas_evasao_beneficios`: subconsultas correlatas por grupo →
  GROUP BY + FILTER
- `rpc_bolsas_evasao_por_ano`: mesma otimização
- `rpc_bolsas_evasao_por_modalidade`: mesma otimização

## Segurança
- Sem mudanças de assinatura (mesmos parâmetros e tipos de retorno).
- SECURITY DEFINER mantido.
- GRANTs re-aplicados para garantir permissões.
*/

-- ============================================================
-- RPC: Panorama KPIs (otimizado — single-pass conditional aggregation)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_bolsas_panorama_kpis(
  p_codperlet text DEFAULT NULL,
  p_ano int DEFAULT NULL,
  p_tipocurso text DEFAULT NULL,
  p_bolsa_padronizada text DEFAULT NULL
)
RETURNS TABLE(
  matriculas bigint,
  bolsas bigint,
  descontos bigint,
  formados bigint,
  fat_original_previsto numeric,
  fat_desconto_previsto numeric,
  matric_cancelado bigint,
  matric_evadido bigint,
  matric_transferencia bigint,
  evasao_bolsas bigint,
  fat_desconto_matriculado numeric,
  mat_bene_fin bigint,
  renuncia_valor_evasao numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matriculas_union AS (
    SELECT COUNT(DISTINCT ra) AS cnt
    FROM (
      SELECT ra FROM public.stg_rm_matriculas_grad WHERE situacao = 'Matriculado'
      UNION ALL
      SELECT ra FROM public.stg_rm_matriculas_pos WHERE situacao = 'Matriculado'
      UNION ALL
      SELECT ra FROM public.stg_rm_matriculas_mestrado WHERE situacao = 'Matriculado'
    ) t
    WHERE ra IS NOT NULL AND TRIM(ra) <> ''
  ),
  agg AS (
    SELECT
      COUNT(*) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Bolsa') AS bolsas,
      COUNT(*) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto') AS descontos,
      COUNT(*) FILTER (WHERE situacao_matriculapl = 'Formado') AS formados,
      COALESCE(SUM(valororiginal_num), 0) AS fat_original_previsto,
      COALESCE(SUM(valordoliq_num), 0) AS fat_desconto_previsto,
      COUNT(DISTINCT ra) FILTER (WHERE situacao_curso = 'Cancelado - Curso (Assin_Cont)') AS cancelado_assin_ra,
      COUNT(DISTINCT codplanopgto) FILTER (WHERE situacao_curso = 'Cancelado – Curso') AS cancelado_curso_planos,
      COUNT(*) FILTER (WHERE situacao_curso = 'Evadido Curso') AS evadido,
      COUNT(*) FILTER (WHERE situacao_curso = 'Transferido de Instituição') AS transferencia,
      COALESCE(SUM(valororiginal_num) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto'), 0) AS fat_desconto_matriculado,
      COALESCE(SUM(valororiginal_num) FILTER (WHERE situacao_curso IN ('Cancelado – Curso', 'Cancelado - Curso (Assin_Cont)', 'Evadido Curso', 'Transferido de Instituição')), 0) AS renuncia
    FROM public.vw_bolsas_descontos
    WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
      AND (p_ano IS NULL OR ano = p_ano)
      AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
      AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  )
  SELECT
    (SELECT cnt FROM matriculas_union)::bigint AS matriculas,
    agg.bolsas::bigint AS bolsas,
    agg.descontos::bigint AS descontos,
    agg.formados::bigint AS formados,
    agg.fat_original_previsto::numeric AS fat_original_previsto,
    agg.fat_desconto_previsto::numeric AS fat_desconto_previsto,
    (COALESCE(agg.cancelado_assin_ra, 0) + COALESCE(agg.cancelado_curso_planos, 0))::bigint AS matric_cancelado,
    agg.evadido::bigint AS matric_evadido,
    agg.transferencia::bigint AS matric_transferencia,
    (COALESCE(agg.cancelado_assin_ra, 0) + COALESCE(agg.cancelado_curso_planos, 0) + COALESCE(agg.evadido, 0) + COALESCE(agg.transferencia, 0))::bigint AS evasao_bolsas,
    agg.fat_desconto_matriculado::numeric AS fat_desconto_matriculado,
    (COALESCE(agg.bolsas, 0) + COALESCE(agg.descontos, 0))::bigint AS mat_bene_fin,
    agg.renuncia::numeric AS renuncia_valor_evasao
  FROM agg
$$;

-- ============================================================
-- RPC: Top 10 Benefícios Financeiros com Maior Evasão (otimizado)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_bolsas_evasao_beneficios(
  p_codperlet text DEFAULT NULL,
  p_ano int DEFAULT NULL,
  p_tipocurso text DEFAULT NULL,
  p_bolsa_padronizada text DEFAULT NULL
)
RETURNS TABLE(categoria text, valor bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bolsa_padronizada AS categoria,
    (
      COALESCE(COUNT(DISTINCT ra) FILTER (WHERE situacao_curso = 'Cancelado - Curso (Assin_Cont)'), 0)
      + COALESCE(COUNT(DISTINCT codplanopgto) FILTER (WHERE situacao_curso = 'Cancelado – Curso'), 0)
      + COALESCE(COUNT(*) FILTER (WHERE situacao_curso = 'Evadido Curso'), 0)
      + COALESCE(COUNT(*) FILTER (WHERE situacao_curso = 'Transferido de Instituição'), 0)
    )::bigint AS valor
  FROM public.vw_bolsas_descontos
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY bolsa_padronizada
  ORDER BY valor DESC
  LIMIT 10
$$;

-- ============================================================
-- RPC: Evasão por Ano (otimizado — single-pass conditional aggregation)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_bolsas_evasao_por_ano(
  p_tipocurso text DEFAULT NULL,
  p_bolsa_padronizada text DEFAULT NULL
)
RETURNS TABLE(ano int, mat_bene_fin bigint, evasao_bolsas bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ano,
    (
      COALESCE(COUNT(*) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Bolsa'), 0)
      + COALESCE(COUNT(*) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto'), 0)
    )::bigint AS mat_bene_fin,
    (
      COALESCE(COUNT(DISTINCT ra) FILTER (WHERE situacao_curso = 'Cancelado - Curso (Assin_Cont)'), 0)
      + COALESCE(COUNT(DISTINCT codplanopgto) FILTER (WHERE situacao_curso = 'Cancelado – Curso'), 0)
      + COALESCE(COUNT(*) FILTER (WHERE situacao_curso = 'Evadido Curso'), 0)
      + COALESCE(COUNT(*) FILTER (WHERE situacao_curso = 'Transferido de Instituição'), 0)
    )::bigint AS evasao_bolsas
  FROM public.vw_bolsas_descontos
  WHERE ano IS NOT NULL
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY ano
  ORDER BY ano
$$;

-- ============================================================
-- RPC: Evasão por Modalidade (otimizado — single-pass conditional aggregation)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_bolsas_evasao_por_modalidade(
  p_codperlet text DEFAULT NULL,
  p_ano int DEFAULT NULL,
  p_tipocurso text DEFAULT NULL,
  p_bolsa_padronizada text DEFAULT NULL
)
RETURNS TABLE(categoria text, valor bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tipocurso AS categoria,
    (
      COALESCE(COUNT(DISTINCT ra) FILTER (WHERE situacao_curso = 'Cancelado - Curso (Assin_Cont)'), 0)
      + COALESCE(COUNT(DISTINCT codplanopgto) FILTER (WHERE situacao_curso = 'Cancelado – Curso'), 0)
      + COALESCE(COUNT(*) FILTER (WHERE situacao_curso = 'Evadido Curso'), 0)
      + COALESCE(COUNT(*) FILTER (WHERE situacao_curso = 'Transferido de Instituição'), 0)
    )::bigint AS valor
  FROM public.vw_bolsas_descontos
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY tipocurso
  ORDER BY valor DESC
$$;

-- ============================================================
-- Re-grant permissions (safe to re-run)
-- ============================================================

GRANT EXECUTE ON FUNCTION public.rpc_bolsas_panorama_kpis(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_beneficios(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_por_ano(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_por_modalidade(text, int, text, text) TO anon, authenticated;

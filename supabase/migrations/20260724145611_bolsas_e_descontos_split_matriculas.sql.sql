/*
# Bolsas e Descontos — Split panorama_kpis to avoid timeout

## Problema
`rpc_bolsas_panorama_kpis` ainda excedia o timeout de 3s quando chamada
sem filtros (all NULL). A causa era o CTE `matriculas_union` que faz
UNION ALL de 3 tabelas (grad/pos/mestrado) + COUNT(DISTINCT ra) em
paralelo ao scan da view de 129K linhas — duas operações pesadas na
mesma transação.

## Solução
1. Criar `rpc_bolsas_matriculas_count` — RPC isolado que retorna apenas
   o COUNT(DISTINCT ra) das 3 tabelas. É rápido (index scan) e não
   precisa de filtros (matrículas é um total global por definição).
2. Remover o CTE `matriculas_union` de `rpc_bolsas_panorama_kpis` e
   retornar 0 para matriculas (o frontend soma o valor do RPC separado).
3. O frontend chama ambos em paralelo via Promise.all.

## Segurança
- Nova função: SECURITY DEFINER, GRANT EXECUTE TO anon, authenticated.
- Assinatura de `panorama_kpis` não muda (mesmos params e retorno).
*/

-- ============================================================
-- RPC: Matrículas Count (isolado — global, sem filtros)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_bolsas_matriculas_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT ra)::bigint
  FROM (
    SELECT ra FROM public.stg_rm_matriculas_grad WHERE situacao = 'Matriculado'
    UNION ALL
    SELECT ra FROM public.stg_rm_matriculas_pos WHERE situacao = 'Matriculado'
    UNION ALL
    SELECT ra FROM public.stg_rm_matriculas_mestrado WHERE situacao = 'Matriculado'
  ) t
  WHERE ra IS NOT NULL AND TRIM(ra) <> ''
$$;

GRANT EXECUTE ON FUNCTION public.rpc_bolsas_matriculas_count() TO anon, authenticated;

-- ============================================================
-- RPC: Panorama KPIs (sem CTE matriculas_union — matriculas vem do RPC separado)
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
  SELECT
    0::bigint AS matriculas,
    COUNT(*) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Bolsa')::bigint AS bolsas,
    COUNT(*) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto')::bigint AS descontos,
    COUNT(*) FILTER (WHERE situacao_matriculapl = 'Formado')::bigint AS formados,
    COALESCE(SUM(valororiginal_num), 0)::numeric AS fat_original_previsto,
    COALESCE(SUM(valordoliq_num), 0)::numeric AS fat_desconto_previsto,
    (COALESCE(COUNT(DISTINCT ra) FILTER (WHERE situacao_curso = 'Cancelado - Curso (Assin_Cont)'), 0)
     + COALESCE(COUNT(DISTINCT codplanopgto) FILTER (WHERE situacao_curso = 'Cancelado – Curso'), 0))::bigint AS matric_cancelado,
    COUNT(*) FILTER (WHERE situacao_curso = 'Evadido Curso')::bigint AS matric_evadido,
    COUNT(*) FILTER (WHERE situacao_curso = 'Transferido de Instituição')::bigint AS matric_transferencia,
    (COALESCE(COUNT(DISTINCT ra) FILTER (WHERE situacao_curso = 'Cancelado - Curso (Assin_Cont)'), 0)
     + COALESCE(COUNT(DISTINCT codplanopgto) FILTER (WHERE situacao_curso = 'Cancelado – Curso'), 0)
     + COALESCE(COUNT(*) FILTER (WHERE situacao_curso = 'Evadido Curso'), 0)
     + COALESCE(COUNT(*) FILTER (WHERE situacao_curso = 'Transferido de Instituição'), 0))::bigint AS evasao_bolsas,
    COALESCE(SUM(valororiginal_num) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto'), 0)::numeric AS fat_desconto_matriculado,
    (COALESCE(COUNT(*) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Bolsa'), 0)
     + COALESCE(COUNT(*) FILTER (WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto'), 0))::bigint AS mat_bene_fin,
    COALESCE(SUM(valororiginal_num) FILTER (WHERE situacao_curso IN ('Cancelado – Curso', 'Cancelado - Curso (Assin_Cont)', 'Evadido Curso', 'Transferido de Instituição')), 0)::numeric AS renuncia_valor_evasao
  FROM public.vw_bolsas_descontos
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
$$;

GRANT EXECUTE ON FUNCTION public.rpc_bolsas_panorama_kpis(text, int, text, text) TO anon, authenticated;

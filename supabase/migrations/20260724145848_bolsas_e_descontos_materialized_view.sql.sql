/*
# Bolsas e Descontos — Materialized view for performance

## Problema
A view `vw_bolsas_descontos` recalcula regex (REGEXP_REPLACE + BTRIM +
UPPER) e hash join com `dim_tipo_beneficio` em cada scan das 129K linhas.
Sem filtros, isso excede o timeout de 3s do Supabase REST API.

## Solução
Criar `mvw_bolsas_descontos` (materialized view) que pré-calcula todas
as colunas normalizadas. As RPCs são reescritas para ler da materialized
view em vez da view regular. Índices não-uniformes (sem constraint de
unicidade) pois há linhas duplicadas na tabela fonte.

A materialized view deve ser atualizada manualmente via
`rpc_bolsas_refresh_mvw()` quando os dados de `stg_rm_matriculas_bolsas`
mudarem.
*/

-- ============================================================
-- Materialized View: mvw_bolsas_descontos
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS public.mvw_bolsas_descontos;

CREATE MATERIALIZED VIEW public.mvw_bolsas_descontos AS
SELECT
  b.aluno,
  b.ra,
  b.curso,
  b.data_matricula,
  b.codperlet,
  REPLACE(b.codperlet, '_', '') AS codperlet_norm,
  b.situacao_curso,
  b.situacao_matriculapl,
  b.bolsa,
  b.codplanopgto,
  b.databaixa,
  b.valororiginal::numeric AS valororiginal_num,
  b.valordoliq::numeric AS valordoliq_num,
  b.valorbaixado::numeric AS valorbaixado_num,
  COALESCE(
    dt.tipo_beneficio_padronizado,
    UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g')))
  ) AS bolsa_padronizada,
  CASE
    WHEN UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g'))) LIKE '%DESCONTO%' THEN 'Desconto'
    WHEN UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g'))) LIKE '%BOLSA%' THEN 'Bolsa'
    WHEN UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g'))) LIKE '%SEM BOLSA%' THEN 'Sem Bolsa'
    ELSE 'Pagamento Integral'
  END AS tipo_beneficio,
  CASE
    WHEN b.curso = 'Direito' THEN 'Graduação'
    WHEN b.curso = 'Mestrado Academico T.E.D.I' THEN 'Mestrado'
    WHEN b.curso = 'Curso Preparação Concurso MP' THEN 'Curso Preparatório'
    ELSE 'Pós Graduação'
  END AS tipocurso,
  CASE
    WHEN REPLACE(b.codperlet, '_', '') ~ '^\d{2}' THEN 2000 + SUBSTRING(REPLACE(b.codperlet, '_', '') FROM 1 FOR 2)::int
    ELSE NULL
  END AS ano
FROM public.stg_rm_matriculas_bolsas b
LEFT JOIN public.dim_tipo_beneficio dt
  ON dt.valor_original_rm = UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g')));

-- Non-unique indexes (source table has duplicate rows)
CREATE INDEX idx_mvw_bolsas_codperlet ON public.mvw_bolsas_descontos (codperlet_norm);
CREATE INDEX idx_mvw_bolsas_ano ON public.mvw_bolsas_descontos (ano);
CREATE INDEX idx_mvw_bolsas_tipocurso ON public.mvw_bolsas_descontos (tipocurso);
CREATE INDEX idx_mvw_bolsas_bolsa_pad ON public.mvw_bolsas_descontos (bolsa_padronizada);
CREATE INDEX idx_mvw_bolsas_sit_mat ON public.mvw_bolsas_descontos (situacao_matriculapl);
CREATE INDEX idx_mvw_bolsas_sit_cur ON public.mvw_bolsas_descontos (situacao_curso);
CREATE INDEX idx_mvw_bolsas_tipo_ben ON public.mvw_bolsas_descontos (tipo_beneficio);

GRANT SELECT ON public.mvw_bolsas_descontos TO anon, authenticated;

-- ============================================================
-- Refresh function
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_bolsas_refresh_mvw()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  REFRESH MATERIALIZED VIEW public.mvw_bolsas_descontos;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_bolsas_refresh_mvw() TO authenticated;

-- ============================================================
-- Re-point all RPCs to the materialized view
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
  FROM public.mvw_bolsas_descontos
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
$$;

CREATE OR REPLACE FUNCTION public.rpc_bolsas_top_descontos(
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
    COUNT(*)::bigint AS valor
  FROM public.mvw_bolsas_descontos
  WHERE tipo_beneficio = 'Desconto'
    AND situacao_matriculapl = 'Matriculado'
    AND (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY bolsa_padronizada
  ORDER BY valor DESC
  LIMIT 5
$$;

CREATE OR REPLACE FUNCTION public.rpc_bolsas_ocorrencias_bolsa(
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
    COUNT(*)::bigint AS valor
  FROM public.mvw_bolsas_descontos
  WHERE tipo_beneficio = 'Bolsa'
    AND situacao_matriculapl = 'Matriculado'
    AND (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY bolsa_padronizada
  HAVING COUNT(*) > 0
  ORDER BY valor DESC
$$;

CREATE OR REPLACE FUNCTION public.rpc_bolsas_distribuicao_beneficios(
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
  SELECT 'Bolsas' AS categoria,
    COUNT(*) FILTER (WHERE tipo_beneficio = 'Bolsa' AND situacao_matriculapl = 'Matriculado')::bigint AS valor
  FROM public.mvw_bolsas_descontos
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  UNION ALL
  SELECT 'Descontos' AS categoria,
    COUNT(*) FILTER (WHERE tipo_beneficio = 'Desconto' AND situacao_matriculapl = 'Matriculado')::bigint AS valor
  FROM public.mvw_bolsas_descontos
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
$$;

CREATE OR REPLACE FUNCTION public.rpc_bolsas_top_cursos_faturamento(
  p_codperlet text DEFAULT NULL,
  p_ano int DEFAULT NULL,
  p_tipocurso text DEFAULT NULL,
  p_bolsa_padronizada text DEFAULT NULL
)
RETURNS TABLE(categoria text, valor numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    curso AS categoria,
    COALESCE(SUM(valororiginal_num), 0)::numeric AS valor
  FROM public.mvw_bolsas_descontos
  WHERE situacao_matriculapl = 'Matriculado'
    AND tipo_beneficio = 'Desconto'
    AND (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY curso
  ORDER BY valor DESC
  LIMIT 5
$$;

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
  FROM public.mvw_bolsas_descontos
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY bolsa_padronizada
  ORDER BY valor DESC
  LIMIT 10
$$;

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
  FROM public.mvw_bolsas_descontos
  WHERE ano IS NOT NULL
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY ano
  ORDER BY ano
$$;

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
  FROM public.mvw_bolsas_descontos
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY tipocurso
  ORDER BY valor DESC
$$;

CREATE OR REPLACE FUNCTION public.rpc_bolsas_filter_options()
RETURNS TABLE(
  codperlet_options text[],
  ano_options int[],
  tipocurso_options text[],
  bolsa_padronizada_options text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT array_agg(DISTINCT codperlet_norm ORDER BY codperlet_norm) FROM public.mvw_bolsas_descontos WHERE codperlet_norm IS NOT NULL),
    (SELECT array_agg(DISTINCT ano ORDER BY ano) FROM public.mvw_bolsas_descontos WHERE ano IS NOT NULL),
    (SELECT array_agg(DISTINCT tipocurso ORDER BY tipocurso) FROM public.mvw_bolsas_descontos WHERE tipocurso IS NOT NULL),
    (SELECT array_agg(DISTINCT bolsa_padronizada ORDER BY bolsa_padronizada) FROM public.mvw_bolsas_descontos WHERE bolsa_padronizada IS NOT NULL)
$$;

-- Re-grant all
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_panorama_kpis(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_top_descontos(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_ocorrencias_bolsa(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_distribuicao_beneficios(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_top_cursos_faturamento(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_beneficios(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_por_ano(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_por_modalidade(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_filter_options() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_matriculas_count() TO anon, authenticated;

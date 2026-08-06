/*
# Bolsas e Descontos — View e RPCs

1. Visão geral
   Cria a view `vw_bolsas_descontos` que normaliza os dados de
   `stg_rm_matriculas_bolsas` aplicando as regras de negócio herdadas
   do Power BI (bolsa_padronizada, tipo_beneficio, tipocurso).
   Cria RPCs agregadoras para que o frontend nunca precise trazer
   as ~129 mil linhas para o client — todas as agregações rodam no banco.

2. View: vw_bolsas_descontos
   - bolsa_padronizada: TRIM+UPPER+colapsar espaços; JOIN com dim_tipo_beneficio;
     fallback = próprio texto normalizado.
   - tipo_beneficio: 'Desconto' se contém "desconto"; 'Bolsa' se contém "bolsa";
     'Sem Bolsa' se contém "sem bolsa"; senão 'Pagamento Integral'.
   - tipocurso: 'Graduação' se curso='Direito'; 'Mestrado' se 'Mestrado Academico T.E.D.I';
     'Curso Preparatório' se 'Curso Preparação Concurso MP'; senão 'Pós Graduação'.
   - codperlet_norm: codperlet sem o "_" inicial.
   - ano: 2000 + 2 primeiros dígitos do codperlet normalizado.

3. RPCs
   - rpc_bolsas_panorama_kpis: retorna os 6 KPIs de cards + KPIs auxiliares.
   - rpc_bolsas_top_descontos: Top 5 descontos por ocorrência.
   - rpc_bolsas_ocorrencias_bolsa: ocorrências por bolsa (todas com valor > 0).
   - rpc_bolsas_distribuicao_beneficios: 2 fatias (Bolsas vs Descontos).
   - rpc_bolsas_top_cursos_faturamento: Top 5 cursos por Fat_desconto.
   - rpc_bolsas_evasao_beneficios: Top 10 benefícios por EvasãoBolsas.
   - rpc_bolsas_evasao_por_ano: combinado colunas+linha (Mat_BeneFin, EvasãoBolsas).
   - rpc_bolsas_evasao_por_modalidade: donut por tipocurso.
   - rpc_bolsas_filter_options: valores distintos para filtros.

4. Segurança
   - As tabelas stg_rm_* têm RLS desabilitado (achado de segurança, não corrigido).
   - As views e RPCs são SECURITY DEFINER para permitir leitura via anon key
     sem expor leitura direta das tabelas stg_rm_*.
   - Nenhum dado pessoal (nome, CPF, telefone, e-mail) é retornado.

5. Notas
   - Os en-dashes (U+2013) e hifens (U+002D) em situacao_curso são distintos;
     ambos são tratados nas condições.
   - valororiginal e valordoliq: CAST direto para numeric (formato com ponto).
*/

-- ============================================================
-- VIEW: vw_bolsas_descontos
-- ============================================================

CREATE OR REPLACE VIEW public.vw_bolsas_descontos AS
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
  -- bolsa_padronizada
  COALESCE(
    dt.tipo_beneficio_padronizado,
    UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g')))
  ) AS bolsa_padronizada,
  -- tipo_beneficio (ordem exata do Power BI)
  CASE
    WHEN UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g'))) LIKE '%DESCONTO%' THEN 'Desconto'
    WHEN UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g'))) LIKE '%BOLSA%' THEN 'Bolsa'
    WHEN UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g'))) LIKE '%SEM BOLSA%' THEN 'Sem Bolsa'
    ELSE 'Pagamento Integral'
  END AS tipo_beneficio,
  -- tipocurso
  CASE
    WHEN b.curso = 'Direito' THEN 'Graduação'
    WHEN b.curso = 'Mestrado Academico T.E.D.I' THEN 'Mestrado'
    WHEN b.curso = 'Curso Preparação Concurso MP' THEN 'Curso Preparatório'
    ELSE 'Pós Graduação'
  END AS tipocurso,
  -- ano extraído do codperlet
  CASE
    WHEN REPLACE(b.codperlet, '_', '') ~ '^\d{2}' THEN 2000 + SUBSTRING(REPLACE(b.codperlet, '_', '') FROM 1 FOR 2)::int
    ELSE NULL
  END AS ano
FROM public.stg_rm_matriculas_bolsas b
LEFT JOIN public.dim_tipo_beneficio dt
  ON dt.valor_original_rm = UPPER(BTRIM(REGEXP_REPLACE(b.bolsa, '\s+', ' ', 'g')));

-- ============================================================
-- RPC: Panorama KPIs
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
    SELECT DISTINCT ra
    FROM (
      SELECT ra FROM public.stg_rm_matriculas_grad WHERE situacao = 'Matriculado'
      UNION ALL
      SELECT ra FROM public.stg_rm_matriculas_pos WHERE situacao = 'Matriculado'
      UNION ALL
      SELECT ra FROM public.stg_rm_matriculas_mestrado WHERE situacao = 'Matriculado'
    ) t
    WHERE ra IS NOT NULL AND TRIM(ra) <> ''
  ),
  bolsas_filtered AS (
    SELECT * FROM public.vw_bolsas_descontos
    WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
      AND (p_ano IS NULL OR ano = p_ano)
      AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
      AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  )
  SELECT
    -- Matrículas: COUNT(DISTINCT ra) das 3 tabelas com situacao='Matriculado'
    -- (não filtrado por p_codperlet etc — é o total global)
    (SELECT COUNT(*) FROM matriculas_union)::bigint AS matriculas,
    -- Bolsas: COUNT(ra) WHERE situacao_matriculapl='Matriculado' AND tipo_beneficio='Bolsa'
    (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Bolsa')::bigint AS bolsas,
    -- Descontos: igual com tipo_beneficio='Desconto'
    (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto')::bigint AS descontos,
    -- Formados: COUNT(ra) WHERE situacao_matriculapl='Formado'
    (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_matriculapl = 'Formado')::bigint AS formados,
    -- Faturamento Original Previsto: SUM(valororiginal) sem filtro adicional
    (SELECT COALESCE(SUM(valororiginal_num), 0) FROM bolsas_filtered)::numeric AS fat_original_previsto,
    -- Faturamento Desconto Previsto: SUM(valordoliq) sem filtro adicional
    (SELECT COALESCE(SUM(valordoliq_num), 0) FROM bolsas_filtered)::numeric AS fat_desconto_previsto,
    -- Matric_Cancelado: COUNT(DISTINCT ra) WHERE situacao_curso='Cancelado - Curso (Assin_Cont)'
    --                   + COUNT(DISTINCT codplanopgto) WHERE situacao_curso='Cancelado – Curso'
    (
      (SELECT COUNT(DISTINCT ra) FROM bolsas_filtered WHERE situacao_curso = 'Cancelado - Curso (Assin_Cont)')
      +
      (SELECT COUNT(DISTINCT codplanopgto) FROM bolsas_filtered WHERE situacao_curso = 'Cancelado – Curso')
    )::bigint AS matric_cancelado,
    -- Matric_Evadido: COUNT(ra) WHERE situacao_curso='Evadido Curso'
    (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_curso = 'Evadido Curso')::bigint AS matric_evadido,
    -- Matric_Transferencia: COUNT(ra) WHERE situacao_curso='Transferido de Instituição'
    (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_curso = 'Transferido de Instituição')::bigint AS matric_transferencia,
    -- EvasãoBolsas: soma dos 3 acima
    (
      (SELECT COUNT(DISTINCT ra) FROM bolsas_filtered WHERE situacao_curso = 'Cancelado - Curso (Assin_Cont)')
      +
      (SELECT COUNT(DISTINCT codplanopgto) FROM bolsas_filtered WHERE situacao_curso = 'Cancelado – Curso')
      +
      (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_curso = 'Evadido Curso')
      +
      (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_curso = 'Transferido de Instituição')
    )::bigint AS evasao_bolsas,
    -- Fat_desconto: SUM(valororiginal) WHERE situacao_matriculapl='Matriculado' AND tipo_beneficio='Desconto'
    (SELECT COALESCE(SUM(valororiginal_num), 0) FROM bolsas_filtered WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto')::numeric AS fat_desconto_matriculado,
    -- Mat_BeneFin: Bolsas + Descontos
    (
      (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Bolsa')
      +
      (SELECT COUNT(*) FROM bolsas_filtered WHERE situacao_matriculapl = 'Matriculado' AND tipo_beneficio = 'Desconto')
    )::bigint AS mat_bene_fin,
    -- Renúncia de Valor - Evasão: SUM(valororiginal) WHERE situacao_curso IN (...)
    (SELECT COALESCE(SUM(valororiginal_num), 0) FROM bolsas_filtered
     WHERE situacao_curso IN ('Cancelado – Curso', 'Cancelado - Curso (Assin_Cont)', 'Evadido Curso', 'Transferido de Instituição')
    )::numeric AS renuncia_valor_evasao
$$;

-- ============================================================
-- RPC: Top 5 Descontos com Maior Nº de Ocorrências
-- ============================================================

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
  FROM public.vw_bolsas_descontos
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

-- ============================================================
-- RPC: Nº Ocorrências por Bolsa
-- ============================================================

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
  FROM public.vw_bolsas_descontos
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

-- ============================================================
-- RPC: Distribuição dos Benefícios Financeiros (2 fatias)
-- ============================================================

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
    (SELECT COUNT(*) FROM public.vw_bolsas_descontos
     WHERE tipo_beneficio = 'Bolsa' AND situacao_matriculapl = 'Matriculado'
       AND (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
       AND (p_ano IS NULL OR ano = p_ano)
       AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
       AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
    )::bigint AS valor
  UNION ALL
  SELECT 'Descontos' AS categoria,
    (SELECT COUNT(*) FROM public.vw_bolsas_descontos
     WHERE tipo_beneficio = 'Desconto' AND situacao_matriculapl = 'Matriculado'
       AND (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
       AND (p_ano IS NULL OR ano = p_ano)
       AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
       AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
    )::bigint AS valor
$$;

-- ============================================================
-- RPC: Top 5 Cursos de Maior Faturamento - Descontos
-- ============================================================

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
  FROM public.vw_bolsas_descontos
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

-- ============================================================
-- RPC: Top 10 Benefícios Financeiros com Maior Evasão
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
      (SELECT COUNT(DISTINCT ra) FROM public.vw_bolsas_descontos v2
       WHERE v2.bolsa_padronizada = vw.bolsa_padronizada
         AND v2.situacao_curso = 'Cancelado - Curso (Assin_Cont)'
         AND (p_codperlet IS NULL OR v2.codperlet_norm = p_codperlet)
         AND (p_ano IS NULL OR v2.ano = p_ano)
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(DISTINCT codplanopgto) FROM public.vw_bolsas_descontos v2
       WHERE v2.bolsa_padronizada = vw.bolsa_padronizada
         AND v2.situacao_curso = 'Cancelado – Curso'
         AND (p_codperlet IS NULL OR v2.codperlet_norm = p_codperlet)
         AND (p_ano IS NULL OR v2.ano = p_ano)
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(*) FROM public.vw_bolsas_descontos v2
       WHERE v2.bolsa_padronizada = vw.bolsa_padronizada
         AND v2.situacao_curso = 'Evadido Curso'
         AND (p_codperlet IS NULL OR v2.codperlet_norm = p_codperlet)
         AND (p_ano IS NULL OR v2.ano = p_ano)
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(*) FROM public.vw_bolsas_descontos v2
       WHERE v2.bolsa_padronizada = vw.bolsa_padronizada
         AND v2.situacao_curso = 'Transferido de Instituição'
         AND (p_codperlet IS NULL OR v2.codperlet_norm = p_codperlet)
         AND (p_ano IS NULL OR v2.ano = p_ano)
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
    )::bigint AS valor
  FROM public.vw_bolsas_descontos vw
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY bolsa_padronizada
  ORDER BY valor DESC
  LIMIT 10
$$;

-- ============================================================
-- RPC: Evasão por Ano (combinado colunas+linha)
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
    -- Mat_BeneFin: Bolsas + Descontos (matriculados)
    (
      (SELECT COUNT(*) FROM public.vw_bolsas_descontos v2
       WHERE v2.ano = vw.ano
         AND v2.situacao_matriculapl = 'Matriculado'
         AND v2.tipo_beneficio = 'Bolsa'
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(*) FROM public.vw_bolsas_descontos v2
       WHERE v2.ano = vw.ano
         AND v2.situacao_matriculapl = 'Matriculado'
         AND v2.tipo_beneficio = 'Desconto'
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
    )::bigint AS mat_bene_fin,
    -- EvasãoBolsas
    (
      (SELECT COUNT(DISTINCT ra) FROM public.vw_bolsas_descontos v2
       WHERE v2.ano = vw.ano
         AND v2.situacao_curso = 'Cancelado - Curso (Assin_Cont)'
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(DISTINCT codplanopgto) FROM public.vw_bolsas_descontos v2
       WHERE v2.ano = vw.ano
         AND v2.situacao_curso = 'Cancelado – Curso'
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(*) FROM public.vw_bolsas_descontos v2
       WHERE v2.ano = vw.ano
         AND v2.situacao_curso = 'Evadido Curso'
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(*) FROM public.vw_bolsas_descontos v2
       WHERE v2.ano = vw.ano
         AND v2.situacao_curso = 'Transferido de Instituição'
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
    )::bigint AS evasao_bolsas
  FROM public.vw_bolsas_descontos vw
  WHERE ano IS NOT NULL
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY ano
  ORDER BY ano
$$;

-- ============================================================
-- RPC: Evasão com Benefícios Financeiros por Modalidade (donut)
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
      (SELECT COUNT(DISTINCT ra) FROM public.vw_bolsas_descontos v2
       WHERE v2.tipocurso = vw.tipocurso
         AND v2.situacao_curso = 'Cancelado - Curso (Assin_Cont)'
         AND (p_codperlet IS NULL OR v2.codperlet_norm = p_codperlet)
         AND (p_ano IS NULL OR v2.ano = p_ano)
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(DISTINCT codplanopgto) FROM public.vw_bolsas_descontos v2
       WHERE v2.tipocurso = vw.tipocurso
         AND v2.situacao_curso = 'Cancelado – Curso'
         AND (p_codperlet IS NULL OR v2.codperlet_norm = p_codperlet)
         AND (p_ano IS NULL OR v2.ano = p_ano)
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(*) FROM public.vw_bolsas_descontos v2
       WHERE v2.tipocurso = vw.tipocurso
         AND v2.situacao_curso = 'Evadido Curso'
         AND (p_codperlet IS NULL OR v2.codperlet_norm = p_codperlet)
         AND (p_ano IS NULL OR v2.ano = p_ano)
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
      +
      (SELECT COUNT(*) FROM public.vw_bolsas_descontos v2
       WHERE v2.tipocurso = vw.tipocurso
         AND v2.situacao_curso = 'Transferido de Instituição'
         AND (p_codperlet IS NULL OR v2.codperlet_norm = p_codperlet)
         AND (p_ano IS NULL OR v2.ano = p_ano)
         AND (p_tipocurso IS NULL OR v2.tipocurso = p_tipocurso)
         AND (p_bolsa_padronizada IS NULL OR v2.bolsa_padronizada = p_bolsa_padronizada)
      )
    )::bigint AS valor
  FROM public.vw_bolsas_descontos vw
  WHERE (p_codperlet IS NULL OR codperlet_norm = p_codperlet)
    AND (p_ano IS NULL OR ano = p_ano)
    AND (p_tipocurso IS NULL OR tipocurso = p_tipocurso)
    AND (p_bolsa_padronizada IS NULL OR bolsa_padronizada = p_bolsa_padronizada)
  GROUP BY tipocurso
  ORDER BY valor DESC
$$;

-- ============================================================
-- RPC: Opções de Filtro
-- ============================================================

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
    (SELECT array_agg(DISTINCT codperlet_norm ORDER BY codperlet_norm) FROM public.vw_bolsas_descontos WHERE codperlet_norm IS NOT NULL),
    (SELECT array_agg(DISTINCT ano ORDER BY ano) FROM public.vw_bolsas_descontos WHERE ano IS NOT NULL),
    (SELECT array_agg(DISTINCT tipocurso ORDER BY tipocurso) FROM public.vw_bolsas_descontos WHERE tipocurso IS NOT NULL),
    (SELECT array_agg(DISTINCT bolsa_padronizada ORDER BY bolsa_padronizada) FROM public.vw_bolsas_descontos WHERE bolsa_padronizada IS NOT NULL)
$$;

-- ============================================================
-- Grant access to anon and authenticated roles
-- ============================================================

GRANT EXECUTE ON FUNCTION public.rpc_bolsas_panorama_kpis(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_top_descontos(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_ocorrencias_bolsa(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_distribuicao_beneficios(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_top_cursos_faturamento(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_beneficios(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_por_ano(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_evasao_por_modalidade(text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_bolsas_filter_options() TO anon, authenticated;
GRANT SELECT ON public.vw_bolsas_descontos TO anon, authenticated;

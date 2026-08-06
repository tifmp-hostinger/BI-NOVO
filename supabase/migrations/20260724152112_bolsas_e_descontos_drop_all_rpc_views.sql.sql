/*
# Bolsas e Descontos — Remove DB objects (simplify to client-side)

## O que muda
Remove todos os objetos de banco criados para este dashboard: view,
materialized view, funções RPC. A partir daqui o dashboard lê
diretamente as tabelas existentes e faz o cruzamento em TypeScript.

## O que permanece intocado
- Tabela public.dim_tipo_beneficio (de-para estático) — passa a ser
  lida diretamente pelo client.
- Tabelas stg_rm_matriculas_bolsas / grad / pos / mestrado — usadas
  por outros projetos, não podem ser alteradas.

## Segurança
- Nenhuma alteração de RLS ou permissões nas tabelas fonte.
- CASCADE nos DROPs para remover dependências geradas por versões
  anteriores desta migration.
*/

DROP FUNCTION IF EXISTS public.rpc_bolsas_distribuicao_beneficios CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_evasao_beneficios CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_evasao_por_ano CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_evasao_por_modalidade CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_filter_options CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_matriculas_count CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_ocorrencias_bolsa CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_panorama_kpis CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_refresh_mvw CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_top_cursos_faturamento CASCADE;
DROP FUNCTION IF EXISTS public.rpc_bolsas_top_descontos CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mvw_bolsas_descontos CASCADE;
DROP VIEW IF EXISTS public.vw_bolsas_descontos CASCADE;

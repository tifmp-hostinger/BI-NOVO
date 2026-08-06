-- Remove o acesso de leitura das tabelas de RH para usuarios autenticados.
--
-- CONTEXTO. A migracao 20260731112004 liberou SELECT para `authenticated` em
-- bloco. Duas tabelas entraram junto sem serem usadas por nenhum painel:
--
--   stg_rm_rh_infofuncionarios  (741 linhas)  cpf, rg, ctps, salario, telefone,
--                                             endereco, dtnascimento, corraca,
--                                             emailpessoal
--   stg_rh_infofolha            (5433 linhas) folha de pagamento
--
-- Como a anon key vive no bundle publico e quem protege e a RLS (SPECS 6.2),
-- qualquer usuario logado podia rodar no console do navegador:
--
--   supabase.from('stg_rm_rh_infofuncionarios').select('*')
--
-- e levar a folha inteira. Nenhuma dessas tabelas aparece em
-- FONTES_POR_DASHBOARD -- conferido nos 5 paineis --, entao revogar nao quebra
-- tela nenhuma. Elas continuam cadastradas em REGISTRO_FONTES apenas como
-- documentacao da esteira de carga, o que nao exige leitura pelo app.
--
-- A carga (service_role) ignora RLS e segue funcionando normalmente.

drop policy if exists leitura_autenticados_stg_rm_rh_infofuncionarios
  on public.stg_rm_rh_infofuncionarios;

drop policy if exists leitura_autenticados_stg_rh_infofolha
  on public.stg_rh_infofolha;

-- RLS ligada + zero policy = nenhuma linha visivel para anon/authenticated.
alter table public.stg_rm_rh_infofuncionarios enable row level security;
alter table public.stg_rh_infofolha enable row level security;

-- Cinto e suspensorio: sem o GRANT, nem uma policy criada por engano no futuro
-- devolve dado para o navegador.
revoke all on public.stg_rm_rh_infofuncionarios from anon, authenticated;
revoke all on public.stg_rh_infofolha from anon, authenticated;

comment on table public.stg_rm_rh_infofuncionarios is
  'Cadastro de funcionarios (RH). CONTEM PII SENSIVEL: cpf, rg, salario, endereco. '
  'Sem acesso para anon/authenticated -- somente service_role (carga). '
  'Nao usar em dashboard: SPECS 13 proibe PII na interface.';

comment on table public.stg_rh_infofolha is
  'Folha de pagamento. CONTEM PII SENSIVEL. '
  'Sem acesso para anon/authenticated -- somente service_role (carga).';

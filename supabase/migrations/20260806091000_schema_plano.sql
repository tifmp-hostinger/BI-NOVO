-- =====================================================================
-- Modulo Plano de Acao -- schema `plano`
--
-- DESVIO REGISTRADO DO SPECS. O SPECS 2 diz que a aplicacao e "somente leitura
-- sobre dados de negocio" e o 6.2 proibe INSERT/UPDATE/DELETE a partir do
-- front. Isso CONTINUA VALENDO para stg_*, rubeus_*, meta_* e dim_*.
--
-- Plano de acao nao e dado de negocio: e dado proprio da aplicacao, criado por
-- pessoas dentro dela. Por isso vive em um SCHEMA SEPARADO, com escrita
-- permitida. A separacao por schema (e nao por prefixo de tabela) torna a
-- auditoria trivial: basta conferir que nenhuma tabela de `public` ganhou
-- policy de escrita.
--
-- PASSO MANUAL OBRIGATORIO APOS APLICAR:
--   Supabase Dashboard -> Settings -> API -> "Exposed schemas"
--   acrescentar `plano` a lista (junto de `public`).
--   Sem isso o PostgREST nao enxerga o schema e `supabase.schema('plano')`
--   devolve 404 -- falha silenciosa que parece bug de RLS.
-- =====================================================================

create schema if not exists plano;

grant usage on schema plano to authenticated;
-- `anon` NUNCA recebe nada aqui: quem nao esta logado nao ve plano.
revoke all on schema plano from anon;

-- unaccent: sem ele "matricula" e "matricula" viram termos distintos na busca.
create extension if not exists unaccent with schema extensions;

-- unaccent(text) e STABLE, e coluna gerada exige IMMUTABLE. A forma de dois
-- argumentos, com o dicionario fixado, e deterministica -- por isso o wrapper
-- pode ser marcado immutable com seguranca.
--
-- SECURITY DEFINER nao e detalhe: sem ele, o INSERT de um usuario `authenticated`
-- que nao tenha USAGE em `extensions` falha com "permission denied for schema
-- extensions" na hora de calcular a coluna gerada -- erro que aparece so no
-- primeiro insert real, nunca na migracao. Encontrado em teste contra Postgres 16.
create or replace function plano.imutavel_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
security definer
set search_path = extensions, pg_catalog, pg_temp
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

grant execute on function plano.imutavel_unaccent(text) to authenticated;

-- ---------------------------------------------------------------- conversas

create table if not exists plano.conversas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.perfis(id) on delete cascade,
  dashboard_slug text,
  titulo text,
  criado_em timestamptz not null default now()
);
create index if not exists conversas_autor_idx on plano.conversas (autor_id, criado_em desc);

create table if not exists plano.mensagens (
  id bigserial primary key,
  conversa_id uuid not null references plano.conversas(id) on delete cascade,
  papel text not null check (papel in ('user', 'assistant', 'tool')),
  conteudo jsonb not null,
  tokens int,
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_conversa_idx on plano.mensagens (conversa_id, id);

-- ---------------------------------------------------------------- planos

create table if not exists plano.planos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) > 0),
  dashboard_slug text not null,
  -- Filtros ativos quando o plano nasceu (para reabrir o painel no recorte).
  recorte jsonb not null default '{}'::jsonb,
  -- Snapshot CONGELADO: e a evidencia auditavel. Sem ele, o painel muda amanha
  -- e ninguem consegue mais explicar por que a acao foi criada.
  snapshot jsonb not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'em_revisao', 'aprovado', 'arquivado')),
  autor_id uuid not null references public.perfis(id),
  aprovado_por uuid references public.perfis(id),
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Aprovado exige quem e quando: status sem autoria nao e aprovacao, e assinatura em branco.
  constraint planos_aprovacao_completa check (
    status <> 'aprovado' or (aprovado_por is not null and aprovado_em is not null)
  )
);
create index if not exists planos_autor_idx on plano.planos (autor_id, criado_em desc);
create index if not exists planos_status_idx on plano.planos (status, criado_em desc);

create table if not exists plano.acoes (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references plano.planos(id) on delete cascade,
  ordem int not null default 0,
  area text not null,
  titulo text not null check (length(btrim(titulo)) > 0),
  descricao text,
  responsavel_id uuid references public.perfis(id) on delete set null,
  prazo date,
  -- Esforco em tempo humano (SPECS 7.4): "leva ~1 hora", nunca baixo/medio/alto.
  esforco_horas numeric(6,1),
  janela text not null default 'proximas_semanas'
    check (janela in ('esta_semana', 'proximas_semanas', 'quando_der')),
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  -- { dashboard, indicador, valor } -- validado pela guarda de numeros na
  -- Edge Function contra o snapshot antes de chegar aqui.
  evidencia jsonb,
  -- Preenchido quando a acao nasceu de uma memoria e nao de um numero.
  memoria_id uuid,
  criado_em timestamptz not null default now()
);
create index if not exists acoes_plano_idx on plano.acoes (plano_id, ordem);
create index if not exists acoes_responsavel_idx on plano.acoes (responsavel_id, status);

-- ---------------------------------------------------------------- memoria

create table if not exists plano.memoria (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'sazonalidade', 'processo', 'hierarquia', 'correcao',
    'licao_aprendida', 'restricao', 'glossario'
  )),
  -- A frase como a pessoa ensinou. Curta de proposito: memoria longa nao e
  -- memoria, e documento.
  conteudo text not null check (length(btrim(conteudo)) between 10 and 1000),

  -- ESCOPO -- decide QUANDO esta memoria e carregada.
  -- NULL = "vale sempre". Preenchido = "vale so nesse recorte".
  dashboard_slug text,
  produto text,
  indicador text,
  area text,
  meses smallint[] check (
    meses is null or (
      array_length(meses, 1) between 1 and 12
      and meses <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
    )
  ),
  campanha text,

  -- VALIDADE -- memoria sem prazo vira mentira repetida para sempre.
  -- Sazonalidade e a excecao: recorre todo ano, entao usa `meses` e nao expira.
  vigente_de date,
  vigente_ate date,
  constraint memoria_vigencia_coerente check (
    vigente_de is null or vigente_ate is null or vigente_ate >= vigente_de
  ),

  status text not null default 'proposta'
    check (status in ('proposta', 'validada', 'recusada', 'substituida')),
  substitui uuid references plano.memoria(id) on delete set null,
  origem text not null default 'llm' check (origem in ('llm', 'humano')),
  ensinado_por uuid not null references public.perfis(id),
  validado_por uuid references public.perfis(id),
  validado_em timestamptz,
  usos int not null default 0,

  busca tsvector generated always as (
    to_tsvector('portuguese', plano.imutavel_unaccent(conteudo))
  ) stored,

  criado_em timestamptz not null default now(),

  -- Validada exige quem validou. A LLM nunca preenche isso: e a barreira que
  -- impede o agente de escrever uma suposicao hoje e le-la como fato amanha.
  constraint memoria_validacao_completa check (
    status <> 'validada' or (validado_por is not null and validado_em is not null)
  )
);
create index if not exists memoria_busca_idx on plano.memoria using gin (busca);
create index if not exists memoria_escopo_idx on plano.memoria (status, dashboard_slug, produto, area);
create index if not exists memoria_meses_idx on plano.memoria using gin (meses);
create index if not exists memoria_vigencia_idx on plano.memoria (status, vigente_ate);

alter table plano.acoes
  drop constraint if exists acoes_memoria_fk;
alter table plano.acoes
  add constraint acoes_memoria_fk
  foreign key (memoria_id) references plano.memoria(id) on delete set null;

-- De onde veio cada memoria: rastreabilidade ate a fala que a gerou.
create table if not exists plano.memoria_origem (
  memoria_id uuid primary key references plano.memoria(id) on delete cascade,
  acao_id uuid references plano.acoes(id) on delete set null,
  conversa_id uuid references plano.conversas(id) on delete set null,
  trecho text
);

-- ---------------------------------------------------------------- envios

create table if not exists plano.envios (
  id bigserial primary key,
  plano_id uuid not null references plano.planos(id) on delete cascade,
  canal text not null check (canal in ('n8n', 'teams', 'email')),
  destino text,
  payload jsonb not null,
  status_http int,
  resposta text,
  enviado_por uuid not null references public.perfis(id),
  enviado_em timestamptz not null default now()
);
create index if not exists envios_plano_idx on plano.envios (plano_id, enviado_em desc);

-- ---------------------------------------------------------------- triggers

create or replace function plano.toca_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists planos_atualizado_em on plano.planos;
create trigger planos_atualizado_em
  before update on plano.planos
  for each row execute function plano.toca_atualizado_em();

-- Aprovacao e sempre carimbada pelo banco, nunca pelo cliente: um front
-- comprometido nao pode forjar "aprovado por outra pessoa".
create or replace function plano.carimba_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = plano, public, pg_temp
as $$
begin
  if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    new.aprovado_por := auth.uid();
    new.aprovado_em := now();
  elsif new.status <> 'aprovado' then
    new.aprovado_por := null;
    new.aprovado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists planos_carimba_aprovacao on plano.planos;
create trigger planos_carimba_aprovacao
  before update on plano.planos
  for each row execute function plano.carimba_aprovacao();

-- Idem para memoria: quem valida e sempre quem esta logado.
create or replace function plano.carimba_validacao()
returns trigger
language plpgsql
security definer
set search_path = plano, public, pg_temp
as $$
begin
  if new.status = 'validada' and old.status is distinct from 'validada' then
    new.validado_por := auth.uid();
    new.validado_em := now();
  elsif new.status <> 'validada' then
    new.validado_por := null;
    new.validado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists memoria_carimba_validacao on plano.memoria;
create trigger memoria_carimba_validacao
  before update on plano.memoria
  for each row execute function plano.carimba_validacao();

-- ---------------------------------------------------------------- leitura da memoria

-- Recuperacao por FILTRO nas dimensoes do snapshot, nao por similaridade.
-- Deterministica e auditavel: da para mostrar ao usuario exatamente o que
-- entrou no plano. Ver docs/plano-de-acao-arquitetura.md 5.3.1.
--
-- NULL em uma dimensao da memoria = "vale para qualquer valor dela".
-- Mora em `public` de proposito: e o unico schema que o PostgREST expoe por
-- padrao, entao a Edge Function le a memoria mesmo antes de alguem marcar
-- `plano` em "Exposed schemas". Devolve colunas explicitas -- nunca
-- `setof plano.memoria`, que vazaria a estrutura interna pela API.
create or replace function public.plano_memoria_no_escopo(
  p_dashboard text default null,
  p_produto text default null,
  p_indicadores text[] default null,
  p_areas text[] default null,
  p_mes smallint default null
)
returns table (
  id uuid,
  tipo text,
  conteudo text,
  dashboard_slug text,
  produto text,
  indicador text,
  area text,
  meses smallint[],
  vigente_ate date,
  ensinado_por uuid,
  criado_em timestamptz,
  usos int
)
language sql
stable
security definer
set search_path = plano, public, pg_temp
as $$
  select m.id, m.tipo, m.conteudo, m.dashboard_slug, m.produto, m.indicador,
         m.area, m.meses, m.vigente_ate, m.ensinado_por, m.criado_em, m.usos
  from plano.memoria m
  where m.status = 'validada'
    and (m.vigente_ate is null or m.vigente_ate >= current_date)
    and (m.vigente_de is null or m.vigente_de <= current_date)
    and (m.dashboard_slug is null or p_dashboard is null or m.dashboard_slug = p_dashboard)
    and (m.produto is null or p_produto is null or m.produto = p_produto)
    and (m.indicador is null or p_indicadores is null or m.indicador = any(p_indicadores))
    and (m.area is null or p_areas is null or m.area = any(p_areas))
    and (m.meses is null or p_mes is null or p_mes = any(m.meses))
  order by
    -- Mais especifica primeiro: se um dia precisar cortar por orcamento de
    -- token, o que sai e o generico, nao a correcao pontual.
    (m.dashboard_slug is not null)::int
      + (m.produto is not null)::int
      + (m.indicador is not null)::int
      + (m.area is not null)::int desc,
    m.usos desc,
    m.criado_em desc;
$$;

revoke all on function public.plano_memoria_no_escopo(text, text, text[], text[], smallint) from public, anon;
grant execute on function public.plano_memoria_no_escopo(text, text, text[], text[], smallint) to authenticated;

comment on function public.plano_memoria_no_escopo(text, text, text[], text[], smallint) is
  'Memoria validada e vigente no escopo do snapshot. Recuperacao deterministica '
  'por filtro -- nunca por similaridade -- para que o plano possa mostrar '
  'exatamente o que considerou.';

-- Contador de uso: memoria nunca usada em 6 meses e candidata a remocao;
-- memoria muito usada e candidata a virar regra de codigo. Telemetria, nao
-- regra de negocio -- por isso nao falha o turno se der erro.
create or replace function public.plano_memoria_incrementa_uso(p_id uuid)
returns void
language sql
security definer
set search_path = plano, public, pg_temp
as $$
  update plano.memoria set usos = usos + 1 where id = p_id and status = 'validada';
$$;

revoke all on function public.plano_memoria_incrementa_uso(uuid) from public, anon;
grant execute on function public.plano_memoria_incrementa_uso(uuid) to authenticated;

-- Busca textual para a cauda de memoria sem chave natural (o grosso vem pelo
-- filtro de escopo acima).
--
-- O termo da busca PRECISA passar pelo mesmo unaccent da coluna gerada. Sem
-- isso, procurar "matricula" acha "matrícula" mas procurar "matrícula" nao acha
-- "matricula" -- assimetria que so aparece quando alguem digita com acento, e
-- que faz a memoria certa sumir sem nenhum erro. Encontrado em teste.
create or replace function public.plano_memoria_busca(p_termo text)
returns table (id uuid, tipo text, conteudo text, relevancia real)
language sql
stable
security definer
set search_path = plano, public, pg_temp
as $$
  select m.id, m.tipo, m.conteudo,
         ts_rank(m.busca, plainto_tsquery('portuguese', plano.imutavel_unaccent(p_termo))) as relevancia
  from plano.memoria m
  where m.status = 'validada'
    and (m.vigente_ate is null or m.vigente_ate >= current_date)
    and m.busca @@ plainto_tsquery('portuguese', plano.imutavel_unaccent(p_termo))
  order by relevancia desc, m.usos desc
  limit 20;
$$;

revoke all on function public.plano_memoria_busca(text) from public, anon;
grant execute on function public.plano_memoria_busca(text) to authenticated;

-- ---------------------------------------------------------------- RLS

alter table plano.conversas      enable row level security;
alter table plano.mensagens      enable row level security;
alter table plano.planos         enable row level security;
alter table plano.acoes          enable row level security;
alter table plano.memoria        enable row level security;
alter table plano.memoria_origem enable row level security;
alter table plano.envios         enable row level security;

grant select, insert, update, delete on plano.conversas      to authenticated;
grant select, insert                 on plano.mensagens      to authenticated;
grant select, insert, update, delete on plano.planos         to authenticated;
grant select, insert, update, delete on plano.acoes          to authenticated;
grant select, insert, update         on plano.memoria        to authenticated;
grant select, insert                 on plano.memoria_origem to authenticated;
grant select                         on plano.envios         to authenticated;
grant usage, select on all sequences in schema plano to authenticated;

-- conversas / mensagens: privadas do autor. Conversa e rascunho de raciocinio,
-- nao documento institucional -- o que vira publico e o plano.
drop policy if exists conversas_rw on plano.conversas;
create policy conversas_rw on plano.conversas
  for all to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

drop policy if exists mensagens_select on plano.mensagens;
create policy mensagens_select on plano.mensagens
  for select to authenticated
  using (exists (
    select 1 from plano.conversas c
    where c.id = conversa_id and c.autor_id = auth.uid()
  ));

drop policy if exists mensagens_insert on plano.mensagens;
create policy mensagens_insert on plano.mensagens
  for insert to authenticated
  with check (exists (
    select 1 from plano.conversas c
    where c.id = conversa_id and c.autor_id = auth.uid()
  ));

-- planos: toda a instituicao LE (e o ponto do modulo); so autor e admin escrevem.
drop policy if exists planos_select on plano.planos;
create policy planos_select on plano.planos
  for select to authenticated using (true);

drop policy if exists planos_insert on plano.planos;
create policy planos_insert on plano.planos
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists planos_update on plano.planos;
create policy planos_update on plano.planos
  for update to authenticated
  using (autor_id = auth.uid() or public.eh_admin())
  with check (
    (autor_id = auth.uid() or public.eh_admin())
    -- Aprovar e ato de admin. O autor mexe no rascunho a vontade, mas nao
    -- assina a propria aprovacao.
    and (status <> 'aprovado' or public.eh_admin())
  );

drop policy if exists planos_delete on plano.planos;
create policy planos_delete on plano.planos
  for delete to authenticated
  using ((autor_id = auth.uid() and status = 'rascunho') or public.eh_admin());

-- acoes: seguem o plano. Excecao util: o responsavel pode mover o proprio
-- status (pendente -> concluida) sem poder reescrever a acao.
drop policy if exists acoes_select on plano.acoes;
create policy acoes_select on plano.acoes
  for select to authenticated using (true);

drop policy if exists acoes_insert on plano.acoes;
create policy acoes_insert on plano.acoes
  for insert to authenticated
  with check (exists (
    select 1 from plano.planos p
    where p.id = plano_id and (p.autor_id = auth.uid() or public.eh_admin())
  ));

drop policy if exists acoes_update on plano.acoes;
create policy acoes_update on plano.acoes
  for update to authenticated
  using (
    responsavel_id = auth.uid()
    or exists (
      select 1 from plano.planos p
      where p.id = plano_id and (p.autor_id = auth.uid() or public.eh_admin())
    )
  )
  with check (
    responsavel_id = auth.uid()
    or exists (
      select 1 from plano.planos p
      where p.id = plano_id and (p.autor_id = auth.uid() or public.eh_admin())
    )
  );

drop policy if exists acoes_delete on plano.acoes;
create policy acoes_delete on plano.acoes
  for delete to authenticated
  using (exists (
    select 1 from plano.planos p
    where p.id = plano_id and (p.autor_id = auth.uid() or public.eh_admin())
  ));

-- memoria: todos leem (transparencia e o que faz a equipe confiar e ensinar).
drop policy if exists memoria_select on plano.memoria;
create policy memoria_select on plano.memoria
  for select to authenticated using (true);

-- Insert sempre como 'proposta' e sempre em nome de quem esta logado.
-- A promocao para 'validada' e feita por UPDATE -- nunca no insert.
drop policy if exists memoria_insert on plano.memoria;
create policy memoria_insert on plano.memoria
  for insert to authenticated
  with check (ensinado_por = auth.uid() and status = 'proposta');

-- Quem valida o que (docs/plano-de-acao-arquitetura.md 5.3.5):
--   escopo delimitado (dashboard, produto, indicador ou area) -> o proprio autor
--   escopo aberto, ou tipo 'hierarquia'                       -> somente admin
-- Validacao centralizada em admin mataria o habito de ensinar; memoria sem
-- controle nenhum viraria boato com carimbo de sistema.
drop policy if exists memoria_update on plano.memoria;
create policy memoria_update on plano.memoria
  for update to authenticated
  using (ensinado_por = auth.uid() or public.eh_admin())
  with check (
    public.eh_admin()
    or (
      ensinado_por = auth.uid()
      and tipo <> 'hierarquia'
      and (dashboard_slug is not null or produto is not null
           or indicador is not null or area is not null)
    )
  );

drop policy if exists memoria_origem_select on plano.memoria_origem;
create policy memoria_origem_select on plano.memoria_origem
  for select to authenticated using (true);

drop policy if exists memoria_origem_insert on plano.memoria_origem;
create policy memoria_origem_insert on plano.memoria_origem
  for insert to authenticated
  with check (exists (
    select 1 from plano.memoria m
    where m.id = memoria_id and m.ensinado_por = auth.uid()
  ));

-- envios: leitura para auditoria; escrita SO pela Edge Function (service_role).
-- Nenhuma policy de insert de proposito -- e o que garante, na arquitetura e
-- nao no prompt, que nada sai daqui sem passar pelo caminho aprovado.
drop policy if exists envios_select on plano.envios;
create policy envios_select on plano.envios
  for select to authenticated using (true);

-- ---------------------------------------------------------------- comentarios

comment on schema plano is
  'Dados proprios da aplicacao (plano de acao, memoria institucional). '
  'Unico schema com escrita a partir do front -- `public` permanece somente leitura.';

comment on table plano.planos is 'Plano de acao gerado a partir do snapshot de um painel.';
comment on column plano.planos.snapshot is
  'Snapshot congelado do painel na hora da geracao. E a evidencia auditavel da acao.';
comment on table plano.memoria is
  'Memoria institucional ensinada pela equipe. Escopo decide quando e carregada; '
  'validade impede que circunstancia vire verdade permanente.';
comment on column plano.memoria.meses is
  'Sazonalidade recorrente (1-12). Unico caso que volta todo ano e por isso nao expira.';
comment on table plano.envios is
  'Auditoria de comunicacao. Escrita apenas por service_role (Edge Function).';

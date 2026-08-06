-- Correcao dos gatilhos de carimbo do schema `plano`.
--
-- SINTOMA. Qualquer tentativa de validar memoria ou aprovar plano fora de uma
-- sessao logada falhava com:
--   new row for relation "memoria" violates check constraint
--   "memoria_validacao_completa"
--
-- CAUSA. Os gatilhos faziam `new.validado_por := auth.uid()` incondicionalmente.
-- Em service_role, Edge Function sem JWT de usuario ou SQL Editor do Dashboard,
-- `auth.uid()` e NULL -- entao o carimbo APAGAVA o valor informado e a CHECK
-- recusava a linha. Efeito pratico: impossivel semear a memoria inicial ou
-- corrigir dado pelo painel do Supabase. Encontrado ao aplicar em producao.
--
-- CORRECAO. `auth.uid()` continua tendo precedencia SEMPRE que existe -- que e o
-- caso de toda escrita vinda do navegador. Ninguem consegue forjar "aprovado por
-- outra pessoa" a partir do front. O valor informado so e aceito quando
-- `auth.uid()` e NULL, ou seja, em service_role -- que ja ignora RLS por
-- definicao e portanto nao ganha poder nenhum com esta mudanca.
--
-- A guarda nova (`raise exception`) fecha o caso restante: status 'aprovado' ou
-- 'validada' sem ninguem identificado agora falha com mensagem clara, em vez de
-- estourar uma CHECK generica.

create or replace function plano.carimba_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = plano, public, pg_temp
as $$
begin
  if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    new.aprovado_por := coalesce(auth.uid(), new.aprovado_por);
    new.aprovado_em := coalesce(new.aprovado_em, now());
    if new.aprovado_por is null then
      raise exception 'aprovacao exige um usuario identificado';
    end if;
  elsif new.status <> 'aprovado' then
    new.aprovado_por := null;
    new.aprovado_em := null;
  end if;
  return new;
end;
$$;

create or replace function plano.carimba_validacao()
returns trigger
language plpgsql
security definer
set search_path = plano, public, pg_temp
as $$
begin
  if new.status = 'validada' and old.status is distinct from 'validada' then
    new.validado_por := coalesce(auth.uid(), new.validado_por);
    new.validado_em := coalesce(new.validado_em, now());
    if new.validado_por is null then
      raise exception 'validacao de memoria exige um usuario identificado';
    end if;
  elsif new.status <> 'validada' then
    new.validado_por := null;
    new.validado_em := null;
  end if;
  return new;
end;
$$;

/*
# Read access para stg_meta_ads (dashboard Growth e Performance)

## Contexto
`stg_meta_ads` esta com RLS habilitado e SEM nenhuma policy. Sem policy, o
PostgREST devolve zero linhas ao cliente anon — a chamada NAO gera erro, apenas
retorna vetor vazio. Efeito no dashboard Growth e Performance: todas as metricas
de midia mostram somente o Google (Investimento, Impressoes e Clicks batem
digito a digito com o Google isolado) e o Alcance aparece zerado, porque `reach`
so existe no Meta.

Mesmo problema, mesma causa e mesma correcao da migration
20260724001822_enable_read_access_analise_conversao_tables.sql, que ja tratou
pletivo / meta_mestrado / meta_pos / rubeus_registros_personalizada.

## Mudancas
Adiciona uma policy SELECT permitindo leitura por anon e authenticated.
Nenhuma policy de INSERT / UPDATE / DELETE e criada: a tabela permanece
somente-leitura pelo frontend.

## Seguranca
- RLS continua habilitado.
- Nenhuma politica de escrita e criada.
- Escopo minimo: apenas SELECT.
- A tabela contem metricas agregadas de campanha (investimento, impressoes,
  cliques, alcance, acoes). Nao ha dado pessoal: nenhuma coluna de CPF,
  telefone, email, RA ou nome de aluno.
*/

-- stg_meta_ads
DROP POLICY IF EXISTS "read_stg_meta_ads_public" ON stg_meta_ads;
CREATE POLICY "read_stg_meta_ads_public"
  ON stg_meta_ads FOR SELECT
  TO anon, authenticated
  USING (true);

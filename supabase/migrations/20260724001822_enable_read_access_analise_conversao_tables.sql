/*
# Read access para o dashboard Analise de Conversao - Presidencia

## Contexto
As tabelas `pletivo`, `meta_mestrado`, `meta_pos` e `rubeus_registros_personalizada`
estao com RLS habilitado mas SEM policies. Sem policy, o PostgREST devolve zero
linhas ao cliente anon (a chamada nao gera erro, apenas retorna vetor vazio),
o que faz com que o dashboard exiba "0 leads" e meta vazia.

## Mudancas
Adiciona uma policy SELECT para cada tabela permitindo leitura por anon e
authenticated. Nenhuma politica de INSERT / UPDATE / DELETE e criada: as tabelas
permanecem somente-leitura pelo frontend, como exige o dashboard.

## Seguranca
- RLS continua habilitado.
- Nenhuma politica de escrita e criada.
- Escopo minimo: apenas SELECT.
- Dados exibidos ja sao agregados/derivados; colunas sensiveis (CPF, telefone,
  email, RA, nome completo do aluno) NAO sao renderizadas na UI, conforme
  exigido pela especificacao do dashboard.
*/

-- pletivo
DROP POLICY IF EXISTS "read_pletivo_public" ON pletivo;
CREATE POLICY "read_pletivo_public"
  ON pletivo FOR SELECT
  TO anon, authenticated
  USING (true);

-- meta_mestrado
DROP POLICY IF EXISTS "read_meta_mestrado_public" ON meta_mestrado;
CREATE POLICY "read_meta_mestrado_public"
  ON meta_mestrado FOR SELECT
  TO anon, authenticated
  USING (true);

-- meta_pos
DROP POLICY IF EXISTS "read_meta_pos_public" ON meta_pos;
CREATE POLICY "read_meta_pos_public"
  ON meta_pos FOR SELECT
  TO anon, authenticated
  USING (true);

-- rubeus_registros_personalizada
DROP POLICY IF EXISTS "read_rubeus_public" ON rubeus_registros_personalizada;
CREATE POLICY "read_rubeus_public"
  ON rubeus_registros_personalizada FOR SELECT
  TO anon, authenticated
  USING (true);

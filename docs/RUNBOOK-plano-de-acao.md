# Runbook — subir o módulo Plano de Ação

Projeto: **BDBI_01** (`nuxrpjqtfvrrgnmshpge`) · região us-east-1

Sua máquina não tem Supabase CLI nem Docker, e o projeto nunca foi ligado via
`supabase link` (não existe `supabase/config.toml`). Por isso o caminho aqui é o
**SQL Editor do Dashboard**, não `supabase db push`. O caminho por CLI está no
apêndice, para quando quiser automatizar.

Tempo total: ~20 minutos. **A ordem importa.**

---

## Antes de começar

Tenha à mão:

- [ ] Acesso de admin ao Dashboard do Supabase, projeto **BDBI_01**
- [ ] A chave e o endpoint da **Azure OpenAI** (ou uma chave da OpenAI)
- [ ] Os arquivos, que já estão no repositório em
      `supabase/migrations/` e `supabase/functions/plano-agente/`

Nada aqui derruba a aplicação atual. O passo 1 **remove** um acesso, e os passos
2 e 3 só **acrescentam**. Os cinco painéis continuam funcionando o tempo todo.

---

## Passo 1 — Fechar o acesso às tabelas de RH

> Este passo é independente do módulo de IA. É correção de segurança e vale
> mesmo que você pare por aqui.

**Onde:** Dashboard → SQL Editor → New query

1. Abra `supabase/migrations/20260806090000_restringe_acesso_tabelas_rh.sql`
2. Cole o conteúdo inteiro no editor
3. **Run**

**Confira** — rode na sequência e compare com o esperado:

```sql
select tablename, count(policyname) as policies
from pg_policies
where schemaname = 'public'
  and tablename in ('stg_rm_rh_infofuncionarios','stg_rh_infofolha')
group by tablename;
```

*Esperado:* **nenhuma linha**. Se voltar alguma, a política não caiu.

```sql
select has_table_privilege('authenticated','public.stg_rh_infofolha','select') as ainda_le;
```

*Esperado:* `false`.

**Se der errado:** nada a desfazer — o passo só remove permissão. Para reverter
(não recomendado), recrie a policy de SELECT como estava na migração
`20260731112004`.

---

## Passo 2 — Coluna `area` em `perfis` + função `equipe()`

**Onde:** SQL Editor → New query

1. Cole `supabase/migrations/20260806090500_perfis_area_e_equipe.sql`
2. **Run**

**Confira:**

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='perfis' and column_name='area';
```

*Esperado:* uma linha, `area`.

```sql
select * from public.equipe();
```

*Esperado:* suas 8 pessoas, com `area` ainda em branco. Você preenche no passo 8.

---

## Passo 3 — Schema `plano`

Este é o grande. ~450 linhas: tabelas, índices, triggers, funções e RLS.

**Onde:** SQL Editor → New query

1. Cole `supabase/migrations/20260806091000_schema_plano.sql` **inteiro**
2. **Run**

Vão aparecer vários `NOTICE: policy ... does not exist, skipping`. **É normal** —
são os `drop policy if exists` que deixam a migração poder ser rodada de novo sem
quebrar.

**Confira** — as três coisas que mais dão problema:

```sql
-- 1. as 7 tabelas nasceram, todas com RLS ligada
select tablename, rowsecurity from pg_tables
where schemaname='plano' order by tablename;
```

*Esperado:* `acoes, conversas, memoria, memoria_origem, mensagens, planos, envios`
— todas com `rowsecurity = true`.

```sql
-- 2. a coluna gerada com unaccent funciona (é onde quebrou no meu teste)
insert into plano.memoria (tipo, conteudo, area, ensinado_por)
select 'glossario', 'Teste de acentuação: matrícula do Pós.', 'TI', id
from public.perfis where papel='admin' limit 1;

select conteudo, busca from plano.memoria where conteudo like 'Teste de acentua%';
```

*Esperado:* a coluna `busca` preenchida com lexemas **sem acento**
(`'matricul'`, `'pos'`). Se der `permission denied for schema extensions`, o
`security definer` do wrapper não pegou — rode a migração de novo.

```sql
-- 3. limpa o teste
delete from plano.memoria where conteudo like 'Teste de acentua%';
```

**Se der errado no meio:** o schema pode ter ficado parcial. Para recomeçar do
zero, sem afetar mais nada:

```sql
drop schema plano cascade;
drop function if exists public.plano_memoria_no_escopo(text,text,text[],text[],smallint);
drop function if exists public.plano_memoria_incrementa_uso(uuid);
drop function if exists public.plano_memoria_busca(text);
```

E rode a migração outra vez.

---

## Passo 4 — Registrar as três no histórico de migrações

Como você aplicou pelo Dashboard, o Supabase **não sabe** que essas migrações
rodaram. Sem este passo, um `supabase db push` no futuro tentaria aplicá-las de
novo.

```sql
insert into supabase_migrations.schema_migrations (version, name)
values
  ('20260806090000','restringe_acesso_tabelas_rh'),
  ('20260806090500','perfis_area_e_equipe'),
  ('20260806091000','schema_plano')
on conflict (version) do nothing;
```

**Confira:**

```sql
select version, name from supabase_migrations.schema_migrations
order by version desc limit 5;
```

*Esperado:* as três no topo.

> Aproveitando: hoje há uma divergência pequena entre disco e banco — existe
> `20260724140257_create_dim_tipo_beneficio` registrado no banco sem arquivo
> correspondente, e três arquivos com extensão dupla (`.sql.sql`). Não atrapalha
> nada agora, mas é o tipo de coisa que morde no dia do `db push`.

---

## Passo 5 — Expor o schema `plano` na API

**Este é o passo que ninguém lembra e custa uma tarde.** Sem ele, o PostgREST
não enxerga o schema e devolve **404** — que parece erro de RLS.

**Onde:** Dashboard → **Settings** → **API** → seção *Data API* →
campo **Exposed schemas**

1. O campo hoje tem `public` (e talvez `graphql_public`)
2. Acrescente `plano`
3. **Save**

**Confira** — no console do navegador, com a aplicação aberta e você logado:

```js
// deve responder sem erro (lista vazia é resposta válida)
await window.fetch(
  'https://nuxrpjqtfvrrgnmshpge.supabase.co/rest/v1/planos?select=id&limit=1',
  { headers: { apikey: '<sua anon key>', 'Accept-Profile': 'plano' } }
).then(r => r.status)
```

*Esperado:* `200`. Se vier `404`, o schema não foi exposto ainda — às vezes leva
alguns segundos para o PostgREST recarregar.

---

## Passo 6 — Publicar a Edge Function

Sem CLI, o caminho é pelo Dashboard.

**Onde:** Dashboard → **Edge Functions** → **Deploy a new function** →
*Via Editor*

1. Nome (slug): **`plano-agente`** — exatamente assim, é o que o
   `planoService.ts` chama
2. Apague o exemplo e cole o conteúdo de
   `supabase/functions/plano-agente/index.ts`
3. **Verify JWT: ligado** (é o padrão; as suas `minha-senha` e `usuarios-admin`
   já estão assim — só a `auth-login` fica desligada)
4. **Deploy**

**Confira** — no terminal, sem precisar de token:

```bash
curl -i -X POST https://nuxrpjqtfvrrgnmshpge.supabase.co/functions/v1/plano-agente \
  -H "apikey: <sua anon key>" \
  -H "Content-Type: application/json" \
  -d "{}"
```

*Esperado:* **401**. Parece erro, mas é a resposta certa: prova que a função
subiu e que a guarda de sessão está de pé. `404` significa que o deploy não
aconteceu ou o slug está diferente.

---

## Passo 7 — Guardar os segredos

**Onde:** Dashboard → Edge Functions → **Secrets** (ou Settings → Edge Functions)

Acrescente:

| Nome | Valor |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | `https://<seu-recurso>.openai.azure.com` |
| `AZURE_OPENAI_KEY` | a chave |
| `AZURE_OPENAI_DEPLOYMENT` | o nome do *deployment*, não o do modelo |
| `AZURE_OPENAI_API_VERSION` | opcional — padrão `2024-10-21` |

Usando OpenAI direto, em vez dos quatro acima: `OPENAI_API_KEY` e, opcional,
`OPENAI_MODEL`.

> **Nunca** coloque essas chaves em `VITE_*` nem no `config.js`. Os dois são
> públicos: `VITE_*` vai embutida no bundle e `config.js` é servido pela web.
> Aqui, o segredo fica só no servidor.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem por padrão — não precisa
criar.

---

## Passo 8 — Preencher a área das pessoas

Sem isso o plano não tem como agrupar por área nem sugerir responsável.

```sql
update public.perfis set area = 'Marketing'  where codusuario = 'nome.sobrenome';
update public.perfis set area = 'Comercial'  where codusuario = 'nome.sobrenome';
-- ... uma linha por pessoa
```

**Confira:**

```sql
select nome_completo, cargo, area from public.equipe();
```

*Esperado:* ninguém com `area` nula.

---

## Passo 9 — Teste de ponta a ponta

Ainda não existe a tela `/plano-de-acao` (é a próxima entrega), então o teste é
pelo console do navegador, com você logado na aplicação:

```js
const { data: { session } } = await (await import('/src/lib/supabase.ts')).supabase.auth.getSession()

await fetch('https://nuxrpjqtfvrrgnmshpge.supabase.co/functions/v1/plano-agente', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: '<sua anon key>',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    mensagem: 'O que chamou sua atenção neste recorte?',
    contexto: {
      slug_ativo: 'growth-e-performance',
      snapshots: {
        'growth-e-performance': {
          versao: 1, slug: 'growth-e-performance', titulo: 'Growth e Performance',
          geradoEm: new Date().toISOString(),
          recorte: { descricao: 'Pós EAD · julho/2026', filtros: {}, produto: 'Pós EAD', mesReferencia: 7 },
          frescor: [{ fonte: 'anúncios do Meta', sinal: 'atualizado até 05/08', alerta: false }],
          indicadores: [
            { chave: 'cpl', rotulo: 'Custo para atrair um interessado', valor: 42.8, unidade: 'brl' },
            { chave: 'matriculas', rotulo: 'Matrículas', valor: 37, unidade: 'int' },
          ],
          series: [], observacoes: [],
        },
      },
    },
  }),
}).then(r => r.json()).then(console.log)
```

*Esperado:* um objeto com `resposta` em português citando **R$ 42,80** e **37**,
`conversa_id` preenchido e `memorias_consideradas: []`.

Se ela citar um número que não está nesse JSON, a guarda de números falhou —
me avise, porque isso seria um defeito meu, não de configuração.

---

## Resumo do checklist

- [ ] 1. Migração de RH aplicada · nenhuma policy sobrou
- [ ] 2. `area` em `perfis` · `equipe()` responde
- [ ] 3. Schema `plano` · 7 tabelas com RLS · teste do acento passou
- [ ] 4. Três versões registradas em `schema_migrations`
- [ ] 5. `plano` em *Exposed schemas* · REST responde 200
- [ ] 6. `plano-agente` publicada · curl responde 401
- [ ] 7. Segredos da Azure guardados
- [ ] 8. Área preenchida para as 8 pessoas
- [ ] 9. Teste de ponta a ponta com número correto

---

## Apêndice — o caminho por CLI

Vale montar quando quiser reproduzir o ambiente em outra máquina ou automatizar.

```powershell
# Windows, PowerShell
winget install Supabase.CLI      # ou: scoop install supabase

supabase login
cd C:\Users\felipe.silva\Downloads\BI_ATUALIZADO\BI
supabase init                    # cria supabase/config.toml
supabase link --project-ref nuxrpjqtfvrrgnmshpge

supabase migration list          # confira o que o banco já tem antes de empurrar
supabase db push

supabase functions deploy plano-agente
supabase secrets set AZURE_OPENAI_ENDPOINT=... AZURE_OPENAI_KEY=... AZURE_OPENAI_DEPLOYMENT=...
```

Duas ressalvas:

- Rode `supabase migration list` **antes** de `db push`. Se você já aplicou pelo
  Dashboard e pulou o passo 4, o push tenta rodar tudo de novo.
- `supabase init` sobrescreve nada do que existe em `supabase/functions/` e
  `supabase/migrations/` — ele só acrescenta o `config.toml`.

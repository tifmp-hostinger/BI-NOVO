# Deploy FMP Analytics (Docker / EasyPanel)

## Como funciona

A aplicacao e um SPA (Single Page Application) construido com Vite.
O Dockerfile tem dois stages:

1. **build** — `npm ci && npm run build`, gera arquivos estaticos em `dist/`
2. **serve** — `nginx:alpine` servindo `dist/` com fallback de SPA (`try_files ... /index.html`)

## Variaveis de ambiente

Um SPA estatico nao le variavel de ambiente sozinho: o JS ja foi compilado antes
do container subir. Por isso existem **dois caminhos**, e o app aceita os dois.

### Caminho 1 — build-time (`import.meta.env`)

O Vite embute o valor no bundle durante `npm run build`. Exige que a variavel
seja passada como **build arg** e que exista uma linha `ARG` correspondente no
`Dockerfile` — sem essa declaracao o Docker **descarta o build arg em silencio**.

| Variavel                      | Descricao                                    |
|-------------------------------|----------------------------------------------|
| VITE_SUPABASE_URL             | URL do projeto Supabase                      |
| VITE_SUPABASE_ANON_KEY        | Chave anon (publica) do Supabase             |
| VITE_GROWTH_AJUSTE_ALUNO_RA   | RA do ajuste manual de faturamento (Pos)     |
| VITE_GROWTH_AJUSTE_DATA       | Data do ajuste manual (padrao 2026-05-28)    |

**Toda variavel `VITE_*` nova precisa ganhar um `ARG` + `ENV` no `Dockerfile`.**
Troca de valor exige **rebuild** da imagem.

### Caminho 2 — runtime (`/config.js`)

Quando o container sobe, `docker/40-app-config.sh` (executado automaticamente
pelo entrypoint do nginx) gera `/usr/share/nginx/html/config.js` a partir das
variaveis de ambiente **do container**, e o `index.html` carrega esse arquivo
antes do bundle. O runtime tem **precedencia** sobre o build-time.

Serve para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`: assim a aplicacao
sobe mesmo que o painel de deploy nao passe build args, e trocar de projeto
Supabase exige apenas reiniciar o container.

## Autenticacao

O login **nao usa variavel de ambiente**. A plataforma autentica contra o banco:

- **Supabase Auth** guarda a senha (hash bcrypt), emite e renova o token.
- **`public.perfis`** guarda os dados de negocio do usuario, 1:1 com `auth.users`.
- O login e o **`codusuario`** no padrao `nome.sobrenome`. O e-mail interno
  (`<codusuario>@bi.fmp.local`) e um detalhe do Supabase Auth e nunca aparece na
  interface; o dominio `.local` nao e roteavel de proposito.

### Papeis

| Papel    | Pode                                                                 |
|----------|----------------------------------------------------------------------|
| `gestor` | Acessar os dashboards; editar os proprios dados e a propria senha     |
| `admin`  | Tudo do gestor, mais criar/editar/desativar/remover usuarios e resetar senhas |

`codusuario` e imutavel para todos (trigger no banco). Para corrigir um login
errado, o admin remove e recria a conta.

### Rotas de API (Supabase Edge Functions)

| Rota                            | JWT | O que faz                                        |
|---------------------------------|-----|--------------------------------------------------|
| `POST /functions/v1/auth-login` | nao | `{ codusuario, senha }` -> sessao + perfil        |
| `POST /functions/v1/minha-senha`| sim | `{ senha_atual, nova_senha }` -> troca a propria senha |
| `POST /functions/v1/usuarios-admin` | sim | `{ acao: listar\|criar\|atualizar\|definir_senha\|remover }` (so admin) |

`auth-login` roda sem JWT por definicao -- e o endpoint que **emite** o token.
As outras exigem token valido e reconferem o papel no banco: `verify_jwt`
garante que o token e valido, nao que quem chama e admin.

Codigo-fonte em `supabase/functions/`. As operacoes que escrevem em
`auth.users` passam por funcoes SQL `SECURITY DEFINER` liberadas apenas para
`service_role` -- inalcancaveis a partir do navegador.

### Protecao dos dados (RLS)

Todas as tabelas do schema `public` tem RLS habilitada e so permitem **leitura
a usuarios autenticados**. A role `anon` nao tem nenhum privilegio.

Isso importa porque a chave anon fica embutida no bundle JS publico: sem RLS, a
tela de login seria decorativa -- qualquer pessoa leria (e poderia apagar) os
dados direto pela API REST. A carga de dados nao e afetada: ela usa
`service_role`, que ignora RLS.

## Cache dos dados (navegador)

Cada painel baixa as tabelas brutas e calcula no cliente -- Bolsas sozinho sao
~129 mil linhas / ~38 MB em ~129 requisicoes. Para nao repetir isso a cada
abertura, os datasets ficam guardados no **IndexedDB** do navegador
(`src/lib/datasetCache.ts`) e a tela usa o guardado enquanto revalida
("stale-while-revalidate", em `src/lib/carregaComCache.ts`).

Ao abrir um painel:

1. o dado guardado aparece **na hora**;
2. em paralelo, uma consulta de **uma linha por tabela com carimbo de carga**
   pergunta se a carga mudou (nao baixa o dataset);
3. nao mudou e o cache e do mesmo dia -> termina, **zero download**;
4. mudou (ou nao havia cache) -> baixa por tras e atualiza a tela, exibindo
   "Atualizando..." de forma discreta.

**Nao existe horario de atualizacao, de proposito.** A carga nao roda em hora
fixa nem todo dia (medido: 27/07 11:47, 29/07 12:25, 31/07 09:14, 03/08 14:50),
entao qualquer horario fixo estaria errado na maioria dos dias. O gatilho e a
mudanca da carga, nao o relogio.

**Sinal de mudanca, por tabela** (todos custam UMA linha):

| Tabela                                   | Sinal                                  |
|------------------------------------------|----------------------------------------|
| Com carimbo (Rubeus, Meta Ads, dominio)  | `atualizado_em` mais recente           |
| Sem carimbo, coluna de data em ISO       | maior data de conteudo                 |
| Sem carimbo, coluna em dd/mm/aaaa        | nenhum -- so a validade por dia civil  |

A ultima linha existe porque ordenar dd/mm/aaaa como texto devolve lixo (ver a
nota em `REGISTRO_FONTES`). Sao 3 tabelas nessa condicao
(`stg_rm_matriculas_grad`, `_mestrado`, `_bolsas`); nos paineis onde elas
aparecem ha sempre outra fonte com sinal utilizavel.

**Validade por dia civil**: rede de protecao para o que os sinais acima nao
pegam -- por exemplo, uma carga que altere linhas existentes sem trazer
registro com data mais nova. O cache nunca atravessa a virada do dia sem
reconferir. O botao "Atualizar" de cada painel ignora o cache.

**Assinatura desconhecida**: se a consulta do sinal falhar, o cache e tratado
como invalido e NADA e gravado. Gravar uma assinatura de falha faria ela casar
consigo mesma nas visitas seguintes, deixando o cache eternamente "valido".

**Aquecimento apos o login**: assim que o usuario entra, o app baixa os
paineis em segundo plano (sequencial, mais leves primeiro), enquanto ele ainda
esta na Central de Dashboards -- ao clicar, o painel ja abre pronto
(`src/lib/aqueceDashboards.ts`). Se ele abrir um painel no meio do
aquecimento, o download e compartilhado, nunca duplicado. A checagem "ja esta
quente?" le so uma entrada meta leve (`meta:<chave>`), sem desserializar o
dataset -- por isso reabrir o app com tudo quente nao baixa nada nem trava a
tela inicial.

**Ao mudar as queries** (colunas novas, formato diferente), incremente
`VERSAO_CACHE` em `src/lib/datasetCache.ts` -- senao um cache antigo alimenta
calculos novos com dados incompletos, que e falha silenciosa.

Sem espaco, em navegacao privada ou com IndexedDB bloqueado, o app funciona
normalmente, apenas sem cache.

## Cache (arquivos estaticos)

`index.html` e `config.js` sao servidos com `no-store` (`docker/nginx.conf`):
sao a porta de entrada do app e o arquivo de configuracao. Sem isso, um deploy
novo ou uma troca de senha poderiam nao ter efeito visivel, com o navegador
servindo a versao anterior. Os assets em `/assets/` tem hash no nome e sao
cacheados por 1 ano.

## Comando manual

```bash
# build-time (embute no bundle)
docker build -t fmp-analytics \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... \
  .

# runtime (injetado no boot, sem rebuild)
docker run -p 80:80 \
  -e VITE_SUPABASE_URL=... \
  -e VITE_SUPABASE_ANON_KEY=... \
  fmp-analytics
```

## EasyPanel

1. Crie um novo app tipo Dockerfile
2. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` como **build args**
   (elas so funcionam em build-time)
3. Deploy
4. Entre com o usuario `admin` e gerencie as contas em **/usuarios**

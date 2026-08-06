# SPECS — FMP Analytics (Central de Dashboards)

Contrato de construção da aplicação. Todo código novo — escrito por pessoa ou
por agente — deve caber neste documento. Quando uma mudança exigir sair do que
está aqui, **atualize este arquivo na mesma entrega**; um desvio não registrado
é um bug de consistência.

Formato das regras:

- **DEVE / NUNCA** — regra dura. Quebrar exige justificativa escrita no código.
- **PADRÃO** — convenção existente no repositório. Siga por omissão.
- **DECISÃO** — ponto que estava inconsistente no código e foi resolvido aqui.

---

## 1. O que é o produto

Plataforma web interna da FMP (Fundação Escola Superior do Ministério Público)
que reúne, num único lugar, os painéis analíticos migrados do Power BI.

- **Público**: gestão e presidência da FMP. Acesso restrito, login obrigatório.
- **Natureza**: **somente leitura sobre dados de negócio**. A aplicação nunca
  escreve em tabela de dados — só em `public.perfis` (o próprio usuário) e via
  Edge Functions de administração de contas.
- **Origem dos dados**: cargas agendadas **fora da aplicação** alimentam o
  Supabase (staging `stg_*`, Rubeus, mídia paga, tabelas de domínio). O front
  não dispara, agenda nem conhece o horário dessas cargas.
- **Cálculo**: acontece **no navegador**. As tabelas brutas são baixadas e
  agregadas em TypeScript, com paridade de regra em relação ao Power BI original.

### Painéis existentes

| Slug | Título | Categoria |
|------|--------|-----------|
| `presenca-nacional` | Presença Nacional | Geolocalização |
| `analise-conversao-presidencia` | Análise de Conversão - Presidência | Presidência |
| `bolsas-e-descontos` | Bolsas e Descontos | Financeiro |
| `analise-de-conversao` | Análise de Conversão | Comercial |
| `growth-e-performance` | Growth e Performance | Comercial |

---

## 2. Stack e restrições fixas

| Camada | Escolha | Observação |
|--------|---------|------------|
| Build | Vite 5 | `@` → `src/` (`vite.config.ts`) |
| UI | React 18 + TypeScript 5 | function components, sem class (exceto `ErrorBoundary`) |
| Estilo | Tailwind 3 + `@tailwindcss/container-queries` | tokens em `src/fmp-tokens.css` |
| Ícones | `lucide-react` | **NUNCA** outra biblioteca de ícones |
| Gráficos | `recharts` | **NUNCA** outra biblioteca de charts |
| Mapas | `leaflet` + `react-leaflet` (+ `leaflet.heat`) | só em Presença Nacional / Growth |
| Rotas | `react-router-dom` 7 | `BrowserRouter` |
| Backend | Supabase (Postgres + Auth + Edge Functions) | free tier — ver §6 |
| Deploy | Docker multi-stage → nginx | `Dockerfile`, `docker/` |

- **NUNCA** adicionar dependência para tema de UI, ícone ou componente pronto.
  Se falta um componente, escreva em `src/components/ui/`.
- **NUNCA** adicionar biblioteca de estado global (Redux, Zustand, Jotai) nem
  de data-fetching (React Query, SWR). O padrão é hook próprio por dashboard
  (§5.3) sobre `carregaComCache` (§7).
- Scripts disponíveis: `npm run dev`, `build`, `lint`, `preview`, `typecheck`.
- **DEVE** passar `npm run typecheck` e `npm run lint` antes de qualquer entrega.

---

## 3. Estrutura de pastas

```
src/
  App.tsx                  rotas + providers
  main.tsx                 bootstrap
  index.css                Tailwind + camada de componentes FMP
  fmp-tokens.css           tokens da marca (fonte da verdade visual)
  components/
    auth/                  AuthGate
    brand/                 FmpLogo, FmpSimbolo
    layout/                AppShell, Header, Sidebar, Footer
    maps/                  BrazilStateMap
    panels/                painéis de drill-down reutilizáveis
    ui/                    biblioteca compartilhada (§9)
  contexts/                AuthContext
  dashboards/<slug>/       um diretório por painel (§5)
  hooks/                   hooks transversais (useDashboards, useMatriculas)
  lib/                     infraestrutura (supabase, cache, frescor, cores)
  pages/                   páginas que não são dashboards
  services/                acesso a dados fora de dashboards/
supabase/
  functions/               Edge Functions (Deno)
  migrations/              SQL versionado
docker/                    nginx.conf + gerador de /config.js
docs/                      observações de paridade com o Power BI
```

- **DEVE** importar com o alias `@/` (`@/components/ui/StatCard`). **NUNCA**
  usar caminho relativo profundo (`../../components/...`).
- Dentro de `src/dashboards/<slug>/`, imports **do próprio painel** usam
  caminho relativo curto (`./calculations`, `./components/X`) — é o padrão
  existente e deve ser mantido.
- **NUNCA** um dashboard importa de outro, **exceto** a reutilização já
  estabelecida de `analise-de-conversao` (`dateUtils`, `formatters`, e as
  constantes de exclusão em `calculations`) pelo `growth-e-performance`. Regra
  compartilhada nova vai para `src/lib/` ou para os módulos de
  `analise-de-conversao`, nunca duplicada.

---

## 4. Rotas e navegação

| Rota | Componente | Acesso |
|------|-----------|--------|
| `/` | `HomePage` (catálogo) | autenticado |
| `/dashboards/:slug` | `DashboardRouter` (lazy) | autenticado |
| `/minha-conta` | `MinhaContaPage` (lazy) | autenticado |
| `/usuarios` | `UsuariosPage` (lazy) | admin |
| `*` | redirect para `/` | — |

- **DEVE** carregar toda página de dashboard por `lazy()` + `Suspense`: os
  chunks de `recharts`/`leaflet` são pesados e precisam ficar fora do bundle
  inicial.
- **DEVE** envolver cada rota lazy em `<ErrorBoundary>`: um erro de render em
  um painel não pode derrubar a aplicação.
- Slug desconhecido cai em `ModulePlaceholder` ("em breve"), nunca em erro.
- A árvore é `AuthProvider > AuthGate > AquecedorDashboards + BrowserRouter`.
  **NUNCA** montar rota fora de `AuthGate`.

---

## 5. Anatomia obrigatória de um dashboard

Todo painel vive em `src/dashboards/<slug>/` e segue esta divisão. O nome dos
arquivos é parte do contrato.

```
<slug>/
  page.tsx           componente de página (default export nomeado <Nome>Page)
  queries.ts         SOMENTE download (Supabase → tipos Raw*)
  calculations.ts    SOMENTE cálculo puro (dataset + filtros → dados de tela)
  types.ts           Raw* (formato do banco) e tipos de saída
  formatters.ts      formatação pt-BR
  constants.ts       constantes de domínio herdadas do BI (opcional)
  rules.ts           regras de negócio nomeadas (opcional)
  hooks/use<Nome>Data.ts   orquestra cache + estado + memos
  components/        blocos visuais do painel
```

### 5.1 `queries.ts` — download

- **DEVE** conter apenas I/O. **NUNCA** regra de negócio aqui.
- **DEVE** usar `loadAllFrom()` (`@/lib/supabasePaginate`) para tabela grande —
  ele já faz paginação de 1000, concorrência 3 e retry com backoff. `supabase
  .from(...)` direto só para tabela pequena de domínio (`pletivo`, `meta_*`).
- **DEVE** selecionar **colunas explícitas**, nunca `select('*')` em tabela de
  fato. Cada coluna baixada custa tráfego e memória do usuário.
- **DEVE** filtrar no servidor quando o filtro é fixo e reduz muito o volume
  (ex.: `whereIn` das duas bolsas de incentivo, ~129k → ~9,5k linhas).
- **DEVE** agregar logo após o fetch e descartar o array bruto quando a tabela
  passa de ~100k linhas (padrão de `loadClInscAgregado`).
- **DEVE** expor `fetch<Nome>Data(onProgress?, forceRefresh?)` e
  `clear<Nome>Cache()` quando houver cache em memória de módulo.
- Lotes **sequenciais**, não `Promise.all` de tudo: o free tier falha com
  muitas requisições simultâneas. Reporte progresso por lote via `onProgress`.

### 5.2 `calculations.ts` — cálculo

- **DEVE** ser puro: entra dataset + filtros, sai objeto de tela. Sem `fetch`,
  sem acesso a `window`, sem data "agora" implícita fora do necessário.
- **DEVE** nomear funções `compute*` / `build*` / `apply*`.
- **DEVE** comentar toda regra herdada do Power BI com o **porquê**, incluindo
  as que parecem erradas (§12).

### 5.3 `hooks/use<Nome>Data.ts` — orquestração

Contrato de retorno mínimo:

```ts
{
  loading: boolean,        // não há nada legível na tela
  revalidando: boolean,    // há dado de cache na tela e download por trás
  error: string | null,
  progress?: string | null,
  freshnessRitmos: Record<string, RitmoFonte>,
  refetch: () => void,     // ignora o cache de propósito
  ...blocos de dados
}
```

- **DEVE** carregar via `carregaComCache` com `chave` **igual ao slug** do
  dashboard e `tabelas: FONTES_POR_DASHBOARD['<slug>']`.
- **DEVE** calcular cada bloco em `useMemo` **condicionado à aba/visão ativa**
  (`if (!dataset || tab !== 'x') return null`). Sem isso, uma mudança de filtro
  recalcula todas as abas sobre centenas de milhares de linhas e trava a UI.
- **DEVE** montar `freshnessRitmos` com `ritmoDoDataset` sobre o dataset
  **completo, sem filtro de usuário** (`ritmoDeDatasets` quando uma tabela
  chega partida em vários arrays). **NUNCA** disparar consulta nova para isso.
- **NUNCA** zerar o dataset em caso de erro: dado vindo do cache continua
  legível e é melhor que tela vazia.
- **DEVE** exportar a função de download completo (`baixar<Nome>()`) quando o
  aquecimento (§7.3) precisar dela, para que aquecimento e tela usem
  exatamente a mesma montagem — e portanto o mesmo formato de cache.

### 5.4 `page.tsx` — página

Estrutura obrigatória, nesta ordem:

```tsx
<AppShell title="..." subtitle="...">
  <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
    <section className="... hero-gradient ...">   {/* hero escuro */}
      <Link to="/">← Central de Dashboards</Link>
      <DataFreshness tabelas={FONTES_POR_DASHBOARD['<slug>']} ritmos={freshnessRitmos} />
      <AtualizandoAviso visivel={revalidando} />
      {/* chips de categoria + "Somente leitura" */}
      <h1 style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 500 }} />
      <button onClick={refetch}>Atualizar</button>
    </section>

    {/* abas (role="tablist") — opcional */}
    {/* barra de filtros — só quando !loading */}
    {loading && progress && <LoadingSteps mensagem={progress} />}
    {error && <ErrorState onRetry={refetch} />}
    {/* conteúdo por aba, cada aba em <ErrorBoundary> */}
  </div>
</AppShell>
```

- O bloco hero é **idêntico** entre painéis (mesmas classes, mesma ordem). É a
  assinatura visual da plataforma; divergência aqui é regressão.
- Toda aba pesada **DEVE** estar dentro de `<ErrorBoundary>`.

### 5.5 Registro de um dashboard novo

Adicionar painel exige tocar **todos** estes pontos — esquecer um deixa o
painel roteado mas invisível, ou visível mas frio:

1. `src/dashboards/<slug>/` com a estrutura do §5.
2. `src/App.tsx`: `lazy()` + linha no `DashboardRouter`.
3. `src/lib/sampleData.ts`: entrada em `SAMPLE_DASHBOARDS` (catálogo real —
   a tabela `dashboards` não existe neste projeto Supabase).
4. `src/lib/dataFreshness.ts`: entrada em `FONTES_POR_DASHBOARD` com todas as
   tabelas usadas, e cada tabela cadastrada em `REGISTRO_FONTES`.
5. `src/lib/aqueceDashboards.ts`: entrada em `ALVOS`, **na posição correta da
   ordem de peso** (mais leve primeiro).
6. Ícone presente nos mapas `ICONS` de `Sidebar.tsx` **e** `HomePage.tsx`.
7. `docs/<slug>-observacoes.md` se houver regra herdada do Power BI.

---

## 6. Dados e Supabase

### 6.1 Acesso

- Cliente único em `@/lib/supabase` (`persistSession`, `autoRefreshToken`,
  `storageKey: 'fmp-bi-sessao'`). **NUNCA** criar um segundo `createClient`.
- URL e anon key vêm de `leConfig()` (`@/lib/runtimeConfig`): runtime
  (`/config.js`) tem precedência sobre build-time (`import.meta.env`).
- **NUNCA** ler `import.meta.env.VITE_*` direto para configuração que precise
  funcionar em runtime — use `leConfig`.

### 6.2 Segurança

- RLS habilitada em todas as tabelas de `public`. `anon` **não tem nenhum
  privilégio**; `authenticated` tem **apenas SELECT**; `service_role` (usado
  pela carga, fora do app) ignora RLS.
- A anon key está embutida no bundle público. **A tela de login não protege
  nada — quem protege é a RLS.** Toda tabela nova **DEVE** entrar com RLS e
  policy de SELECT para `authenticated`, via migração.
- **NUNCA** `INSERT`/`UPDATE`/`DELETE` em tabela de dados a partir do front.
- Operações que tocam `auth.users` passam por funções SQL `SECURITY DEFINER`
  liberadas só para `service_role`, chamadas pelas Edge Functions.

### 6.3 Edge Functions

| Rota | JWT | Função |
|------|-----|--------|
| `POST /functions/v1/auth-login` | não | `{ codusuario, senha }` → sessão + perfil |
| `POST /functions/v1/minha-senha` | sim | troca a própria senha |
| `POST /functions/v1/usuarios-admin` | sim | `listar\|criar\|atualizar\|definir_senha\|remover` (admin) |

- `verify_jwt` garante token válido, **não** que quem chama é admin: a função
  **DEVE** reconferir o papel no banco.
- O front fala com elas só por `@/lib/authService`. **NUNCA** `fetch` avulso
  para Edge Function em componente.

### 6.4 Migrações

- Toda mudança de schema/policy **DEVE** virar arquivo em
  `supabase/migrations/` com timestamp no nome. **NUNCA** alterar o banco por
  fora sem registrar a migração.

---

## 7. Cache, frescor e aquecimento

Esta é a parte mais frágil do sistema. As regras abaixo são invioláveis.

### 7.1 Cache de dataset (IndexedDB)

- Todo dashboard carrega por `carregaComCache` (`@/lib/carregaComCache`):
  mostra o guardado **na hora**, revalida por trás
  (*stale-while-revalidate*).
- Chave de cache = slug do dashboard. Banco `fmp-bi-cache`, store `datasets`.
- **DEVE** incrementar `VERSAO_CACHE` (`@/lib/datasetCache.ts`) sempre que
  mudar o **formato** do dataset (colunas, tipos, agregação). Sem isso, um
  cache antigo alimenta cálculo novo com dado incompleto — falha silenciosa,
  o pior tipo.
- Cache válido = mesma versão **e** mesma assinatura de carga **e** mesmo dia
  civil. Assinatura desconhecida (`null`) ⇒ cache inválido e **nada é
  gravado**: gravar uma assinatura de falha a faria casar consigo mesma para
  sempre.
- Falta de espaço, modo privado ou IndexedDB bloqueado ⇒ o app funciona
  normalmente, apenas sem cache. **NUNCA** quebrar por causa do cache.

### 7.2 Sinal de frescor (`@/lib/dataFreshness.ts`)

- `REGISTRO_FONTES` é o cadastro único de todas as tabelas. Tabela usada por
  um painel e ausente daqui aparece como "sem sinal" — que é erro de cadastro,
  não ausência real.
- Dois tipos de sinal, **nunca misturados**:
  - `colunaCarga` — carimbo real de carga (`atualizado_em`). Fonte da verdade.
    Consulta de **uma linha**.
  - `colunaConteudo` — proxy: maior data de negócio. **NUNCA** dispara consulta
    dedicada; é calculado em memória sobre o dataset que o painel já baixou.
- **NUNCA** comparar data `dd/mm/aaaa` como texto — o `max()` textual devolve
  lixo. Sempre `parseFlexibleDate`.
- Alerta de "carga parada" **NUNCA** usa prazo fixo: compara o silêncio atual
  com o maior silêncio já observado naquela mesma fonte no último ano
  (`ritmoDoDataset` → `limiteDeSilencio`). Fontes sazonais (`sazonal: true`)
  ficam fora do rótulo principal.
- **NUNCA** exibir "atualizado agora" por omissão. Sem sinal confiável, o texto
  diz exatamente isso.
- **NUNCA** prometer horário de atualização: a carga não roda em hora fixa nem
  todo dia.

### 7.3 Aquecimento (`@/lib/aqueceDashboards.ts`)

- Dispara uma vez por sessão de página, após o login, com os painéis em ordem
  do mais leve para o mais pesado, **sequencialmente**.
- **DEVE** usar `apenasAquecer: true` (lê só a entrada `meta:<chave>`; não
  desserializa dezenas de MB só para concluir "nada a fazer").
- **DEVE** usar `import()` dinâmico por painel, preservando o code-splitting.
- Falha de aquecimento **NUNCA** afeta o app: `try/catch` por painel, erro só
  em `console.debug`.

---

## 8. Autenticação e papéis

- Login é o `codusuario` no padrão `nome.sobrenome`. O e-mail interno
  (`<codusuario>@bi.fmp.local`) é detalhe do Supabase Auth e **NUNCA** aparece
  na interface.
- `codusuario` é **imutável** (trigger no banco). Corrigir login = remover e
  recriar a conta.
- Papéis: `gestor` (dashboards + próprio perfil) e `admin` (tudo + gestão de
  usuários). Checagem na UI por `perfil.papel === 'admin'` / `ehAdmin`.
- **A UI esconde, o banco decide.** Esconder um item de menu **NUNCA** é
  controle de acesso — a policy/Edge Function é.
- Estado de sessão só via `useAuth()` (`@/contexts/AuthContext`). **NUNCA** ler
  `supabase.auth` direto em componente.
- Perfil salvo é **revalidado contra o banco** a cada carga: usuário desativado
  perde o acesso na hora.

---

## 9. Design system

`src/fmp-tokens.css` é a fonte da verdade da marca; `tailwind.config.js`
espelha os tokens; `src/index.css` traz a camada de componentes.

### 9.1 Cor

- **Um único vermelho de marca**: `#EE2A42` (`fmp`). Hover `#D32238`
  (`fmp-dark`), pressed `#B81E32` (`fmp-pressed`).
- Fundo da página `--fmp-cream` (`bg-base`), cartão `#FFFFFF`, cartão aninhado
  `paper`, borda `line`, texto `ink` / `ink-2` / `ink-3`.
- Superfície escura ("prestígio"): sidebar e hero (`hero-gradient` =
  `--fmp-dark-2`), texto `cream`.
- Semânticas: `success`, `warning`, `danger`, `info` — só para estado, nunca
  como cor decorativa.
- **NUNCA** introduzir cor fora dos tokens. Se precisa de uma, adicione ao
  token + Tailwind com justificativa.

### 9.2 Tipografia

- **Outfit** (sans) para UI, dados, rótulos.
- **Noto Serif itálico** para títulos editoriais, títulos de card e valores de
  KPI. É a voz da marca — títulos de página, `SectionCard` e `StatCard` já
  aplicam; mantenha.
- Rótulos de KPI e eyebrows: `text-2xs uppercase tracking-widest`.

### 9.3 Forma e movimento

- Raios: `sm 8px`, `md 16px` (cartão padrão), `lg 28px` (hero), `pill` (botão).
- Sombras: `shadow-card` em repouso, `shadow-card-hover` no hover.
- Animações disponíveis: `fade-in`, `slide-up`, `slide-right`, `pop-in`,
  `shimmer`, `pulse-ring`. Listas usam `animationDelay` escalonado
  (`${i * 60}ms`).

### 9.4 Layout

- Página: `mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8`.
- Grade de KPIs: **DEVE** usar `STAT_GRID_CONTAINER` no wrapper e
  `STAT_GRID_CLASSES` na grade (`@/components/ui/StatCard`). São *container
  queries*, não media queries — reagem à largura real disponível (menu
  colapsado, painel lateral de filtros). Máximo de 4 colunas.
- **NUNCA** substituir por `sm:grid-cols-*` de viewport.

### 9.5 Biblioteca compartilhada (`src/components/ui/`)

| Componente | Uso obrigatório quando |
|-----------|------------------------|
| `StatCard` / `StatCardSkeleton` | KPI numérico |
| `SectionCard` | qualquer bloco com título (dá ampliar em tela cheia de graça) |
| `GaugeSemicircle` | percentual contra meta |
| `MultiSelect` / `SelectedChips` | filtro de múltipla escolha |
| `ReorderableGrid` + `RItem` | grade de cards que o usuário pode reordenar |
| `DataFreshness` | carimbo de frescor no hero — **em todo dashboard** |
| `AtualizandoAviso` | revalidação em segundo plano |
| `LoadingSteps` / `ChartSkeleton` / `TableSkeleton` / `FullPageLoader` | carregamento |
| `EmptyState` | recorte sem dado |
| `ErrorState` | falha recuperável, sempre com `onRetry` |
| `ErrorBoundary` | rota lazy e aba pesada |
| `Badge` | rótulo de status |

- **DEVE** procurar aqui antes de escrever componente novo. Componente usado
  por dois painéis **DEVE** subir para cá.

### 9.6 Gráficos (recharts)

- Categorias lado a lado (pizza/rosca): **DEVE** usar `CORES_CATEGORICAS` /
  `corCategorica()` (`@/lib/chartColors`) — 8 matizes validados para daltonismo.
  Ordem fixa; **NUNCA** reordenar ou ciclar por filtro (a cor de uma categoria
  mudaria quando outra sai do recorte).
- Funil, série temporal e barra única: vermelho da marca (`#EE2A42` → `#B81E32`
  em gradiente) com `#BFBAA4` como neutro de apoio.
- Tooltip padrão (mesmos valores em todos os painéis): fundo
  `rgba(255,255,255,0.98)`, borda `#DEDCD4`, raio 12, sombra
  `0 18px 40px rgba(25,24,24,0.12)`, `fontSize: 12`; label `#191818`/600; item
  `#3A3838`.
  **DECISÃO**: hoje `chartTooltipStyle()` está duplicado em cada `page.tsx`. Ao
  criar o **terceiro** consumidor novo, extraia para `@/lib/chartTheme.ts` e
  migre os existentes. Até lá, copie **exatamente** — divergir nos valores é
  regressão visual.
- Eixos: `tick` 9–11px em `#6E6B66`, `tickLine`/`axisLine` desligados, grid
  `strokeDasharray="4 4"` em `#DEDCD4`.
- Rótulo longo: `truncateLabel()`, nunca cortar no CSS.

### 9.7 Estados de tela — todos obrigatórios

Todo bloco de dados **DEVE** tratar os quatro:

1. **Carregando** — skeleton com shimmer (nunca spinner solto no meio da
   página); se há etapas, `LoadingSteps` com a mensagem de progresso.
2. **Vazio** — `EmptyState` com texto que diz *por que* está vazio ("Sem dados
   para os filtros selecionados"), nunca gráfico em branco.
3. **Erro** — `ErrorState` com `onRetry`. Falha parcial (ex.: Rubeus fora) exibe
   aviso amarelo e **mantém o resto do painel**.
4. **Revalidando** — `AtualizandoAviso`, discreto. **NUNCA** bloquear a tela:
   o dado exibido é válido.

---

## 10. Acessibilidade

- **DEVE**: `aria-label` em todo botão só-ícone; `role="tablist"` +
  `aria-selected` em abas; `aria-haspopup`/`aria-expanded` em dropdown;
  `role="alert"` em erro de formulário; `role="status"` em aviso assíncrono;
  `role="dialog"` + `aria-modal` + fechar com `Esc` em modal.
- Foco visível **NUNCA** removido sem substituto (`focus:border-fmp`,
  `focus:ring-fmp/30`).
- Cor **NUNCA** é o único portador de informação: acompanhe de ícone ou texto.
- Métrica não óbvia **DEVE** ter `hint` no `StatCard`.

---

## 11. Idioma, texto e formatação

- Interface, comentários, nomes de domínio e mensagens de erro: **português**.
- **DECISÃO — acentuação**: texto novo de interface **DEVE** usar acentuação
  correta ("Análise de Conversão", "Matrículas"). Boa parte da copy antiga está
  sem acento por herança; corrija **oportunisticamente**, quando já estiver
  editando aquele trecho — nunca numa varredura isolada no meio de outra tarefa.
- Nomenclatura de código:
  - `src/lib`, `src/contexts`, autenticação: português
    (`carregaComCache`, `leCache`, `entrarComo`, `perfil`).
  - `src/dashboards/*`: prefixos `fetch*`, `compute*`, `build*`, `apply*` com
    sufixo de domínio em português (`computeGraduacaoData`). É o padrão do
    módulo — siga o arquivo vizinho, não invente um terceiro estilo.
  - Tipos de linha crua do banco: `Raw<Entidade>Row`.
- Formatação **DEVE** sair dos `formatters.ts`: `fmtInt`, `fmtBRLCompact`,
  `fmtPct`, `truncateLabel`. Locale `pt-BR`.
- Valor ausente/inválido: **`—`** (travessão). **NUNCA** `0`, `NaN`, `null` ou
  string vazia na tela.
- Valor abreviado (`R$ 872 mil`) **DEVE** ter o valor exato em `title` /
  `exactValue`.

---

## 12. Paridade com o Power BI

Os painéis reproduzem relatórios existentes. A regra é **paridade primeiro**.

- **NUNCA** "consertar" em silêncio uma regra herdada que pareça errada.
  Preserve o comportamento, comente o porquê no código e registre em
  `docs/<slug>-observacoes.md` na seção de divergências.
- Comentário de regra herdada **DEVE** dizer: o que a regra faz, de onde veio,
  e por que não foi alterada.
- Constante literal vinda do DAX (situações, nomes de processo, exclusões)
  **DEVE** ficar em `constants.ts`/`calculations.ts` com comentário — inclusive
  filtro morto preservado por paridade.
- Divergência descoberta contra o banco **DEVE** ser reportada, não aplicada às
  cegas (padrão já usado em `REGISTRO_FONTES`).

---

## 13. Privacidade

- A interface **NUNCA** exibe CPF, telefone, e-mail, RA, nome completo de aluno
  ou lista de pessoas. Nomes são usados **apenas em memória**, para *join* com o
  Rubeus.
- Exceção pessoa identificada em regra de negócio (exclusão, ajuste manual):
  **DEVE** ser identificada por **RA**, nunca por nome — em código **e** em env
  var. `VITE_*` é embutida no bundle público: "fora do Git" não é "fora do
  navegador".
- **NUNCA** logar valor de configuração, token ou dado pessoal. Log é
  `console.warn`/`console.debug` com prefixo (`[cache]`, `[aquecimento]`,
  `[growth]`), sem PII.
- Ausência de configuração que altere número na tela **DEVE** avisar uma vez no
  console — divergir do BI em silêncio é o pior defeito possível.

---

## 14. Configuração e deploy

- Duas origens de configuração, nesta ordem: **runtime** (`/config.js`, gerado
  por `docker/40-app-config.sh` a cada boot) → **build-time**
  (`import.meta.env`).
- **DEVE**: toda `VITE_*` nova ganha `ARG` **e** `ENV` no `Dockerfile` — sem a
  linha `ARG`, o Docker descarta o build arg em silêncio — e entra em
  `.env.example` e no `README-deploy.md`.

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | projeto Supabase (aceita runtime) |
| `VITE_SUPABASE_ANON_KEY` | chave anon (aceita runtime) |
| `VITE_GROWTH_AJUSTE_ALUNO_RA` | RA do ajuste manual de faturamento do Pós |
| `VITE_GROWTH_AJUSTE_DATA` | data do ajuste (padrão `2026-05-28`) |

- `index.html` e `config.js` são servidos com `no-store`; assets com hash têm
  cache de 1 ano (`docker/nginx.conf`). **NUNCA** cachear os dois primeiros.
- Autenticação **NUNCA** volta para variável de ambiente: é banco.

---

## 15. Antipadrões proibidos

1. Fallback silencioso de dado de negócio (número inventado com cara de real).
   O único fallback aceito é `SAMPLE_DASHBOARDS` — catálogo de navegação, não
   métrica.
2. `select('*')` em tabela de fato.
3. Recalcular todas as abas a cada mudança de filtro.
4. Consulta nova só para descobrir frescor de tabela sem carimbo de carga.
5. Mudar formato de dataset sem incrementar `VERSAO_CACHE`.
6. Gravar assinatura de carga obtida com falha.
7. Comparar data `dd/mm/aaaa` como texto.
8. Nome de pessoa em código ou em `VITE_*`.
9. Esconder item de menu e chamar isso de controle de acesso.
10. Cor, ícone ou componente fora do design system.
11. Caminho relativo profundo em vez de `@/`.
12. Ajustar regra herdada do Power BI sem documentar.

---

## 16. Checklist de entrega

Antes de considerar qualquer mudança pronta:

- [ ] `npm run typecheck` e `npm run lint` limpos.
- [ ] Imports por `@/`; nada duplicado que já exista em `ui/` ou `lib/`.
- [ ] Os quatro estados de tela tratados (carregando / vazio / erro /
      revalidando).
- [ ] Grade de KPI com `STAT_GRID_CONTAINER` + `STAT_GRID_CLASSES`.
- [ ] `DataFreshness` presente e recebendo `ritmos`.
- [ ] Cores de gráfico vindas do design system / `chartColors`.
- [ ] `aria-label` em botão só-ícone; foco visível preservado.
- [ ] Números formatados por `formatters.ts`; ausente é `—`.
- [ ] Sem PII na tela, no console e nas env vars.
- [ ] Mudou query/formato? `VERSAO_CACHE` incrementado.
- [ ] Dashboard novo? Os 7 pontos do §5.5 cumpridos.
- [ ] Mudou schema/policy? Migração em `supabase/migrations/`.
- [ ] Regra herdada do BI tocada? Documentada em `docs/`.
- [ ] Saiu deste documento? **SPECS.md atualizado na mesma entrega.**

---

## 17. Módulo Plano de Ação (dados próprios da aplicação)

Detalhamento em `docs/plano-de-acao-arquitetura.md`. Aqui ficam apenas as regras
que mudam o contrato geral desta aplicação.

### 17.1 A exceção ao "somente leitura"

O §2 continua valendo: a aplicação **NUNCA** escreve em tabela de dados de
negócio (`stg_*`, `rubeus_*`, `meta_*`, `dim_*`, `pletivo`).

**DECISÃO**: plano de ação e memória institucional são **dados próprios da
aplicação**, criados por pessoas dentro dela. Vivem no schema **`plano`**, com
escrita permitida por RLS. A separação por schema — e não por prefixo de tabela —
torna a auditoria trivial: nenhuma tabela de `public` ganha policy de escrita, em
nenhuma hipótese.

- `plano` **DEVE** estar em *Exposed schemas* (Dashboard → Settings → API).
  Sem isso o PostgREST devolve 404 e parece erro de RLS.
- `anon` **NUNCA** recebe privilégio em `plano`.
- `plano.envios` **NUNCA** ganha policy de INSERT: registrar comunicação é
  privilégio da Edge Function (`service_role`). É o que garante, na arquitetura
  e não no *prompt*, que nada é enviado sem aprovação.

### 17.2 Como a LLM lê um painel

- **DEVE** ler o **snapshot** — o estado já calculado pelo painel
  (`src/dashboards/<slug>/snapshot.ts` → `DashboardSnapshot`).
- **NUNCA** dar ao modelo acesso a SQL, tabela ou imagem de tela. A regra de
  negócio vive em `calculations.ts` (paridade com o Power BI, §12); recalcular em
  outro lugar produziria número diferente do que está na tela — o defeito mais
  caro possível.
- Snapshot **DEVE** ser agregado, ≤ ~15 KB, com `frescor` e `observacoes`, e
  **NUNCA** conter PII (§13 continua valendo por construção).
- Todo número citado pelo agente **DEVE** passar pela guarda de números no
  servidor: evidência que não bate com o snapshot rejeita o turno.

### 17.3 Segredos

- Chave da LLM e URL de webhook **NUNCA** em `VITE_*` **nem** em `/config.js`.
  Os dois caminhos de `leConfig` (§14) são públicos: `VITE_*` é embutida no
  bundle e `config.js` é servido pela web. Segredo vive em *secret* de Edge
  Function, sempre.

### 17.4 Memória institucional

- Recuperação por **filtro nas dimensões do snapshot**
  (`public.plano_memoria_no_escopo`), não por similaridade. Determinística e
  auditável — dá para mostrar ao usuário o que entrou no plano.
- Banco vetorial **NUNCA** como serviço externo. Se um dia for necessário,
  `pgvector` no mesmo Postgres (critérios no doc §5.3.3).
- A LLM **NUNCA** grava `status='validada'`. Quem valida é pessoa; o alcance da
  memória decide qual pessoa (§5.3.5 do doc).
- Toda memória **DEVE** ter escopo; a circunstancial **DEVE** ter `vigente_ate`.

### 17.5 Interface

O público é gestor, não analista. **Curva de aprendizagem alvo: zero.**

- Coluna única de leitura (máx. 760px). **NUNCA** três painéis simultâneos.
- Ações agrupadas por **quando fazer**, nunca por `P1/P2/P3`.
- Card mostra o que fazer, quem faz e até quando; o resto atrás de `por quê?`,
  fechado por padrão e abrindo com **texto antes de número**.
- Sigla, slug e nome de tabela **NUNCA** chegam à tela (léxico no doc §7.4).
- Envio **DEVE** mostrar a prévia exata da mensagem antes de confirmar.
- **NUNCA** bolha flutuante nem painel de chat permanente.

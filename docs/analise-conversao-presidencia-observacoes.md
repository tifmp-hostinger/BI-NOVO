# Analise de Conversao - Presidencia — Observacoes

Este documento registra as regras herdadas do relatorio Power BI reproduzidas
nesta primeira fase do dashboard "Analise de Conversao - Presidencia" e as
inconsistencias que foram intencionalmente preservadas para paridade.

Nenhum ajuste silencioso foi realizado: quando uma regra parecia estranha, ela
foi mantida e listada aqui para revisao futura.

## 1. Regras preservadas apenas por compatibilidade

### 1.1 Graduacao — Leads (Rubeus)

- COUNT (nao DISTINCT) de registros do Rubeus com `pessoa_nome` preenchido.
- Filtro por `processo = 'Graduacao'` e `momento_date` entre
  `pletivo.data_inicio_matricula` e `pletivo.data_fim_matricula` do periodo
  selecionado.
- O modelo antigo nao aplica DISTINCT por pessoa; a mesma pessoa pode aparecer
  varias vezes com diferentes etapas/momentos. Mantido igual.

### 1.2 Graduacao — Inscricoes originadas de lead

- Denominador do calculo de conversao.
- Uma inscricao e considerada "originada de lead" quando o nome normalizado
  do inscrito (lower(trim(nome))) aparece como `pessoa_nome` normalizado no
  Rubeus, dentro do mesmo periodo letivo.
- Regras equivalentes ao antigo campo `insc_lead` do Power BI.

### 1.3 Graduacao — Conversao

- Formula: `matriculas / inscricoes originadas de lead`.
- Nao usar total de inscricoes como denominador.

### 1.4 Graduacao — Matriculas

- `codperlet` chega no banco com prefixo "_" em alguns casos (ex.: `_26-01`).
  Normalizamos removendo o prefixo antes da comparacao.
- Filtros: `situacao = 'Matriculado'` e `tipomatricula = 'Nova Matricula'`.
- Contagem: `COUNT(DISTINCT ra)`.

### 1.5 Mestrado — Derivacao de periodo do processo seletivo

- Regra herdada:
  - `processoseletivo` contem "Complementar" -> considerar `26-01`.
  - contem `2024` -> `24-01`.
  - contem `2025` -> `25-01`.
  - contem `2026` -> `26-01`.
- A verificacao ocorre nessa ordem. "Complementar" tem precedencia mesmo que
  o texto contenha um ano.

### 1.6 Mestrado — Conversao

- Rotulo visual no Power BI: "% Conversao Inscritos".
- Formula real: `matriculas qualificadas como lead / total de matriculas`.
- Uma matricula e "qualificada" quando o `aluno` normalizado existe em
  `pessoa_nome` normalizado do Rubeus e a `situacao` esta em:
  `Matriculado`, `Matriculado- Pendente Contrato`.
- **Divergencia**: o nome exibido sugere razao sobre inscritos, mas a formula
  usa matriculas. Mantido igual ao Power BI.

### 1.7 Especializacoes — Faturamento

Regras herdadas aplicadas ao calcular faturamento a partir de
`stg_rm_matriculas_pos`:

- `descontoaluno` deve ser exatamente `Pagante`.
- Excluir curso `Pós-graduação em Direito Público (ead)`.
- Excluir situacoes: `Óbito`, `Evadido Curso`, `Formado`, `Troca de Ciclo`,
  `Transferência Interna`, `Pré Matricula`. Comparacao feita sem acentos e
  case-insensitive porque a base tem variacoes (`Pré-Matrícula`,
  `Cancelado – Curso` com en-dash, etc.).
- Excluir registros cujo `aluno` contenha a palavra `teste`.
- Excluir o aluno `Eric Maldaner Molter`.
- Para EAD, excluir tambem `joanderson costa ribeiro`.
- Excluir registros em que `bolsas` ou `bolsa3` contenham `TROCA DE PL`,
  mantendo a excecao para `Bruno Barbosa da Silveira` (nao excluido).
- Filtrar `databaixa` dentro do periodo selecionado (ano + meses).

### 1.8 Especializacoes — Modalidade

- `processoseletivo` **exatamente igual** a `Inscrição Pós Graduação Presencial`
  -> modalidade `Pos Presencial`.
- Qualquer outro valor -> `Pos EAD`.
- **Observacao**: essa regra e muito estrita. Como o Power BI, ela pode
  classificar registros com processos seletivos especificos como EAD mesmo
  quando o curso e presencial. Mantida igual.

### 1.9 Especializacoes — EAD e cancelamentos

- Deduplicacao por chave `aluno + curso`.
- Para uma mesma dupla, se existir cancelamento dentro do periodo, considerar
  o registro com maior `databaixa`.
- Cancelamentos posteriores a `2026-06-01` recebem tratamento especifico
  descrito na funcao `computePosCancelamento` em `queries.ts`.
- Excecao existente para `Daiana Cerutti` mantida.

### 1.10 Metas de Pos-graduacao

- Meses `janeiro` e `fevereiro` de 2026 estao com meta nula no banco.
- O dashboard soma apenas metas nao nulas dos meses selecionados.
- Nao inventamos metas para meses vazios.

## 2. Divergencias potenciais em relacao ao Power BI

- Rotulo "% Conversao Inscritos" do Mestrado nao reflete a formula real
  (ver 1.6).
- COUNT nao DISTINCT dos leads da Graduacao e do Mestrado pode inflar o
  numerador (ver 1.1 e 11.2).
- Modalidade das Pos-graduacoes depende de string exata; pequenas variacoes
  em `processoseletivo` movem o registro entre presencial e EAD.
- Situacoes da matricula tem variacoes com acentos e traco longo (en-dash)
  que nao sao filtradas literalmente no Power BI. Aqui aplicamos comparacao
  normalizada para evitar falsos positivos.
- `codperlet` da graduacao chega com prefixo `_` em alguns registros; o
  Power BI provavelmente aplica o mesmo tratamento antes da comparacao.

## 3. Recomendacoes para a segunda fase

- Substituir COUNT por COUNT DISTINCT em leads e revisar impacto historico.
- Padronizar `descontoaluno`, `situacao` e `tipomatricula` no ETL.
- Padronizar `codperlet` (sem `_`).
- Adicionar coluna estruturada `modalidade` em `stg_rm_matriculas_pos`.
- Revisar o rotulo "% Conversao Inscritos" do Mestrado ou a formula.
- Consolidar a lista de exclusoes de aluno em uma tabela de configuracao no
  banco, evitando manter nomes de pessoas no codigo do dashboard.
- Considerar views/materialized views no Supabase para reduzir volume de
  dados trazidos ao navegador em cada consulta.

## 4. Restricoes de privacidade

O dashboard nao exibe CPF, telefone, e-mail, RA, nome completo ou listas de
pessoas. Os nomes sao usados apenas em memoria para joins e correspondencias
com o Rubeus.

## 5. Autorizacoes pendentes

Nesta primeira fase nao foi criada nenhuma view, funcao RPC ou indice novo.
Caso a segunda fase precise:

- View materializada `mv_rubeus_leads_por_periodo` para reduzir joins em JS.
- Indice em `rubeus_registros_personalizada(momento_date, processo)`.
- Indice em `stg_rm_matriculas_pos(databaixa, descontoaluno)`.

Nenhum desses foi executado automaticamente.

## 6. Politicas de leitura RLS

As tabelas `pletivo`, `meta_mestrado`, `meta_pos` e
`rubeus_registros_personalizada` estavam com RLS habilitado sem nenhuma
politica, o que fazia com que o PostgREST retornasse zero linhas para o cliente
anon (sem gerar erro) — resultando em "0 leads" e meta vazia na UI.

Foi aplicada uma migracao adicionando uma politica SELECT em cada tabela para
os papeis `anon` e `authenticated`:

- `pletivo.read_pletivo_public`
- `meta_mestrado.read_meta_mestrado_public`
- `meta_pos.read_meta_pos_public`
- `rubeus_registros_personalizada.read_rubeus_public`

Nenhuma politica de INSERT / UPDATE / DELETE foi criada. As tabelas permanecem
somente-leitura pelo frontend, alinhado aa restricao "consultas read-only" do
dashboard.

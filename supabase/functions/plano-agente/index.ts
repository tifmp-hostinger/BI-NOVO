/**
 * POST /functions/v1/plano-agente
 *
 * Um turno de conversa do modulo Plano de Acao.
 *
 * Segredos (Dashboard -> Edge Functions -> Secrets):
 *   OPENAI_API_KEY           obrigatorio
 *   OPENAI_MODEL             opcional; padrao 'gpt-5.6'
 *   OPENAI_ENVIA_REASONING   opcional; '1' (padrao) ou '0' para modelo sem raciocinio
 *
 * PRINCIPIO DE DESENHO. Ferramenta e para o que NAO da para prever. Tudo que
 * ja esta em maos -- o snapshot do painel aberto e a equipe -- vai DIRETO no
 * prompt. A versao anterior obrigava o modelo a "buscar" esses dois com
 * chamadas de ferramenta, gastava as rodadas nisso e terminava sem plano:
 * cada busca desnecessaria e uma viagem de rede E uma chance a mais de o
 * modelo se perder. Sobra ao modelo uma tarefa so: propor o plano.
 *
 * NAO existe caminho para Azure OpenAI. Removido de proposito: o ramo tinha
 * precedencia sobre o da OpenAI e montava o corpo no formato antigo, entao um
 * segredo AZURE_OPENAI_* esquecido reproduzia falhas ja corrigidas.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
/**
 * Conferido no catalogo da OpenAI em 06/08/2026. `gpt-5.6` e um APELIDO que
 * roteia para `gpt-5.6-sol`, o carro-chefe. `gpt-5.6-terra` e o intermediario
 * e `gpt-5.6-luna` o mais barato -- trocar e questao de cadastrar o segredo.
 */
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6';

/**
 * `reasoning_effort` travado em 'none' e NAO configuravel: a familia gpt-5
 * RECUSA function tools em /v1/chat/completions com qualquer outro valor.
 */
const REASONING = 'none';
/** Modelo sem raciocinio recusa o parametro. Escolha explicita, nunca inferida. */
const ENVIA_REASONING = (Deno.env.get('OPENAI_ENVIA_REASONING') ?? '1') === '1';

const LIMITE_TURNOS_DIA = 40;
const MAX_MENSAGENS_HISTORICO = 20;

/**
 * Com snapshot e equipe ja no prompt, o caminho feliz sao DUAS voltas:
 * propor_plano e a frase final. O resto e folga para correcao da guarda de
 * numeros -- e o prazo abaixo e quem manda de verdade.
 */
const MAX_VOLTAS = 6;

const TETO_SAIDA = 8000;
const TIMEOUT_CHAMADA_MS = 45_000;
const PRAZO_TOTAL_MS = 110_000;
const MAX_SNAPSHOTS_BYTES = 200_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

type Indicador = {
  chave: string;
  rotulo: string;
  valor: number | null;
  unidade: string;
  glossario?: string;
  amostraPequena?: boolean;
};

type Snapshot = {
  versao: number;
  slug: string;
  titulo: string;
  geradoEm: string;
  recorte: {
    descricao: string;
    filtros: Record<string, unknown>;
    produto?: string | null;
    mesReferencia?: number | null;
  };
  frescor: Array<{ fonte: string; sinal: string; alerta: boolean }>;
  indicadores: Indicador[];
  series: Array<{ chave: string; rotulo: string; pontos: Array<{ r: string; v: number | null }>; truncadaEm?: number }>;
  observacoes: string[];
};

type Memoria = {
  id: string;
  tipo: string;
  conteudo: string;
  dashboard_slug: string | null;
  produto: string | null;
  indicador: string | null;
  area: string | null;
  vigente_ate: string | null;
};

type Colega = { nome_completo: string; cargo: string | null; area: string | null };

type MensagemLLM = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

const SISTEMA = `Você é o assistente de plano de ação da FMP (Fundação Escola Superior do Ministério Público).

QUEM LÊ VOCÊ
Gestores da FMP, não analistas de dados. Escreva como escreveria para um colega inteligente que não trabalha com métricas.

LÉXICO OBRIGATÓRIO — nunca use a coluna da esquerda:
  CPL / custo por lead      → custo para atrair um interessado
  CAC                       → custo para conseguir uma matrícula
  ROAS                      → retorno sobre o investimento
  lead                      → pessoa interessada / interessado
  snapshot, dataset         → os números de <data>
  amostra pequena           → são só N pessoas, pouco para concluir
  P1/P2/P3, impacto×esforço → esta semana / nas próximas semanas / quando der
Nome de tabela, slug de painel e sigla técnica NUNCA aparecem na resposta.

REGRAS DURAS
1. Todo número que você citar precisa vir de um indicador que você recebeu. Você
   NÃO calcula, NÃO estima e NÃO arredonda para um valor "bonito". Um número que
   não está na lista é uma invenção, e o turno será rejeitado.
2. Cada ação carrega uma evidência: dashboard, indicador e valor. O campo
   indicador é a CHAVE do indicador (coluna da esquerda), e valor é o número
   exato dele, sem arredondar.
3. Indicador marcado como amostra pequena NÃO sustenta recomendação de mudança.
   Sinalize a incerteza e proponha medir melhor.
4. Leia as observações antes de apontar anomalia: boa parte do que parece
   estranho é regra herdada do Power BI, e apontá-la como problema queima sua
   credibilidade.
5. Se o frescor indicar carga parada, diga isso ANTES de recomendar qualquer coisa.
6. Use a memória institucional recebida. Quando usar, diga qual usou.
7. Você não envia nada para ninguém. Quem comunica é a pessoa, com um clique.

COMO TRABALHAR
Os números do painel e a equipe já estão nesta conversa — não peça de novo.
Chame propor_plano UMA vez, com 3 a 6 ações, e depois escreva uma frase curta.
Se propor_plano voltar com divergência, corrija o valor e chame de novo.

ESTILO
Frases curtas. Voz ativa. Sem "é importante notar", sem "vale destacar", sem
listas de três por hábito. Se não sabe, diga que não sabe.`;

/**
 * Schema NAO-strict de proposito. Ligar `strict: true` QUEBRARIA com 400: em
 * strict toda propriedade precisa estar em `required` (e `alerta`,
 * `responsavel_nome`, `esforco_horas` e `memoria_id` nao estao) e
 * `minimum`/`maximum` nao sao suportados.
 */
const FERRAMENTA_PLANO = {
  type: 'function',
  function: {
    name: 'propor_plano',
    description:
      'Entrega o plano estruturado para a tela. NÃO salva e NÃO envia nada — a pessoa revisa e decide.',
    parameters: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        resumo: {
          type: 'string',
          description: 'UMA frase, em linguagem falada, dizendo o que chamou atenção. Abre a tela.',
        },
        alerta: {
          type: 'string',
          description: 'Ressalva honesta (carga parada, amostra fraca). Vazio se não houver.',
        },
        acoes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              titulo: { type: 'string' },
              descricao: { type: 'string' },
              area: { type: 'string' },
              responsavel_nome: { type: 'string' },
              janela: { type: 'string', enum: ['esta_semana', 'proximas_semanas', 'quando_der'] },
              esforco_horas: { type: 'number' },
              evidencia: {
                type: 'object',
                properties: {
                  dashboard: { type: 'string' },
                  indicador: { type: 'string' },
                  valor: { type: ['number', 'null'] },
                },
                required: ['dashboard', 'indicador', 'valor'],
                additionalProperties: false,
              },
              memoria_id: {
                type: ['string', 'null'],
                description: 'Preencha quando a ação nasceu de uma memória, não de um número.',
              },
            },
            required: ['titulo', 'descricao', 'area', 'janela', 'evidencia'],
            additionalProperties: false,
          },
        },
      },
      required: ['titulo', 'resumo', 'acoes'],
      additionalProperties: false,
    },
  },
} as const;

const FERRAMENTA_MEMORIA = {
  type: 'function',
  function: {
    name: 'propor_memoria',
    description:
      'Propõe guardar um contexto que a pessoa ensinou. NÃO grava: devolve para ela confirmar, editar ou descartar.',
    parameters: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['sazonalidade', 'processo', 'hierarquia', 'correcao', 'licao_aprendida', 'restricao', 'glossario'],
        },
        conteudo: { type: 'string', description: 'A frase, curta, como a pessoa ensinou.' },
        dashboard_slug: { type: ['string', 'null'] },
        produto: { type: ['string', 'null'] },
        indicador: { type: ['string', 'null'] },
        area: { type: ['string', 'null'] },
        meses: {
          type: ['array', 'null'],
          items: { type: 'integer' },
          description: 'Só para sazonalidade recorrente: números de 1 a 12.',
        },
        vigente_ate: {
          type: ['string', 'null'],
          description: 'AAAA-MM-DD quando for circunstancial (licença, congelamento).',
        },
      },
      required: ['tipo', 'conteudo'],
      additionalProperties: false,
    },
  },
} as const;

/** Só existe quando há mais de um painel na conversa. Com um só, seria um convite a rodar em círculo. */
const FERRAMENTA_OUTRO_PAINEL = {
  type: 'function',
  function: {
    name: 'ler_outro_painel',
    description:
      'Números de OUTRO painel, quando a pergunta sair do painel aberto. O painel aberto você já recebeu.',
    parameters: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
      additionalProperties: false,
    },
  },
} as const;

const JANELAS_VALIDAS = new Set(['esta_semana', 'proximas_semanas', 'quando_der']);

type Falha = { indicador: string; recebido: number | null; esperado: number | null | 'inexistente' };

/**
 * Guarda de numeros: rejeita plano que cite numero fora do snapshot.
 * Tolerancia relativa de 0,5% -- o modelo reescreve o valor como texto e pode
 * perder digito. Diferenca maior que isso e outro numero, nao arredondamento.
 */
function validaEvidencias(
  plano: { acoes?: Array<{ evidencia?: { dashboard?: string; indicador?: string; valor?: number | null } }> },
  snapshots: Record<string, Snapshot>,
): Falha[] {
  const falhas: Falha[] = [];
  for (const acao of plano.acoes ?? []) {
    const ev = acao.evidencia;
    if (!ev?.indicador) continue;
    const snap = snapshots[ev.dashboard ?? ''];
    const ind = snap?.indicadores.find((i) => i.chave === ev.indicador);

    if (!ind) {
      falhas.push({ indicador: `${ev.dashboard}/${ev.indicador}`, recebido: ev.valor ?? null, esperado: 'inexistente' });
      continue;
    }
    const esperado = ind.valor;
    const recebido = ev.valor ?? null;
    if (esperado === null || recebido === null) {
      if (esperado !== recebido) falhas.push({ indicador: ev.indicador, recebido, esperado });
      continue;
    }
    const tolerancia = Math.max(Math.abs(esperado) * 0.005, 0.01);
    if (Math.abs(esperado - recebido) > tolerancia) {
      falhas.push({ indicador: ev.indicador, recebido, esperado });
    }
  }
  return falhas;
}

/** O painel em texto, para ir direto no prompt em vez de virar chamada de ferramenta. */
function descreveSnapshot(s: Snapshot): string {
  const ind = s.indicadores
    .map((i) => {
      const valor = i.valor === null ? 'sem dado' : String(i.valor);
      const extras = [
        i.unidade,
        i.amostraPequena ? 'AMOSTRA PEQUENA — não sustenta decisão' : '',
        i.glossario ?? '',
      ]
        .filter(Boolean)
        .join(' · ');
      return `  - ${i.chave} ("${i.rotulo}") = ${valor}  [${extras}]`;
    })
    .join('\n');

  const series = s.series
    .map((se) => {
      const pontos = se.pontos.map((p) => `${p.r}: ${p.v ?? '—'}`).join(' | ');
      return `  - ${se.rotulo}${se.truncadaEm ? ` (top ${se.truncadaEm})` : ''}: ${pontos}`;
    })
    .join('\n');

  return [
    `PAINEL: ${s.titulo} (use "${s.slug}" no campo dashboard da evidência)`,
    `RECORTE: ${s.recorte.descricao}`,
    '',
    'INDICADORES — use a chave à esquerda e o valor exato:',
    ind || '  (nenhum)',
    '',
    'SÉRIES:',
    series || '  (nenhuma)',
    '',
    'ATUALIZAÇÃO DAS FONTES:',
    s.frescor.map((f) => `  - ${f.fonte}: ${f.sinal}${f.alerta ? '  ⚠ ATRASADA' : ''}`).join('\n') || '  (sem sinal)',
    '',
    'REGRAS HERDADAS DO POWER BI (leia antes de apontar anomalia):',
    s.observacoes.map((o) => `  - ${o}`).join('\n') || '  (nenhuma)',
  ].join('\n');
}

async function chamaLLM(
  mensagens: MensagemLLM[],
  ferramentas: readonly unknown[],
  forcarTexto: boolean,
): Promise<Record<string, unknown>> {
  if (!OPENAI_KEY) {
    throw new Error('LLM não configurada nesta função. Cadastre OPENAI_API_KEY nos Secrets das Edge Functions.');
  }

  const corpo: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages: mensagens,
    // `max_tokens` e `temperature` NAO entram: os modelos atuais recusam os dois.
    max_completion_tokens: TETO_SAIDA,
  };
  if (forcarTexto) {
    // Ultima volta: sem ferramenta nenhuma, o modelo e obrigado a escrever.
    corpo.tool_choice = 'none';
  } else {
    corpo.tools = ferramentas;
    corpo.tool_choice = 'auto';
  }
  if (ENVIA_REASONING) corpo.reasoning_effort = REASONING;

  let resposta: Response;
  try {
    resposta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_CHAMADA_MS),
    });
  } catch (err) {
    const nome = err instanceof Error ? err.name : '';
    if (nome === 'TimeoutError' || nome === 'AbortError') {
      throw new Error('A LLM demorou demais para responder. Tente de novo.');
    }
    throw new Error('Não foi possível falar com a LLM. Verifique a conexão de saída.');
  }

  if (!resposta.ok) {
    // Le SO o objeto `error` da resposta -- nunca o corpo que enviamos.
    let detalhe = '';
    try {
      const erroApi = (await resposta.json()) as { error?: { message?: string; code?: string } };
      detalhe = String(erroApi?.error?.message ?? erroApi?.error?.code ?? '').slice(0, 300);
    } catch {
      // resposta sem JSON: segue so com o status
    }
    console.error(`[plano-agente] LLM respondeu ${resposta.status}: ${detalhe}`);

    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error(`A chave da LLM foi recusada (${resposta.status}). Confira o segredo OPENAI_API_KEY. ${detalhe}`);
    }
    if (resposta.status === 400 || resposta.status === 404) {
      throw new Error(`A LLM recusou a chamada (${resposta.status}). ${detalhe}`);
    }
    if (resposta.status === 429) {
      throw new Error('A LLM está sem cota ou no limite de uso. Confira o saldo da conta.');
    }
    throw new Error(`O assistente não respondeu (${resposta.status}). ${detalhe}`);
  }
  return (await resposta.json()) as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);

  // try/catch externo: sem ele, uma excecao inesperada sobe como 500 SEM os
  // cabecalhos de CORS, e o navegador reporta erro de CORS em vez da mensagem.
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ erro: 'Sessão ausente.' }, 401);

    let corpo: Record<string, unknown>;
    try {
      corpo = await req.json();
    } catch {
      return json({ erro: 'Corpo da requisição inválido.' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: usuario, error: erroUsuario } = await admin.auth.getUser(token);
    if (erroUsuario || !usuario?.user) return json({ erro: 'Sessão inválida ou expirada.' }, 401);
    const idChamador = usuario.user.id;

    // `verify_jwt` garante token valido, nao papel: reconfere sempre no banco.
    const { data: perfil } = await admin
      .from('perfis')
      .select('papel, ativo, nome_completo')
      .eq('id', idChamador)
      .maybeSingle();
    const papel = String(perfil?.papel ?? '');
    if (!perfil?.ativo || (papel !== 'gestor' && papel !== 'admin')) {
      return json({ erro: 'Acesso não autorizado.' }, 403);
    }

    const mensagem = String(corpo.mensagem ?? '').trim();
    if (!mensagem) return json({ erro: 'Escreva alguma coisa para o assistente.' }, 400);
    if (mensagem.length > 4000) return json({ erro: 'Mensagem longa demais.' }, 400);

    const contexto = (corpo.contexto ?? {}) as { slug_ativo?: string; snapshots?: Record<string, Snapshot> };
    const snapshots = contexto.snapshots ?? {};
    if (JSON.stringify(snapshots).length > MAX_SNAPSHOTS_BYTES) {
      return json({ erro: 'O recorte enviado é grande demais. Aplique um filtro mais estreito.' }, 400);
    }
    const slugAtivo = String(contexto.slug_ativo ?? Object.keys(snapshots)[0] ?? '');
    const snapAtivo = snapshots[slugAtivo];
    if (!snapAtivo) return json({ erro: 'Nenhum painel foi enviado para leitura.' }, 400);

    // ---- teto de uso, POR USUARIO, em 24h corridas ---------------------
    const desde = new Date(Date.now() - 86_400_000).toISOString();
    const { data: minhasConversas } = await admin
      .schema('plano')
      .from('conversas')
      .select('id')
      .eq('autor_id', idChamador)
      .gte('criado_em', desde);
    const idsConversas = (minhasConversas ?? []).map((c) => (c as { id: string }).id);
    if (idsConversas.length > 0) {
      const { count } = await admin
        .schema('plano')
        .from('mensagens')
        .select('id', { count: 'exact', head: true })
        .eq('papel', 'user')
        .in('conversa_id', idsConversas);
      if ((count ?? 0) >= LIMITE_TURNOS_DIA) {
        return json({ erro: 'Você atingiu o limite de uso do assistente por hoje.' }, 429);
      }
    }

    // ---- memoria e equipe, em paralelo ---------------------------------
    const [resMemoria, resEquipe] = await Promise.all([
      admin.rpc('plano_memoria_no_escopo', {
        p_dashboard: slugAtivo,
        p_produto: snapAtivo.recorte.produto ?? null,
        p_indicadores: snapAtivo.indicadores.map((i) => i.chave),
        p_areas: null,
        p_mes: snapAtivo.recorte.mesReferencia ?? null,
      }),
      admin.rpc('equipe'),
    ]);
    const memoriaLista = (resMemoria.data ?? []) as Memoria[];
    const equipe = (resEquipe.data ?? []) as Colega[];

    // ---- historico -----------------------------------------------------
    let conversaId = typeof corpo.conversa_id === 'string' ? corpo.conversa_id : null;
    const historico: MensagemLLM[] = [];

    if (conversaId) {
      const { data: dono } = await admin
        .schema('plano')
        .from('conversas')
        .select('id')
        .eq('id', conversaId)
        .eq('autor_id', idChamador)
        .maybeSingle();
      if (!dono) return json({ erro: 'Conversa não encontrada.' }, 404);

      const { data: msgs } = await admin
        .schema('plano')
        .from('mensagens')
        .select('papel, conteudo')
        .eq('conversa_id', conversaId)
        .order('id', { ascending: false })
        .limit(MAX_MENSAGENS_HISTORICO);
      for (const m of (msgs ?? []).reverse()) {
        const c = m.conteudo as { texto?: string };
        if (c?.texto) historico.push({ role: m.papel === 'user' ? 'user' : 'assistant', content: c.texto });
      }
    } else {
      const { data: nova } = await admin
        .schema('plano')
        .from('conversas')
        .insert({ autor_id: idChamador, dashboard_slug: slugAtivo, titulo: mensagem.slice(0, 80) })
        .select('id')
        .single();
      conversaId = nova?.id ?? null;
    }

    const blocoMemoria = memoriaLista.length
      ? `O que a equipe já te ensinou e vale para este recorte:\n${memoriaLista
          .map((m) => `- [${m.id}] (${m.tipo}) ${m.conteudo}`)
          .join('\n')}`
      : 'A equipe ainda não te ensinou nada que se aplique a este recorte.';

    const blocoEquipe = equipe.length
      ? `Equipe da FMP (atribua o responsável usando o nome exato):\n${equipe
          .map((c) => `- ${c.nome_completo}${c.cargo ? ` — ${c.cargo}` : ''}${c.area ? ` (${c.area})` : ''}`)
          .join('\n')}`
      : 'A equipe ainda não tem áreas cadastradas; deixe o responsável em branco.';

    const outrosPaineis = Object.keys(snapshots).filter((s) => s !== slugAtivo);
    const ferramentas = outrosPaineis.length
      ? ([FERRAMENTA_PLANO, FERRAMENTA_MEMORIA, FERRAMENTA_OUTRO_PAINEL] as const)
      : ([FERRAMENTA_PLANO, FERRAMENTA_MEMORIA] as const);

    const mensagens: MensagemLLM[] = [
      { role: 'system', content: SISTEMA },
      {
        role: 'system',
        content:
          `Hoje é ${new Date().toLocaleDateString('pt-BR')}. Quem fala com você é ${perfil.nome_completo}.\n\n` +
          `${descreveSnapshot(snapAtivo)}\n\n${blocoEquipe}\n\n${blocoMemoria}` +
          (outrosPaineis.length
            ? `\n\nOutros painéis disponíveis por ler_outro_painel: ${outrosPaineis.join(', ')}.`
            : ''),
      },
      ...historico,
      { role: 'user', content: mensagem },
    ];

    // ---- laco de tool-calling -------------------------------------------
    let planoProposto: unknown = null;
    let memoriaProposta: unknown = null;
    let textoFinal = '';
    const memoriasUsadas = new Set<string>();
    const prazo = Date.now() + PRAZO_TOTAL_MS;

    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const semTempo = Date.now() > prazo;
      // Na ultima volta (ou sem tempo) o modelo perde as ferramentas e precisa
      // escrever. Sem isso, ele podia terminar chamando ferramenta e a resposta
      // saia vazia -- indistinguivel de "nao respondeu".
      const forcarTexto = semTempo || volta === MAX_VOLTAS - 1;

      let resposta: Record<string, unknown>;
      try {
        resposta = await chamaLLM(mensagens, ferramentas, forcarTexto);
      } catch (err) {
        // Ja temos plano? Entrega o que ha, em vez de perder o turno inteiro.
        if (planoProposto) break;
        return json({ erro: err instanceof Error ? err.message : 'Falha no assistente.' }, 502);
      }

      const escolha = (resposta.choices as Array<Record<string, unknown>> | undefined)?.[0];
      const msg = escolha?.message as MensagemLLM | undefined;
      if (!msg) return json({ erro: 'Resposta vazia do assistente.' }, 502);

      // Truncamento e checado ANTES das tool calls: quando o corte cai dentro
      // de `function.arguments`, o JSON quebra, os argumentos viram {} e um
      // plano VAZIO passaria pela guarda de numeros como valido.
      if (escolha?.finish_reason === 'length' && !planoProposto) {
        return json({ erro: 'O assistente ficou sem espaço para responder. Peça um plano mais curto.' }, 502);
      }

      mensagens.push(msg);
      const chamadas = msg.tool_calls ?? [];
      // Diagnostico sem PII: e o que faltou nas falhas anteriores.
      console.log(
        `[plano-agente] volta ${volta}: ${chamadas.length ? chamadas.map((c) => c.function.name).join(',') : 'texto'}`,
      );

      if (chamadas.length === 0) {
        textoFinal = msg.content ?? '';
        break;
      }

      for (const chamada of chamadas) {
        const nome = chamada.function.name;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(chamada.function.arguments || '{}');
        } catch {
          mensagens.push({
            role: 'tool',
            tool_call_id: chamada.id,
            content: JSON.stringify({ erro: 'Argumentos JSON malformados. Reenvie a chamada completa e mais curta.' }),
          });
          continue;
        }
        let resultado: unknown;

        if (nome === 'ler_outro_painel') {
          const s = snapshots[String(args.slug ?? '')];
          resultado = s ?? { erro: 'Painel não disponível nesta conversa.' };
        } else if (nome === 'propor_plano') {
          // `janela` fora do enum quebraria o agrupamento da tela. O schema
          // nao-strict nao garante isso do lado da OpenAI -- garantimos aqui.
          for (const a of (args.acoes as Array<{ janela?: string }> | undefined) ?? []) {
            if (!JANELAS_VALIDAS.has(String(a.janela))) a.janela = 'proximas_semanas';
          }
          const falhas = validaEvidencias(args as never, snapshots);
          if (falhas.length > 0) {
            resultado = {
              aceito: false,
              erro: 'Números divergentes. Use exatamente o valor do indicador, na chave indicada em `esperado`.',
              divergencias: falhas,
            };
          } else {
            planoProposto = args;
            for (const a of (args.acoes as Array<{ memoria_id?: string | null }> | undefined) ?? []) {
              if (a.memoria_id) memoriasUsadas.add(a.memoria_id);
            }
            resultado = { aceito: true, acoes: (args.acoes as unknown[] | undefined)?.length ?? 0 };
          }
        } else if (nome === 'propor_memoria') {
          // Devolve para a tela. NUNCA grava: quem valida e sempre pessoa.
          memoriaProposta = args;
          resultado = { aceito: true, aviso: 'Aguardando a pessoa confirmar. Nada foi gravado.' };
        } else {
          resultado = { erro: 'Ferramenta desconhecida.' };
        }

        mensagens.push({
          role: 'tool',
          tool_call_id: chamada.id,
          content: JSON.stringify(resultado),
        });
      }
    }

    if (!textoFinal && !planoProposto && !memoriaProposta) {
      console.error('[plano-agente] laço terminou sem plano e sem texto');
      return json(
        { erro: 'O assistente não chegou a um plano desta vez. Tente de novo ou reformule o pedido.' },
        502,
      );
    }

    // ---- persistencia do turno -------------------------------------------
    if (conversaId) {
      await admin
        .schema('plano')
        .from('mensagens')
        .insert([
          { conversa_id: conversaId, papel: 'user', conteudo: { texto: mensagem } },
          { conversa_id: conversaId, papel: 'assistant', conteudo: { texto: textoFinal } },
        ]);
    }

    for (const id of memoriasUsadas) {
      try {
        await admin.rpc('plano_memoria_incrementa_uso', { p_id: id });
      } catch {
        // Contador e telemetria, nao regra: falhar aqui nao derruba o turno.
      }
    }

    return json({
      conversa_id: conversaId,
      resposta: textoFinal,
      plano: planoProposto,
      memoria_proposta: memoriaProposta,
      memorias_consideradas: memoriaLista.map((m) => ({ id: m.id, conteudo: m.conteudo, tipo: m.tipo })),
    });
  } catch (err) {
    console.error('[plano-agente] falha inesperada:', err instanceof Error ? err.message : err);
    return json({ erro: 'Falha inesperada no assistente. Tente de novo em instantes.' }, 500);
  }
});

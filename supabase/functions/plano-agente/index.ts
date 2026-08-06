/**
 * POST /functions/v1/plano-agente
 *
 * Um turno de conversa do modulo Plano de Acao.
 *
 * POR QUE ISTO VIVE NO SERVIDOR. A chave da Azure OpenAI nunca pode ir para o
 * navegador: `VITE_*` e embutida no bundle em build-time e `/config.js` e
 * servido publicamente -- os dois caminhos de configuracao do app sao publicos
 * (SPECS 13 e 14). Chave no front = qualquer visitante gastando a cota da FMP.
 *
 * O QUE ESTA FUNCAO GARANTE, e o front nao teria como garantir:
 *   1. a chave nao vaza;
 *   2. quem chama e gestor ou admin ATIVO (reconferido no banco -- `verify_jwt`
 *      diz que o token e valido, nao quem e o dono);
 *   3. todo numero citado no plano existe no snapshot (guarda de numeros);
 *   4. o modelo NAO tem ferramenta de envio: a garantia de "humano aprova" e
 *      arquitetural, nao de prompt;
 *   5. a memoria carregada e so a validada e vigente, filtrada pelo escopo.
 *
 * Segredos esperados (supabase secrets set ...):
 *   AZURE_OPENAI_ENDPOINT    https://<recurso>.openai.azure.com
 *   AZURE_OPENAI_KEY
 *   AZURE_OPENAI_DEPLOYMENT  nome do deployment
 *   AZURE_OPENAI_API_VERSION opcional (padrao 2024-10-21)
 * ou, para OpenAI direto:
 *   OPENAI_API_KEY
 *   OPENAI_MODEL             opcional (padrao gpt-4.1)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const AZURE_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT') ?? '';
const AZURE_KEY = Deno.env.get('AZURE_OPENAI_KEY') ?? '';
const AZURE_DEPLOYMENT = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') ?? '';
const AZURE_API_VERSION = Deno.env.get('AZURE_OPENAI_API_VERSION') ?? '2024-10-21';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
// Conferido no catalogo da OpenAI em 06/08/2026: `gpt-5.6` e o modelo geral e
// `gpt-5.6-terra` a opcao mais barata. Modelo e coisa que muda de nome sozinha
// -- por isso `OPENAI_MODEL` deve ser cadastrado explicitamente no deploy, e
// este padrao serve so para nao quebrar quem esquecer.
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6';

/** Teto por usuario/dia. Conta de LLM sem teto vira surpresa no fim do mes. */
const LIMITE_TURNOS_DIA = 40;
/** Historico enviado ao modelo. Acima disso, o excedente vira resumo. */
const MAX_MENSAGENS_HISTORICO = 20;
/** Voltas de tool-calling antes de desistir. */
const MAX_VOLTAS = 6;

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

// ------------------------------------------------------------------ tipos

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

type MensagemLLM = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

// ------------------------------------------------------------------ prompt

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
1. Todo número que você citar precisa vir de um indicador do snapshot. Você NÃO
   calcula, NÃO estima e NÃO arredonda para um valor "bonito". Um número que não
   está no snapshot é uma invenção, e o turno será rejeitado.
2. Cada ação carrega uma evidência: { dashboard, indicador, valor } — copiada
   exatamente do snapshot.
3. Indicador marcado como amostra pequena NÃO sustenta recomendação de mudança.
   Sinalize a incerteza e proponha medir melhor.
4. Leia as observações do snapshot antes de apontar anomalia: boa parte do que
   parece estranho é regra herdada do Power BI, e apontá-la como problema queima
   sua credibilidade.
5. Se o frescor indicar carga parada, diga isso ANTES de recomendar qualquer coisa.
6. Use a memória institucional recebida. Quando usar, diga qual usou.
7. Você não envia nada para ninguém. Quem comunica é a pessoa, com um clique.

ESTILO
Frases curtas. Voz ativa. Sem "é importante notar", sem "vale destacar", sem
listas de três por hábito. Se não sabe, diga que não sabe.`;

// ------------------------------------------------------------------ ferramentas

const FERRAMENTAS = [
  {
    type: 'function',
    function: {
      name: 'listar_paineis',
      description: 'Lista os painéis disponíveis e o que cada um responde.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ler_painel',
      description:
        'Devolve os números já calculados de um painel: indicadores, séries, filtros ativos, frescor e regras herdadas.',
      parameters: {
        type: 'object',
        properties: { slug: { type: 'string', description: 'Identificador do painel.' } },
        required: ['slug'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_equipe',
      description:
        'Colaboradores ativos da FMP (nome, cargo, área) para atribuir responsável. Não inclui alunos.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
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
            description:
              'UMA frase, em linguagem falada, dizendo o que chamou atenção. Abre a tela.',
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
  },
  {
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
            items: { type: 'integer', minimum: 1, maximum: 12 },
            description: 'Só para sazonalidade recorrente.',
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
  },
] as const;

// ------------------------------------------------------------------ guarda de números

type Falha = { indicador: string; recebido: number | null; esperado: number | null | 'inexistente' };

/**
 * Rejeita plano que cite numero fora do snapshot.
 *
 * Sem esta guarda o modulo produz plano bonito com numero inventado -- o
 * antipadrao 1 do SPECS ("fallback silencioso de dado de negocio"). Com ela,
 * cada acao na tela ganha um selo de evidencia clicavel.
 *
 * Tolerancia relativa de 0,5%: o modelo escreve o numero de volta como texto e
 * pode perder digito de ponto flutuante. Diferenca maior que isso e outro
 * numero, nao arredondamento.
 */
function validaEvidencias(
  plano: { acoes?: Array<{ titulo?: string; evidencia?: { dashboard?: string; indicador?: string; valor?: number | null } }> },
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

// ------------------------------------------------------------------ LLM

async function chamaLLM(mensagens: MensagemLLM[]): Promise<Record<string, unknown>> {
  const corpo = {
    messages: mensagens,
    tools: FERRAMENTAS,
    tool_choice: 'auto',
    temperature: 0.2,
    max_tokens: 2000,
  };

  let url: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (AZURE_ENDPOINT && AZURE_KEY && AZURE_DEPLOYMENT) {
    url = `${AZURE_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;
    headers['api-key'] = AZURE_KEY;
  } else if (OPENAI_KEY) {
    url = 'https://api.openai.com/v1/chat/completions';
    headers.Authorization = `Bearer ${OPENAI_KEY}`;
    (corpo as Record<string, unknown>).model = OPENAI_MODEL;
  } else {
    throw new Error('LLM não configurada nesta função.');
  }

  const resposta = await fetch(url, { method: 'POST', headers, body: JSON.stringify(corpo) });
  if (!resposta.ok) {
    // Le SO o objeto `error` da resposta -- nunca o corpo que enviamos, que
    // carrega trecho do snapshot. `error.message` da OpenAI e diagnostico puro
    // ("The model `x` does not exist") e vale muito mais que "nao respondeu":
    // sem ele, o operador ve uma tela vermelha e nao sabe se e chave, modelo,
    // cota ou rede. Cortado em 300 caracteres.
    let detalhe = '';
    try {
      const erroApi = (await resposta.json()) as { error?: { message?: string; code?: string } };
      detalhe = String(erroApi?.error?.message ?? erroApi?.error?.code ?? '').slice(0, 300);
    } catch {
      // resposta sem JSON: segue só com o status
    }
    console.error(`[plano-agente] LLM respondeu ${resposta.status}: ${detalhe}`);

    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error(`A chave da LLM foi recusada (${resposta.status}). Confira o segredo OPENAI_API_KEY. ${detalhe}`);
    }
    if (resposta.status === 400 || resposta.status === 404) {
      throw new Error(
        `A LLM recusou a chamada (${resposta.status}). Quase sempre é o nome do modelo — confira OPENAI_MODEL (ou AZURE_OPENAI_DEPLOYMENT). ${detalhe}`,
      );
    }
    if (resposta.status === 429) {
      throw new Error('A LLM está sem cota ou no limite de uso. Confira o saldo da conta.');
    }
    throw new Error(`O assistente não respondeu (${resposta.status}). ${detalhe}`);
  }
  return (await resposta.json()) as Record<string, unknown>;
}

// ------------------------------------------------------------------ handler

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);

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
  if (!perfil?.ativo) return json({ erro: 'Acesso não autorizado.' }, 403);

  const mensagem = String(corpo.mensagem ?? '').trim();
  if (!mensagem) return json({ erro: 'Escreva alguma coisa para o assistente.' }, 400);
  if (mensagem.length > 4000) return json({ erro: 'Mensagem longa demais.' }, 400);

  const contexto = (corpo.contexto ?? {}) as { slug_ativo?: string; snapshots?: Record<string, Snapshot> };
  const snapshots = contexto.snapshots ?? {};
  const slugAtivo = String(contexto.slug_ativo ?? Object.keys(snapshots)[0] ?? '');
  const snapAtivo = snapshots[slugAtivo];
  if (!snapAtivo) return json({ erro: 'Nenhum painel foi enviado para leitura.' }, 400);

  // ---- limite diário -------------------------------------------------
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const { count: turnosHoje } = await admin
    .schema('plano')
    .from('mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('papel', 'user')
    .gte('criado_em', inicioDoDia.toISOString());
  if ((turnosHoje ?? 0) > LIMITE_TURNOS_DIA * 20) {
    return json({ erro: 'Limite de uso do assistente atingido por hoje.' }, 429);
  }

  // ---- memória no escopo ---------------------------------------------
  // Filtro determinístico pelas dimensões do próprio snapshot: dá para mostrar
  // ao usuário exatamente o que entrou. Ver arquitetura §5.3.1.
  const { data: memorias } = await admin.rpc('plano_memoria_no_escopo', {
    p_dashboard: slugAtivo,
    p_produto: snapAtivo.recorte.produto ?? null,
    p_indicadores: snapAtivo.indicadores.map((i) => i.chave),
    p_areas: null,
    p_mes: snapAtivo.recorte.mesReferencia ?? null,
  });
  const memoriaLista = (memorias ?? []) as Memoria[];

  // ---- histórico ------------------------------------------------------
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

  // ---- montagem do contexto ------------------------------------------
  const blocoMemoria = memoriaLista.length
    ? `O que a equipe já te ensinou e vale para este recorte:\n${memoriaLista
        .map((m) => `- [${m.id}] (${m.tipo}) ${m.conteudo}`)
        .join('\n')}`
    : 'A equipe ainda não te ensinou nada que se aplique a este recorte.';

  const mensagens: MensagemLLM[] = [
    { role: 'system', content: SISTEMA },
    {
      role: 'system',
      content:
        `Hoje é ${new Date().toLocaleDateString('pt-BR')}. Quem fala com você é ${perfil.nome_completo}.\n\n` +
        `Painel aberto agora: ${snapAtivo.titulo} (${slugAtivo}), recorte "${snapAtivo.recorte.descricao}".\n` +
        `Use ler_painel para ver os números. Painéis disponíveis: ${Object.keys(snapshots).join(', ')}.\n\n` +
        blocoMemoria,
    },
    ...historico,
    { role: 'user', content: mensagem },
  ];

  // ---- laço de tool-calling -------------------------------------------
  let planoProposto: unknown = null;
  let memoriaProposta: unknown = null;
  let textoFinal = '';
  const memoriasUsadas = new Set<string>();

  for (let volta = 0; volta < MAX_VOLTAS; volta++) {
    let resposta: Record<string, unknown>;
    try {
      resposta = await chamaLLM(mensagens);
    } catch (err) {
      return json({ erro: err instanceof Error ? err.message : 'Falha no assistente.' }, 502);
    }

    const escolha = (resposta.choices as Array<Record<string, unknown>> | undefined)?.[0];
    const msg = escolha?.message as MensagemLLM | undefined;
    if (!msg) return json({ erro: 'Resposta vazia do assistente.' }, 502);

    mensagens.push(msg);
    const chamadas = msg.tool_calls ?? [];

    if (chamadas.length === 0) {
      textoFinal = msg.content ?? '';
      break;
    }

    for (const chamada of chamadas) {
      const nome = chamada.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(chamada.function.arguments || '{}');
      } catch {
        /* argumento malformado cai no default abaixo */
      }
      let resultado: unknown;

      if (nome === 'listar_paineis') {
        resultado = Object.values(snapshots).map((s) => ({
          slug: s.slug,
          titulo: s.titulo,
          recorte: s.recorte.descricao,
        }));
      } else if (nome === 'ler_painel') {
        // Resolve do payload que o cliente mandou. A funcao NUNCA consulta
        // tabela de negocio: a regra de calculo vive no navegador, e recalcular
        // aqui produziria numero diferente do que esta na tela.
        const s = snapshots[String(args.slug ?? '')];
        resultado = s ?? { erro: 'Painel não disponível nesta conversa.' };
      } else if (nome === 'listar_equipe') {
        const { data } = await admin.rpc('equipe');
        resultado = data ?? [];
      } else if (nome === 'propor_plano') {
        const falhas = validaEvidencias(args as never, snapshots);
        if (falhas.length > 0) {
          // Devolve ao modelo para corrigir, em vez de aceitar numero inventado.
          resultado = {
            aceito: false,
            erro: 'Números divergentes do painel. Corrija usando exatamente o valor do indicador.',
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

  // ---- persistência do turno -------------------------------------------
  if (conversaId) {
    await admin
      .schema('plano')
      .from('mensagens')
      .insert([
        { conversa_id: conversaId, papel: 'user', conteudo: { texto: mensagem } },
        { conversa_id: conversaId, papel: 'assistant', conteudo: { texto: textoFinal } },
      ]);
  }

  // Contabiliza uso da memoria: memoria nunca usada em 6 meses e candidata a
  // remocao; memoria muito usada e candidata a virar regra de codigo.
  for (const id of memoriasUsadas) {
    try {
      await admin.rpc('plano_memoria_incrementa_uso', { p_id: id });
    } catch {
      // Contador é telemetria, não regra: falhar aqui não pode derrubar o turno.
    }
  }

  return json({
    conversa_id: conversaId,
    resposta: textoFinal,
    plano: planoProposto,
    memoria_proposta: memoriaProposta,
    memorias_consideradas: memoriaLista.map((m) => ({
      id: m.id,
      conteudo: m.conteudo,
      tipo: m.tipo,
    })),
  });
});

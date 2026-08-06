/**
 * Acesso ao módulo Plano de Ação.
 *
 * Todo tráfego com a Edge Function passa por aqui — nada de `fetch` avulso em
 * componente (SPECS §6.3), mesmo padrão do `authService`.
 */

import { supabase } from '@/lib/supabase';
import { leConfig } from '@/lib/runtimeConfig';
import type { DashboardSnapshot } from '@/lib/snapshotTypes';

const URL_FUNCOES = `${leConfig('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL).valor}/functions/v1`;
const ANON = leConfig('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY).valor;

/**
 * Um pouco acima do teto da Edge Function (150s no plano Free): assim o erro
 * que o usuário vê é o nosso, com texto, e não um corte da plataforma.
 */
const TIMEOUT_MS = 160_000;

export class ErroPlano extends Error {
  readonly status: number;
  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = 'ErroPlano';
    this.status = status;
  }
}

export type JanelaAcao = 'esta_semana' | 'proximas_semanas' | 'quando_der';

export type EvidenciaAcao = {
  dashboard: string;
  indicador: string;
  valor: number | null;
};

export type AcaoProposta = {
  titulo: string;
  descricao: string;
  area: string;
  responsavel_nome?: string;
  janela: JanelaAcao;
  esforco_horas?: number;
  evidencia: EvidenciaAcao;
  memoria_id?: string | null;
};

export type PlanoProposto = {
  titulo: string;
  resumo: string;
  alerta?: string;
  acoes: AcaoProposta[];
};

export type MemoriaProposta = {
  tipo:
    | 'sazonalidade'
    | 'processo'
    | 'hierarquia'
    | 'correcao'
    | 'licao_aprendida'
    | 'restricao'
    | 'glossario';
  conteudo: string;
  dashboard_slug?: string | null;
  produto?: string | null;
  indicador?: string | null;
  area?: string | null;
  meses?: number[] | null;
  vigente_ate?: string | null;
};

export type RespostaAgente = {
  conversa_id: string | null;
  resposta: string;
  plano: PlanoProposto | null;
  memoria_proposta: MemoriaProposta | null;
  /** O que o agente carregou de memória — a tela mostra isso ao usuário. */
  memorias_consideradas: Array<{ id: string; conteudo: string; tipo: string }>;
};

export type Colega = {
  id: string;
  nome_completo: string;
  cargo: string | null;
  area: string | null;
};

async function chamaFuncao<T>(nome: string, corpo: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ErroPlano('Sessão expirada. Entre novamente.', 401);

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_FUNCOES}/${nome}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(corpo),
      // Sem teto, a plataforma mata a requisição por conta própria e devolve
      // uma resposta SEM corpo — o usuário fica no spinner até lá e depois
      // recebe uma mensagem genérica. Melhor cortar antes e dizer o que houve.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const tipo = err instanceof Error ? err.name : '';
    if (tipo === 'TimeoutError' || tipo === 'AbortError') {
      throw new ErroPlano('O assistente demorou demais para responder. Tente de novo.', 408);
    }
    throw new ErroPlano('Não foi possível falar com o servidor. Verifique a conexão.', 0);
  }

  let dados: unknown = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    const mensagem =
      (dados as { erro?: string } | null)?.erro ?? 'Não foi possível concluir a operação.';
    throw new ErroPlano(mensagem, resposta.status);
  }

  return dados as T;
}

/**
 * Um turno de conversa. Os snapshots viajam do cliente: o painel já tem os
 * números em memória, e é assim que o agente enxerga exatamente o que o gestor
 * está vendo.
 */
export function conversa(entrada: {
  mensagem: string;
  slugAtivo: string;
  snapshots: Record<string, DashboardSnapshot>;
  conversaId?: string | null;
}): Promise<RespostaAgente> {
  return chamaFuncao<RespostaAgente>('plano-agente', {
    conversa_id: entrada.conversaId ?? null,
    mensagem: entrada.mensagem,
    contexto: { slug_ativo: entrada.slugAtivo, snapshots: entrada.snapshots },
  });
}

/**
 * Equipe ativa para atribuir responsável.
 *
 * Vem da função `public.equipe()` (SECURITY DEFINER) e não de um SELECT em
 * `perfis`: a policy de `perfis` só deixa o usuário ver a si mesmo, e relaxá-la
 * exporia e-mail e papel de todo mundo.
 */
export async function listaEquipe(): Promise<Colega[]> {
  const { data, error } = await supabase.rpc('equipe');
  if (error) throw new ErroPlano('Não foi possível carregar a equipe.', 500);
  return (data ?? []) as Colega[];
}

/**
 * Grava a memória que a pessoa confirmou na tela.
 *
 * Sempre entra como `proposta` — a policy do banco recusa qualquer outra coisa
 * no INSERT. A promoção para `validada` é um UPDATE separado, feito por quem
 * tem alcance para isso (arquitetura §5.3.5).
 */
export async function guardaMemoria(
  memoria: MemoriaProposta,
  ensinadoPor: string,
): Promise<string> {
  const { data, error } = await supabase
    .schema('plano')
    .from('memoria')
    .insert({ ...memoria, origem: 'llm', ensinado_por: ensinadoPor, status: 'proposta' })
    .select('id')
    .single();
  if (error) throw new ErroPlano('Não foi possível guardar esse contexto.', 400);
  return (data as { id: string }).id;
}

/** Promove a memória para valendo. O banco carimba quem validou e quando. */
export async function validaMemoria(id: string): Promise<void> {
  const { error } = await supabase
    .schema('plano')
    .from('memoria')
    .update({ status: 'validada' })
    .eq('id', id);
  if (error) throw new ErroPlano('Você não tem alcance para confirmar esta memória.', 403);
}

import { supabase } from '@/lib/supabase';
import { leConfig } from '@/lib/runtimeConfig';

/**
 * Camada de acesso à autenticação. Fala com as Edge Functions (rotas de API)
 * e mantém a sessão dentro do supabase-js, que se encarrega de anexar o token
 * a cada consulta e de renová-lo antes de expirar.
 */

export type Papel = 'admin' | 'gestor';

export type Perfil = {
  id: string;
  codusuario: string;
  nome_completo: string;
  cargo: string | null;
  papel: Papel;
  ativo: boolean;
  email_contato: string | null;
  criado_em?: string;
  atualizado_em?: string;
};

const URL_FUNCOES = `${leConfig('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL).valor}/functions/v1`;
const ANON = leConfig('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY).valor;

/** Erro com a mensagem que veio da API, para exibir direto ao usuário. */
export class ErroApi extends Error {
  readonly status: number;
  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
  }
}

async function chamaFuncao<T>(
  nome: string,
  corpo: unknown,
  opcoes: { autenticado?: boolean } = {},
): Promise<T> {
  const cabecalhos: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: ANON,
  };

  if (opcoes.autenticado) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ErroApi('Sessão expirada. Entre novamente.', 401);
    cabecalhos.Authorization = `Bearer ${token}`;
  } else {
    // A rota de login não exige token, mas o gateway das Edge Functions ainda
    // pede a apikey no cabeçalho Authorization quando não há sessão.
    cabecalhos.Authorization = `Bearer ${ANON}`;
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_FUNCOES}/${nome}`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi('Não foi possível falar com o servidor. Verifique a conexão.', 0);
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
    throw new ErroApi(mensagem, resposta.status);
  }

  return dados as T;
}

type RespostaLogin = {
  session: { access_token: string; refresh_token: string };
  perfil: Perfil;
};

export async function entrar(codusuario: string, senha: string): Promise<Perfil> {
  const { session, perfil } = await chamaFuncao<RespostaLogin>('auth-login', {
    codusuario,
    senha,
  });

  // Instala a sessão no supabase-js: a partir daqui toda consulta ao banco vai
  // assinada como este usuário (é o que as políticas de RLS enxergam).
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw new ErroApi('Não foi possível iniciar a sessão.', 500);

  return perfil;
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut();
}

/** Perfil do usuário da sessão atual, ou null se não houver sessão válida. */
export async function carregaPerfilAtual(): Promise<Perfil | null> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) return null;

  const { data: perfil, error } = await supabase
    .from('perfis')
    .select('id, codusuario, nome_completo, cargo, papel, ativo, email_contato, criado_em, atualizado_em')
    .eq('id', id)
    .maybeSingle();

  if (error || !perfil) return null;
  // Desativado depois de logado: a sessão perde a validade na prática.
  if (!perfil.ativo) {
    await sair();
    return null;
  }
  return perfil as Perfil;
}

/** Atualiza os próprios dados. `codusuario` é imutável (bloqueado por trigger). */
export async function atualizaMeuPerfil(
  id: string,
  campos: { nome_completo: string; cargo: string | null; email_contato: string | null },
): Promise<Perfil> {
  const { data, error } = await supabase
    .from('perfis')
    .update(campos)
    .eq('id', id)
    .select('id, codusuario, nome_completo, cargo, papel, ativo, email_contato, criado_em, atualizado_em')
    .single();

  if (error) throw new ErroApi(error.message, 400);
  return data as Perfil;
}

export async function trocaMinhaSenha(senhaAtual: string, novaSenha: string): Promise<void> {
  await chamaFuncao('minha-senha', { senha_atual: senhaAtual, nova_senha: novaSenha }, {
    autenticado: true,
  });
}

// ---------------------------------------------------------------- admin

export async function listaUsuarios(): Promise<Perfil[]> {
  const { usuarios } = await chamaFuncao<{ usuarios: Perfil[] }>(
    'usuarios-admin',
    { acao: 'listar' },
    { autenticado: true },
  );
  return usuarios;
}

export async function criaUsuario(dados: {
  codusuario: string;
  nome_completo: string;
  cargo: string | null;
  email_contato: string | null;
  papel: Papel;
  senha?: string;
}): Promise<{ id: string; codusuario: string; senha_inicial: string }> {
  return chamaFuncao('usuarios-admin', { acao: 'criar', ...dados }, { autenticado: true });
}

export async function atualizaUsuario(
  id: string,
  campos: Partial<Pick<Perfil, 'nome_completo' | 'cargo' | 'email_contato' | 'papel' | 'ativo'>>,
): Promise<void> {
  await chamaFuncao('usuarios-admin', { acao: 'atualizar', id, ...campos }, { autenticado: true });
}

export async function redefineSenha(id: string, senha?: string): Promise<string> {
  const { senha_nova } = await chamaFuncao<{ senha_nova: string }>(
    'usuarios-admin',
    { acao: 'definir_senha', id, senha },
    { autenticado: true },
  );
  return senha_nova;
}

export async function removeUsuario(id: string): Promise<void> {
  await chamaFuncao('usuarios-admin', { acao: 'remover', id }, { autenticado: true });
}

/** Sugere `nome.sobrenome` a partir do nome completo, sem acento nem símbolo. */
export function sugereCodusuario(nomeCompleto: string): string {
  const partes = nomeCompleto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  return `${partes[0]}.${partes[partes.length - 1]}`;
}

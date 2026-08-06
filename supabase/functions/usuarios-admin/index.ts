/**
 * POST /functions/v1/usuarios-admin
 *
 * Gestao de usuarios, restrita a quem tem papel 'admin'. Recebe
 * { acao, ...dados } e despacha para a operacao correspondente:
 *
 *   listar        -> todos os perfis
 *   criar         -> cria em auth.users + perfis, devolve a senha inicial
 *   atualizar     -> nome, cargo, e-mail de contato, papel e ativo
 *   definir_senha -> reset de senha de outro usuario
 *   remover       -> apaga o usuario (perfis cai junto, por cascade)
 *
 * Estas operacoes escrevem em auth.users, o que exige service role -- por isso
 * vivem aqui e nao no navegador. O papel do chamador e sempre reconferido no
 * banco: `verify_jwt` garante que o token e valido, nao que quem chama e admin.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TAMANHO_MINIMO_SENHA = 10;
const PADRAO_CODUSUARIO = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;

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

/** Alfabeto sem caracteres ambiguos (0/O, 1/l/I): a senha inicial costuma ser
 *  repassada por telefone ou mensagem, e o operador precisa conseguir ditar. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function geraSenha(tamanho = 14): string {
  const bytes = new Uint32Array(tamanho);
  crypto.getRandomValues(bytes);
  let saida = '';
  for (let i = 0; i < tamanho; i++) saida += ALFABETO[bytes[i] % ALFABETO.length];
  return saida;
}

function texto(v: unknown): string {
  return String(v ?? '').trim();
}

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

  const { data: perfilChamador } = await admin
    .from('perfis')
    .select('papel, ativo')
    .eq('id', idChamador)
    .maybeSingle();

  if (!perfilChamador?.ativo || perfilChamador.papel !== 'admin') {
    return json({ erro: 'Acesso restrito a administradores.' }, 403);
  }

  const acao = texto(corpo.acao);

  if (acao === 'listar') {
    const { data, error } = await admin
      .from('perfis')
      .select('id, codusuario, nome_completo, cargo, papel, ativo, email_contato, criado_em, atualizado_em')
      .order('papel', { ascending: true })
      .order('nome_completo', { ascending: true });
    if (error) return json({ erro: 'Falha ao listar usuários.' }, 500);
    return json({ usuarios: data });
  }

  if (acao === 'criar') {
    const codusuario = texto(corpo.codusuario).toLowerCase();
    const nome = texto(corpo.nome_completo);
    const cargo = texto(corpo.cargo) || null;
    const emailContato = texto(corpo.email_contato) || null;
    const papel = texto(corpo.papel) || 'gestor';
    const senha = texto(corpo.senha) || geraSenha();

    if (!PADRAO_CODUSUARIO.test(codusuario)) {
      return json({ erro: 'Usuário deve seguir o padrão nome.sobrenome (minúsculas, sem acento).' }, 400);
    }
    if (!nome) return json({ erro: 'Informe o nome completo.' }, 400);
    if (papel !== 'admin' && papel !== 'gestor') return json({ erro: 'Papel inválido.' }, 400);
    if (senha.length < TAMANHO_MINIMO_SENHA) {
      return json({ erro: `A senha precisa ter ao menos ${TAMANHO_MINIMO_SENHA} caracteres.` }, 400);
    }

    const { data: jaExiste } = await admin
      .from('perfis')
      .select('id')
      .eq('codusuario', codusuario)
      .maybeSingle();
    if (jaExiste) return json({ erro: 'Já existe um usuário com esse login.' }, 409);

    const { data: novoId, error } = await admin.rpc('admin_criar_usuario', {
      p_codusuario: codusuario,
      p_nome_completo: nome,
      p_cargo: cargo,
      p_papel: papel,
      p_senha: senha,
      p_email_contato: emailContato,
    });
    if (error) return json({ erro: 'Não foi possível criar o usuário.', detalhe: error.message }, 500);

    // Unica vez em que a senha trafega de volta: o admin precisa repassa-la.
    // Depois disso so existe o hash no banco.
    return json({ id: novoId, codusuario, senha_inicial: senha });
  }

  if (acao === 'atualizar') {
    const id = texto(corpo.id);
    if (!id) return json({ erro: 'Informe o usuário.' }, 400);

    const campos: Record<string, unknown> = {};
    if (corpo.nome_completo !== undefined) {
      const nome = texto(corpo.nome_completo);
      if (!nome) return json({ erro: 'O nome completo não pode ficar vazio.' }, 400);
      campos.nome_completo = nome;
    }
    if (corpo.cargo !== undefined) campos.cargo = texto(corpo.cargo) || null;
    if (corpo.email_contato !== undefined) campos.email_contato = texto(corpo.email_contato) || null;
    if (corpo.papel !== undefined) {
      const papel = texto(corpo.papel);
      if (papel !== 'admin' && papel !== 'gestor') return json({ erro: 'Papel inválido.' }, 400);
      campos.papel = papel;
    }
    if (corpo.ativo !== undefined) campos.ativo = Boolean(corpo.ativo);

    if (Object.keys(campos).length === 0) return json({ erro: 'Nada para atualizar.' }, 400);

    // Trava anti-lockout: o admin nao pode rebaixar nem desativar a si mesmo, o
    // que deixaria a plataforma sem ninguem capaz de gerir usuarios.
    if (id === idChamador && (campos.papel === 'gestor' || campos.ativo === false)) {
      return json({ erro: 'Você não pode remover o próprio acesso de administrador.' }, 400);
    }

    const { error } = await admin.from('perfis').update(campos).eq('id', id);
    if (error) return json({ erro: 'Não foi possível atualizar o usuário.', detalhe: error.message }, 500);
    return json({ ok: true });
  }

  if (acao === 'definir_senha') {
    const id = texto(corpo.id);
    if (!id) return json({ erro: 'Informe o usuário.' }, 400);
    const senha = texto(corpo.senha) || geraSenha();
    if (senha.length < TAMANHO_MINIMO_SENHA) {
      return json({ erro: `A senha precisa ter ao menos ${TAMANHO_MINIMO_SENHA} caracteres.` }, 400);
    }

    const { error } = await admin.rpc('admin_definir_senha', { p_id: id, p_senha: senha });
    if (error) return json({ erro: 'Não foi possível redefinir a senha.' }, 500);
    return json({ ok: true, senha_nova: senha });
  }

  if (acao === 'remover') {
    const id = texto(corpo.id);
    if (!id) return json({ erro: 'Informe o usuário.' }, 400);
    if (id === idChamador) return json({ erro: 'Você não pode remover a própria conta.' }, 400);

    const { count } = await admin
      .from('perfis')
      .select('id', { count: 'exact', head: true })
      .eq('papel', 'admin')
      .eq('ativo', true);
    const { data: alvo } = await admin.from('perfis').select('papel').eq('id', id).maybeSingle();
    if (alvo?.papel === 'admin' && (count ?? 0) <= 1) {
      return json({ erro: 'Não é possível remover o último administrador.' }, 400);
    }

    const { error } = await admin.rpc('admin_remover_usuario', { p_id: id });
    if (error) return json({ erro: 'Não foi possível remover o usuário.' }, 500);
    return json({ ok: true });
  }

  return json({ erro: 'Ação desconhecida.' }, 400);
});

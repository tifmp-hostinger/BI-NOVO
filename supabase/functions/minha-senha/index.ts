/**
 * POST /functions/v1/minha-senha
 *
 * Troca da propria senha. Recebe { senha_atual, nova_senha } e exige um token
 * valido (verify_jwt ligado).
 *
 * Por que nao usar supabase.auth.updateUser({ password }) direto do front:
 * aquele fluxo troca a senha sem pedir a senha atual, entao uma sessao deixada
 * aberta em maquina compartilhada permitiria a qualquer um trocar a senha e
 * tomar a conta. Aqui a senha atual e sempre conferida antes.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TAMANHO_MINIMO_SENHA = 10;

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não suportado.' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ erro: 'Sessão ausente.' }, 401);

  let corpo: { senha_atual?: unknown; nova_senha?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'Corpo da requisição inválido.' }, 400);
  }

  const senhaAtual = String(corpo?.senha_atual ?? '');
  const novaSenha = String(corpo?.nova_senha ?? '');

  if (!senhaAtual || !novaSenha) {
    return json({ erro: 'Informe a senha atual e a nova senha.' }, 400);
  }
  if (novaSenha.length < TAMANHO_MINIMO_SENHA) {
    return json({ erro: `A nova senha precisa ter ao menos ${TAMANHO_MINIMO_SENHA} caracteres.` }, 400);
  }
  if (novaSenha === senhaAtual) {
    return json({ erro: 'A nova senha precisa ser diferente da atual.' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usuario, error: erroUsuario } = await admin.auth.getUser(token);
  if (erroUsuario || !usuario?.user) return json({ erro: 'Sessão inválida ou expirada.' }, 401);

  const id = usuario.user.id;

  const { data: perfil } = await admin
    .from('perfis')
    .select('ativo')
    .eq('id', id)
    .maybeSingle();
  if (!perfil?.ativo) return json({ erro: 'Usuário desativado.' }, 403);

  const { data: confere, error: erroConfere } = await admin.rpc('senha_confere', {
    p_id: id,
    p_senha: senhaAtual,
  });
  if (erroConfere) return json({ erro: 'Falha ao validar a senha atual.' }, 500);
  if (confere !== true) return json({ erro: 'Senha atual incorreta.' }, 401);

  const { error: erroTroca } = await admin.rpc('admin_definir_senha', {
    p_id: id,
    p_senha: novaSenha,
  });
  if (erroTroca) return json({ erro: 'Não foi possível alterar a senha.' }, 500);

  return json({ ok: true });
});

/**
 * POST /functions/v1/auth-login
 *
 * Rota de login da plataforma. Recebe { codusuario, senha } e devolve a sessao
 * do Supabase Auth junto com o perfil do usuario.
 *
 * Por que existe, em vez de o front chamar signInWithPassword direto:
 *  - o login da plataforma e por `codusuario` (nome.sobrenome); o e-mail interno
 *    (<codusuario>@bi.fmp.local) e um detalhe de implementacao do Supabase Auth
 *    e nao deve vazar para a interface;
 *  - usuario desativado e barrado ANTES de qualquer token ser emitido;
 *  - devolve sessao e perfil em uma unica chamada.
 *
 * `verify_jwt` fica desabilitado por definicao: e o endpoint que emite o token,
 * entao nao pode exigir um token previo.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Precisa acompanhar public.email_interno() no banco. */
const DOMINIO_INTERNO = '@bi.fmp.local';

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

  let corpo: { codusuario?: unknown; senha?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'Corpo da requisição inválido.' }, 400);
  }

  const codusuario = String(corpo?.codusuario ?? '').trim().toLowerCase();
  const senha = String(corpo?.senha ?? '');

  if (!codusuario || !senha) {
    return json({ erro: 'Informe usuário e senha.' }, 400);
  }

  // Mensagem unica para "usuario nao existe" e "senha errada": mensagens
  // distintas permitiriam descobrir quais logins existem por tentativa e erro.
  const GENERICA = { erro: 'Usuário ou senha incorretos.' };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: perfil, error: erroPerfil } = await admin
    .from('perfis')
    .select('id, codusuario, nome_completo, cargo, papel, ativo, email_contato')
    .eq('codusuario', codusuario)
    .maybeSingle();

  if (erroPerfil) return json({ erro: 'Falha ao consultar o usuário.' }, 500);
  if (!perfil) return json(GENERICA, 401);
  if (!perfil.ativo) {
    return json({ erro: 'Usuário desativado. Procure o administrador.' }, 403);
  }

  const publico = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await publico.auth.signInWithPassword({
    email: `${codusuario}${DOMINIO_INTERNO}`,
    password: senha,
  });

  if (error || !data?.session) return json(GENERICA, 401);

  return json({ session: data.session, perfil });
});

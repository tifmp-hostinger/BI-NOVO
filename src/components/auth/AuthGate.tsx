import { useState, type FormEvent, type ReactNode } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FmpMarca } from '@/components/brand/FmpLogo';

/**
 * Porta de entrada da plataforma: sem sessão válida, nada além desta tela é
 * montado. A checagem real de acesso está nas políticas de RLS do banco — esta
 * tela é a interface daquela regra, não a regra em si.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { perfil, carregando, entrarComo } = useAuth();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-xs font-medium uppercase tracking-widest text-ink-3">Carregando…</p>
      </div>
    );
  }

  if (perfil) return <>{children}</>;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Lê do formulário, não do estado: gerenciadores de senha preenchem o campo
    // sem disparar onChange em alguns navegadores.
    const form = new FormData(e.currentTarget);
    const codusuario = String(form.get('codusuario') ?? '').trim();
    const senha = String(form.get('senha') ?? '');

    if (!codusuario || !senha) {
      setErro('Informe usuário e senha.');
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      await entrarComo(codusuario, senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <FmpMarca className="h-12" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-md border border-line bg-white p-8 shadow-card"
        >
          <h1 className="text-base font-semibold text-ink">Central de Dashboards</h1>
          <p className="mt-1 text-xs text-ink-3">
            Acesso restrito. Entre com seu usuário institucional.
          </p>

          <label htmlFor="codusuario" className="mb-1 mt-6 block text-xs font-medium text-ink-2">
            Usuário
          </label>
          <input
            id="codusuario"
            name="codusuario"
            placeholder="nome.sobrenome"
            className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-fmp"
            onChange={() => setErro(null)}
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />

          <label htmlFor="senha" className="mb-1 mt-4 block text-xs font-medium text-ink-2">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-fmp"
            onChange={() => setErro(null)}
            autoComplete="current-password"
          />

          {erro && (
            <p role="alert" className="mt-4 rounded-sm bg-fmp-muted px-3 py-2 text-xs text-fmp">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-pill bg-fmp py-2.5 text-sm font-medium text-white transition-all hover:bg-fmp-dark disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="mt-5 text-center text-2xs text-ink-3">
            Esqueceu a senha? Procure o administrador da plataforma.
          </p>
        </form>
      </div>
    </div>
  );
}

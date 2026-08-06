import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuth } from '@/contexts/AuthContext';
import {
  atualizaUsuario,
  criaUsuario,
  listaUsuarios,
  redefineSenha,
  removeUsuario,
  sugereCodusuario,
  type Papel,
  type Perfil,
} from '@/lib/authService';

const CLASSE_CAMPO =
  'w-full rounded-sm border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-fmp disabled:bg-paper disabled:text-ink-3';

/**
 * Senha exibida uma única vez. Depois de fechado este aviso não há como
 * recuperá-la: o banco guarda só o hash. É o mesmo motivo pelo qual o texto
 * insiste em copiar antes de sair.
 */
function AvisoSenha({
  titulo,
  codusuario,
  senha,
  onFechar,
}: {
  titulo: string;
  codusuario: string;
  senha: string;
  onFechar: () => void;
}) {
  return (
    <div className="mb-4 rounded-md border border-warning/40 bg-warning-light px-4 py-3">
      <p className="text-xs font-semibold text-warning-dark">{titulo}</p>
      <p className="mt-1 text-2xs text-warning-dark">
        Copie agora e repasse ao usuário — esta senha não poderá ser vista novamente.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-sm bg-white px-2 py-1 text-xs text-ink">{codusuario}</code>
        <code className="rounded-sm bg-white px-2 py-1 text-xs font-semibold text-ink">
          {senha}
        </code>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(senha)}
          className="rounded-pill border border-warning-dark/30 px-3 py-1 text-2xs text-warning-dark hover:bg-white"
        >
          Copiar senha
        </button>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-pill px-3 py-1 text-2xs text-warning-dark underline"
        >
          Já copiei
        </button>
      </div>
    </div>
  );
}

function FormularioNovoUsuario({
  onCriado,
  onErro,
}: {
  onCriado: (r: { codusuario: string; senha_inicial: string }) => void;
  onErro: (m: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [cod, setCod] = useState('');
  const [codEditado, setCodEditado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Enquanto o admin não editar o campo manualmente, o login acompanha o nome.
  const codSugerido = codEditado ? cod : sugereCodusuario(nome);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setEnviando(true);
    try {
      const r = await criaUsuario({
        codusuario: codSugerido,
        nome_completo: nome,
        cargo: String(form.get('cargo') ?? '').trim() || null,
        email_contato: String(form.get('email_contato') ?? '').trim() || null,
        papel: (String(form.get('papel') ?? 'gestor') as Papel),
      });
      formEl.reset();
      setNome('');
      setCod('');
      setCodEditado(false);
      onCriado(r);
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível criar o usuário.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="novo-nome" className="mb-1 block text-xs font-medium text-ink-2">
          Nome completo
        </label>
        <input
          id="novo-nome"
          className={CLASSE_CAMPO}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="novo-cod" className="mb-1 block text-xs font-medium text-ink-2">
          Usuário (login)
        </label>
        <input
          id="novo-cod"
          className={CLASSE_CAMPO}
          value={codSugerido}
          onChange={(e) => {
            setCodEditado(true);
            setCod(e.target.value.toLowerCase());
          }}
          placeholder="nome.sobrenome"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <p className="mt-1 text-2xs text-ink-3">Padrão nome.sobrenome. Não pode ser alterado depois.</p>
      </div>

      <div>
        <label htmlFor="novo-cargo" className="mb-1 block text-xs font-medium text-ink-2">
          Cargo
        </label>
        <input id="novo-cargo" name="cargo" className={CLASSE_CAMPO} />
      </div>

      <div>
        <label htmlFor="novo-email" className="mb-1 block text-xs font-medium text-ink-2">
          E-mail de contato
        </label>
        <input
          id="novo-email"
          name="email_contato"
          type="email"
          className={CLASSE_CAMPO}
          placeholder="opcional"
        />
      </div>

      <div>
        <label htmlFor="novo-papel" className="mb-1 block text-xs font-medium text-ink-2">
          Papel
        </label>
        <select id="novo-papel" name="papel" className={CLASSE_CAMPO} defaultValue="gestor">
          <option value="gestor">Gestor — acessa os dashboards</option>
          <option value="admin">Administrador — também gerencia usuários</option>
        </select>
      </div>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={enviando || !nome || !codSugerido}
          className="flex items-center gap-2 rounded-pill bg-fmp px-4 py-2 text-xs font-medium text-white transition-all hover:bg-fmp-dark disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          {enviando ? 'Criando…' : 'Criar usuário'}
        </button>
      </div>
    </form>
  );
}

function LinhaUsuario({
  usuario,
  souEu,
  onMudou,
  onErro,
  onSenha,
}: {
  usuario: Perfil;
  souEu: boolean;
  onMudou: () => void;
  onErro: (m: string) => void;
  onSenha: (r: { codusuario: string; senha_inicial: string }) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function executa(acao: () => Promise<void>) {
    setOcupado(true);
    try {
      await acao();
      onMudou();
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Operação não concluída.');
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await executa(async () => {
      await atualizaUsuario(usuario.id, {
        nome_completo: String(form.get('nome_completo') ?? '').trim(),
        cargo: String(form.get('cargo') ?? '').trim() || null,
        email_contato: String(form.get('email_contato') ?? '').trim() || null,
        papel: String(form.get('papel') ?? 'gestor') as Papel,
      });
      setEditando(false);
    });
  }

  if (editando) {
    return (
      <tr className="border-t border-line align-top">
        <td colSpan={5} className="px-3 py-3">
          <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
            <input
              name="nome_completo"
              className={CLASSE_CAMPO}
              defaultValue={usuario.nome_completo}
              aria-label="Nome completo"
              required
            />
            <input
              name="cargo"
              className={CLASSE_CAMPO}
              defaultValue={usuario.cargo ?? ''}
              aria-label="Cargo"
              placeholder="Cargo"
            />
            <input
              name="email_contato"
              type="email"
              className={CLASSE_CAMPO}
              defaultValue={usuario.email_contato ?? ''}
              aria-label="E-mail de contato"
              placeholder="E-mail de contato"
            />
            <select
              name="papel"
              className={CLASSE_CAMPO}
              defaultValue={usuario.papel}
              aria-label="Papel"
              disabled={souEu}
            >
              <option value="gestor">Gestor</option>
              <option value="admin">Administrador</option>
            </select>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={ocupado}
                className="rounded-pill bg-fmp px-4 py-1.5 text-xs font-medium text-white hover:bg-fmp-dark disabled:opacity-60"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="rounded-pill border border-line px-4 py-1.5 text-xs text-ink-2 hover:bg-paper"
              >
                Cancelar
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2.5">
        <p className="text-xs font-medium text-ink">{usuario.nome_completo}</p>
        <code className="text-2xs text-ink-3">{usuario.codusuario}</code>
      </td>
      <td className="px-3 py-2.5 text-xs text-ink-2">{usuario.cargo ?? '—'}</td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-medium ${
            usuario.papel === 'admin' ? 'bg-fmp-muted text-fmp' : 'bg-paper text-ink-2'
          }`}
        >
          {usuario.papel === 'admin' && <ShieldCheck className="h-3 w-3" />}
          {usuario.papel === 'admin' ? 'Administrador' : 'Gestor'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`text-2xs font-medium ${usuario.ativo ? 'text-success-dark' : 'text-ink-3'}`}
        >
          {usuario.ativo ? 'Ativo' : 'Desativado'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-pill border border-line px-2.5 py-1 text-2xs text-ink-2 hover:bg-paper"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              void executa(async () => {
                const senha = await redefineSenha(usuario.id);
                onSenha({ codusuario: usuario.codusuario, senha_inicial: senha });
              })
            }
            className="flex items-center gap-1 rounded-pill border border-line px-2.5 py-1 text-2xs text-ink-2 hover:bg-paper disabled:opacity-60"
          >
            <KeyRound className="h-3 w-3" /> Nova senha
          </button>
          {!souEu && (
            <>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  void executa(() => atualizaUsuario(usuario.id, { ativo: !usuario.ativo }))
                }
                className="rounded-pill border border-line px-2.5 py-1 text-2xs text-ink-2 hover:bg-paper disabled:opacity-60"
              >
                {usuario.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  const ok = window.confirm(
                    `Remover ${usuario.nome_completo} (${usuario.codusuario})? Esta ação não pode ser desfeita.`,
                  );
                  if (ok) void executa(() => removeUsuario(usuario.id));
                }}
                className="flex items-center gap-1 rounded-pill border border-fmp/30 px-2.5 py-1 text-2xs text-fmp hover:bg-fmp-muted disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" /> Remover
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function UsuariosPage() {
  const { perfil, ehAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaExibida, setSenhaExibida] = useState<
    { codusuario: string; senha_inicial: string } | null
  >(null);

  const carrega = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setUsuarios(await listaUsuarios());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível listar os usuários.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (ehAdmin) void carrega();
    else setCarregando(false);
  }, [ehAdmin, carrega]);

  if (!ehAdmin) {
    return (
      <AppShell title="Usuários" subtitle="Acesso restrito">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <EmptyState
            title="Área restrita a administradores"
            message="Sua conta não tem permissão para gerenciar usuários."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Usuários" subtitle="Quem pode acessar a plataforma">
      <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {senhaExibida && (
          <AvisoSenha
            titulo="Senha gerada"
            codusuario={senhaExibida.codusuario}
            senha={senhaExibida.senha_inicial}
            onFechar={() => setSenhaExibida(null)}
          />
        )}

        <SectionCard title="Novo usuário" subtitle="A senha é gerada automaticamente" icon={Plus} expandable={false}>
          <FormularioNovoUsuario
            onCriado={(r) => {
              setSenhaExibida(r);
              void carrega();
            }}
            onErro={setErro}
          />
        </SectionCard>

        <SectionCard
          title="Usuários cadastrados"
          subtitle={`${usuarios.length} conta(s)`}
          icon={Users}
          expandable={false}
          actions={
            <button
              type="button"
              onClick={() => void carrega()}
              className="flex items-center gap-1 rounded-pill border border-line px-2.5 py-1 text-2xs text-ink-2 hover:bg-paper"
            >
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
          }
        >
          {erro && <ErrorState title="Erro" message={erro} onRetry={() => void carrega()} />}

          {!erro && carregando && (
            <p className="py-6 text-center text-xs text-ink-3">Carregando usuários…</p>
          )}

          {!erro && !carregando && usuarios.length === 0 && (
            <EmptyState title="Nenhum usuário cadastrado" />
          )}

          {!erro && !carregando && usuarios.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-2xs uppercase tracking-widest text-ink-3">
                    <th className="px-3 pb-2 font-medium">Usuário</th>
                    <th className="px-3 pb-2 font-medium">Cargo</th>
                    <th className="px-3 pb-2 font-medium">Papel</th>
                    <th className="px-3 pb-2 font-medium">Situação</th>
                    <th className="px-3 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <LinhaUsuario
                      key={u.id}
                      usuario={u}
                      souEu={u.id === perfil?.id}
                      onMudou={() => void carrega()}
                      onErro={setErro}
                      onSenha={setSenhaExibida}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

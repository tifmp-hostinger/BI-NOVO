import { useState, type FormEvent } from 'react';
import { KeyRound, Save, UserCog } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/contexts/AuthContext';
import { atualizaMeuPerfil, trocaMinhaSenha } from '@/lib/authService';

const TAMANHO_MINIMO_SENHA = 10;

type Aviso = { tipo: 'ok' | 'erro'; texto: string } | null;

function MensagemAviso({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  const estilo =
    aviso.tipo === 'ok'
      ? 'bg-success-light text-success-dark'
      : 'bg-fmp-muted text-fmp';
  return (
    <p role="status" className={`mt-4 rounded-sm px-3 py-2 text-xs ${estilo}`}>
      {aviso.texto}
    </p>
  );
}

const CLASSE_CAMPO =
  'w-full rounded-sm border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-fmp disabled:bg-paper disabled:text-ink-3';

export function MinhaContaPage() {
  const { perfil, atualizaPerfilLocal } = useAuth();

  const [avisoDados, setAvisoDados] = useState<Aviso>(null);
  const [salvandoDados, setSalvandoDados] = useState(false);

  const [avisoSenha, setAvisoSenha] = useState<Aviso>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  if (!perfil) return null;

  async function salvarDados(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!perfil) return;
    const form = new FormData(e.currentTarget);
    const nome = String(form.get('nome_completo') ?? '').trim();
    if (!nome) {
      setAvisoDados({ tipo: 'erro', texto: 'O nome completo não pode ficar vazio.' });
      return;
    }

    setSalvandoDados(true);
    setAvisoDados(null);
    try {
      const atualizado = await atualizaMeuPerfil(perfil.id, {
        nome_completo: nome,
        cargo: String(form.get('cargo') ?? '').trim() || null,
        email_contato: String(form.get('email_contato') ?? '').trim() || null,
      });
      atualizaPerfilLocal(atualizado);
      setAvisoDados({ tipo: 'ok', texto: 'Dados atualizados.' });
    } catch (err) {
      setAvisoDados({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Não foi possível salvar.',
      });
    } finally {
      setSalvandoDados(false);
    }
  }

  async function salvarSenha(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const atual = String(form.get('senha_atual') ?? '');
    const nova = String(form.get('nova_senha') ?? '');
    const confirma = String(form.get('confirma_senha') ?? '');

    if (nova.length < TAMANHO_MINIMO_SENHA) {
      setAvisoSenha({
        tipo: 'erro',
        texto: `A nova senha precisa ter ao menos ${TAMANHO_MINIMO_SENHA} caracteres.`,
      });
      return;
    }
    if (nova !== confirma) {
      setAvisoSenha({ tipo: 'erro', texto: 'A confirmação não confere com a nova senha.' });
      return;
    }

    setSalvandoSenha(true);
    setAvisoSenha(null);
    try {
      await trocaMinhaSenha(atual, nova);
      formEl.reset();
      setAvisoSenha({ tipo: 'ok', texto: 'Senha alterada com sucesso.' });
    } catch (err) {
      setAvisoSenha({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Não foi possível alterar a senha.',
      });
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <AppShell title="Minha conta" subtitle="Seus dados e sua senha de acesso">
      <div className="mx-auto grid max-w-4xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-8">
        <SectionCard title="Meus dados" subtitle="Visíveis para o administrador" icon={UserCog} expandable={false}>
          <form onSubmit={salvarDados}>
            <label htmlFor="conta-usuario" className="mb-1 block text-xs font-medium text-ink-2">
              Usuário
            </label>
            <input
              id="conta-usuario"
              className={CLASSE_CAMPO}
              value={perfil.codusuario}
              disabled
              readOnly
            />
            <p className="mt-1 text-2xs text-ink-3">
              O usuário de login não pode ser alterado. Fale com o administrador se estiver errado.
            </p>

            <label htmlFor="conta-nome" className="mb-1 mt-4 block text-xs font-medium text-ink-2">
              Nome completo
            </label>
            <input
              id="conta-nome"
              name="nome_completo"
              className={CLASSE_CAMPO}
              defaultValue={perfil.nome_completo}
            />

            <label htmlFor="conta-cargo" className="mb-1 mt-4 block text-xs font-medium text-ink-2">
              Cargo
            </label>
            <input
              id="conta-cargo"
              name="cargo"
              className={CLASSE_CAMPO}
              defaultValue={perfil.cargo ?? ''}
            />

            <label htmlFor="conta-email" className="mb-1 mt-4 block text-xs font-medium text-ink-2">
              E-mail de contato
            </label>
            <input
              id="conta-email"
              name="email_contato"
              type="email"
              className={CLASSE_CAMPO}
              defaultValue={perfil.email_contato ?? ''}
              placeholder="opcional"
            />

            <MensagemAviso aviso={avisoDados} />

            <button
              type="submit"
              disabled={salvandoDados}
              className="mt-5 flex items-center gap-2 rounded-pill bg-fmp px-4 py-2 text-xs font-medium text-white transition-all hover:bg-fmp-dark disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {salvandoDados ? 'Salvando…' : 'Salvar dados'}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Alterar senha" subtitle="Exige a senha atual" icon={KeyRound} expandable={false}>
          <form onSubmit={salvarSenha}>
            <label htmlFor="senha-atual" className="mb-1 block text-xs font-medium text-ink-2">
              Senha atual
            </label>
            <input
              id="senha-atual"
              name="senha_atual"
              type="password"
              className={CLASSE_CAMPO}
              autoComplete="current-password"
            />

            <label htmlFor="senha-nova" className="mb-1 mt-4 block text-xs font-medium text-ink-2">
              Nova senha
            </label>
            <input
              id="senha-nova"
              name="nova_senha"
              type="password"
              className={CLASSE_CAMPO}
              autoComplete="new-password"
            />
            <p className="mt-1 text-2xs text-ink-3">
              Mínimo de {TAMANHO_MINIMO_SENHA} caracteres.
            </p>

            <label
              htmlFor="senha-confirma"
              className="mb-1 mt-4 block text-xs font-medium text-ink-2"
            >
              Confirmar nova senha
            </label>
            <input
              id="senha-confirma"
              name="confirma_senha"
              type="password"
              className={CLASSE_CAMPO}
              autoComplete="new-password"
            />

            <MensagemAviso aviso={avisoSenha} />

            <button
              type="submit"
              disabled={salvandoSenha}
              className="mt-5 flex items-center gap-2 rounded-pill bg-fmp px-4 py-2 text-xs font-medium text-white transition-all hover:bg-fmp-dark disabled:opacity-60"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {salvandoSenha ? 'Alterando…' : 'Alterar senha'}
            </button>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { carregaPerfilAtual, entrar, sair, type Perfil } from '@/lib/authService';
import { supabase } from '@/lib/supabase';

type EstadoAuth = {
  perfil: Perfil | null;
  carregando: boolean;
  ehAdmin: boolean;
  entrarComo: (codusuario: string, senha: string) => Promise<void>;
  encerrarSessao: () => Promise<void>;
  /** Reaplica o perfil no contexto após o usuário editar os próprios dados. */
  atualizaPerfilLocal: (perfil: Perfil) => void;
};

const Contexto = createContext<EstadoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    // Sessão gravada de uma visita anterior: revalida contra o banco antes de
    // liberar a interface (o usuário pode ter sido desativado nesse meio-tempo).
    carregaPerfilAtual()
      .then((p) => {
        if (ativo) setPerfil(p);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    // Cobre o refresh token expirado e o logout feito em outra aba.
    const { data: assinatura } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') setPerfil(null);
    });

    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  const entrarComo = useCallback(async (codusuario: string, senha: string) => {
    const p = await entrar(codusuario, senha);
    setPerfil(p);
  }, []);

  const encerrarSessao = useCallback(async () => {
    await sair();
    setPerfil(null);
  }, []);

  const valor = useMemo<EstadoAuth>(
    () => ({
      perfil,
      carregando,
      ehAdmin: perfil?.papel === 'admin',
      entrarComo,
      encerrarSessao,
      atualizaPerfilLocal: setPerfil,
    }),
    [perfil, carregando, entrarComo, encerrarSessao],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): EstadoAuth {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}

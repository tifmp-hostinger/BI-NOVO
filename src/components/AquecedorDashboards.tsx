import { useEffect } from 'react';
import { iniciaAquecimentoDashboards } from '@/lib/aqueceDashboards';

/**
 * Dispara o aquecimento dos dashboards após o login (só é montado dentro do
 * AuthGate, logo só com sessão válida). O pequeno atraso deixa a tela de
 * entrada renderizar e as consultas dela (catálogo, perfil) terminarem antes
 * de começar a ocupar a rede.
 */
const ATRASO_INICIAL_MS = 2000;

export function AquecedorDashboards() {
  useEffect(() => {
    const t = setTimeout(iniciaAquecimentoDashboards, ATRASO_INICIAL_MS);
    return () => clearTimeout(t);
  }, []);
  return null;
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Search, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Props = {
  title: string;
  subtitle?: string;
  onOpenSidebar: () => void;
};

/** Iniciais para o avatar: primeiro e último nome, como "Rosangela Berg" → RB. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function Header({ title, subtitle, onOpenSidebar }: Props) {
  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { perfil, ehAdmin, encerrarSessao } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <header className="sticky top-0 z-20 glass-header">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-ink-2 hover:bg-paper lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-lg font-semibold text-ink"
            style={{ fontFamily: '"Noto Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 600 }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-ink-3">{subtitle}</p>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-full glass-input px-3 py-1.5 md:flex">
          <Search className="h-4 w-4 text-sand" />
          <input
            className="w-40 border-0 bg-transparent text-xs text-ink placeholder-sand focus:outline-none focus:ring-0 lg:w-56"
            placeholder="Buscar em dashboards..."
          />
        </div>

        <button
          type="button"
          className="relative rounded-full glass-button p-2 text-ink-2"
          aria-label="Notificacoes"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-fmp ring-2 ring-white" />
        </button>

        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setOpenDropdown((v) => !v)}
            className="flex items-center gap-2 rounded-full glass-button py-1 pl-1 pr-2.5"
            aria-haspopup
            aria-expanded={openDropdown}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fmp text-2xs font-semibold text-white">
              {iniciais(perfil?.nome_completo ?? '')}
            </span>
            <span className="hidden max-w-[10rem] truncate text-xs font-medium text-ink-2 sm:inline">
              {perfil?.nome_completo ?? '—'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
          </button>

          {openDropdown && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl glass-dropdown p-2 animate-slide-up">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {perfil?.nome_completo ?? '—'}
                </p>
                <p className="truncate text-2xs text-ink-3">{perfil?.cargo ?? perfil?.codusuario}</p>
              </div>
              <div className="my-1 border-t border-line" />
              <Link
                to="/minha-conta"
                onClick={() => setOpenDropdown(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-2 no-underline hover:bg-paper"
              >
                <User className="h-3.5 w-3.5" /> Minha conta
              </Link>
              {ehAdmin && (
                <Link
                  to="/usuarios"
                  onClick={() => setOpenDropdown(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-2 no-underline hover:bg-paper"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Usuários
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpenDropdown(false);
                  void encerrarSessao().then(() => navigate('/'));
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-fmp hover:bg-fmp-muted"
              >
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

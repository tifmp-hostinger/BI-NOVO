import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  MapPin,
  Percent,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { FmpSimbolo } from '@/components/brand/FmpLogo';
import { useAuth } from '@/contexts/AuthContext';

/** Iniciais para o avatar: primeiro e último nome ("Rosangela Berg" → RB). */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  MapPin,
  GraduationCap,
  DollarSign,
  UserPlus,
  Activity,
  Users,
  Shield,
  Settings,
  Target,
  Percent,
  TrendingUp,
};

type SidebarItem = {
  slug: string;
  title: string;
  subtitle?: string;
  icon: string;
  disabled?: boolean;
};

type Props = {
  items: SidebarItem[];
  open: boolean;
  onClose: () => void;
  /** Modo compacto (só ícones) no desktop. */
  colapsado?: boolean;
  onToggleColapso?: () => void;
};

export function Sidebar({ items, open, onClose, colapsado = false, onToggleColapso }: Props) {
  const { perfil } = useAuth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col glass-drawer text-cream transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${colapsado ? 'lg:w-20' : ''}`}
      >
        {/* Brand. Recolhido a barra tem 80px: com o padding de 20px de cada
            lado sobrariam 40px para o simbolo E o botao de recolher lado a
            lado, e os dois vazavam. Recolhido, empilha e reduz o padding. */}
        <div
          className={
            colapsado
              ? 'flex flex-col items-center gap-2 px-2 py-4'
              : 'flex items-center justify-between px-5 py-5'
          }
        >
          <NavLink to="/" onClick={onClose} className="flex items-center gap-3 no-underline">
            <FmpSimbolo className="h-9 w-9 shrink-0" titulo="FMP" />
            {!colapsado && (
              <div>
                <p
                  className="text-sm font-semibold tracking-tight text-cream"
                  style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic' }}
                >
                  FMP Analytics
                </p>
                <p className="text-2xs uppercase tracking-widest text-sand/70">
                  Central de Dashboards
                </p>
              </div>
            )}
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-cream/60 hover:bg-white/10 hover:text-cream lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Recolher/expandir: só faz sentido no desktop, onde a barra é fixa. */}
          {onToggleColapso && (
            <button
              type="button"
              onClick={onToggleColapso}
              title={colapsado ? 'Expandir menu' : 'Recolher menu'}
              aria-label={colapsado ? 'Expandir menu' : 'Recolher menu'}
              className="hidden rounded-lg p-1.5 text-cream/60 transition hover:bg-white/10 hover:text-cream lg:block"
            >
              {colapsado ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {!colapsado && (
            <p className="mb-2 mt-2 px-3 text-2xs font-semibold uppercase tracking-widest text-sand/50">
              Painel
            </p>
          )}
          <NavLink
            to="/"
            end
            onClick={onClose}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all no-underline ${
                isActive
                  ? 'bg-fmp text-white'
                  : 'text-cream/70 hover:bg-white/10 hover:text-cream'
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4 flex-shrink-0" strokeWidth={2.3} />
            {!colapsado && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Inicio</p>
                <p className="truncate text-2xs text-cream/40">Visao geral</p>
              </div>
            )}
          </NavLink>

          {!colapsado && (
            <p className="mb-2 mt-5 px-3 text-2xs font-semibold uppercase tracking-widest text-sand/50">
              Dashboards
            </p>
          )}
          {items.map((item, i) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const commonInner = (
              <>
                <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2.3} />
                {!colapsado && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {item.subtitle && (
                      <p className="truncate text-2xs text-cream/40">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                )}
                {!colapsado && item.disabled && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-2xs font-semibold text-cream/50">
                    Em breve
                  </span>
                )}
              </>
            );

            if (item.disabled) {
              return (
                <div
                  key={item.slug}
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-cream/30 animate-slide-right"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {commonInner}
                </div>
              );
            }

            return (
              <NavLink
                key={item.slug}
                to={`/dashboards/${item.slug}`}
                onClick={onClose}
                title={colapsado ? `${item.title}${item.subtitle ? ` — ${item.subtitle}` : ''}` : undefined}
                style={{ animationDelay: `${i * 40}ms` }}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all no-underline animate-slide-right ${
                    isActive
                      ? 'bg-fmp text-white'
                      : 'text-cream/70 hover:bg-white/10 hover:text-cream'
                  }`
                }
              >
                {commonInner}
              </NavLink>
            );
          })}

          {!colapsado && (
            <p className="mb-2 mt-5 px-3 text-2xs font-semibold uppercase tracking-widest text-sand/50">
              Administracao
            </p>
          )}
          {/* Gestão de usuários: item real, só para quem tem papel admin. */}
          {perfil?.papel === 'admin' && (
            <NavLink
              to="/usuarios"
              onClick={onClose}
              title={colapsado ? 'Usuarios — Acessos da plataforma' : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all no-underline ${
                  isActive
                    ? 'bg-fmp text-white'
                    : 'text-cream/70 hover:bg-white/10 hover:text-cream'
                }`
              }
            >
              <Shield className="h-4 w-4 flex-shrink-0" strokeWidth={2.3} />
              {!colapsado && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">Usuarios</p>
                  <p className="truncate text-2xs text-cream/40">Acessos da plataforma</p>
                </div>
              )}
            </NavLink>
          )}
          <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-cream/30">
            <Settings className="h-4 w-4 flex-shrink-0" strokeWidth={2.3} />
            {!colapsado && (
              <div className="min-w-0">
                <p className="text-sm font-medium">Configuracoes</p>
                <p className="text-2xs text-cream/40">Preferencias do sistema</p>
              </div>
            )}
          </div>
        </nav>

        {/* User badge */}
        {/* Recolhido, o avatar (40px) nao cabia: dos 80px da barra sobravam
            24px depois de px-4 + p-3, e o circulo vazava para fora. */}
        <div className={colapsado ? 'border-t border-white/10 px-2 py-4' : 'border-t border-white/10 px-4 py-4'}>
          <NavLink
            to="/minha-conta"
            onClick={onClose}
            title={perfil?.nome_completo ?? undefined}
            className={`rounded-xl bg-white/5 no-underline transition hover:bg-white/10 ${
              colapsado ? 'flex items-center justify-center p-2' : 'flex items-center gap-3 p-3'
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fmp text-sm font-semibold text-white">
              {iniciais(perfil?.nome_completo ?? '')}
            </div>
            {!colapsado && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cream">
                  {perfil?.nome_completo ?? '—'}
                </p>
                <p className="truncate text-2xs text-cream/40">
                  {perfil?.cargo ?? perfil?.codusuario ?? ''}
                </p>
              </div>
            )}
          </NavLink>
        </div>
      </aside>
    </>
  );
}

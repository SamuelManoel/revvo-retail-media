"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TooltipRoot,
  TooltipTrigger as TooltipEl,
  TooltipContent,
} from "@heroui/react";

type SessionUser = {
  userId: string;
  companyId: string;
  name: string;
  email: string;
  isMaster: boolean;
};

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  user: SessionUser | null;
  onLogout: () => void;
}

type NavItem = {
  href: string;
  label: string;
  badge?: string;
  disabled?: boolean;
  icon: ReactNode;
};

const mainNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M2 12.2039C2 9.91549 2 8.77128 2.5192 7.82274C3.0384 6.87421 3.98695 6.28551 5.88403 5.10813L7.88403 3.86687C9.88939 2.62229 10.8921 2 12 2C13.1079 2 14.1106 2.62229 16.116 3.86687L18.116 5.10812C20.0131 6.28551 20.9616 6.87421 21.4808 7.82274C22 8.77128 22 9.91549 22 12.2039V13.725C22 17.6258 22 19.5763 20.8284 20.7881C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.7881C2 19.5763 2 17.6258 2 13.725V12.2039Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15 18H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/empresas",
    label: "Empresas",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M22 22L2 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M21 22V6C21 4.11438 21 3.17157 20.4143 2.58579C19.8285 2 18.8857 2 17 2H15C13.1144 2 12.1716 2 11.5858 2.58579C11.1143 3.05733 11.0223 3.76022 11.0044 5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15 22V9C15 7.11438 15 6.17157 14.4142 5.58579C13.8284 5 12.8856 5 11 5H7C5.11438 5 4.17157 5 3.58579 5.58579C3 6.17157 3 7.11438 3 9V22" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 22V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 8H12M6 11H12M6 14H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/lojas",
    label: "Lojas",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12V14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14V12Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 4V2M18 4V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 9H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 14H8.009M12 14H12.009M16 14H16.009M8 18H8.009M12 18H12.009M16 18H16.009" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/licencas",
    label: "Licenças",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 2v5h5M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM12 14v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/terminais",
    label: "Terminais",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M2 9C2 6.17157 2 4.75736 2.87868 3.87868C3.75736 3 5.17157 3 8 3H16C18.8284 3 20.2426 3 21.1213 3.87868C22 4.75736 22 6.17157 22 9V10C22 12.8284 22 14.2426 21.1213 15.1213C20.2426 16 18.8284 16 16 16H8C5.17157 16 3.75736 16 2.87868 15.1213C2 14.2426 2 12.8284 2 10V9Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 19V16.5M12 19L18 21M12 19L6 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  }, 
  { 
    href: "/midias", 
    label: "Mídias",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 12.5001L3.75159 10.9675C4.66286 10.1702 6.03628 10.2159 6.89249 11.0721L11.1822 15.3618C11.8694 16.0491 12.9512 16.1428 13.7464 15.5839L14.0446 15.3744C15.1888 14.5702 16.7369 14.6634 17.7765 15.599L21 18.5001" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    disabled: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74457 2.35523 9.35522 2.74458 9.15223 3.23463C9.05957 3.45834 9.0233 3.7185 9.00911 4.09799C8.98826 4.65568 8.70226 5.17189 8.21894 5.45093C7.73564 5.72996 7.14559 5.71954 6.65219 5.45876C6.31645 5.2813 6.07301 5.18262 5.83294 5.15102C5.30704 5.08178 4.77518 5.22429 4.35436 5.5472C4.03874 5.78938 3.80577 6.1929 3.33983 6.99993C2.87389 7.80697 2.64092 8.21048 2.58899 8.60491C2.51976 9.1308 2.66227 9.66266 2.98518 10.0835C3.13256 10.2756 3.3397 10.437 3.66119 10.639C4.1338 10.936 4.43789 11.4419 4.43786 12C4.43783 12.5581 4.13375 13.0639 3.66118 13.3608C3.33965 13.5629 3.13248 13.7244 2.98508 13.9165C2.66217 14.3373 2.51966 14.8691 2.5889 15.395C2.64082 15.7894 2.87379 16.193 3.33973 17C3.80568 17.807 4.03865 18.2106 4.35426 18.4527C4.77508 18.7756 5.30694 18.9181 5.83284 18.8489C6.07289 18.8173 6.31632 18.7186 6.65204 18.5412C7.14547 18.2804 7.73556 18.27 8.2189 18.549C8.70224 18.8281 8.98826 19.3443 9.00911 19.9021C9.02331 20.2815 9.05957 20.5417 9.15223 20.7654C9.35522 21.2554 9.74457 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8477 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.902C15.0117 19.3443 15.2977 18.8281 15.781 18.549C16.2643 18.2699 16.8544 18.2804 17.3479 18.5412C17.6836 18.7186 17.927 18.8172 18.167 18.8488C18.6929 18.9181 19.2248 18.7756 19.6456 18.4527C19.9612 18.2105 20.1942 17.807 20.6601 16.9999C21.1261 16.1929 21.3591 15.7894 21.411 15.395C21.4802 14.8691 21.3377 14.3372 21.0148 13.9164C20.8674 13.7243 20.6602 13.5628 20.3387 13.3608C19.8662 13.0639 19.5621 12.558 19.5621 11.9999C19.5621 11.4418 19.8662 10.9361 20.3387 10.6392C20.6603 10.4371 20.8675 10.2757 21.0149 10.0835C21.3378 9.66273 21.4803 9.13087 21.4111 8.60497C21.3592 8.21055 21.1262 7.80703 20.6602 7C20.1943 6.19297 19.9613 5.78945 19.6457 5.54727C19.2249 5.22436 18.693 5.08185 18.1671 5.15109C17.9271 5.18269 17.6837 5.28136 17.3479 5.4588C16.8545 5.71959 16.2644 5.73002 15.7811 5.45096C15.2977 5.17191 15.0117 4.65566 14.9909 4.09794C14.9767 3.71848 14.9404 3.45833 14.8477 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

const bottomNav: NavItem[] = [
  {
    href: "/usuarios",
    label: "Usuários",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15 9C16.6569 9 18 7.65685 18 6C18 4.34315 16.6569 3 15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="9" cy="17" rx="7" ry="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M18 14C19.7542 14.3847 21 15.3589 21 16.5C21 17.5293 19.9863 18.4229 18.5 18.8704" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/ajuda",
    label: "Ajuda & Suporte",
    disabled: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
      </svg>
    ),
  },
];

function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <span
      className={[
        "flex items-center gap-3 w-full rounded-xl h-10 text-sm font-medium transition-all duration-150 select-none",
        collapsed ? "justify-center px-0" : "px-3",
        isActive
          ? "bg-[var(--accent-soft)] text-accent"
          : item.disabled
          ? "text-muted/40 cursor-not-allowed"
          : "text-muted hover:text-foreground hover:bg-surface-secondary/70 cursor-pointer",
      ].join(" ")}
    >
      <span className={`shrink-0 ${isActive ? "text-accent" : ""}`}>{item.icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
              {item.badge}
            </span>
          )}
          {isActive && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </>
      )}
    </span>
  );

  const wrapped = item.disabled ? (
    inner
  ) : (
    <Link href={item.href} className="block" onClick={onClick}>
      {inner}
    </Link>
  );

  if (!collapsed) return wrapped;

  return (
    <TooltipRoot>
      <TooltipEl>{wrapped}</TooltipEl>
      <TooltipContent placement="right" showArrow>
        {item.label}
      </TooltipContent>
    </TooltipRoot>
  );
}

export function Sidebar({
  isCollapsed,
  onToggle,
  isMobileOpen,
  onMobileClose,
  user,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const collapsed = isCollapsed && !isMobileOpen;

  const visibleMainNav = mainNav.filter((item) => {
    if (item.href === "/empresas") return user?.isMaster;
    if (item.href === "/licencas") return user?.isMaster;
    return true;
  });

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "U";

  return (
    <aside
      className={[
        "flex flex-col bg-surface border-r border-border h-full shrink-0",
        "fixed inset-y-0 left-0 z-50 w-64",
        "transition-transform duration-300 ease-in-out",
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        "md:relative md:inset-auto md:z-auto md:translate-x-0 md:shadow-none",
        "md:transition-[width] md:duration-300 md:ease-in-out",
        collapsed ? "md:w-[68px]" : "md:w-64",
      ].join(" ")}
    >
      {/* ── Logo + Collapse ── */}
      <div className={`flex h-16 shrink-0 items-center border-b border-border ${collapsed ? "justify-center px-4" : "justify-between px-5"}`}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M2 12h20" />
              </svg>
            </div>
            <span className="text-[15px] font-bold text-foreground tracking-tight">Smart Price</span>
          </Link>
        )}

        {collapsed && (
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M2 12h20" />
            </svg>
          </Link>
        )}

        {!collapsed && (
          <>
            <button onClick={onMobileClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-secondary hover:text-foreground transition-colors md:hidden" aria-label="Fechar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            <button onClick={onToggle} className="hidden rounded-lg p-1.5 text-muted hover:bg-surface-secondary hover:text-foreground transition-colors md:flex" aria-label="Recolher">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          </>
        )}

        {collapsed && (
          <button onClick={onToggle} className="absolute right-1 hidden rounded-lg p-1.5 text-muted hover:bg-surface-secondary hover:text-foreground transition-colors md:flex" aria-label="Expandir">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        )}
      </div>

      {/* ── User Profile ── */}
      <div className={`shrink-0 px-3 py-4 border-b border-border`}>
        {collapsed ? (
          <TooltipRoot>
            <TooltipEl>
              <Link href="/perfil" className="flex justify-center">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent to-success flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
              </Link>
            </TooltipEl>
            <TooltipContent placement="right" showArrow>{user?.name ?? "Usuário"}</TooltipContent>
          </TooltipRoot>
        ) : (
          <Link href="/perfil" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-secondary transition-colors group">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-accent to-success flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground leading-tight">{user?.name ?? "Usuário"}</p>
              <p className="truncate text-xs text-muted mt-0.5">{user?.isMaster ? "Master" : "Admin"}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        )}
      </div>

      {/* ── Main Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {!collapsed && (
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted/60">Menu</p>
        )}
        <div className="flex flex-col gap-0.5">
          {visibleMainNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive}
                collapsed={collapsed}
                onClick={isMobileOpen ? onMobileClose : undefined}
              />
            );
          })}
        </div>
      </nav>

      {/* ── Bottom Navigation ── */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <div className="flex flex-col gap-0.5">
          {bottomNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive}
                collapsed={collapsed}
                onClick={isMobileOpen ? onMobileClose : undefined}
              />
            );
          })}

          {collapsed ? (
            <TooltipRoot>
              <TooltipEl>
                <button onClick={onLogout} className="flex w-full items-center justify-center rounded-xl h-10 text-muted transition-colors hover:bg-danger/10 hover:text-danger">
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </TooltipEl>
              <TooltipContent placement="right" showArrow>Sair</TooltipContent>
            </TooltipRoot>
          ) : (
            <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl h-10 px-3 text-sm font-medium text-muted transition-colors hover:bg-danger/10 hover:text-danger">
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

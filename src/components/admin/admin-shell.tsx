"use client";

import { type ReactNode, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "./notification-bell";

type SessionUser = {
  userId: string;
  companyId: string;
  name: string;
  email: string;
  isMaster: boolean;
};

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/empresas": "Empresas",
  "/lojas": "Lojas",
  "/licencas": "Licenças",
  "/terminais": "Terminais",
  "/banners": "Banners",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
  "/usuarios": "Usuários",
  "/perfil": "Perfil",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = "/" + pathname.split("/")[1];
  return PAGE_TITLES[base] ?? "";
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setUser(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleDark = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      const value = next ? "dark" : "light";
      localStorage.setItem("theme", value);
      document.cookie = `theme=${value}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed((v) => !v)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-4 border-b border-border bg-surface/80 backdrop-blur-md pt-[env(safe-area-inset-top)] h-[calc(env(safe-area-inset-top,0px)+4rem)] px-[max(1.25rem,env(safe-area-inset-left))]">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="rounded-xl p-2 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground md:hidden"
            aria-label="Abrir menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Mobile logo */}
          <div className="flex items-center gap-2 md:hidden">
            <Image
              src="/logo-preto.png"
              alt="Revvo"
              width={28}
              height={28}
              priority
              className="h-7 w-7 rounded-xl hidden dark:inline"
            />
            <Image
              src="/logo-branco.png"
              alt="Revvo"
              width={28}
              height={28}
              priority
              className="h-7 w-7 rounded-xl dark:hidden"
            />
            <span className="text-sm font-bold text-foreground">Smart Price</span>
          </div>

          {/* Page title — desktop */}
          {pageTitle && (
            <div className="hidden md:block">
              <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
            </div>
          )}

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="rounded-xl p-2 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
              aria-label={isDark ? "Modo claro" : "Modo escuro"}
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>

            <NotificationBell />

            {/* User avatar */}
            {user && (
              <button
                onClick={() => router.push("/perfil")}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-success text-xs font-bold text-white hover:opacity-90 transition-opacity"
              >
                {user.name?.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase() ?? "U"}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-screen-xl w-full px-5 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

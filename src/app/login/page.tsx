'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ conta: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.conta || !form.email || !form.password) {
      setError('Preencha conta, e-mail e senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Erro ao fazer login.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* ── Coluna esquerda — branding ── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-surface p-12 lg:flex">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-accent/20 via-surface to-surface" />

        {/* Decorative circles */}
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo-preto.png"
              alt="Revvo"
              width={40}
              height={40}
              priority
              className="h-10 w-10 rounded-xl shadow-lg hidden dark:inline"
            />
            <Image
              src="/logo-branco.png"
              alt="Revvo"
              width={40}
              height={40}
              priority
              className="h-10 w-10 rounded-xl shadow-lg dark:hidden"
            />
            <span className="text-xl font-bold text-foreground">Revvo Smart Price</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight text-foreground">
              Gestão inteligente<br />
              <span className="text-accent">de preços</span>
            </h1>
            <p className="mt-4 text-lg text-muted leading-relaxed">
              Controle seus terminais, banners e sincronização de preços em tempo real, tudo em um único painel.
            </p>
          </div>

          {/* Feature list */}
          <ul className="flex flex-col gap-3">
            {[
              'Gerenciamento de terminais por empresa',
              'Upload e vinculação de mídias em tempo real',
              'Sincronização automática de cargas de preços',
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-muted">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-muted/60">© {new Date().getFullYear()} Revvo Smart Price. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* ── Coluna direita — formulário ── */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <Image
            src="/logo-preto.png"
            alt="Revvo"
            width={36}
            height={36}
            priority
            className="h-9 w-9 rounded-xl hidden dark:inline"
          />
          <Image
            src="/logo-branco.png"
            alt="Revvo"
            width={36}
            height={36}
            priority
            className="h-9 w-9 rounded-xl dark:hidden"
          />
          <span className="text-lg font-bold text-foreground">Revvo Smart Price</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h2>
            <p className="mt-1.5 text-sm text-muted">
              Entre com suas credenciais para acessar o painel
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Conta</label>
              <input
                type="text"
                placeholder="nome-da-sua-conta"
                autoComplete="organization"
                value={form.conta}
                onChange={(e) => { setForm((f) => ({ ...f, conta: e.target.value })); setError(null); }}
                className="
                  w-full rounded-lg border border-border bg-surface px-3 py-2.5
                  text-sm text-foreground placeholder:text-muted
                  outline-none transition-colors
                  focus:border-accent focus:ring-2 focus:ring-accent-soft-hover
                "
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                value={form.email}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setError(null); }}
                className="
                  w-full rounded-lg border border-border bg-surface px-3 py-2.5
                  text-sm text-foreground placeholder:text-muted
                  outline-none transition-colors
                  focus:border-accent focus:ring-2 focus:ring-accent-soft-hover
                "
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Senha</label>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setError(null); }}
                className="
                  w-full rounded-lg border border-border bg-surface px-3 py-2.5
                  text-sm text-foreground placeholder:text-muted
                  outline-none transition-colors
                  focus:border-accent focus:ring-2 focus:ring-accent-soft-hover
                "
              />
            </div>

            {error && (
              <div className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                mt-1 w-full rounded-lg bg-accent px-4 py-2.5
                text-sm font-semibold text-white
                transition-opacity hover:opacity-90
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

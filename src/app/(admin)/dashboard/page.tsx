'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@heroui/react';
import Link from 'next/link';

type Company = {
  id: string;
  name: string;
  legalName: string;
  cnpj: string;
  email: string;
  status: string;
  createdAt: string;
  _count: { terminals: number; users: number };
};

type Store = {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
  company: { id: string; name: string };
  license: { status: string } | null;
  _count: { terminals: number };
};

type Terminal = {
  id: string;
  name: string;
  ip: string | null;
  location: string;
  companyId: string;
  isActive: boolean;
  isBlocked: boolean;
  isPriceChecker: boolean;
  isMediaDisplay: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  company?: { id: string; name: string };
  store?: { id: string; name: string } | null;
};

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000; // 5 min

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

// ── Avatar ──────────────────────────────────────────────────
const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-500',
];

function Avatar({ name, index }: { name: string; index: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div
      className={`h-8 w-8 shrink-0 rounded-full bg-linear-to-br ${color} flex items-center justify-center text-xs font-semibold text-white select-none`}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

// ── Copy ID button ───────────────────────────────────────────
function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const short = `#${id.slice(0, 7).toUpperCase()}`;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm text-foreground">{short}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(id);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="text-muted hover:text-foreground transition-colors"
        title="Copiar ID"
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Bar Chart ────────────────────────────────────────────────
function BarChart({ data, labels, title, subtitle }: { data: number[]; labels: string[]; title: string; subtitle: string }) {
  const max = Math.max(...data, 1);
  return (
    <Card className="flex-1 min-w-0">
      <Card.Content className="p-5">
        <div className="mb-4">
          <p className="text-xs font-medium text-muted uppercase tracking-widest">{subtitle}</p>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">{title}</h3>
        </div>
        <div className="flex items-end gap-0.75 h-24">
          {data.map((v, i) => {
            const pct = (v / max) * 100;
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-sm bg-accent/80 relative group transition-all duration-300"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {v > 0 && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {v}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-end gap-0.75 mt-1.5">
          {labels.map((l, i) => (
            <div key={i} className="flex-1 text-center text-[9px] text-muted truncate">{l}</div>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

// ── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ATIVO' || status === 'ativo' || status === 'active';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-success' : 'bg-muted'}`} />
      {isActive ? 'Ativo' : 'Inativo'}
    </span>
  );
}

// ── Terminal Row ──────────────────────────────────────────────
function TerminalRow({ terminal, now }: { terminal: Terminal; now: number }) {
  const online = terminal.lastSeenAt
    ? now - new Date(terminal.lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
    : false;

  let statusLabel: string;
  let statusClass: string;
  let dotClass: string;

  if (terminal.isBlocked) {
    statusLabel = 'Bloqueado';
    statusClass = 'bg-danger/10 text-danger';
    dotClass = 'bg-danger';
  } else if (!terminal.isActive) {
    statusLabel = 'Inativo';
    statusClass = 'bg-muted/10 text-muted';
    dotClass = 'bg-muted';
  } else if (online) {
    statusLabel = 'Online';
    statusClass = 'bg-success/10 text-success';
    dotClass = 'bg-success animate-pulse';
  } else {
    statusLabel = 'Offline';
    statusClass = 'bg-warning/10 text-warning';
    dotClass = 'bg-warning';
  }

  return (
    <tr className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${online ? 'bg-success/10' : 'bg-surface-secondary'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={online ? 'text-success' : 'text-muted'}>
              <rect width="20" height="14" x="2" y="3" rx="2" />
              <line x1="8" x2="16" y1="21" y2="21" />
              <line x1="12" x2="12" y1="17" y2="21" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate leading-tight">{terminal.name}</p>
            <p className="text-xs text-muted truncate mt-0.5">{terminal.location}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap gap-1">
          {terminal.isPriceChecker && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent/10 text-accent">
              Busca Preço
            </span>
          )}
          {terminal.isMediaDisplay && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-violet-400/10 text-violet-400">
              Mídia
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5 text-xs text-muted">
        {terminal.store?.name ?? <span className="text-muted/50 italic">Sem loja</span>}
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          {statusLabel}
        </span>
      </td>
      <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">
        {terminal.lastSeenAt ? timeAgo(terminal.lastSeenAt) : '—'}
      </td>
      <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">
        {terminal.ip ?? '—'}
      </td>
    </tr>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [terminalSearch, setTerminalSearch] = useState('');
  const [now, setNow] = useState(Date.now());

  const fetchData = useCallback(async () => {
    const [me, t] = await Promise.all([
      fetch('/api/auth/me').then((r) => r.json()).catch(() => ({})),
      fetch('/api/terminals').then((r) => r.json()).catch(() => []),
    ]);
    const master = !!me?.isMaster;
    setIsMaster(master);
    setTerminals(Array.isArray(t) ? t : []);
    if (master) {
      const c = await fetch('/api/companies').then((r) => r.json()).catch(() => []);
      setCompanies(Array.isArray(c) ? c : []);
    } else {
      const s = await fetch('/api/stores').then((r) => r.json()).catch(() => []);
      setStores(Array.isArray(s) ? s : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh terminals every 30s to update heartbeat status
    const interval = setInterval(() => {
      fetch('/api/terminals').then((r) => r.json()).then((t) => {
        if (Array.isArray(t)) setTerminals(t);
        setNow(Date.now());
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Tick "now" every 10s so relative times stay fresh without a network call
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(tick);
  }, []);

  const monthlyData = useMemo(() => {
    const d = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = new Date(d.getFullYear(), d.getMonth() - 11 + i, 1);
      return { label: m.toLocaleString('pt-BR', { month: 'short' }), count: 0 };
    });
    for (const t of terminals) {
      const td = new Date(t.createdAt);
      const diff = (d.getFullYear() - td.getFullYear()) * 12 + (d.getMonth() - td.getMonth());
      if (diff >= 0 && diff < 12) months[11 - diff].count++;
    }
    return months;
  }, [terminals]);

  const secondaryMonthlyData = useMemo(() => {
    const d = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = new Date(d.getFullYear(), d.getMonth() - 11 + i, 1);
      return { label: m.toLocaleString('pt-BR', { month: 'short' }), count: 0 };
    });
    const items = isMaster ? companies : stores;
    for (const c of items) {
      const cd = new Date(c.createdAt);
      const diff = (d.getFullYear() - cd.getFullYear()) * 12 + (d.getMonth() - cd.getMonth());
      if (diff >= 0 && diff < 12) months[11 - diff].count++;
    }
    return months;
  }, [isMaster, companies, stores]);

  const filteredCompanies = useMemo(() => {
    const q = search.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.cnpj.includes(q));
  }, [companies, search]);

  const filteredStores = useMemo(() => {
    const q = search.toLowerCase();
    return stores.filter((s) => s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q));
  }, [stores, search]);

  const filteredTerminals = useMemo(() => {
    const q = terminalSearch.toLowerCase();
    return terminals.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        (t.store?.name ?? '').toLowerCase().includes(q) ||
        (t.ip ?? '').includes(q),
    );
  }, [terminals, terminalSearch]);

  const activeCompanies = companies.filter((c) => c.status === 'ATIVO' || c.status === 'ativo').length;
  const totalTerminals = terminals.length;
  const onlineTerminals = terminals.filter((t) => isOnline(t.lastSeenAt)).length;
  const totalUsers = companies.reduce((s, c) => s + (c._count?.users ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          isMaster
            ? {
                label: 'Empresas',
                value: companies.length,
                sub: `${activeCompanies} ativas`,
                color: 'text-accent',
                bg: 'bg-accent/10',
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                    <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
                    <path d="M12 3v6" />
                  </svg>
                ),
              }
            : {
                label: 'Lojas',
                value: stores.length,
                sub: `${stores.filter((s) => s.license?.status === 'active').length} ativas`,
                color: 'text-accent',
                bg: 'bg-accent/10',
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                    <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
                    <path d="M12 3v6" />
                  </svg>
                ),
              },
          {
            label: 'Terminais',
            value: totalTerminals,
            sub: `${onlineTerminals} online agora`,
            color: 'text-sky-400',
            bg: 'bg-sky-400/10',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
            ),
          },
          {
            label: 'Usuários',
            value: totalUsers,
            sub: 'total',
            color: 'text-violet-400',
            bg: 'bg-violet-400/10',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
          },
          {
            label: 'Online agora',
            value: onlineTerminals,
            sub: onlineTerminals === 0 ? 'nenhum ativo' : `de ${totalTerminals} terminais`,
            color: onlineTerminals > 0 ? 'text-success' : 'text-muted',
            bg: onlineTerminals > 0 ? 'bg-success/10' : 'bg-muted/10',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
              </svg>
            ),
          },
        ].map((s) => (
          <Card key={s.label}>
            <Card.Content className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1 leading-none">
                    {loading ? '—' : s.value}
                  </p>
                  <p className="text-xs text-muted mt-1">{s.sub}</p>
                </div>
                <div className={`shrink-0 w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center`}>
                  {s.icon}
                </div>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="flex gap-4 flex-col sm:flex-row">
        <BarChart
          title="Terminais cadastrados"
          subtitle="Últimos 12 meses"
          data={monthlyData.map((m) => m.count)}
          labels={monthlyData.map((m) => m.label)}
        />
        <BarChart
          title={isMaster ? 'Empresas cadastradas' : 'Lojas cadastradas'}
          subtitle="Últimos 12 meses"
          data={secondaryMonthlyData.map((m) => m.count)}
          labels={secondaryMonthlyData.map((m) => m.label)}
        />
      </div>

      {/* ── Terminals Heartbeat ── */}
      <Card>
        <Card.Content className="p-0">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-foreground">Status dos Terminais</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                {loading ? '—' : terminals.length}
              </span>
              {onlineTerminals > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-success/10 text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  {onlineTerminals} online
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={terminalSearch}
                  onChange={(e) => setTerminalSearch(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-surface-secondary pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors w-44"
                />
              </div>
              <Link
                href="/terminais"
                className="text-xs text-accent hover:text-accent/80 font-medium transition-colors whitespace-nowrap"
              >
                Ver todos →
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Terminal', 'Tipo', 'Loja', 'Status', 'Último heartbeat', 'IP'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredTerminals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                      {terminalSearch ? 'Nenhum terminal encontrado.' : 'Nenhum terminal cadastrado.'}
                    </td>
                  </tr>
                ) : (
                  filteredTerminals.map((t) => (
                    <TerminalRow key={t.id} terminal={t} now={now} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredTerminals.length > 0 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted">
                Mostrando <span className="text-foreground font-medium">{filteredTerminals.length}</span> de{' '}
                <span className="text-foreground font-medium">{terminals.length}</span> terminais
              </p>
              <p className="text-xs text-muted">Atualiza automaticamente a cada 30s</p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* ── Companies / Stores Table ── */}
      {isMaster ? (
        <Card>
          <Card.Content className="p-0">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-foreground">Todas as Empresas</h2>
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                  {loading ? '—' : companies.length}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-surface-secondary pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors w-44"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['ID da Empresa', 'Empresa', 'CNPJ', 'Terminais', 'Status', 'Ações'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-3.5">
                            <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted">
                        {search ? 'Nenhuma empresa encontrada.' : 'Nenhuma empresa cadastrada.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCompanies.map((company, idx) => (
                      <tr key={company.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                        <td className="px-5 py-3.5"><CopyId id={company.id} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={company.name} index={idx} />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate leading-tight">{company.name}</p>
                              <p className="text-xs text-muted truncate mt-0.5">{company.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted font-mono text-xs whitespace-nowrap">{company.cnpj}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                              <rect width="20" height="14" x="2" y="3" rx="2" />
                              <line x1="8" x2="16" y1="21" y2="21" />
                              <line x1="12" x2="12" y1="17" y2="21" />
                            </svg>
                            <span className="text-foreground font-medium">{company._count?.terminals ?? 0}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={company.status} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <Link href="/empresas" className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors" title="Ver empresa">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </Link>
                            <Link href="/terminais" className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors" title="Ver terminais">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="20" height="14" x="2" y="3" rx="2" />
                                <line x1="8" x2="16" y1="21" y2="21" />
                                <line x1="12" x2="12" y1="17" y2="21" />
                              </svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filteredCompanies.length > 0 && (
              <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted">
                  Mostrando <span className="text-foreground font-medium">{filteredCompanies.length}</span> de{' '}
                  <span className="text-foreground font-medium">{companies.length}</span> empresas
                </p>
                <Link href="/empresas" className="text-xs text-accent hover:text-accent/80 font-medium transition-colors">
                  Ver todas →
                </Link>
              </div>
            )}
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="p-0">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-foreground">Minhas Lojas</h2>
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                  {loading ? '—' : stores.length}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-surface-secondary pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors w-44"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Loja', 'Endereço', 'Terminais', 'Licença', 'Ações'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-5 py-3.5">
                            <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredStores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted">
                        {search ? 'Nenhuma loja encontrada.' : 'Nenhuma loja cadastrada.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStores.map((store, idx) => (
                      <tr key={store.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={store.name} index={idx} />
                            <p className="font-medium text-foreground truncate leading-tight">{store.name}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted">{store.address ?? <span className="italic text-muted/50">Sem endereço</span>}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                              <rect width="20" height="14" x="2" y="3" rx="2" />
                              <line x1="8" x2="16" y1="21" y2="21" />
                              <line x1="12" x2="12" y1="17" y2="21" />
                            </svg>
                            <span className="text-foreground font-medium">{store._count?.terminals ?? 0}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={store.license?.status ?? 'inactive'} />
                        </td>
                        <td className="px-5 py-3.5">
                          <Link href="/lojas" className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors" title="Ver loja">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filteredStores.length > 0 && (
              <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted">
                  Mostrando <span className="text-foreground font-medium">{filteredStores.length}</span> de{' '}
                  <span className="text-foreground font-medium">{stores.length}</span> lojas
                </p>
                <Link href="/lojas" className="text-xs text-accent hover:text-accent/80 font-medium transition-colors">
                  Ver todas →
                </Link>
              </div>
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@heroui/react';

type SessionUser = { userId: string; companyId: string; name: string; isMaster: boolean };
type Company = { id: string; name: string };
type Store   = { id: string; name: string; companyId: string; company?: { id: string; name: string } };

type HourlyRow = { bucket: string; total: number; found: number; not_found: number };
type ByTerminalRow = { terminal_id: string; total: number; found: number; not_found: number; terminal: { id: string; name: string; ip: string | null } | null };
type TopItemRow = { ean: string; product_name: string | null; total: number; found: number; not_found: number; last_scanned_at: string };
type NotFoundRow = { ean: string; total: number; last_scanned_at: string; last_terminal: { id: string; name: string } | null };

type CampaignVisibility = {
  id: string; name: string; isActive: boolean;
  startsAt: string; endsAt: string;
  effectiveFrom: string; effectiveTo: string;
  terminalCount: number; heartbeats: number; estimatedHours: number;
  perTerminal: { terminalId: string; name: string; heartbeats: number; hours: number }[];
};

const TABS = ['hourly', 'daily', 'by-terminal', 'top-items', 'not-found', 'campaign-visibility'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  hourly: 'Buscas por hora',
  daily: 'Buscas por dia',
  'by-terminal': 'Por terminal',
  'top-items': 'Mais buscados',
  'not-found': 'Não encontrados',
  'campaign-visibility': 'Visibilidade de campanhas',
};

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}
function fmtHour(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function todayMinus(days: number) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayEnd() {
  const d = new Date(); d.setHours(23, 59, 59, 999);
  return d.toISOString().slice(0, 10);
}

function Bar({ value, max, color = 'bg-accent' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full bg-surface-secondary rounded-full overflow-hidden">
      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RelatoriosPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [storeId, setStoreId] = useState<string>('');
  const [from, setFrom] = useState(todayMinus(7));
  const [to, setTo]     = useState(todayEnd());
  const [tab, setTab]   = useState<Tab>('hourly');

  const [hourly, setHourly] = useState<HourlyRow[]>([]);
  const [daily, setDaily]   = useState<HourlyRow[]>([]);
  const [byTerminal, setByTerminal] = useState<ByTerminalRow[]>([]);
  const [topItems, setTopItems] = useState<TopItemRow[]>([]);
  const [notFound, setNotFound] = useState<NotFoundRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignVisibility[]>([]);
  const [loading, setLoading] = useState(false);

  // Carrega sessão + lojas + (master) empresas
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u: SessionUser | null) => {
        setUser(u);
        if (u?.isMaster) {
          fetch('/api/companies').then((r) => r.json())
            .then((data) => setCompanies(Array.isArray(data) ? data : []))
            .catch(() => setCompanies([]));
        }
      })
      .catch(() => setUser(null));

    fetch('/api/stores').then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => setStores([]));
  }, []);

  const availableStores = useMemo(() => {
    if (!user) return [] as Store[];
    if (user.isMaster) return companyFilter ? stores.filter((s) => s.companyId === companyFilter) : stores;
    return stores.filter((s) => s.companyId === user.companyId);
  }, [stores, user, companyFilter]);

  // Auto-seleciona a primeira loja quando muda o filtro de empresa ou carrega lojas
  useEffect(() => {
    if (storeId && !availableStores.find((s) => s.id === storeId)) {
      setStoreId(availableStores[0]?.id ?? '');
    } else if (!storeId && availableStores.length > 0) {
      setStoreId(availableStores[0].id);
    }
  }, [availableStores, storeId]);

  const fromIso = useMemo(() => `${from}T00:00:00.000Z`, [from]);
  const toIso   = useMemo(() => `${to}T23:59:59.999Z`,   [to]);

  // Refetch quando muda store, datas ou tab
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);

    async function run() {
      try {
        if (tab === 'campaign-visibility') {
          const r = await fetch(`/api/reports/campaign-visibility?storeId=${storeId}&from=${fromIso}&to=${toIso}`);
          if (!r.ok) throw new Error();
          const d = await r.json();
          setCampaigns(Array.isArray(d.campaigns) ? d.campaigns : []);
        } else {
          const r = await fetch(`/api/reports/scans?type=${tab}&storeId=${storeId}&from=${fromIso}&to=${toIso}`);
          if (!r.ok) throw new Error();
          const d = await r.json();
          if (tab === 'hourly') setHourly(d.rows ?? []);
          else if (tab === 'daily') setDaily(d.rows ?? []);
          else if (tab === 'by-terminal') setByTerminal(d.rows ?? []);
          else if (tab === 'top-items') setTopItems(d.rows ?? []);
          else if (tab === 'not-found') setNotFound(d.rows ?? []);
        }
      } catch {
        // mantém vazio
        if (tab === 'hourly') setHourly([]);
        if (tab === 'daily') setDaily([]);
        if (tab === 'by-terminal') setByTerminal([]);
        if (tab === 'top-items') setTopItems([]);
        if (tab === 'not-found') setNotFound([]);
        if (tab === 'campaign-visibility') setCampaigns([]);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [storeId, fromIso, toIso, tab]);

  const totalScans = useMemo(() => {
    if (tab === 'hourly') return hourly.reduce((a, r) => a + r.total, 0);
    if (tab === 'daily')  return daily.reduce((a, r) => a + r.total, 0);
    if (tab === 'by-terminal') return byTerminal.reduce((a, r) => a + r.total, 0);
    if (tab === 'top-items')   return topItems.reduce((a, r) => a + r.total, 0);
    if (tab === 'not-found')   return notFound.reduce((a, r) => a + r.total, 0);
    return 0;
  }, [tab, hourly, daily, byTerminal, topItems, notFound]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="mt-1 text-sm text-muted">Consultas por loja: bipagens dos terminais e visibilidade das campanhas.</p>
      </div>

      {/* Filtros */}
      <Card>
        <Card.Content className="px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            {user?.isMaster && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Empresa</label>
                <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Loja</label>
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={inputClass}>
                <option value="">Selecione</option>
                {availableStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{user?.isMaster && s.company ? ` — ${s.company.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">De</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Até</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </div>
            <div className="flex gap-1.5">
              {(['hoje', '7 dias', '30 dias'] as const).map((quick) => (
                <button
                  key={quick}
                  onClick={() => {
                    if (quick === 'hoje') { setFrom(todayMinus(0)); setTo(todayEnd()); }
                    else if (quick === '7 dias') { setFrom(todayMinus(7)); setTo(todayEnd()); }
                    else { setFrom(todayMinus(30)); setTo(todayEnd()); }
                  }}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:border-accent/40 hover:text-foreground transition-colors"
                >
                  {quick}
                </button>
              ))}
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Stats banner */}
      {tab !== 'campaign-visibility' && (
        <p className="text-xs text-muted">
          {loading ? 'Carregando...' : `Total de bipagens no período: `}
          {!loading && <span className="font-bold text-foreground">{totalScans}</span>}
        </p>
      )}

      {/* Conteúdo por tab */}
      {!storeId ? (
        <Card><Card.Content className="py-12 text-center text-sm text-muted">Selecione uma loja.</Card.Content></Card>
      ) : loading ? (
        <Card><Card.Content className="py-12 text-center text-sm text-muted">Carregando...</Card.Content></Card>
      ) : tab === 'hourly' || tab === 'daily' ? (
        <BucketTable rows={tab === 'hourly' ? hourly : daily} bucketLabel={tab === 'hourly' ? 'Hora' : 'Dia'} fmt={tab === 'hourly' ? fmtHour : fmtDate} />
      ) : tab === 'by-terminal' ? (
        <ByTerminalTable rows={byTerminal} />
      ) : tab === 'top-items' ? (
        <TopItemsTable rows={topItems} />
      ) : tab === 'not-found' ? (
        <NotFoundTable rows={notFound} />
      ) : (
        <CampaignVisibilityTable rows={campaigns} />
      )}
    </div>
  );
}

/* ─── Tables ────────────────────────────────────────────────────────────── */

function BucketTable({ rows, bucketLabel, fmt }: { rows: HourlyRow[]; bucketLabel: string; fmt: (iso: string) => string }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  if (rows.length === 0) return <Card><Card.Content className="py-12 text-center text-sm text-muted">Sem bipagens no período.</Card.Content></Card>;
  return (
    <Card>
      <Card.Content className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary/50 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">{bucketLabel}</th>
              <th className="px-4 py-2 text-left font-medium">Total</th>
              <th className="px-4 py-2 text-left font-medium">Encontrados</th>
              <th className="px-4 py-2 text-left font-medium">Não encontrados</th>
              <th className="px-4 py-2 text-left font-medium w-1/3">Distribuição</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bucket} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{fmt(r.bucket)}</td>
                <td className="px-4 py-2 font-semibold">{r.total}</td>
                <td className="px-4 py-2 text-success">{r.found}</td>
                <td className="px-4 py-2 text-danger">{r.not_found}</td>
                <td className="px-4 py-2"><Bar value={r.total} max={max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card.Content>
    </Card>
  );
}

function ByTerminalTable({ rows }: { rows: ByTerminalRow[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  if (rows.length === 0) return <Card><Card.Content className="py-12 text-center text-sm text-muted">Sem bipagens no período.</Card.Content></Card>;
  return (
    <Card>
      <Card.Content className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary/50 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Terminal</th>
              <th className="px-4 py-2 text-left font-medium">Total</th>
              <th className="px-4 py-2 text-left font-medium">Encontrados</th>
              <th className="px-4 py-2 text-left font-medium">Não encontrados</th>
              <th className="px-4 py-2 text-left font-medium w-1/3">Distribuição</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.terminal_id} className="border-t border-border">
                <td className="px-4 py-2">
                  <p className="font-medium text-foreground">{r.terminal?.name ?? r.terminal_id}</p>
                  {r.terminal?.ip && <p className="text-xs text-muted font-mono">{r.terminal.ip}</p>}
                </td>
                <td className="px-4 py-2 font-semibold">{r.total}</td>
                <td className="px-4 py-2 text-success">{r.found}</td>
                <td className="px-4 py-2 text-danger">{r.not_found}</td>
                <td className="px-4 py-2"><Bar value={r.total} max={max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card.Content>
    </Card>
  );
}

function TopItemsTable({ rows }: { rows: TopItemRow[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  if (rows.length === 0) return <Card><Card.Content className="py-12 text-center text-sm text-muted">Sem itens no período.</Card.Content></Card>;
  return (
    <Card>
      <Card.Content className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary/50 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">EAN</th>
              <th className="px-4 py-2 text-left font-medium">Produto</th>
              <th className="px-4 py-2 text-left font-medium">Total</th>
              <th className="px-4 py-2 text-left font-medium">Encontrados</th>
              <th className="px-4 py-2 text-left font-medium">Não encontrados</th>
              <th className="px-4 py-2 text-left font-medium">Última busca</th>
              <th className="px-4 py-2 text-left font-medium w-1/4">Vol.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ean} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{r.ean}</td>
                <td className="px-4 py-2">{r.product_name ?? <span className="text-muted">—</span>}</td>
                <td className="px-4 py-2 font-semibold">{r.total}</td>
                <td className="px-4 py-2 text-success">{r.found}</td>
                <td className="px-4 py-2 text-danger">{r.not_found}</td>
                <td className="px-4 py-2 text-xs text-muted">{fmtDateTime(r.last_scanned_at)}</td>
                <td className="px-4 py-2"><Bar value={r.total} max={max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card.Content>
    </Card>
  );
}

function NotFoundTable({ rows }: { rows: NotFoundRow[] }) {
  if (rows.length === 0) return <Card><Card.Content className="py-12 text-center text-sm text-muted">Nenhum item buscado sem retorno no período.</Card.Content></Card>;
  return (
    <Card>
      <Card.Content className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary/50 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">EAN buscado</th>
              <th className="px-4 py-2 text-left font-medium">Buscas</th>
              <th className="px-4 py-2 text-left font-medium">Última busca</th>
              <th className="px-4 py-2 text-left font-medium">Último terminal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ean} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{r.ean}</td>
                <td className="px-4 py-2 font-semibold text-danger">{r.total}</td>
                <td className="px-4 py-2 text-xs text-muted">{fmtDateTime(r.last_scanned_at)}</td>
                <td className="px-4 py-2 text-xs">{r.last_terminal?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card.Content>
    </Card>
  );
}

function CampaignVisibilityTable({ rows }: { rows: CampaignVisibility[] }) {
  if (rows.length === 0) return <Card><Card.Content className="py-12 text-center text-sm text-muted">Nenhuma campanha cruzou o período selecionado.</Card.Content></Card>;
  const maxHours = Math.max(...rows.map((r) => r.estimatedHours), 1);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Estimativa baseada em heartbeats dos terminais com mídia da campanha. Cada heartbeat ≈ 15 minutos de tela.
      </p>
      {rows.map((r) => (
        <Card key={r.id}>
          <Card.Content className="px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="text-sm font-semibold text-foreground">{r.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? 'bg-success/10 text-success' : 'bg-muted/15 text-muted'}`}>
                {r.isActive ? 'Ativa' : 'Inativa'}
              </span>
              <p className="text-xs text-muted">{fmtDate(r.startsAt)} → {fmtDate(r.endsAt)}</p>
              <p className="text-xs text-muted">· {r.terminalCount} terminal{r.terminalCount !== 1 ? 'is' : ''}</p>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-accent">{r.estimatedHours.toFixed(1)}</span>
              <span className="text-xs text-muted">horas estimadas no período (de {r.heartbeats} heartbeats)</span>
            </div>
            <div className="mt-2"><Bar value={r.estimatedHours} max={maxHours} /></div>
            {r.perTerminal.length > 0 && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {r.perTerminal.map((p) => (
                  <div key={p.terminalId} className="rounded-lg border border-border px-3 py-2 text-xs">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-muted">{p.hours.toFixed(1)}h · {p.heartbeats} hb</p>
                  </div>
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}

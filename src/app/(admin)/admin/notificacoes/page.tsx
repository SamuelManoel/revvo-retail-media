'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Card } from '@heroui/react';

type NotificationType = 'info' | 'success' | 'warning' | 'danger';

type Company = { id: string; name: string };

type Notification = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  actionLabel: string | null;
  actionUrl: string | null;
  isRead: boolean;
  companyId: string | null;
  company: { id: string; name: string } | null;
  createdAt: string;
};

const TYPE_OPTIONS: { value: NotificationType; label: string; dot: string; badge: string }[] = [
  { value: 'info',    label: 'Informação', dot: 'bg-accent',   badge: 'bg-accent/10 text-accent' },
  { value: 'success', label: 'Sucesso',    dot: 'bg-success',  badge: 'bg-success/10 text-success' },
  { value: 'warning', label: 'Atenção',    dot: 'bg-warning',  badge: 'bg-warning/10 text-warning' },
  { value: 'danger',  label: 'Urgente',    dot: 'bg-danger',   badge: 'bg-danger/10 text-danger' },
];

function typeStyle(type: string) {
  return TYPE_OPTIONS.find((t) => t.value === type) ?? TYPE_OPTIONS[0];
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const EMPTY_FORM = {
  title:       '',
  body:        '',
  type:        'info' as NotificationType,
  companyId:   'all',
  actionLabel: '',
  actionUrl:   '',
};

export default function AdminNotificacoesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | NotificationType>('all');
  const [search, setSearch] = useState('');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications');
      if (res.ok) setNotifications(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetch('/api/companies')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Company[]) => setCompanies(data.filter((c: Company & { type?: string }) => (c as Company & { type?: string }).type !== 'master')))
      .catch(() => {});
  }, [fetchNotifications]);

  async function handleSend() {
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       form.title.trim(),
          body:        form.body.trim(),
          type:        form.type,
          companyId:   form.companyId,
          actionLabel: form.actionLabel.trim() || undefined,
          actionUrl:   form.actionUrl.trim()   || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSendError(d.message ?? 'Erro ao enviar.');
        return;
      }
      const data = await res.json();
      const count = data.sent ?? 1;
      setSendSuccess(count > 1 ? `Enviado para ${count} empresas.` : 'Notificação enviada.');
      setForm({ ...EMPTY_FORM });
      fetchNotifications();
    } catch {
      setSendError('Erro de conexão.');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  }

  const filtered = notifications.filter((n) => {
    if (filter !== 'all' && n.type !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.company?.name ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const readCount   = notifications.filter((n) => n.isRead).length;
  const unreadCount = notifications.length - readCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
        <p className="mt-1 text-sm text-muted">Envie comunicados para empresas clientes e acompanhe o histórico</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* ── Compose ── */}
        <Card className="lg:col-span-2">
          <Card.Content className="p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground">Nova notificação</p>

            {/* Type selector */}
            <div className="flex gap-2 flex-wrap">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                    form.type === t.value
                      ? `${t.badge} border-current`
                      : 'border-border text-muted hover:border-accent/40 hover:text-foreground'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Título <span className="text-danger">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Manutenção programada"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft-hover"
              />
            </div>

            {/* Body */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Mensagem <span className="text-danger">*</span></label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={4}
                placeholder="Descreva o comunicado..."
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft-hover resize-none"
              />
            </div>

            {/* Target */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Destinatário</label>
              <select
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="all">Todas as empresas</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Action (optional) */}
            <details className="group">
              <summary className="text-xs text-muted cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
                Botão de ação (opcional)
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Texto do botão</label>
                  <input
                    type="text"
                    value={form.actionLabel}
                    onChange={(e) => setForm((f) => ({ ...f, actionLabel: e.target.value }))}
                    placeholder="Ex.: Ver detalhes"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">URL de destino</label>
                  <input
                    type="text"
                    value={form.actionUrl}
                    onChange={(e) => setForm((f) => ({ ...f, actionUrl: e.target.value }))}
                    placeholder="/integrações ou https://..."
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
                  />
                </div>
              </div>
            </details>

            {sendError   && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{sendError}</p>}
            {sendSuccess && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{sendSuccess}</p>}

            <Button
              variant="primary"
              onPress={handleSend}
              isDisabled={sending || !form.title.trim() || !form.body.trim()}
              className="w-full"
            >
              {sending ? 'Enviando...' : 'Enviar notificação'}
            </Button>
          </Card.Content>
        </Card>

        {/* ── History ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total',   value: notifications.length, color: 'text-foreground' },
              { label: 'Lidas',   value: readCount,            color: 'text-success' },
              { label: 'Não lidas', value: unreadCount,        color: 'text-accent' },
            ].map((s) => (
              <Card key={s.label}>
                <Card.Content className="p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted mt-0.5">{s.label}</p>
                </Card.Content>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 min-w-[160px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent"
            />
            <div className="flex items-center gap-1">
              {(['all', 'info', 'success', 'warning', 'danger'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-accent text-white'
                      : 'text-muted hover:text-foreground hover:bg-surface-secondary'
                  }`}
                >
                  {f === 'all' ? 'Todas' : typeStyle(f).label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <Card>
            <Card.Content className="p-0">
              {loading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-surface-secondary animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">Nenhuma notificação encontrada.</p>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((n) => {
                    const s = typeStyle(n.type);
                    return (
                      <div key={n.id} className="flex items-start gap-3 px-5 py-4 group hover:bg-surface-secondary/30 transition-colors">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot} ${n.isRead ? 'opacity-30' : ''}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold truncate ${n.isRead ? 'text-muted' : 'text-foreground'}`}>
                              {n.title}
                            </p>
                            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${s.badge}`}>
                              {s.label}
                            </span>
                            {!n.isRead && (
                              <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-accent/10 text-accent">
                                Não lida
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-muted/70">{timeAgo(n.createdAt)}</span>
                            <span className="text-[10px] text-muted/70">
                              {n.company ? n.company.name : <span className="italic">Todas as empresas</span>}
                            </span>
                            {n.actionLabel && (
                              <span className="text-[10px] text-muted/70 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                {n.actionLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(n.id)}
                          disabled={deleting === n.id}
                          title="Excluir"
                          className="shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger/10 transition-all disabled:opacity-30"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}

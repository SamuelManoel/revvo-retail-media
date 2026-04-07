'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  actionLabel: string | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

const TYPE_STYLES: Record<string, { dot: string; border: string; badge: string }> = {
  info:    { dot: 'bg-accent',   border: 'border-accent/20',   badge: 'bg-accent/10 text-accent' },
  success: { dot: 'bg-success',  border: 'border-success/20',  badge: 'bg-success/10 text-success' },
  warning: { dot: 'bg-warning',  border: 'border-warning/20',  badge: 'bg-warning/10 text-warning' },
  danger:  { dot: 'bg-danger',   border: 'border-danger/20',   badge: 'bg-danger/10 text-danger' },
};

function typeStyles(type: string) {
  return TYPE_STYLES[type] ?? TYPE_STYLES.info;
}

// ── Detail Modal ─────────────────────────────────────────────
function NotificationModal({ notification, onClose, onAction, onMarkRead }: {
  notification: Notification;
  onClose: () => void;
  onAction: (n: Notification) => void;
  onMarkRead: (id: string) => void;
}) {
  const router = useRouter();
  const s = typeStyles(notification.type);

  useEffect(() => {
    if (!notification.isRead) onMarkRead(notification.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 p-5 border-b ${s.border} border-border`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground leading-tight">{notification.title}</h2>
              <p className="text-xs text-muted mt-0.5">{timeAgo(notification.createdAt)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{notification.body}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-border text-sm text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
          >
            Fechar
          </button>
          {notification.actionLabel && (
            <button
              onClick={() => {
                onAction(notification);
                if (notification.actionUrl) router.push(notification.actionUrl);
                onClose();
              }}
              className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {notification.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bell ─────────────────────────────────────────────────────
export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const unread = notifications.filter((n) => !n.isRead).length;

  const fetchNotifications = useCallback(async () => {
    const data = await fetch('/api/notifications').then((r) => r.ok ? r.json() : []).catch(() => []);
    setNotifications(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' }).catch(() => {});
  }, []);

  const dismiss = useCallback(async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await Promise.allSettled(unreadIds.map((id) => fetch(`/api/notifications/${id}`, { method: 'PATCH' })));
  };

  const openDetail = (n: Notification) => {
    setSelected(n);
    setOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          ref={btnRef}
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl p-2 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground relative"
          aria-label="Notificações"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            ref={panelRef}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-border bg-surface shadow-2xl z-50 overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Notificações</span>
                {unread > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-border/60">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span className="text-xs">Nenhuma notificação</span>
                </div>
              ) : (
                notifications.map((n) => {
                  const s = typeStyles(n.type);
                  return (
                    <div
                      key={n.id}
                      onClick={() => openDetail(n)}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-secondary/60 transition-colors group ${!n.isRead ? 'bg-accent/5' : ''}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot} ${n.isRead ? 'opacity-30' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-tight truncate ${n.isRead ? 'text-muted' : 'text-foreground'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                        <div className="flex items-center justify-between mt-1.5 gap-2">
                          <span className="text-[10px] text-muted/70">{timeAgo(n.createdAt)}</span>
                          {n.actionLabel && (
                            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${s.badge}`}>
                              {n.actionLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => dismiss(n.id, e)}
                        className="shrink-0 mt-0.5 rounded p-0.5 text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-all"
                        title="Dispensar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <NotificationModal
          notification={selected}
          onClose={() => setSelected(null)}
          onAction={(n) => { if (!n.isRead) markRead(n.id); }}
          onMarkRead={markRead}
        />
      )}
    </>
  );
}

'use client';

import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';

/* ────────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────────── */
type Terminal = { id: string; name: string; ip: string | null; isMediaDisplay: boolean };
type Store    = { id: string; name: string };
type Media    = { id: string; url: string | null; fileName: string; mimeType: string; type: string; size: number };

type EnterAnimation = 'none' | 'fade' | 'zoom' | 'bounce' | 'slideLeft' | 'slideUp';

type CampaignMedia = {
  id: string;
  order: number;
  duration: number | null;
  enterAnimation: EnterAnimation;
  startsAt: string | null;
  endsAt:   string | null;
  terminalId: string;
  mediaId: string | null;
  offerId: string | null;
  media:    Media | null;
  offer: {
    id: string;
    name: string;
    kind: string;
    renderedImageUrl: string | null;
    storeId: string;
    companyId: string;
  } | null;
  terminal: {
    id: string;
    name: string;
    isPriceChecker: boolean;
    store: { terminalLayout: { id: string; name: string } | null } | null;
  };
};

type Campaign = {
  id: string;
  name: string;
  startsAt: string;
  endsAt:   string;
  createdAt: string;
  thumbnail: string | null;
  isActive: boolean;
  store:    { id: string; name: string } | null;
  terminal: { id: string; name: string } | null;
  terminalMedias: CampaignMedia[];
  products: CampaignProduct[];
};

type CampaignLog = {
  id: string;
  action: string;
  description: string;
  userName: string;
  userId: string;
  diff: Record<string, { from: string | null; to: string | null }> | null;
  createdAt: string;
};

type CampaignProduct = {
  id: string;
  ean: string;
  productName: string;
  preco1: string | null;
  preco2: string | null;
  preco3: string | null;
  productId: string | null;
  storeId: string | null;
  store: { id: string; name: string } | null;
  createdAt: string;
};

type StoreProduct = {
  id: string;
  ean: string;
  produto: string;
  preco1: string;
  preco2: string | null;
  preco3: string | null;
};

/* ────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────── */
function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtBRL(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseDateLocal(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function campaignStatus(c: Campaign): 'active' | 'scheduled' | 'expired' | 'inactive' {
  if (!c.isActive) return 'inactive';
  const now  = new Date();
  const ends = parseDateLocal(c.endsAt);
  const starts = parseDateLocal(c.startsAt);
  if (ends && ends < now) return 'expired';
  if (starts && starts > now) return 'scheduled';
  return 'active';
}

/* ────────────────────────────────────────────────────────────────
   Shared UI
──────────────────────────────────────────────────────────────── */
const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'scheduled' | 'expired' | 'inactive' }) {
  if (status === 'active')    return <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Ativa</span>;
  if (status === 'scheduled') return <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Agendada</span>;
  if (status === 'inactive')  return <span className="rounded-full bg-muted/15 px-2 py-0.5 text-xs font-medium text-muted">Inativa</span>;
  return                             <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">Expirada</span>;
}

function PlayIcon({ className = 'h-10 w-10 text-muted' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
      <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────
   Emoji catalog + picker
──────────────────────────────────────────────────────────────── */
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Promoções',
    emojis: ['🎉', '🎊', '🏷️', '💰', '💵', '🛍️', '🎁', '⭐', '🌟', '✨', '🔥', '💥', '🆕', '🆓', '📣', '📢', '🎯', '💎', '🏆', '🥇'],
  },
  {
    label: 'Estações & Datas',
    emojis: ['🌞', '☀️', '🌈', '🌧️', '❄️', '⛄', '🍂', '🍃', '🌸', '🌺', '🎃', '🎄', '🎆', '🎇', '🥳', '💝', '🐣', '🎋'],
  },
  {
    label: 'Produtos & Categorias',
    emojis: ['👕', '👗', '👟', '👠', '🧢', '👜', '💍', '⌚', '📱', '💻', '🖥️', '📺', '🎮', '🍕', '🍔', '🍰', '☕', '🍷', '🛒', '🏠'],
  },
  {
    label: 'Lojas & Negócios',
    emojis: ['🏪', '🏬', '🏦', '🏨', '🏥', '🚗', '✈️', '🌍', '📦', '🚀', '💼', '📊', '📈', '🤝', '👑', '🎪', '🎭', '🎬'],
  },
  {
    label: 'Símbolos',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚡', '💫', '🌀', '♻️', '✅', '🔔'],
  },
];

function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 hover:border-accent/50 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
        title="Escolher thumbnail"
      >
        {value ? (
          <span className="text-3xl leading-none">{value}</span>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-secondary text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </span>
        )}
        <div className="text-left">
          <p className="text-xs font-medium text-foreground">{value ? 'Alterar emoji' : 'Escolher emoji'}</p>
          <p className="text-[10px] text-muted">{value ? 'Thumbnail da campanha' : 'Selecione um emoticon'}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted ml-auto transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-80 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
          {/* Group tabs */}
          <div className="flex overflow-x-auto border-b border-border bg-surface-secondary/50 scrollbar-hide">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                onClick={() => setActiveGroup(i)}
                className={[
                  'shrink-0 px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  activeGroup === i
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-foreground',
                ].join(' ')}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="p-3 grid grid-cols-8 gap-1">
            {EMOJI_GROUPS[activeGroup].emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onChange(emoji); setOpen(false); }}
                className={[
                  'flex items-center justify-center h-9 w-9 rounded-lg text-xl transition-all hover:scale-125',
                  value === emoji ? 'bg-accent/15 ring-2 ring-accent/40 scale-110' : 'hover:bg-surface-secondary',
                ].join(' ')}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Clear / footer */}
          {value && (
            <div className="border-t border-border px-3 py-2 flex justify-end">
              <button
                onClick={() => { onChange(''); setOpen(false); }}
                className="text-xs text-muted hover:text-danger transition-colors"
              >
                Remover emoji
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Video thumbnail — renders first frame natively + play overlay
──────────────────────────────────────────────────────────────── */
function VideoThumbnail({ url, className = '' }: { url: string; className?: string }) {
  return (
    <div className={`relative bg-black overflow-hidden ${className}`}>
      <video
        src={url}
        preload="metadata"
        muted
        playsInline
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-4 w-4 ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Full-screen media preview (image or video player)
──────────────────────────────────────────────────────────────── */
function MediaPreview({ media, onClose }: { media: Media; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/92"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 py-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <p className="text-sm text-white/70 font-medium truncate max-w-md">{media.fileName}</p>
        <button
          onClick={onClose}
          className="pointer-events-auto flex items-center justify-center h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div
        className="relative flex items-center justify-center w-full max-w-5xl px-4 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {media.type === 'image' && media.url ? (
          <img
            src={media.url}
            alt={media.fileName}
            className="max-h-[88vh] max-w-full object-contain rounded-xl shadow-2xl"
          />
        ) : media.url ? (
          <video
            src={media.url}
            controls
            autoPlay
            className="max-h-[88vh] max-w-full rounded-xl shadow-2xl bg-black"
            style={{ minWidth: 320 }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <p className="text-sm">Arquivo sem URL de visualização</p>
          </div>
        )}
      </div>

      {/* Hint */}
      <p className="absolute bottom-4 text-xs text-white/30 pointer-events-none">
        Pressione Esc ou clique fora para fechar
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Log action icon + color
──────────────────────────────────────────────────────────────── */
function LogIcon({ action }: { action: string }) {
  if (action === 'created') return (
    <div className="h-7 w-7 rounded-full bg-success/10 flex items-center justify-center shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </div>
  );
  if (action === 'updated') return (
    <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    </div>
  );
  if (action === 'media_added') return (
    <div className="h-7 w-7 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
        <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    </div>
  );
  if (action === 'media_removed') return (
    <div className="h-7 w-7 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      </svg>
    </div>
  );
  return (
    <div className="h-7 w-7 rounded-full bg-surface-secondary flex items-center justify-center shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Media card
──────────────────────────────────────────────────────────────── */
function DurationInput({ cm, onSaved }: { cm: CampaignMedia; onSaved: (id: string, duration: number) => void }) {
  const initial = cm.duration ?? 10;
  const [value, setValue] = useState<string>(String(initial));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(String(cm.duration ?? 10)); }, [cm.duration]);

  async function commit() {
    const n = Number(value);
    if (!Number.isFinite(n)) { setValue(String(cm.duration ?? 10)); return; }
    const clamped = Math.min(300, Math.max(3, Math.round(n)));
    setValue(String(clamped));
    if (clamped === (cm.duration ?? 10)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/terminals/${cm.terminalId}/media/${cm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: clamped }),
      });
      if (res.ok) onSaved(cm.id, clamped);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted">Duração:</span>
      <input
        type="number" min={3} max={300} step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        disabled={saving}
        className="w-14 rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft-hover disabled:opacity-60"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
      />
      <span className="text-xs text-muted">seg</span>
    </div>
  );
}

const ANIMATION_OPTIONS: { id: EnterAnimation; label: string; emoji: string }[] = [
  { id: 'none',       label: 'Nenhuma',     emoji: '○' },
  { id: 'fade',       label: 'Fade',        emoji: '◐' },
  { id: 'zoom',       label: 'Zoom In',     emoji: '🔍' },
  { id: 'bounce',     label: 'Quicar',      emoji: '⤓' },
  { id: 'slideLeft',  label: 'Da esquerda', emoji: '→' },
  { id: 'slideUp',    label: 'De baixo',    emoji: '↑' },
];

function animationClass(a: EnterAnimation): string {
  return a === 'none' ? '' : `anim-enter-${a}`;
}

function AnimationPreviewBox({ animation, replayKey }: { animation: EnterAnimation; replayKey: number }) {
  return (
    <div className="relative h-20 w-full overflow-hidden rounded-md border border-border bg-surface-secondary">
      <div
        key={`${animation}-${replayKey}`}
        className={`absolute inset-2 flex items-center justify-center rounded-md bg-gradient-to-br from-accent/40 to-accent/10 text-xs font-medium text-foreground ${animationClass(animation)}`}
      >
        Prévia
      </div>
    </div>
  );
}

function AnimationPicker({ cm, onSaved }: { cm: CampaignMedia; onSaved: (id: string, value: EnterAnimation) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<EnterAnimation>(cm.enterAnimation ?? 'none');
  const [replayKey, setReplayKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setValue(cm.enterAnimation ?? 'none'); }, [cm.enterAnimation]);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popWidth = 256; // w-64
      const margin = 8;
      let left = rect.left;
      if (left + popWidth + margin > window.innerWidth) left = window.innerWidth - popWidth - margin;
      if (left < margin) left = margin;
      setCoords({ top: rect.bottom + 4, left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const current = ANIMATION_OPTIONS.find((o) => o.id === value) ?? ANIMATION_OPTIONS[0];

  async function choose(next: EnterAnimation) {
    setValue(next);
    setReplayKey((k) => k + 1);
    if (next === cm.enterAnimation) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/terminals/${cm.terminalId}/media/${cm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enterAnimation: next }),
      });
      if (res.ok) onSaved(cm.id, next);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  const popover = open && coords && typeof window !== 'undefined'
    ? createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 256 }}
          className="z-[100] rounded-xl border border-border bg-surface p-2 shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-2">
            {ANIMATION_OPTIONS.map((opt) => {
              const active = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => choose(opt.id)}
                  className={`group flex flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors ${active ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'}`}
                >
                  <AnimationPreviewBox animation={opt.id} replayKey={replayKey + (active ? 0 : 1)} />
                  <span className={`px-1 text-[11px] font-medium ${active ? 'text-accent' : 'text-foreground'}`}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={saving}
        title="Animação de entrada"
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-foreground transition-colors hover:border-accent/60 focus:border-accent focus:ring-1 focus:ring-accent-soft-hover disabled:opacity-60"
      >
        <span className="text-muted">Animação:</span>
        <span className="font-medium">{current.label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {popover}
    </>
  );
}

function LockedPriceCheckerCard({ layoutName }: { layoutName: string | null }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/30">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-accent/20 bg-accent/10">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Padrão
        </div>
        <span className="text-xs text-accent/70">Final</span>
      </div>

      <div className="relative h-32 flex items-center justify-center bg-gradient-to-br from-accent/10 via-accent/5 to-transparent">
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent/70">
          <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      </div>

      <div className="p-3 space-y-1.5">
        <p className="truncate text-sm font-semibold text-foreground">Layout busca de preço</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">layout</span>
          <span className="text-xs text-muted truncate">{layoutName ?? 'Padrão da loja'}</span>
        </div>
        <p className="text-xs text-muted">Exibido após a playlist até bipar um produto.</p>
      </div>

      <div className="px-3 py-2 border-t border-accent/20 bg-accent/5">
        <p className="text-xs text-muted flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
          Item fixo — não pode ser excluído ou reordenado.
        </p>
      </div>
    </div>
  );
}

function MediaCard({
  cm, index, onEdit, onDelete, onPreview, onDurationSaved, onAnimationSaved,
}: {
  cm: CampaignMedia; index: number;
  onEdit: (cm: CampaignMedia) => void;
  onDelete: (cm: CampaignMedia) => void;
  onPreview: (media: Media) => void;
  onDurationSaved: (id: string, duration: number) => void;
  onAnimationSaved: (id: string, value: EnterAnimation) => void;
}) {
  const { media, offer } = cm;
  const now       = new Date();
  const ends      = parseDateLocal(cm.endsAt);
  const starts    = parseDateLocal(cm.startsAt);
  const expired   = !!ends && ends < now;
  const scheduled = !expired && !!starts && starts > now;

  // Slot é uma OFERTA (offerId setado, sem media) ou uma MÍDIA convencional.
  const isOffer = !!offer && !media;

  // Dados unificados para renderizar (imagem + nome + label)
  const displayUrl     = isOffer ? (offer?.renderedImageUrl ?? null) : (media?.url ?? null);
  const displayName    = isOffer ? (offer?.name ?? 'Oferta') : (media?.fileName ?? 'Mídia');
  const displayKind    = isOffer ? 'oferta' : (media?.type ?? 'arquivo');
  const isVideoMedia   = !isOffer && media?.type === 'video';

  // Mídia surrogate para o preview do modal — passa um objeto Media com fileName/url/type
  const previewSurrogate: Media = (media ?? ({
    id: cm.id, url: displayUrl ?? '', fileName: displayName,
    mimeType: 'image/png', size: 0, type: 'image',
  } as Media));

  return (
    <div className={`overflow-hidden rounded-xl border bg-surface ${expired ? 'border-danger/30 opacity-60' : 'border-border'}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-surface-secondary/50">
        <GripIcon />
        <div className="flex items-center gap-1.5">
          {isOffer  && <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-xs font-medium text-violet-500">Oferta</span>}
          {expired   && <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-xs font-medium text-danger">Expirada</span>}
          {scheduled && <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">Agendada</span>}
          {!expired && !scheduled && (cm.startsAt || cm.endsAt) && <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">Vigente</span>}
          <span className="text-xs text-muted font-mono">#{index + 1}</span>
        </div>
      </div>

      {/* Clickable thumbnail / preview area */}
      <button
        onClick={() => onPreview(previewSurrogate)}
        className="relative block w-full h-32 group overflow-hidden focus:outline-none"
        title="Clique para visualizar"
      >
        {!isVideoMedia && displayUrl ? (
          <img src={displayUrl} alt={displayName} className="h-full w-full object-cover" />
        ) : isVideoMedia && displayUrl ? (
          <VideoThumbnail url={displayUrl} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-secondary">
            <PlayIcon />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1.5">
            {isVideoMedia
              ? <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-3.5 w-3.5"><path d="M8 5v14l11-7z"/></svg><span className="text-white text-xs font-medium">Reproduzir</span></>
              : <><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg><span className="text-white text-xs font-medium">Ampliar</span></>}
          </div>
        </div>
      </button>

      <div className="p-3 space-y-1.5">
        <p className="truncate text-sm font-medium text-foreground" title={displayName}>{displayName}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{displayKind}</span>
          {!isOffer && media && <span className="text-xs text-muted">{formatSize(media.size)}</span>}
        </div>
        <p className="text-xs text-muted">{cm.terminal.name}</p>
        {isVideoMedia ? (
          <p className="text-xs text-muted italic">Duração: tempo total do vídeo</p>
        ) : (
          <DurationInput cm={cm} onSaved={onDurationSaved} />
        )}
        <AnimationPicker cm={cm} onSaved={onAnimationSaved} />
        {(cm.startsAt || cm.endsAt) && (
          <p className={`text-xs ${expired ? 'text-danger/70' : 'text-muted'}`}>
            {fmtDate(cm.startsAt)} → {fmtDate(cm.endsAt)}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-border px-3 py-2">
        {!isOffer && (
          <button onClick={() => onEdit(cm)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Editar
          </button>
        )}
        {isOffer && (
          <a
            href={(() => {
              const oid = cm.offerId ?? offer?.id ?? '';
              const sid = offer?.storeId ?? '';
              const cid = offer?.companyId ?? '';
              const qs = new URLSearchParams();
              if (oid) qs.set('edit', oid);
              if (sid) qs.set('storeId', sid);
              if (cid) qs.set('companyId', cid);
              return `/ofertas?${qs.toString()}`;
            })()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
            title="Editar oferta"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Ir para a oferta
          </a>
        )}
        <button onClick={() => onDelete(cm)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-danger hover:bg-danger/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          {isOffer ? 'Remover oferta' : 'Excluir'}
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Draggable grid
──────────────────────────────────────────────────────────────── */
function DraggableGrid({ items, onReorder, onEdit, onDelete, onPreview, onDurationSaved, onAnimationSaved, trailing }: {
  items: CampaignMedia[];
  onReorder: (items: CampaignMedia[]) => void;
  onEdit: (cm: CampaignMedia) => void;
  onDelete: (cm: CampaignMedia) => void;
  onPreview: (media: Media) => void;
  onDurationSaved: (id: string, duration: number) => void;
  onAnimationSaved: (id: string, value: EnterAnimation) => void;
  trailing?: React.ReactNode;
}) {
  const [local, setLocal] = useState<CampaignMedia[]>(items);
  const dragging = useRef<{ id: string; index: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => { setLocal(items); }, [items]);

  function onDragStart(cm: CampaignMedia, index: number) { dragging.current = { id: cm.id, index }; setDraggingId(cm.id); }
  function onDragOver(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (!dragging.current || dragging.current.index === targetIndex) return;
    const next = [...local];
    const [item] = next.splice(dragging.current.index, 1);
    next.splice(targetIndex, 0, item);
    dragging.current = { ...dragging.current, index: targetIndex };
    setLocal(next);
  }
  function onDrop() { setDraggingId(null); dragging.current = null; onReorder(local); }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {local.map((cm, index) => (
        <div key={cm.id} draggable
          onDragStart={() => onDragStart(cm, index)}
          onDragOver={(e) => onDragOver(e, index)}
          onDrop={onDrop}
          onDragEnd={() => { setDraggingId(null); dragging.current = null; }}
          style={{ opacity: draggingId === cm.id ? 0.4 : 1 }}
          className="cursor-grab active:cursor-grabbing transition-opacity"
        >
          <MediaCard cm={cm} index={index} onEdit={onEdit} onDelete={onDelete} onPreview={onPreview} onDurationSaved={onDurationSaved} onAnimationSaved={onAnimationSaved} />
        </div>
      ))}
      {trailing}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Campaign card (collapsible)
──────────────────────────────────────────────────────────────── */
function CampaignCard({ campaign, mediaTerminals, allMedias, stores, onDelete, onReactivate, onRefresh }: {
  campaign: Campaign;
  mediaTerminals: Terminal[];
  allMedias: Media[];
  stores: Store[];
  onDelete: (c: Campaign) => void;
  onReactivate: (c: Campaign) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState<'media' | 'products' | 'logs'>('media');
  const [items, setItems]       = useState<CampaignMedia[]>(campaign.terminalMedias);
  const [logs, setLogs]         = useState<CampaignLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  // Modals
  const addModal    = useOverlayState();
  const editModal   = useOverlayState();
  const deleteModal = useOverlayState();
  const editCampaignModal = useOverlayState();
  const addProductModal   = useOverlayState();
  const deleteProductModal = useOverlayState();
  const addOfferModal     = useOverlayState();

  // Offer placement modal state
  type AvailableOffer = {
    id: string; name: string; kind: string;
    isActive: boolean;
    renderedImageUrl: string | null;
    products: { ean: string }[];
  };
  const [availableOffers, setAvailableOffers] = useState<AvailableOffer[]>([]);
  const [availableOffersLoading, setAvailableOffersLoading] = useState(false);
  const [pickedOfferId, setPickedOfferId] = useState<string>('');
  const [pickedTerminalId, setPickedTerminalId] = useState<string>('');
  const [pickedPosition, setPickedPosition] = useState<number>(0);
  const [pickedDuration, setPickedDuration] = useState<number>(10);
  const [storeTerminals, setStoreTerminals] = useState<Array<{ id: string; name: string }>>([]);
  const [placingOffer, setPlacingOffer] = useState(false);
  const [placeOfferError, setPlaceOfferError] = useState<string | null>(null);

  // Products
  const [products, setProducts] = useState<CampaignProduct[]>(campaign.products ?? []);
  const [addProductStoreId, setAddProductStoreId] = useState<string>(campaign.store?.id ?? '');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<StoreProduct[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [productAdding, setProductAdding] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<CampaignProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  // Add media form
  const [addTerminalId, setAddTerminalId] = useState(campaign.terminal?.id ?? '');
  const [addMediaId, setAddMediaId]       = useState('');
  const [addFile, setAddFile]             = useState<File | null>(null);
  const [addMode, setAddMode]             = useState<'existing' | 'upload'>('existing');
  const [addStartAt, setAddStartAt]       = useState('');
  const [addEndAt, setAddEndAt]           = useState('');
  const [addError, setAddError]           = useState<string | null>(null);
  const [adding, setAdding]               = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit media form
  const [editTarget, setEditTarget]   = useState<CampaignMedia | null>(null);
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt]     = useState('');
  const [editError, setEditError]     = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);

  // Delete media
  const [deleteTarget, setDeleteTarget] = useState<CampaignMedia | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // Preview
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null);
  const openPreview = useCallback((m: Media) => setPreviewMedia(m), []);

  // Edit campaign fields
  const [editName, setEditName]             = useState(campaign.name);
  const [editCStartAt, setEditCStartAt]     = useState(campaign.startsAt.slice(0, 10));
  const [editCEndAt, setEditCEndAt]         = useState(campaign.endsAt.slice(0, 10));
  const [editCStoreId, setEditCStoreId]     = useState(campaign.store?.id ?? '');
  const [editCTermId, setEditCTermId]       = useState(campaign.terminal?.id ?? '');
  const [editCThumbnail, setEditCThumbnail] = useState(campaign.thumbnail ?? '');
  const [editCError, setEditCError]         = useState<string | null>(null);
  const [savingCampaign, setSavingCampaign] = useState(false);

  useEffect(() => { setItems(campaign.terminalMedias); }, [campaign.terminalMedias]);
  useEffect(() => { setProducts(campaign.products ?? []); }, [campaign.products]);

  const byTerminal = useMemo(() => {
    const map = new Map<string, CampaignMedia[]>();
    for (const cm of items) {
      if (!map.has(cm.terminalId)) map.set(cm.terminalId, []);
      map.get(cm.terminalId)!.push(cm);
    }
    map.forEach((list) => list.sort((a, b) => a.order - b.order));
    return map;
  }, [items]);

  const status     = campaignStatus(campaign);
  const mediaCount = campaign.terminalMedias.length;
  const previews   = campaign.terminalMedias.slice(0, 4);

  async function fetchLogs() {
    const res = await fetch(`/api/campaigns/${campaign.id}/logs`);
    if (res.ok) { setLogs(await res.json()); setLogsLoaded(true); }
  }

  function handleTabChange(tab: 'media' | 'products' | 'logs') {
    setActiveTab(tab);
    if (tab === 'logs' && !logsLoaded) fetchLogs();
  }

  // Reset logs loaded when campaign changes so logs refresh on next open
  useEffect(() => { setLogsLoaded(false); }, [campaign]);

  function handleDurationSaved(id: string, duration: number) {
    setItems((prev) => prev.map((cm) => cm.id === id ? { ...cm, duration } : cm));
  }

  function handleAnimationSaved(id: string, value: EnterAnimation) {
    setItems((prev) => prev.map((cm) => cm.id === id ? { ...cm, enterAnimation: value } : cm));
  }

  async function handleReorder(terminalId: string, reordered: CampaignMedia[]) {
    const groupIds = new Set(reordered.map((cm) => cm.id));
    setItems((prev) => {
      const others  = prev.filter((cm) => !groupIds.has(cm.id));
      const updated = reordered.map((cm, i) => ({ ...cm, order: i }));
      return [...others, ...updated];
    });
    await fetch(`/api/admin/terminals/${terminalId}/media/order`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reordered.map((cm, i) => ({ id: cm.id, order: i })) }),
    }).catch(() => {});
  }

  function openAdd() {
    setAddTerminalId(campaign.terminal?.id ?? '');
    setAddMediaId(''); setAddFile(null); setAddMode('existing');
    setAddStartAt(campaign.startsAt.slice(0, 10));
    setAddEndAt(campaign.endsAt.slice(0, 10));
    setAddError(null);
    addModal.open();
  }

  async function handleAdd() {
    if (!addTerminalId) { setAddError('Selecione um terminal.'); return; }
    setAdding(true); setAddError(null);
    try {
      let mediaId = addMediaId;
      if (addMode === 'upload') {
        if (!addFile) { setAddError('Selecione um arquivo.'); setAdding(false); return; }
        const fd = new FormData(); fd.append('file', addFile);
        const r = await fetch('/api/media', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) { setAddError(d.message ?? 'Erro ao enviar.'); setAdding(false); return; }
        mediaId = d.id;
      }
      if (!mediaId) { setAddError('Selecione ou envie uma mídia.'); setAdding(false); return; }
      const res = await fetch(`/api/admin/terminals/${addTerminalId}/media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId, campaignId: campaign.id, startsAt: addStartAt || null, endsAt: addEndAt || null }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.message ?? 'Erro ao adicionar.'); return; }
      addModal.close();
      setLogsLoaded(false);
      onRefresh();
    } catch { setAddError('Erro de conexão.'); } finally { setAdding(false); }
  }

  function openEdit(cm: CampaignMedia) {
    setEditTarget(cm);
    setEditStartAt(cm.startsAt ? cm.startsAt.slice(0, 10) : '');
    setEditEndAt(cm.endsAt ? cm.endsAt.slice(0, 10) : '');
    setEditError(null); editModal.open();
  }

  async function handleEdit() {
    if (!editTarget) return;
    setSaving(true); setEditError(null);
    try {
      const res = await fetch(`/api/admin/terminals/${editTarget.terminalId}/media/${editTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startsAt: editStartAt || null, endsAt: editEndAt || null }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.message ?? 'Erro ao salvar.'); return; }
      editModal.close(); onRefresh();
    } catch { setEditError('Erro de conexão.'); } finally { setSaving(false); }
  }

  function openDeleteMedia(cm: CampaignMedia) { setDeleteTarget(cm); deleteModal.open(); }

  async function handleDeleteMedia() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Slot de oferta → endpoint específico que limpa também os CampaignProducts
      // que entraram via essa oferta. Slot de mídia → endpoint clássico.
      if (deleteTarget.offerId) {
        await fetch(`/api/offers/${deleteTarget.offerId}/placement?terminalMediaId=${deleteTarget.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/admin/terminals/${deleteTarget.terminalId}/media/${deleteTarget.id}`, { method: 'DELETE' });
      }
      deleteModal.close();
      setLogsLoaded(false);
      onRefresh();
    } catch { /* ignore */ } finally { setDeleting(false); setDeleteTarget(null); }
  }

  // ── Products handlers ──────────────────────────────────────────────────
  function openAddProduct() {
    setAddProductStoreId(campaign.store?.id ?? '');
    setProductSearch('');
    setProductResults([]);
    setProductError(null);
    addProductModal.open();
  }

  async function searchProducts(q: string) {
    if (!addProductStoreId) { setProductResults([]); return; }
    setProductSearching(true);
    try {
      const url = new URL(`/api/stores/${addProductStoreId}/products`, window.location.origin);
      if (q.trim()) url.searchParams.set('q', q.trim());
      url.searchParams.set('limit', '20');
      const res = await fetch(url.toString());
      const data = await res.json();
      setProductResults(Array.isArray(data?.products) ? data.products : []);
    } catch {
      setProductResults([]);
    } finally {
      setProductSearching(false);
    }
  }

  // Re-busca quando a loja muda ou ao digitar (debounce simples)
  useEffect(() => {
    if (!addProductModal.isOpen) return;
    const t = setTimeout(() => { searchProducts(productSearch); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch, addProductStoreId, addProductModal.isOpen]);

  async function addProduct(p: StoreProduct) {
    if (!addProductStoreId) { setProductError('Selecione uma loja.'); return; }
    setProductAdding(true);
    setProductError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: addProductStoreId, ean: p.ean }),
      });
      const data = await res.json();
      if (!res.ok) { setProductError(data.message ?? 'Erro ao adicionar produto.'); return; }
      // Optimistic: append à lista local; o refresh externo traz tudo de novo
      setProducts((prev) => [...prev, data]);
      onRefresh();
    } catch {
      setProductError('Erro de conexão.');
    } finally {
      setProductAdding(false);
    }
  }

  function openDeleteProduct(p: CampaignProduct) {
    setDeleteProductTarget(p);
    deleteProductModal.open();
  }

  async function handleDeleteProduct() {
    if (!deleteProductTarget) return;
    setDeletingProduct(true);
    try {
      await fetch(`/api/campaigns/${campaign.id}/products/${deleteProductTarget.id}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p.id !== deleteProductTarget.id));
      deleteProductModal.close();
      onRefresh();
    } catch { /* ignore */ } finally {
      setDeletingProduct(false);
      setDeleteProductTarget(null);
    }
  }

  // ── Add offer to campaign ──────────────────────────────────────────────
  function openAddOffer() {
    setPickedOfferId('');
    setPickedTerminalId(campaign.terminal?.id ?? '');
    setPickedPosition(0);
    setPickedDuration(10);
    setPlaceOfferError(null);
    setAvailableOffers([]);
    setStoreTerminals([]);
    addOfferModal.open();
  }

  // Carrega ofertas e terminais ao abrir o modal
  useEffect(() => {
    if (!addOfferModal.isOpen) return;
    if (!campaign.store?.id) {
      setPlaceOfferError('A campanha precisa ter uma loja vinculada pra receber ofertas.');
      return;
    }
    setAvailableOffersLoading(true);
    fetch(`/api/offers?storeId=${campaign.store.id}&isActive=true`)
      .then((r) => r.json())
      .then((d: AvailableOffer[]) => setAvailableOffers(Array.isArray(d) ? d : []))
      .catch(() => setAvailableOffers([]))
      .finally(() => setAvailableOffersLoading(false));

    if (!campaign.terminal?.id) {
      fetch('/api/terminals')
        .then((r) => r.json())
        .then((d: Array<{ id: string; name: string; isMediaDisplay: boolean; store?: { id: string } | null }>) => {
          const list = Array.isArray(d) ? d : [];
          setStoreTerminals(
            list
              .filter((t) => t.isMediaDisplay && t.store?.id === campaign.store?.id)
              .map((t) => ({ id: t.id, name: t.name })),
          );
        })
        .catch(() => setStoreTerminals([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOfferModal.isOpen]);

  async function placeOffer() {
    if (!pickedOfferId) { setPlaceOfferError('Escolha uma oferta.'); return; }
    const terminalId = campaign.terminal?.id ?? pickedTerminalId;
    if (!terminalId) { setPlaceOfferError('Escolha um terminal.'); return; }
    setPlacingOffer(true);
    setPlaceOfferError(null);
    try {
      const res = await fetch(`/api/offers/${pickedOfferId}/placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          terminalId,
          position: pickedPosition,
          duration: pickedDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setPlaceOfferError(data.message ?? 'Erro ao adicionar oferta.'); return; }
      addOfferModal.close();
      onRefresh();
    } catch {
      setPlaceOfferError('Erro de conexão.');
    } finally {
      setPlacingOffer(false);
    }
  }

  function openEditCampaign() {
    setEditName(campaign.name);
    setEditCStartAt(campaign.startsAt.slice(0, 10));
    setEditCEndAt(campaign.endsAt.slice(0, 10));
    setEditCStoreId(campaign.store?.id ?? '');
    setEditCTermId(campaign.terminal?.id ?? '');
    setEditCThumbnail(campaign.thumbnail ?? '');
    setEditCError(null);
    editCampaignModal.open();
  }

  async function handleEditCampaign() {
    if (!editName.trim() || !editCStartAt || !editCEndAt) {
      setEditCError('Nome e datas são obrigatórios.'); return;
    }
    setSavingCampaign(true); setEditCError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          startsAt: editCStartAt,
          endsAt: editCEndAt,
          storeId: editCStoreId || null,
          terminalId: editCTermId || null,
          thumbnail: editCThumbnail || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditCError(data.message ?? 'Erro ao salvar.'); return; }
      editCampaignModal.close();
      setLogsLoaded(false);
      onRefresh();
    } catch { setEditCError('Erro de conexão.'); } finally { setSavingCampaign(false); }
  }

  return (
    <>
      <Card>
        <Card.Content className="p-0">
          {/* ── Campaign header ── */}
          <div className="flex items-center gap-4 px-5 py-4">
            {/* Thumbnail: emoji or stacked media previews */}
            {campaign.thumbnail ? (
              <div className="shrink-0 h-14 w-14 rounded-xl bg-surface-secondary border border-border flex items-center justify-center text-3xl select-none">
                {campaign.thumbnail}
              </div>
            ) : (
              <div className="shrink-0 flex -space-x-2">
                {previews.length === 0 ? (
                  <div className="h-12 w-12 rounded-lg bg-surface-secondary flex items-center justify-center border border-border">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40">
                      <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                ) : (
                  previews.map((cm, i) => {
                    const thumbUrl = cm.media?.url ?? cm.offer?.renderedImageUrl ?? null;
                    const thumbName = cm.media?.fileName ?? cm.offer?.name ?? 'Item';
                    const isVideo = cm.media?.type === 'video';
                    return (
                      <button
                        key={cm.id}
                        onClick={() => {
                          if (cm.media) openPreview(cm.media);
                          else if (cm.offer) openPreview({ id: cm.id, url: cm.offer.renderedImageUrl ?? '', fileName: cm.offer.name, mimeType: 'image/png', size: 0, type: 'image' } as Media);
                        }}
                        title={thumbName}
                        className="h-12 w-12 rounded-lg border-2 border-surface overflow-hidden bg-surface-secondary shrink-0 hover:ring-2 hover:ring-accent/60 transition-shadow"
                        style={{ zIndex: previews.length - i }}
                      >
                        {!isVideo && thumbUrl
                          ? <img src={thumbUrl} alt={thumbName} className="h-full w-full object-cover" />
                          : isVideo && thumbUrl
                            ? <VideoThumbnail url={thumbUrl} className="h-full w-full" />
                            : <div className="h-full w-full flex items-center justify-center"><PlayIcon className="h-5 w-5 text-muted" /></div>}
                      </button>
                    );
                  })
                )}
                {mediaCount > 4 && (
                  <div className="h-12 w-12 rounded-lg border-2 border-surface bg-surface-secondary flex items-center justify-center shrink-0 z-0">
                    <span className="text-xs font-semibold text-muted">+{mediaCount - 4}</span>
                  </div>
                )}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
                <StatusBadge status={status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  {fmtDate(campaign.startsAt)} → {fmtDate(campaign.endsAt)}
                </span>
                {campaign.store && (
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                    {campaign.store.name}
                  </span>
                )}
                {campaign.terminal && (
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
                    </svg>
                    {campaign.terminal.name}
                  </span>
                )}
                <span>{mediaCount} mídia{mediaCount !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={openAdd} title="Adicionar mídia" className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors">
                + Mídia
              </button>
              <button onClick={openAddOffer} title="Adicionar oferta" className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors">
                + Oferta
              </button>
              <button onClick={openEditCampaign} title="Editar campanha" className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
              {campaign.isActive ? (
                <button onClick={() => onDelete(campaign)} title="Desativar campanha" className="rounded-lg p-1.5 text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </button>
              ) : (
                <button onClick={() => onReactivate(campaign)} title="Reativar campanha" className="rounded-lg p-1.5 text-muted hover:text-success hover:bg-success/10 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                  </svg>
                </button>
              )}
              <button onClick={() => setOpen((v) => !v)} title={open ? 'Recolher' : 'Expandir'} className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Expanded body ── */}
          {open && (
            <>
              <div className="border-t border-border" />

              {/* Inner tabs */}
              <div className="flex gap-1 px-5 pt-3 border-b border-border">
                {(['media', 'products', 'logs'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={[
                      'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                      activeTab === tab
                        ? 'border-accent text-accent'
                        : 'border-transparent text-muted hover:text-foreground',
                    ].join(' ')}
                  >
                    {tab === 'media'
                      ? `Mídias (${mediaCount})`
                      : tab === 'products'
                        ? `Produtos (${products.length})`
                        : 'Histórico de alterações'}
                  </button>
                ))}
                {activeTab === 'media' && (
                  <div className="ml-auto pb-1.5 flex items-center gap-2">
                    <button onClick={openAdd} className="sm:hidden flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors">
                      + Mídia
                    </button>
                  </div>
                )}
                {activeTab === 'products' && (
                  <div className="ml-auto pb-1.5 flex items-center gap-2">
                    <button onClick={openAddProduct} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors">
                      + Produto
                    </button>
                  </div>
                )}
                {activeTab === 'logs' && (
                  <button onClick={fetchLogs} className="ml-auto mb-1.5 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-secondary transition-colors" title="Atualizar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
                    </svg>
                    Atualizar
                  </button>
                )}
              </div>

              {/* Media tab */}
              {activeTab === 'media' && (
                items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40">
                      <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <p className="text-sm text-muted">Nenhuma mídia nesta campanha.</p>
                    <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors">
                      + Adicionar primeira mídia
                    </button>
                  </div>
                ) : (
                  <div className="px-5 pb-5 pt-4 space-y-6">
                    {Array.from(byTerminal.entries()).map(([terminalId, group]) => {
                      const term = group[0].terminal;
                      const layoutName = term.store?.terminalLayout?.name ?? null;
                      return (
                        <div key={terminalId}>
                          <div className="flex items-center gap-2 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400 shrink-0">
                              <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
                            </svg>
                            <span className="text-xs font-semibold text-muted uppercase tracking-wide">{term.name}</span>
                            <span className="text-xs text-muted/60">· {group.length} {group.length === 1 ? 'mídia' : 'mídias'}</span>
                            {term.isPriceChecker && (
                              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">busca preço</span>
                            )}
                          </div>
                          <DraggableGrid
                            items={group}
                            onReorder={(reordered) => handleReorder(terminalId, reordered)}
                            onEdit={openEdit}
                            onDelete={openDeleteMedia}
                            onPreview={openPreview}
                            onDurationSaved={handleDurationSaved}
                            onAnimationSaved={handleAnimationSaved}
                            trailing={term.isPriceChecker ? <LockedPriceCheckerCard layoutName={layoutName} /> : null}
                          />
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* Products tab */}
              {activeTab === 'products' && (
                products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40">
                      <path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l-1 12H6z" />
                    </svg>
                    <p className="text-sm text-muted">Nenhum produto vinculado a esta campanha.</p>
                    <button onClick={openAddProduct} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors">
                      + Adicionar primeiro produto
                    </button>
                  </div>
                ) : (
                  <div className="px-5 pb-5 pt-4">
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-surface-secondary/50 text-xs text-muted">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">EAN</th>
                            <th className="px-4 py-2 text-left font-medium">Produto</th>
                            <th className="px-4 py-2 text-left font-medium">Preço 1</th>
                            <th className="px-4 py-2 text-left font-medium">Preço 2</th>
                            <th className="px-4 py-2 text-left font-medium">Preço 3</th>
                            <th className="px-4 py-2 text-left font-medium">Loja</th>
                            <th className="px-4 py-2 text-left font-medium">Adicionado em</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => (
                            <tr key={p.id} className="border-t border-border">
                              <td className="px-4 py-2 font-mono text-xs">{p.ean}</td>
                              <td className="px-4 py-2 font-medium text-foreground">{p.productName}</td>
                              <td className="px-4 py-2">{fmtBRL(p.preco1)}</td>
                              <td className="px-4 py-2">{fmtBRL(p.preco2)}</td>
                              <td className="px-4 py-2">{fmtBRL(p.preco3)}</td>
                              <td className="px-4 py-2 text-xs text-muted">{p.store?.name ?? '—'}</td>
                              <td className="px-4 py-2 text-xs text-muted">{fmtDateTime(p.createdAt)}</td>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => openDeleteProduct(p)}
                                  className="rounded-lg p-1.5 text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                  title="Remover produto"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Os preços e o nome são fixados no momento em que o produto é adicionado. Mudanças posteriores no catálogo não alteram o histórico desta campanha.
                    </p>
                  </div>
                )
              )}

              {/* Logs tab */}
              {activeTab === 'logs' && (
                <div className="px-5 pb-5 pt-4">
                  {!logsLoaded ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="h-7 w-7 rounded-full bg-surface-secondary animate-pulse shrink-0" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 w-48 rounded bg-surface-secondary animate-pulse" />
                            <div className="h-3 w-24 rounded bg-surface-secondary animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : logs.length === 0 ? (
                    <p className="text-sm text-muted text-center py-6">Nenhum registro de alteração.</p>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-3.5 top-3 bottom-3 w-px bg-border" />
                      <div className="space-y-4">
                        {logs.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 relative">
                            <LogIcon action={log.action} />
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-sm text-foreground">{log.description}</p>
                              {log.diff && Object.keys(log.diff).length > 0 && (
                                <div className="mt-1.5 rounded-lg bg-surface-secondary border border-border p-2 space-y-1">
                                  {Object.entries(log.diff).map(([field, { from, to }]) => (
                                    <div key={field} className="text-xs text-muted flex flex-wrap items-center gap-1">
                                      <span className="font-medium text-foreground/70">{field}:</span>
                                      <span className="line-through opacity-60">{from ?? '—'}</span>
                                      <span className="text-muted/50">→</span>
                                      <span className="text-foreground/80">{to ?? '—'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                                <span className="font-medium">{log.userName}</span>
                                <span>·</span>
                                <span>{fmtDateTime(log.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card.Content>
      </Card>

      {/* ── Add media modal ── */}
      <Modal state={addModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Adicionar mídia — {campaign.name}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Terminal">
                  <select value={addTerminalId} onChange={(e) => setAddTerminalId(e.target.value)} className={inputClass}>
                    <option value="">Selecione um terminal</option>
                    {mediaTerminals.map((t) => <option key={t.id} value={t.id}>{t.name}{t.ip ? ` — ${t.ip}` : ''}</option>)}
                  </select>
                </Field>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                  <button onClick={() => setAddMode('existing')} className={`flex-1 py-2 transition-colors ${addMode === 'existing' ? 'bg-accent text-white' : 'bg-surface text-muted hover:bg-surface-secondary'}`}>
                    Mídia existente
                  </button>
                  <button onClick={() => setAddMode('upload')} className={`flex-1 py-2 transition-colors ${addMode === 'upload' ? 'bg-accent text-white' : 'bg-surface text-muted hover:bg-surface-secondary'}`}>
                    Upload novo
                  </button>
                </div>
                {addMode === 'existing' ? (
                  <Field label="Mídia">
                    <select value={addMediaId} onChange={(e) => setAddMediaId(e.target.value)} className={inputClass}>
                      <option value="">Selecione uma mídia</option>
                      {allMedias.map((m) => <option key={m.id} value={m.id}>{m.fileName} ({m.type})</option>)}
                    </select>
                  </Field>
                ) : (
                  <Field label="Arquivo (imagem ou vídeo)">
                    <div className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-secondary px-4 py-6 transition-colors hover:border-accent hover:bg-accent/5" onClick={() => fileRef.current?.click()}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{addFile ? addFile.name : 'Clique para selecionar'}</p>
                        {!addFile && <p className="text-xs text-muted mt-0.5">Imagens até 5MB · Vídeos até 50MB</p>}
                        {addFile && <p className="text-xs text-muted mt-0.5">{formatSize(addFile.size)}</p>}
                      </div>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setAddFile(e.target.files?.[0] ?? null)} />
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Exibir a partir de">
                    <input type="date" value={addStartAt} onChange={(e) => setAddStartAt(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Exibir até">
                    <input type="date" value={addEndAt} onChange={(e) => setAddEndAt(e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <p className="text-xs text-muted -mt-2">Pré-preenchido com o período da campanha.</p>
                {addError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{addError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={addModal.close} isDisabled={adding}>Cancelar</Button>
                <Button variant="primary" onPress={handleAdd} isDisabled={adding}>{adding ? 'Adicionando...' : 'Adicionar'}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Edit media modal ── */}
      <Modal state={editModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Editar período de exibição</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                {editTarget && (() => {
                  const m = editTarget.media;
                  const o = editTarget.offer;
                  const thumbUrl = m?.url ?? o?.renderedImageUrl ?? null;
                  const thumbName = m?.fileName ?? o?.name ?? 'Item';
                  const isVideo = m?.type === 'video';
                  return (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
                      {!isVideo && thumbUrl
                        ? <img src={thumbUrl} alt={thumbName} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                        : <div className="h-10 w-10 rounded-lg bg-surface flex items-center justify-center shrink-0"><PlayIcon className="h-6 w-6 text-muted" /></div>}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{thumbName}</p>
                        <p className="text-xs text-muted">{editTarget.terminal.name}{m ? ` · ${formatSize(m.size)}` : o ? ` · ${o.kind}` : ''}</p>
                      </div>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Exibir a partir de">
                    <div className="flex gap-1.5">
                      <input type="date" value={editStartAt} onChange={(e) => setEditStartAt(e.target.value)} className={inputClass} />
                      {editStartAt && <button onClick={() => setEditStartAt('')} className="px-2 rounded-lg border border-border text-muted hover:text-danger hover:border-danger/40 transition-colors text-xs">✕</button>}
                    </div>
                  </Field>
                  <Field label="Exibir até">
                    <div className="flex gap-1.5">
                      <input type="date" value={editEndAt} onChange={(e) => setEditEndAt(e.target.value)} className={inputClass} />
                      {editEndAt && <button onClick={() => setEditEndAt('')} className="px-2 rounded-lg border border-border text-muted hover:text-danger hover:border-danger/40 transition-colors text-xs">✕</button>}
                    </div>
                  </Field>
                </div>
                <p className="text-xs text-muted -mt-2">Deixe em branco para usar o período da campanha.</p>
                {editError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{editError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={editModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleEdit} isDisabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Delete media modal ── */}
      <Modal state={deleteModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {deleteTarget?.offerId ? 'Remover oferta da campanha' : 'Remover mídia'}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Remover <span className="font-semibold text-foreground">{deleteTarget?.media?.fileName ?? deleteTarget?.offer?.name ?? 'este item'}</span>?
                  {deleteTarget?.media && ' O arquivo será excluído permanentemente se não estiver vinculado a nenhuma outra campanha.'}
                  {deleteTarget?.offerId && ' A oferta em si continua disponível em /ofertas. Os produtos dela que entraram nesta campanha por causa dela serão removidos (a menos que outra oferta da mesma campanha também os utilize).'}
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={deleteModal.close} isDisabled={deleting}>Cancelar</Button>
                <Button variant="danger" onPress={handleDeleteMedia} isDisabled={deleting}>{deleting ? 'Removendo...' : 'Remover'}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Media preview overlay ── */}
      {previewMedia && (
        <MediaPreview media={previewMedia} onClose={() => setPreviewMedia(null)} />
      )}

      {/* ── Add product modal ── */}
      <Modal state={addProductModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Adicionar produto à campanha</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Loja">
                  <select
                    value={addProductStoreId}
                    onChange={(e) => { setAddProductStoreId(e.target.value); setProductResults([]); }}
                    className={inputClass}
                    disabled={productAdding}
                  >
                    <option value="">Selecione uma loja</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Buscar produto (EAN, código ou nome)">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Comece a digitar para buscar"
                    className={inputClass}
                    disabled={!addProductStoreId || productAdding}
                  />
                </Field>
                {productError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{productError}</p>}

                <div className="rounded-xl border border-border max-h-80 overflow-auto">
                  {!addProductStoreId ? (
                    <p className="px-4 py-6 text-sm text-muted text-center">Selecione uma loja para listar os produtos.</p>
                  ) : productSearching ? (
                    <p className="px-4 py-6 text-sm text-muted text-center">Buscando...</p>
                  ) : productResults.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted text-center">Nenhum produto encontrado.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-surface-secondary/50 text-xs text-muted sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">EAN</th>
                          <th className="px-3 py-2 text-left font-medium">Produto</th>
                          <th className="px-3 py-2 text-left font-medium">Preço 1</th>
                          <th className="px-3 py-2 text-left font-medium">Preço 2</th>
                          <th className="px-3 py-2 text-left font-medium">Preço 3</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {productResults.map((p) => {
                          const already = products.some((cp) => cp.ean === p.ean);
                          return (
                            <tr key={p.id} className="border-t border-border">
                              <td className="px-3 py-2 font-mono text-xs">{p.ean}</td>
                              <td className="px-3 py-2 truncate max-w-xs" title={p.produto}>{p.produto}</td>
                              <td className="px-3 py-2">{fmtBRL(p.preco1)}</td>
                              <td className="px-3 py-2">{fmtBRL(p.preco2)}</td>
                              <td className="px-3 py-2">{fmtBRL(p.preco3)}</td>
                              <td className="px-3 py-2">
                                {already ? (
                                  <span className="text-xs text-muted">Já adicionado</span>
                                ) : (
                                  <button
                                    onClick={() => addProduct(p)}
                                    disabled={productAdding}
                                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors disabled:opacity-50"
                                  >
                                    + Adicionar
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={addProductModal.close} isDisabled={productAdding}>Fechar</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Delete product confirm ── */}
      <Modal state={deleteProductModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Remover produto</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Remover <span className="font-semibold text-foreground">{deleteProductTarget?.productName}</span> (EAN {deleteProductTarget?.ean}) desta campanha?
                  O snapshot de preços será apagado, mas o produto continua no catálogo da loja.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={deleteProductModal.close} isDisabled={deletingProduct}>Cancelar</Button>
                <Button variant="danger" onPress={handleDeleteProduct} isDisabled={deletingProduct}>
                  {deletingProduct ? 'Removendo...' : 'Remover'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Add offer to campaign ── */}
      <Modal state={addOfferModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Adicionar oferta na campanha</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Oferta">
                  {availableOffersLoading ? (
                    <p className="text-sm text-muted">Carregando ofertas...</p>
                  ) : availableOffers.length === 0 ? (
                    <p className="text-sm text-muted">
                      Nenhuma oferta ativa nesta loja. Crie em <strong>/ofertas</strong>.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-auto rounded-lg border border-border divide-y divide-border">
                      {availableOffers.map((o) => (
                        <label key={o.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-secondary/50">
                          <input
                            type="radio"
                            name="picked-offer"
                            checked={pickedOfferId === o.id}
                            onChange={() => setPickedOfferId(o.id)}
                            className="h-4 w-4 accent-accent"
                          />
                          {o.renderedImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.renderedImageUrl} alt={o.name} className="h-12 w-12 rounded object-cover bg-surface-secondary" />
                          ) : (
                            <div className="h-12 w-12 rounded bg-surface-secondary flex items-center justify-center text-[10px] text-muted">sem render</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{o.name}</p>
                            <p className="text-xs text-muted">{o.products.length} produto(s)</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </Field>

                {campaign.terminal?.id ? (
                  <p className="text-xs text-muted">
                    Terminal: <strong>{campaign.terminal.name}</strong> (definido pela campanha)
                  </p>
                ) : (
                  <Field label="Terminal">
                    <select className={inputClass} value={pickedTerminalId} onChange={(e) => setPickedTerminalId(e.target.value)}>
                      <option value="">Selecione...</option>
                      {storeTerminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Posição (0 = início)">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={pickedPosition}
                      onChange={(e) => setPickedPosition(parseInt(e.target.value) || 0)}
                    />
                  </Field>
                  <Field label="Duração (segundos)" hint="3–300s — quanto tempo a oferta fica na tela">
                    <input
                      type="number"
                      min={3}
                      max={300}
                      step={1}
                      className={inputClass}
                      value={pickedDuration}
                      onChange={(e) => setPickedDuration(Math.max(3, Math.min(300, parseInt(e.target.value) || 10)))}
                    />
                  </Field>
                </div>

                {placeOfferError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{placeOfferError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={addOfferModal.close} isDisabled={placingOffer}>Cancelar</Button>
                <Button variant="primary" onPress={placeOffer} isDisabled={placingOffer || !pickedOfferId}>
                  {placingOffer ? 'Adicionando...' : 'Adicionar à campanha'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Edit campaign modal ── */}
      <Modal state={editCampaignModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Editar campanha</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Thumbnail da campanha">
                  <EmojiPicker value={editCThumbnail} onChange={setEditCThumbnail} />
                </Field>
                <Field label="Nome da campanha">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data de início">
                    <input type="date" value={editCStartAt} onChange={(e) => setEditCStartAt(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Data de término">
                    <input type="date" value={editCEndAt} onChange={(e) => setEditCEndAt(e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <Field label="Loja (opcional)">
                  <select value={editCStoreId} onChange={(e) => setEditCStoreId(e.target.value)} className={inputClass}>
                    <option value="">Todas as lojas</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Terminal (opcional)">
                  <select value={editCTermId} onChange={(e) => setEditCTermId(e.target.value)} className={inputClass}>
                    <option value="">Todos os terminais</option>
                    {mediaTerminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                {editCError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{editCError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={editCampaignModal.close} isDisabled={savingCampaign}>Cancelar</Button>
                <Button variant="primary" onPress={handleEditCampaign} isDisabled={savingCampaign}>{savingCampaign ? 'Salvando...' : 'Salvar alterações'}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   Main page
──────────────────────────────────────────────────────────────── */
export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [stores, setStores]       = useState<Store[]>([]);
  const [allMedias, setAllMedias] = useState<Media[]>([]);
  const [loading, setLoading]     = useState(true);

  const newModal = useOverlayState();
  const delModal = useOverlayState();

  const [newName, setNewName]               = useState('');
  const [newStartsAt, setNewStartsAt]       = useState('');
  const [newEndsAt, setNewEndsAt]           = useState('');
  const [newStoreId, setNewStoreId]         = useState('');
  const [newTerminalId, setNewTerminalId]   = useState('');
  const [newThumbnail, setNewThumbnail]     = useState('');
  const [newError, setNewError]             = useState<string | null>(null);
  const [saving, setSaving]                 = useState(false);

  const [toDelete, setToDelete] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'expired' | 'inactive'>('all');

  const mediaTerminals = useMemo(() => terminals.filter((t) => t.isMediaDisplay), [terminals]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [cr, tr, sr, mr] = await Promise.all([
        fetch('/api/campaigns'), fetch('/api/terminals'), fetch('/api/stores'), fetch('/api/media'),
      ]);
      const [cd, td, sd, md] = await Promise.all([cr.json(), tr.json(), sr.json(), mr.json()]);
      setCampaigns(Array.isArray(cd) ? cd : []);
      setTerminals(Array.isArray(td) ? td : []);
      setStores(Array.isArray(sd) ? sd : []);
      setAllMedias(Array.isArray(md) ? md : []);
    } catch { setCampaigns([]); } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleCreate() {
    if (!newName.trim() || !newStartsAt || !newEndsAt) { setNewError('Nome e datas são obrigatórios.'); return; }
    setSaving(true); setNewError(null);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), startsAt: newStartsAt, endsAt: newEndsAt, storeId: newStoreId || undefined, terminalId: newTerminalId || undefined, thumbnail: newThumbnail || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setNewError(data.message ?? 'Erro ao criar.'); return; }
      newModal.close();
      setNewName(''); setNewStartsAt(''); setNewEndsAt(''); setNewStoreId(''); setNewTerminalId(''); setNewThumbnail('');
      fetchAll();
    } catch { setNewError('Erro de conexão.'); } finally { setSaving(false); }
  }

  function openDelete(c: Campaign) { setToDelete(c); delModal.open(); }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/campaigns/${toDelete.id}`, { method: 'DELETE' });
      delModal.close(); fetchAll();
    } catch { /* ignore */ } finally { setDeleting(false); setToDelete(null); }
  }

  async function handleReactivate(c: Campaign) {
    try {
      const res = await fetch(`/api/campaigns/${c.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.message ?? 'Erro ao reativar.');
        return;
      }
      fetchAll();
    } catch {
      alert('Erro de conexão.');
    }
  }

  const filtered = useMemo(() => campaigns.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || campaignStatus(c) === statusFilter;
    return matchSearch && matchStatus;
  }), [campaigns, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="mt-1 text-sm text-muted">Crie campanhas, gerencie mídias e acompanhe o histórico de alterações</p>
        </div>
        <Button variant="primary" size="sm" onPress={() => {
          setNewName(''); setNewStartsAt(''); setNewEndsAt(''); setNewStoreId(''); setNewTerminalId(''); setNewThumbnail(''); setNewError(null);
          newModal.open();
        }}>
          + Nova campanha
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Buscar campanha..." value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass + ' max-w-xs'} />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'scheduled', 'expired', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={['rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border',
                statusFilter === s ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:border-accent/40 hover:text-foreground',
              ].join(' ')}
            >
              {s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : s === 'scheduled' ? 'Agendadas' : s === 'expired' ? 'Expiradas' : 'Inativas'}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><Card.Content className="px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-surface-secondary animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-48 rounded bg-surface-secondary animate-pulse" />
                  <div className="h-3 w-32 rounded bg-surface-secondary animate-pulse" />
                </div>
              </div>
            </Card.Content></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card><Card.Content className="py-16 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40 mx-auto mb-3">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          <p className="text-sm text-muted">{campaigns.length === 0 ? 'Nenhuma campanha cadastrada. Crie a primeira!' : 'Nenhuma campanha encontrada com esses filtros.'}</p>
        </Card.Content></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              mediaTerminals={mediaTerminals}
              allMedias={allMedias}
              stores={stores}
              onDelete={openDelete}
              onReactivate={handleReactivate}
              onRefresh={fetchAll}
            />
          ))}
        </div>
      )}

      {/* New campaign modal */}
      <Modal state={newModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Nova campanha</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Thumbnail da campanha">
                  <EmojiPicker value={newThumbnail} onChange={setNewThumbnail} />
                </Field>
                <Field label="Nome da campanha">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Promoção de Verão" className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data de início"><input type="date" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)} className={inputClass} /></Field>
                  <Field label="Data de término"><input type="date" value={newEndsAt} onChange={(e) => setNewEndsAt(e.target.value)} className={inputClass} /></Field>
                </div>
                <Field label="Loja (opcional)">
                  <select value={newStoreId} onChange={(e) => setNewStoreId(e.target.value)} className={inputClass}>
                    <option value="">Todas as lojas</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Terminal (opcional)">
                  <select value={newTerminalId} onChange={(e) => setNewTerminalId(e.target.value)} className={inputClass}>
                    <option value="">Todos os terminais</option>
                    {mediaTerminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                {newError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{newError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={newModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleCreate} isDisabled={saving}>{saving ? 'Criando...' : 'Criar campanha'}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete campaign modal */}
      <Modal state={delModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Desativar campanha</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Confirmar a desativação de <span className="font-semibold text-foreground">{toDelete?.name}</span>?
                  As mídias param de ser exibidas no app, mas o histórico fica preservado e dá pra reativar depois.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={delModal.close} isDisabled={deleting}>Cancelar</Button>
                <Button variant="danger" onPress={handleDelete} isDisabled={deleting}>{deleting ? 'Desativando...' : 'Desativar'}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';

type Terminal = {
  id: string;
  name: string;
  ip: string | null;
  isMediaDisplay: boolean;
};

type Media = {
  id: string;
  url: string | null;
  fileName: string;
  originalName: string | null;
  mimeType: string;
  type: string;
  size: number;
  createdAt: string;
};

type TerminalMedia = {
  id: string;
  order: number;
  startsAt: string | null;
  endsAt: string | null;
  terminalId: string;
  mediaId: string;
  media: Media;
};

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  // Extrai YYYY-MM-DD sem converter timezone
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-muted">
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  // Interpreta a data como local (sem deslocamento de timezone)
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function mediaStatus(tm: TerminalMedia): 'active' | 'expired' | 'scheduled' | 'permanent' {
  const now = new Date();
  const ends = parseDate(tm.endsAt);
  const starts = parseDate(tm.startsAt);
  if (ends && ends < now) return 'expired';
  if (starts && starts > now) return 'scheduled';
  if (!starts && !ends) return 'permanent';
  return 'active';
}

function MediaCard({
  tm,
  onEdit,
  onDelete,
}: {
  tm: TerminalMedia;
  onEdit: (tm: TerminalMedia) => void;
  onDelete: (tm: TerminalMedia) => void;
}) {
  const { media } = tm;
  const status = mediaStatus(tm);
  const isExpired = status === 'expired';

  return (
    <div className={`overflow-hidden rounded-xl border bg-surface ${isExpired ? 'border-danger/30 opacity-60' : 'border-border'}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-surface-secondary/50">
        <GripIcon />
        <div className="flex items-center gap-1.5">
          {status === 'expired' && (
            <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-xs font-medium text-danger">Expirada</span>
          )}
          {status === 'scheduled' && (
            <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">Agendada</span>
          )}
          {status === 'active' && (
            <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">Vigente</span>
          )}
          <span className="text-xs text-muted font-mono">#{tm.order + 1}</span>
        </div>
      </div>
      {media.type === 'image' && media.url ? (
        <img src={media.url} alt={media.fileName} className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-surface-secondary">
          <PlayIcon />
        </div>
      )}
      <div className="p-3 space-y-1.5">
        <p className="truncate text-sm font-medium text-foreground" title={media.fileName}>
          {media.fileName}
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{media.type}</span>
          <span className="text-xs text-muted">{formatSize(media.size)}</span>
        </div>
        {(tm.startsAt || tm.endsAt) && (
          <div className={`flex items-center gap-1 text-xs pt-0.5 ${isExpired ? 'text-danger/70' : 'text-muted'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            <span>
              {fmtDate(tm.startsAt)}
              {' → '}
              {fmtDate(tm.endsAt)}
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-3 py-2">
        <button
          onClick={() => onEdit(tm)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
          Editar
        </button>
        <button
          onClick={() => onDelete(tm)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          Excluir
        </button>
      </div>
    </div>
  );
}

function DraggableGrid({
  items,
  onReorder,
  onEdit,
  onDelete,
}: {
  items: TerminalMedia[];
  onReorder: (items: TerminalMedia[]) => void;
  onEdit: (tm: TerminalMedia) => void;
  onDelete: (tm: TerminalMedia) => void;
}) {
  const [local, setLocal] = useState<TerminalMedia[]>(items);
  const dragging = useRef<{ id: string; index: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => { setLocal(items); }, [items]);

  function onDragStart(tm: TerminalMedia, index: number) {
    dragging.current = { id: tm.id, index };
    setDraggingId(tm.id);
  }

  function onDragOver(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (!dragging.current || dragging.current.index === targetIndex) return;
    const next = [...local];
    const [item] = next.splice(dragging.current.index, 1);
    next.splice(targetIndex, 0, item);
    dragging.current = { ...dragging.current, index: targetIndex };
    setLocal(next);
  }

  function onDrop() {
    setDraggingId(null);
    dragging.current = null;
    onReorder(local);
  }

  return (
    <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {local.map((tm, index) => (
        <div
          key={tm.id}
          draggable
          onDragStart={() => onDragStart(tm, index)}
          onDragOver={(e) => onDragOver(e, index)}
          onDrop={onDrop}
          onDragEnd={() => { setDraggingId(null); dragging.current = null; }}
          style={{ opacity: draggingId === tm.id ? 0.4 : 1 }}
          className="cursor-grab active:cursor-grabbing transition-opacity"
        >
          <MediaCard tm={tm} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ))}
    </div>
  );
}

function TerminalCollapse({
  terminal,
  items,
  onReorder,
  onEdit,
  onDelete,
  onAddBanner,
}: {
  terminal: Terminal;
  items: TerminalMedia[];
  onReorder: (items: TerminalMedia[]) => void;
  onEdit: (tm: TerminalMedia) => void;
  onDelete: (tm: TerminalMedia) => void;
  onAddBanner: (terminalId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    let vigentes = 0, expiradas = 0, agendadas = 0;
    for (const tm of items) {
      const s = mediaStatus(tm);
      if (s === 'active' || s === 'permanent') vigentes++;
      else if (s === 'expired') expiradas++;
      else if (s === 'scheduled') agendadas++;
    }
    return { total: items.length, vigentes, expiradas, agendadas };
  }, [items]);

  return (
    <Card>
      <Card.Content className="p-0">
        {/* Header — clicável */}
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-secondary/40 transition-colors rounded-t-xl"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-violet-400/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{terminal.name}</p>
              <p className="text-xs text-muted font-mono">{terminal.ip ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {stats.total > 0 && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-muted">
                  Total <span className="font-semibold text-foreground">{stats.total}</span>
                </span>
                {stats.vigentes > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
                    {stats.vigentes} vigente{stats.vigentes !== 1 ? 's' : ''}
                  </span>
                )}
                {stats.agendadas > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
                    {stats.agendadas} agendada{stats.agendadas !== 1 ? 's' : ''}
                  </span>
                )}
                {stats.expiradas > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                    {stats.expiradas} expirada{stats.expiradas !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
            <ChevronIcon open={open} />
          </div>
        </button>

        {/* Body */}
        {open && (
          <>
            {open && <div className="border-t border-border" />}
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40">
                  <rect width="20" height="14" x="2" y="3" rx="2" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
                </svg>
                <p className="text-sm text-muted">Nenhuma mídia vinculada a este terminal.</p>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddBanner(terminal.id); }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors"
                >
                  + Adicionar midia
                </button>
              </div>
            ) : (
              <DraggableGrid items={items} onReorder={onReorder} onEdit={onEdit} onDelete={onDelete} />
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
}

export default function BannersPage() {
  const [terminalMedias, setTerminalMedias] = useState<TerminalMedia[]>([]);
  const [medias, setMedias] = useState<Media[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Upload state
  const [uploadTerminalId, setUploadTerminalId] = useState('');
  const [uploadFile, setFile] = useState<File | null>(null);
  const [uploadStartAt, setUploadStartAt] = useState('');
  const [uploadEndAt, setUploadEndAt] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Link existing media state
  const [linkTerminalId, setLinkTerminalId] = useState('');
  const [linkMediaId, setLinkMediaId] = useState('');
  const [linkStartAt, setLinkStartAt] = useState('');
  const [linkEndAt, setLinkEndAt] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  // Bulk link state
  const [bulkMediaId, setBulkMediaId] = useState('');
  const [bulkTerminalIds, setBulkTerminalIds] = useState<Set<string>>(new Set());
  const [bulkStartAt, setBulkStartAt] = useState('');
  const [bulkEndAt, setBulkEndAt] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{ ok: string[]; fail: string[] } | null>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<TerminalMedia | null>(null);
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<TerminalMedia | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadModal = useOverlayState();
  const linkModal = useOverlayState();
  const bulkModal = useOverlayState();
  const editModal = useOverlayState();
  const deleteModal = useOverlayState();

  const midiaTerminals = useMemo(() => terminals.filter((t) => t.isMediaDisplay), [terminals]);

  // Map terminalId → items
  const mediaByTerminal = useMemo(() => {
    const map = new Map<string, TerminalMedia[]>();
    for (const tm of terminalMedias) {
      if (!map.has(tm.terminalId)) map.set(tm.terminalId, []);
      map.get(tm.terminalId)!.push(tm);
    }
    return map;
  }, [terminalMedias]);

  async function fetchTerminalMedias(terminalIds: string[]) {
    const results = await Promise.all(
      terminalIds.map((id) => fetch(`/api/admin/terminals/${id}/media`).then((r) => r.json())),
    );
    const all: TerminalMedia[] = results.flat().filter(Boolean);
    setTerminalMedias(all);
  }

  async function fetchData() {
    setLoading(true);
    try {
      const [tr, mr] = await Promise.all([fetch('/api/terminals'), fetch('/api/media')]);
      const [td, md] = await Promise.all([tr.json(), mr.json()]);
      const termList: Terminal[] = Array.isArray(td) ? td : [];
      const mediaList: Media[] = Array.isArray(md) ? md : [];
      setTerminals(termList);
      setMedias(mediaList);

      const midiaIds = termList.filter((t) => t.isMediaDisplay).map((t) => t.id);
      if (midiaIds.length > 0) {
        await fetchTerminalMedias(midiaIds);
      } else {
        setTerminalMedias([]);
      }
    } catch {
      setTerminals([]);
      setMedias([]);
      setTerminalMedias([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  async function handleReorder(groupItems: TerminalMedia[]) {
    if (groupItems.length === 0) return;
    const terminalId = groupItems[0].terminalId;
    const items = groupItems.map((tm, i) => ({ id: tm.id, order: i }));

    const groupIds = new Set(groupItems.map((tm) => tm.id));
    setTerminalMedias((prev) => {
      const others = prev.filter((tm) => !groupIds.has(tm.id));
      const updated = groupItems.map((tm, i) => ({ ...tm, order: i }));
      return [...others, ...updated];
    });

    await fetch(`/api/admin/terminals/${terminalId}/media/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }).catch(() => {});
  }

  function openUploadForTerminal(terminalId: string) {
    setFile(null);
    setUploadTerminalId(terminalId);
    setUploadStartAt('');
    setUploadEndAt('');
    setUploadError(null);
    uploadModal.open();
  }

  async function handleUpload() {
    if (!uploadFile) { setUploadError('Selecione um arquivo.'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const uploadRes = await fetch('/api/media', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { setUploadError(uploadData.message ?? 'Erro ao enviar arquivo.'); return; }

      if (uploadTerminalId) {
        const linkRes = await fetch(`/api/admin/terminals/${uploadTerminalId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId: uploadData.id,
            startsAt: uploadStartAt || null,
            endsAt: uploadEndAt || null,
          }),
        });
        if (!linkRes.ok) {
          const d = await linkRes.json();
          setUploadError(d.message ?? 'Erro ao vincular ao terminal.');
          return;
        }
      }

      uploadModal.close();
      fetchData();
    } catch {
      setUploadError('Erro de conexão.');
    } finally {
      setUploading(false);
    }
  }

  async function handleLink() {
    if (!linkMediaId || !linkTerminalId) { setLinkError('Selecione a mídia e o terminal.'); return; }
    setUploading(true);
    setLinkError(null);
    try {
      const res = await fetch(`/api/admin/terminals/${linkTerminalId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: linkMediaId,
          startsAt: linkStartAt || null,
          endsAt: linkEndAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setLinkError(data.message ?? 'Erro ao vincular.'); return; }
      linkModal.close();
      fetchData();
    } catch {
      setLinkError('Erro de conexão.');
    } finally {
      setUploading(false);
    }
  }

  async function handleBulkLink() {
    if (!bulkMediaId) { setBulkError('Selecione uma mídia.'); return; }
    if (bulkTerminalIds.size === 0) { setBulkError('Selecione ao menos um terminal.'); return; }
    setUploading(true);
    setBulkError(null);
    const ids = Array.from(bulkTerminalIds);
    const results = await Promise.allSettled(
      ids.map((tid) =>
        fetch(`/api/admin/terminals/${tid}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId: bulkMediaId,
            startsAt: bulkStartAt || null,
            endsAt: bulkEndAt || null,
          }),
        }).then((r) => (r.ok ? tid : Promise.reject(tid))),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<string>).value);
    const fail = results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason as string);
    setBulkResult({ ok, fail });
    setUploading(false);
    fetchData();
  }

  function openEdit(tm: TerminalMedia) {
    setEditTarget(tm);
    setEditStartAt(tm.startsAt ? tm.startsAt.slice(0, 10) : '');
    setEditEndAt(tm.endsAt ? tm.endsAt.slice(0, 10) : '');
    setEditError(null);
    editModal.open();
  }

  async function handleEdit() {
    if (!editTarget) return;
    setUploading(true);
    setEditError(null);
    try {
      const res = await fetch(
        `/api/admin/terminals/${editTarget.terminalId}/media/${editTarget.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startsAt: editStartAt || null,
            endsAt: editEndAt || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) { setEditError(data.message ?? 'Erro ao atualizar.'); return; }
      editModal.close();
      fetchData();
    } catch {
      setEditError('Erro de conexão.');
    } finally {
      setUploading(false);
    }
  }

  function openDelete(tm: TerminalMedia) {
    setDeleteTarget(tm);
    deleteModal.open();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/terminals/${deleteTarget.terminalId}/media/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      deleteModal.close();
      fetchData();
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mídias</h1>
          <p className="mt-1 text-sm text-muted">Gerencie as mídias exibidas nos terminais</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onPress={() => {
            setLinkMediaId(''); setLinkTerminalId(''); setLinkStartAt(''); setLinkEndAt(''); setLinkError(null);
            linkModal.open();
          }}>
            Vincular mídia
          </Button>
          <Button variant="ghost" size="sm" onPress={() => {
            setBulkMediaId(''); setBulkTerminalIds(new Set()); setBulkStartAt(''); setBulkEndAt(''); setBulkError(null); setBulkResult(null);
            bulkModal.open();
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Múltiplos terminais
          </Button>
          <Button variant="primary" size="sm" onPress={() => {
            setFile(null); setUploadTerminalId(''); setUploadStartAt(''); setUploadEndAt(''); setUploadError(null);
            uploadModal.open();
          }}>
            Novo banner
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <Card.Content className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-surface-secondary animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-36 rounded bg-surface-secondary animate-pulse" />
                    <div className="h-3 w-20 rounded bg-surface-secondary animate-pulse" />
                  </div>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      ) : midiaTerminals.length === 0 ? (
        <Card>
          <Card.Content className="py-12 text-center text-sm text-muted">
            Nenhum terminal do tipo <strong>Mídia</strong> cadastrado.
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-3">
          {midiaTerminals.map((terminal) => (
            <TerminalCollapse
              key={terminal.id}
              terminal={terminal}
              items={mediaByTerminal.get(terminal.id) ?? []}
              onReorder={handleReorder}
              onEdit={openEdit}
              onDelete={openDelete}
              onAddBanner={openUploadForTerminal}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal state={uploadModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Novo banner</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Terminal (opcional)">
                  {midiaTerminals.length === 0 ? (
                    <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-sm text-muted">
                      Nenhum terminal do tipo <strong>Mídia</strong> disponível.
                    </div>
                  ) : (
                    <select value={uploadTerminalId} onChange={(e) => setUploadTerminalId(e.target.value)} className={inputClass}>
                      <option value="">Sem terminal</option>
                      {midiaTerminals.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.ip ?? '—'}</option>)}
                    </select>
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início da exibição">
                    <input type="date" value={uploadStartAt} onChange={(e) => setUploadStartAt(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Fim da exibição">
                    <input type="date" value={uploadEndAt} onChange={(e) => setUploadEndAt(e.target.value)} className={inputClass} />
                  </Field>
                </div>

                <Field label="Arquivo (imagem ou vídeo)">
                  <div
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-secondary px-4 py-6 transition-colors hover:border-accent hover:bg-accent/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{uploadFile ? uploadFile.name : 'Clique para selecionar'}</p>
                      {!uploadFile && <p className="text-xs text-muted mt-0.5">Imagens até 5MB · Vídeos até 50MB</p>}
                      {uploadFile && <p className="text-xs text-muted mt-0.5">{formatSize(uploadFile.size)}</p>}
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </Field>
                {uploadError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{uploadError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={uploadModal.close} isDisabled={uploading}>Cancelar</Button>
                <Button variant="primary" onPress={handleUpload} isDisabled={uploading}>
                  {uploading ? 'Enviando...' : 'Enviar'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Link existing media Modal */}
      <Modal state={linkModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Vincular mídia existente</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Terminal">
                  <select value={linkTerminalId} onChange={(e) => setLinkTerminalId(e.target.value)} className={inputClass}>
                    <option value="">Selecione um terminal</option>
                    {midiaTerminals.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.ip ?? '—'}</option>)}
                  </select>
                </Field>
                <Field label="Mídia">
                  <select value={linkMediaId} onChange={(e) => setLinkMediaId(e.target.value)} className={inputClass}>
                    <option value="">Selecione uma mídia</option>
                    {medias.map((m) => <option key={m.id} value={m.id}>{m.fileName} ({m.type})</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início da exibição">
                    <input type="date" value={linkStartAt} onChange={(e) => setLinkStartAt(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Fim da exibição">
                    <input type="date" value={linkEndAt} onChange={(e) => setLinkEndAt(e.target.value)} className={inputClass} />
                  </Field>
                </div>
                {linkError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{linkError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={linkModal.close} isDisabled={uploading}>Cancelar</Button>
                <Button variant="primary" onPress={handleLink} isDisabled={uploading}>
                  {uploading ? 'Vinculando...' : 'Vincular'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Bulk Link Modal */}
      <Modal state={bulkModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Vincular a múltiplos terminais</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                {bulkResult ? (
                  <div className="space-y-3">
                    {bulkResult.ok.length > 0 && (
                      <div className="rounded-lg bg-success/10 px-4 py-3 space-y-1">
                        <p className="text-sm font-medium text-success">Vinculado com sucesso ({bulkResult.ok.length})</p>
                        {bulkResult.ok.map((tid) => {
                          const t = midiaTerminals.find((x) => x.id === tid);
                          return <p key={tid} className="text-xs text-success/80">{t?.name ?? tid}</p>;
                        })}
                      </div>
                    )}
                    {bulkResult.fail.length > 0 && (
                      <div className="rounded-lg bg-danger/10 px-4 py-3 space-y-1">
                        <p className="text-sm font-medium text-danger">Falhou ({bulkResult.fail.length})</p>
                        {bulkResult.fail.map((tid) => {
                          const t = midiaTerminals.find((x) => x.id === tid);
                          return <p key={tid} className="text-xs text-danger/80">{t?.name ?? tid}</p>;
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Field label="Mídia">
                      <select value={bulkMediaId} onChange={(e) => setBulkMediaId(e.target.value)} className={inputClass}>
                        <option value="">Selecione uma mídia</option>
                        {medias.map((m) => (
                          <option key={m.id} value={m.id}>{m.fileName} ({m.type})</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Terminais">
                      <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                        {midiaTerminals.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-muted">Nenhum terminal de mídia cadastrado.</p>
                        ) : (
                          <>
                            <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-secondary/50 transition-colors bg-surface-secondary/30">
                              <input
                                type="checkbox"
                                checked={bulkTerminalIds.size === midiaTerminals.length}
                                onChange={(e) => {
                                  if (e.target.checked) setBulkTerminalIds(new Set(midiaTerminals.map((t) => t.id)));
                                  else setBulkTerminalIds(new Set());
                                }}
                                className="h-4 w-4 rounded border-border accent-accent"
                              />
                              <span className="text-xs font-medium text-muted">Selecionar todos</span>
                            </label>
                            {midiaTerminals.map((t) => (
                              <label key={t.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-secondary/50 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={bulkTerminalIds.has(t.id)}
                                  onChange={(e) => {
                                    const next = new Set(bulkTerminalIds);
                                    if (e.target.checked) next.add(t.id);
                                    else next.delete(t.id);
                                    setBulkTerminalIds(next);
                                  }}
                                  className="h-4 w-4 rounded border-border accent-accent"
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-foreground">{t.name}</span>
                                  {t.ip && <span className="ml-2 text-xs text-muted font-mono">{t.ip}</span>}
                                </div>
                              </label>
                            ))}
                          </>
                        )}
                      </div>
                      {bulkTerminalIds.size > 0 && (
                        <p className="text-xs text-muted mt-1">{bulkTerminalIds.size} terminal(is) selecionado(s)</p>
                      )}
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Início da exibição">
                        <input type="date" value={bulkStartAt} onChange={(e) => setBulkStartAt(e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Fim da exibição">
                        <input type="date" value={bulkEndAt} onChange={(e) => setBulkEndAt(e.target.value)} className={inputClass} />
                      </Field>
                    </div>
                    {bulkError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{bulkError}</p>}
                  </>
                )}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                {bulkResult ? (
                  <Button variant="primary" onPress={() => { setBulkResult(null); bulkModal.close(); }}>Fechar</Button>
                ) : (
                  <>
                    <Button variant="ghost" onPress={bulkModal.close} isDisabled={uploading}>Cancelar</Button>
                    <Button variant="primary" onPress={handleBulkLink} isDisabled={uploading}>
                      {uploading ? 'Vinculando...' : `Vincular${bulkTerminalIds.size > 0 ? ` (${bulkTerminalIds.size})` : ''}`}
                    </Button>
                  </>
                )}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Edit Modal */}
      <Modal state={editModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Editar vínculo</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                {editTarget && (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
                    {editTarget.media.type === 'image' && editTarget.media.url ? (
                      <img src={editTarget.media.url} alt={editTarget.media.fileName} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-surface flex items-center justify-center shrink-0">
                        <PlayIcon />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{editTarget.media.fileName}</p>
                      <p className="text-xs text-muted">{formatSize(editTarget.media.size)}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início da exibição">
                    <div className="flex gap-1.5">
                      <input type="date" value={editStartAt} onChange={(e) => setEditStartAt(e.target.value)} className={inputClass} />
                      {editStartAt && (
                        <button onClick={() => setEditStartAt('')} title="Limpar" className="px-2 rounded-lg border border-border text-muted hover:text-danger hover:border-danger/40 transition-colors text-xs">✕</button>
                      )}
                    </div>
                  </Field>
                  <Field label="Fim da exibição">
                    <div className="flex gap-1.5">
                      <input type="date" value={editEndAt} onChange={(e) => setEditEndAt(e.target.value)} className={inputClass} />
                      {editEndAt && (
                        <button onClick={() => setEditEndAt('')} title="Limpar" className="px-2 rounded-lg border border-border text-muted hover:text-danger hover:border-danger/40 transition-colors text-xs">✕</button>
                      )}
                    </div>
                  </Field>
                </div>
                <p className="text-xs text-muted -mt-2">Deixe em branco para exibição permanente.</p>
                {editError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{editError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={editModal.close} isDisabled={uploading}>Cancelar</Button>
                <Button variant="primary" onPress={handleEdit} isDisabled={uploading}>
                  {uploading ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete Modal */}
      <Modal state={deleteModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Excluir banner</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Tem certeza que deseja excluir{' '}
                  <span className="font-semibold text-foreground">{deleteTarget?.media.fileName}</span>?
                  O arquivo será removido do storage e não poderá ser recuperado.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={deleteModal.close} isDisabled={deleting}>Cancelar</Button>
                <Button variant="danger" onPress={handleDelete} isDisabled={deleting}>
                  {deleting ? 'Removendo...' : 'Excluir'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

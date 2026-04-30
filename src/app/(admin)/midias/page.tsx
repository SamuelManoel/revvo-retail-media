'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';

type UsageRef = { id: string; name: string };

type Media = {
  id: string;
  url: string | null;
  fileName: string;
  originalName: string | null;
  mimeType: string;
  type: string; // 'image' | 'video'
  size: number;
  createdAt: string;
  storeId: string | null;
  companyId: string | null;
  store: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  usageCount: number;
  usedInCampaigns: UsageRef[];
  usedInTerminals: UsageRef[];
};

type SessionUser = {
  userId: string;
  companyId: string;
  name: string;
  isMaster: boolean;
};

type Store = { id: string; name: string; companyId: string; company?: { id: string; name: string } };
type Company = { id: string; name: string };

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function PlayIcon({ className = 'h-10 w-10 text-muted' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────
   Video thumbnail (canvas frame snapshot)
──────────────────────────────────────────────────────────────── */
function VideoThumbnail({ url, className = '' }: { url: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function handle() {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video!.videoWidth;
        canvas.height = video!.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video!, 0, 0, canvas.width, canvas.height);
        setThumb(canvas.toDataURL('image/png'));
      } catch { /* ignore */ }
    }
    video.addEventListener('loadeddata', handle);
    return () => video.removeEventListener('loadeddata', handle);
  }, [url]);

  if (thumb) return <img src={thumb} alt="" className={`object-cover ${className}`} />;

  return (
    <div className={`relative bg-surface-secondary ${className}`}>
      <video ref={videoRef} src={url} muted preload="metadata" className="absolute inset-0 h-full w-full object-cover opacity-0" />
      <div className="absolute inset-0 flex items-center justify-center"><PlayIcon /></div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Full-screen media preview
──────────────────────────────────────────────────────────────── */
function MediaPreview({ media, onClose }: { media: Media; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 backdrop-blur-sm transition-colors"
      >
        Fechar (Esc)
      </button>
      <div className="absolute top-4 left-4 z-10">
        <p className="text-sm text-white/80 font-medium truncate max-w-md">{media.fileName}</p>
      </div>
      <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {media.type === 'image' && media.url ? (
          <img src={media.url} alt={media.fileName} className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
        ) : media.url ? (
          <video src={media.url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-lg" />
        ) : null}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Media card
──────────────────────────────────────────────────────────────── */
function MediaCard({ media, onPreview, onDelete, showCompany }: {
  media: Media;
  onPreview: (m: Media) => void;
  onDelete: (m: Media) => void;
  showCompany: boolean;
}) {
  const inUse = media.usageCount > 0;
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-md">
      <button
        onClick={() => onPreview(media)}
        className="relative block w-full h-36 overflow-hidden focus:outline-none"
        title="Clique para visualizar"
      >
        {media.type === 'image' && media.url ? (
          <img src={media.url} alt={media.fileName} className="h-full w-full object-cover" />
        ) : media.url ? (
          <VideoThumbnail url={media.url} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-secondary">
            <PlayIcon />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            <span className="text-white text-xs font-medium">Ampliar</span>
          </div>
        </div>
      </button>

      <div className="p-3 space-y-1.5">
        <p className="truncate text-sm font-medium text-foreground" title={media.fileName}>{media.fileName}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{media.type}</span>
          <span className="text-xs text-muted">{formatSize(media.size)}</span>
        </div>
        {(media.store || (showCompany && media.company)) && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted">
            {showCompany && media.company && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5" title={`Empresa: ${media.company.name}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M5 21V8l7-5 7 5v13M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" />
                </svg>
                <span className="truncate max-w-27.5">{media.company.name}</span>
              </span>
            )}
            {media.store ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-400/10 text-violet-400 px-2 py-0.5" title={`Loja: ${media.store.name}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                <span className="truncate max-w-27.5">{media.store.name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5" title="Mídia legada sem loja">
                Sem loja
              </span>
            )}
          </div>
        )}
        {inUse ? (
          <p className="text-xs text-muted flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Em uso · {media.usageCount} {media.usageCount === 1 ? 'vínculo' : 'vínculos'}
          </p>
        ) : (
          <p className="text-xs text-success flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Livre
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-border px-3 py-2">
        <button
          onClick={() => onDelete(media)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:text-danger hover:bg-danger/10 transition-colors ml-auto"
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

/* ────────────────────────────────────────────────────────────────
   Main page
──────────────────────────────────────────────────────────────── */
export default function MidiasPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [medias, setMedias] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'in_use' | 'free'>('all');
  const [companyFilter, setCompanyFilter] = useState<string>(''); // master only
  const [storeFilter, setStoreFilter] = useState<string>('');     // '', '<storeId>', ou 'none' (sem loja)

  const uploadModal = useOverlayState();
  const deleteModal = useOverlayState();
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadStoreId, setUploadStoreId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Media | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Carrega sessão + lojas (sempre) + empresas (master)
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u: SessionUser | null) => {
        setUser(u);
        if (u?.isMaster) {
          fetch('/api/companies')
            .then((r) => r.json())
            .then((data) => setCompanies(Array.isArray(data) ? data : []))
            .catch(() => setCompanies([]));
        }
      })
      .catch(() => setUser(null));

    fetch('/api/stores')
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => setStores([]));
  }, []);

  // Lojas disponíveis filtradas pela empresa selecionada (master) ou pela própria company
  const availableStores = useMemo(() => {
    if (!user) return [] as Store[];
    if (user.isMaster) {
      return companyFilter ? stores.filter((s) => s.companyId === companyFilter) : stores;
    }
    return stores.filter((s) => s.companyId === user.companyId);
  }, [stores, user, companyFilter]);

  // Reset do filtro de loja quando a empresa muda
  useEffect(() => {
    if (storeFilter && storeFilter !== 'none' && !availableStores.find((s) => s.id === storeFilter)) {
      setStoreFilter('');
    }
  }, [availableStores, storeFilter]);

  async function fetchMedias() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyFilter) params.set('companyId', companyFilter);
      if (storeFilter) params.set('storeId', storeFilter);
      const qs = params.toString();
      const res = await fetch(`/api/media${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      setMedias(Array.isArray(data) ? data : []);
    } catch {
      setMedias([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMedias(); }, [companyFilter, storeFilter]);

  // Esc closes preview
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewMedia(null);
    }
    if (previewMedia) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [previewMedia]);

  const filtered = useMemo(() => {
    return medias.filter((m) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q || m.fileName.toLowerCase().includes(q) || (m.originalName ?? '').toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || m.type === typeFilter;
      const matchUsage =
        usageFilter === 'all' ||
        (usageFilter === 'in_use' && m.usageCount > 0) ||
        (usageFilter === 'free' && m.usageCount === 0);
      return matchSearch && matchType && matchUsage;
    });
  }, [medias, search, typeFilter, usageFilter]);

  const totalSize = useMemo(() => medias.reduce((acc, m) => acc + m.size, 0), [medias]);

  function openUpload() {
    setUploadFiles([]);
    setUploadError(null);
    setUploadProgress(null);
    // Pré-seleciona a loja: filtrada > única disponível
    if (storeFilter && storeFilter !== 'none') {
      setUploadStoreId(storeFilter);
    } else if (availableStores.length === 1) {
      setUploadStoreId(availableStores[0].id);
    } else {
      setUploadStoreId('');
    }
    uploadModal.open();
  }

  function pickFiles() {
    fileInputRef.current?.click();
  }

  function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploadFiles(list);
    setUploadError(null);
  }

  async function handleUpload() {
    if (uploadFiles.length === 0) { setUploadError('Selecione ao menos um arquivo.'); return; }
    if (!uploadStoreId) { setUploadError('Selecione a loja de destino.'); return; }
    setUploading(true);
    setUploadError(null);
    setUploadProgress({ done: 0, total: uploadFiles.length });

    const errors: string[] = [];
    for (let i = 0; i < uploadFiles.length; i++) {
      const f = uploadFiles[i];
      try {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('storeId', uploadStoreId);
        const res = await fetch('/api/media', { method: 'POST', body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          errors.push(`${f.name}: ${d.message ?? 'falha no upload'}`);
        }
      } catch {
        errors.push(`${f.name}: erro de conexão`);
      }
      setUploadProgress({ done: i + 1, total: uploadFiles.length });
    }

    setUploading(false);
    if (errors.length > 0) {
      setUploadError(errors.join(' · '));
    } else {
      uploadModal.close();
    }
    fetchMedias();
  }

  function openDelete(m: Media) {
    setDeleteTarget(m);
    deleteModal.open();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.message ?? 'Erro ao excluir.');
        return;
      }
      deleteModal.close();
      fetchMedias();
    } catch {
      alert('Erro de conexão.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mídia</h1>
          <p className="mt-1 text-sm text-muted">Arquivos do storage da empresa — disponíveis para uso em campanhas e terminais.</p>
        </div>
        <Button variant="primary" size="sm" onPress={openUpload}>+ Enviar arquivos</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><Card.Content className="px-4 py-3">
          <p className="text-xs text-muted">Arquivos</p>
          <p className="mt-1 text-xl font-bold text-foreground">{medias.length}</p>
        </Card.Content></Card>
        <Card><Card.Content className="px-4 py-3">
          <p className="text-xs text-muted">Em uso</p>
          <p className="mt-1 text-xl font-bold text-foreground">{medias.filter((m) => m.usageCount > 0).length}</p>
        </Card.Content></Card>
        <Card><Card.Content className="px-4 py-3">
          <p className="text-xs text-muted">Espaço utilizado</p>
          <p className="mt-1 text-xl font-bold text-foreground">{formatSize(totalSize)}</p>
        </Card.Content></Card>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Buscar arquivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass + ' max-w-xs'}
          />
          {user?.isMaster && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className={inputClass + ' sm:max-w-xs'}
            >
              <option value="">Todas as empresas</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className={inputClass + ' sm:max-w-xs'}
          >
            <option value="">Todas as lojas</option>
            <option value="none">Sem loja (legado)</option>
            {availableStores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'image', 'video'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={['rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
                  typeFilter === t ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:border-accent/40 hover:text-foreground'].join(' ')}
              >
                {t === 'all' ? 'Todos' : t === 'image' ? 'Imagens' : 'Vídeos'}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'in_use', 'free'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUsageFilter(u)}
                className={['rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
                  usageFilter === u ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:border-accent/40 hover:text-foreground'].join(' ')}
              >
                {u === 'all' ? 'Todos os usos' : u === 'in_use' ? 'Em uso' : 'Livres'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><Card.Content className="p-0">
              <div className="h-36 bg-surface-secondary animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-surface-secondary animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-surface-secondary animate-pulse" />
              </div>
            </Card.Content></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <Card.Content className="py-16 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted/40">
              <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <p className="mt-4 text-sm text-muted">
              {medias.length === 0 ? 'Nenhum arquivo no storage ainda.' : 'Nenhum arquivo encontrado com esses filtros.'}
            </p>
            {medias.length === 0 && (
              <button
                onClick={openUpload}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors"
              >
                + Enviar primeiro arquivo
              </button>
            )}
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((m) => (
            <MediaCard
              key={m.id}
              media={m}
              onPreview={setPreviewMedia}
              onDelete={openDelete}
              showCompany={!!user?.isMaster}
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
                <Modal.Heading className="text-base font-semibold text-foreground">Enviar arquivos</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Loja de destino</label>
                  <select
                    value={uploadStoreId}
                    onChange={(e) => setUploadStoreId(e.target.value)}
                    className={inputClass}
                    disabled={uploading}
                  >
                    <option value="">Selecione uma loja</option>
                    {availableStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{user?.isMaster && s.company ? ` — ${s.company.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted">Os arquivos serão salvos na pasta da loja no storage.</p>
                </div>

                <div
                  className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-secondary px-4 py-10 transition-colors hover:border-accent hover:bg-accent/5"
                  onClick={pickFiles}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); onFilesPicked(e.dataTransfer.files); }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  <div className="min-w-0 text-center">
                    <p className="text-sm text-foreground">Clique ou arraste para selecionar</p>
                    <p className="text-xs text-muted mt-0.5">Imagens até 5MB · Vídeos até 50MB</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onFilesPicked(e.target.files)}
                />

                {uploadFiles.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-auto">
                    {uploadFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{f.name}</p>
                          <p className="text-xs text-muted">{formatSize(f.size)}</p>
                        </div>
                        {!uploading && (
                          <button
                            onClick={() => setUploadFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-xs text-muted hover:text-danger px-2 py-1 rounded"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {uploadProgress && uploading && (
                  <p className="text-xs text-muted text-center">
                    Enviando {uploadProgress.done} de {uploadProgress.total}...
                  </p>
                )}

                {uploadError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger wrap-break-word">{uploadError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={uploadModal.close} isDisabled={uploading}>Cancelar</Button>
                <Button variant="primary" onPress={handleUpload} isDisabled={uploading || uploadFiles.length === 0}>
                  {uploading ? 'Enviando...' : `Enviar ${uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}`}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete Modal */}
      <Modal state={deleteModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Excluir do storage</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-3 px-6 py-5">
                {deleteTarget && (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
                    {deleteTarget.type === 'image' && deleteTarget.url ? (
                      <img src={deleteTarget.url} alt={deleteTarget.fileName} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-surface flex items-center justify-center shrink-0"><PlayIcon className="h-6 w-6 text-muted" /></div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{deleteTarget.fileName}</p>
                      <p className="text-xs text-muted">{formatSize(deleteTarget.size)} · {fmtDateTime(deleteTarget.createdAt)}</p>
                    </div>
                  </div>
                )}

                {deleteTarget && deleteTarget.usageCount > 0 ? (
                  <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 space-y-2">
                    <p className="text-sm font-semibold text-danger flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
                      </svg>
                      Este arquivo está em uso
                    </p>
                    <div className="text-xs text-foreground/80 space-y-1">
                      {deleteTarget.usedInCampaigns.length > 0 && (
                        <p><strong>Campanhas:</strong> {deleteTarget.usedInCampaigns.map((c) => c.name).join(', ')}</p>
                      )}
                      {deleteTarget.usedInTerminals.length > 0 && (
                        <p><strong>Terminais:</strong> {deleteTarget.usedInTerminals.map((t) => t.name).join(', ')}</p>
                      )}
                    </div>
                    <p className="text-xs text-danger/80">Excluir agora vai remover o arquivo dessas campanhas/terminais e do storage permanentemente.</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted">O arquivo será removido permanentemente do storage.</p>
                )}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={deleteModal.close} isDisabled={deleting}>Cancelar</Button>
                <Button variant="danger" onPress={handleDelete} isDisabled={deleting}>
                  {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {previewMedia && <MediaPreview media={previewMedia} onClose={() => setPreviewMedia(null)} />}
    </div>
  );
}

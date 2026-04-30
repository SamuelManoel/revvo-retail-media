'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import Link from 'next/link';
import { ActionTooltip } from '@/components/ui/action-tooltip';

type Product = {
  id: string;
  ean: string;
  codigo_produto: string | null;
  produto: string;
  preco1: string;
  preco2: string | null;
  preco3: string | null;
  image_url: string | null;
  status: boolean;
  updated_at: string;
};

type SortKey = 'produto' | 'ean' | 'codigo_produto' | 'preco1' | 'preco2' | 'preco3' | 'status' | 'updated_at';
type SortOrder = 'asc' | 'desc';

const SORT_STORAGE_KEY = 'catalogo-sort';

const DEFAULT_SORT: { sortBy: SortKey; sortOrder: SortOrder } = { sortBy: 'produto', sortOrder: 'asc' };

function loadSort(): { sortBy: SortKey; sortOrder: SortOrder } {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.sortBy && parsed.sortOrder) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_SORT;
}

function saveSort(sortBy: SortKey, sortOrder: SortOrder) {
  try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ sortBy, sortOrder })); } catch { /* ignore */ }
}

type Store = { id: string; name: string; company: { id: string; name: string } | null };

const PAGE_SIZE_OPTIONS = [
  { value: '25',  label: '25 por página' },
  { value: '50',  label: '50 por página' },
  { value: '100', label: '100 por página' },
];

const EMPTY_FORM = { ean: '', codigoProduto: '', produto: '', preco1: '', preco2: '', preco3: '', imageUrl: '', status: true };

const inputClass = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

function fmt(value: string | null) {
  if (!value) return '—';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 13) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 5) pages.push('...');
  for (let i = Math.max(2, current - 3); i <= Math.min(total - 1, current + 3); i++) pages.push(i);
  if (current < total - 4) pages.push('...');
  pages.push(total);
  return pages;
}

function ProductPlaceholder() {
  return (
    <div className="h-10 w-10 rounded-md bg-surface-secondary shrink-0 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/>
        <path d="M12 22V12"/>
      </svg>
    </div>
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

export default function CatalogoPage() {
  const { id } = useParams<{ id: string }>();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>(DEFAULT_SORT.sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT.sortOrder);

  // Form modal
  const formModal = useOverlayState();
  const deleteModal = useOverlayState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  async function fetchStore() {
    try {
      const res = await fetch(`/api/stores/${id}`);
      if (res.ok) setStore(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchProducts(pageNum = 1, query = '', pageLimit = limit, sb = sortBy, so = sortOrder) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(pageLimit), sortBy: sb, sortOrder: so });
      if (query) params.set('q', query);
      const res = await fetch(`/api/stores/${id}/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStore();
    const saved = loadSort();
    setSortBy(saved.sortBy);
    setSortOrder(saved.sortOrder);
    fetchProducts(1, '', limit, saved.sortBy, saved.sortOrder);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleSearch() {
    setPage(1);
    setQ(search);
    fetchProducts(1, search, limit, sortBy, sortOrder);
  }

  function handlePageChange(next: number) {
    setPage(next);
    fetchProducts(next, q, limit, sortBy, sortOrder);
  }

  function handleLimitChange(next: number) {
    setLimit(next);
    setPage(1);
    fetchProducts(1, q, next, sortBy, sortOrder);
  }

  function handleSort(column: SortKey) {
    const newOrder: SortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortOrder(newOrder);
    saveSort(column, newOrder);
    setPage(1);
    fetchProducts(1, q, limit, column, newOrder);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImagePreview(null);
    setFormError(null);
    formModal.open();
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      ean: p.ean,
      codigoProduto: p.codigo_produto ?? '',
      produto: p.produto,
      preco1: p.preco1,
      preco2: p.preco2 ?? '',
      preco3: p.preco3 ?? '',
      imageUrl: p.image_url ?? '',
      status: p.status,
    });
    setImagePreview(p.image_url);
    setFormError(null);
    formModal.open();
  }

  function openDelete(p: Product) {
    setDeleteTarget(p);
    deleteModal.open();
  }

  async function handleUploadImage(file: File) {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/media', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message ?? 'Erro ao fazer upload.'); return; }
      const url: string = data.url ?? '';
      setForm((f) => ({ ...f, imageUrl: url }));
      setImagePreview(url);
    } catch {
      setFormError('Erro ao fazer upload da imagem.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!form.ean || !form.produto || !form.preco1) {
      setFormError('EAN, nome e Preço 1 são obrigatórios.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        ean: form.ean.trim(),
        produto: form.produto.trim(),
        preco1: Number(form.preco1),
        preco2: form.preco2 ? Number(form.preco2) : null,
        preco3: form.preco3 ? Number(form.preco3) : null,
        codigoProduto: form.codigoProduto.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        status: form.status,
      };

      const res = editingId
        ? await fetch(`/api/stores/${id}/products/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
        : await fetch(`/api/stores/${id}/products`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });

      const data = await res.json();
      if (!res.ok) { setFormError(data.message ?? 'Erro ao salvar produto.'); return; }
      formModal.close();
      fetchProducts(page, q, limit);
    } catch {
      setFormError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/stores/${id}/products/${deleteTarget.id}`, { method: 'DELETE' });
      deleteModal.close();
      fetchProducts(page, q, limit);
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const storeName = store?.name ?? '...';
  const pageNumbers = buildPageNumbers(page, pages);
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <Link href="/lojas" className="hover:text-foreground transition-colors">Lojas</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{storeName}</span>
            <span>/</span>
            <span>Catálogo</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo de Produtos</h1>
          <p className="mt-1 text-sm text-muted">{storeName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/lojas">
            <Button variant="ghost" size="sm">← Voltar</Button>
          </Link>
          <Link href={`/lojas/${id}/layout-terminal`}>
            <Button variant="secondary" size="sm">Layout do terminal</Button>
          </Link>
          <Button variant="primary" size="sm" onPress={openCreate}>+ Novo produto</Button>
        </div>
      </div>

      <Card>
        <Card.Content className="p-0">
          {/* Table header */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-foreground">Produtos</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                {loading ? '—' : total}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={String(limit)}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="h-8 rounded-lg border border-border bg-surface-secondary px-2 pr-7 text-xs text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
              >
                {PAGE_SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="EAN, código ou nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 rounded-lg border border-border bg-surface-secondary pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors w-52"
                />
              </div>
              <Button variant="primary" size="sm" onPress={handleSearch}>Buscar</Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {([
                    ['EAN', 'ean'],
                    ['Código', 'codigo_produto'],
                    ['Produto', 'produto'],
                    ['Preço 1', 'preco1'],
                    ['Preço 2', 'preco2'],
                    ['Preço 3', 'preco3'],
                    ['Status', 'status'],
                    ['Atualizado', 'updated_at'],
                  ] as [string, SortKey][]).map(([label, key]) => (
                    <th key={key} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">
                      <button
                        onClick={() => handleSort(key)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {label}
                        {sortBy === key ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                            {sortOrder === 'asc' ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                            <path d="m6 9 6-6 6 6"/><path d="m6 15 6 6 6-6"/>
                          </svg>
                        )}
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-sm text-muted">
                      {q ? 'Nenhum produto encontrado para esta busca.' : 'Nenhum produto cadastrado ainda.'}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-muted whitespace-nowrap">{p.ean}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted">{p.codigo_produto ?? '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.produto}
                              className="h-10 w-10 rounded-md object-cover shrink-0 bg-surface-secondary"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={p.image_url ? 'hidden' : ''}>
                            <ProductPlaceholder />
                          </div>
                          <span className="font-medium text-foreground">{p.produto}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-foreground font-medium whitespace-nowrap">{fmt(p.preco1)}</td>
                      <td className="px-5 py-3 text-muted whitespace-nowrap">{fmt(p.preco2)}</td>
                      <td className="px-5 py-3 text-muted whitespace-nowrap">{fmt(p.preco3)}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={async () => {
                            const newStatus = !p.status;
                            setProducts((prev) => prev.map((item) => item.id === p.id ? { ...item, status: newStatus } : item));
                            await fetch(`/api/stores/${id}/products/${p.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: newStatus }),
                            });
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            p.status
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-zinc-500/10 text-zinc-500'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${p.status ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                          {p.status ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                        {new Date(p.updated_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <ActionTooltip label="Editar produto">
                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                          </ActionTooltip>
                          <ActionTooltip label="Excluir produto">
                            <button onClick={() => openDelete(p)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </ActionTooltip>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer / Pagination */}
          {!loading && total > 0 && (
            <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-wrap gap-4">
              <p className="text-xs text-muted">
                Mostrando <span className="text-foreground font-medium">{start}–{end}</span> de{' '}
                <span className="text-foreground font-medium">{total}</span> produtos
              </p>
              {pages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted hover:bg-surface-secondary hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === '...' ? (
                      <span key={`e-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted select-none">···</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p as number)}
                        className={`h-8 w-8 flex items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                          p === page
                            ? 'border-accent bg-accent text-white'
                            : 'border-border text-muted hover:bg-surface-secondary hover:text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === pages}
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted hover:bg-surface-secondary hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Product Form Modal */}
      <Modal state={formModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {editingId ? 'Editar produto' : 'Novo produto'}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5 max-h-[70vh] overflow-y-auto">

                {/* Image section */}
                <div className="flex gap-4 items-start">
                  <div className="shrink-0">
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="h-20 w-20 rounded-lg object-cover bg-surface-secondary border border-border"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-lg bg-surface-secondary border border-border flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                          <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Field label="URL da imagem">
                      <input
                        type="text"
                        placeholder="https://..."
                        value={form.imageUrl}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, imageUrl: e.target.value }));
                          setImagePreview(e.target.value || null);
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">ou</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="text-xs text-accent hover:text-accent/80 underline underline-offset-2 transition-colors disabled:opacity-50"
                      >
                        {uploadingImage ? 'Enviando...' : 'Fazer upload de arquivo'}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="EAN *">
                    <input type="text" placeholder="7891234567890" value={form.ean}
                      onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Código do produto">
                    <input type="text" placeholder="COD-001" value={form.codigoProduto}
                      onChange={(e) => setForm((f) => ({ ...f, codigoProduto: e.target.value }))} className={inputClass} />
                  </Field>
                </div>

                <Field label="Nome do produto *">
                  <input type="text" placeholder="Ex.: Arroz Tipo 1 5kg" value={form.produto}
                    onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))} className={inputClass} />
                </Field>

                <div className="grid grid-cols-3 gap-4">
                  <Field label="Preço 1 *">
                    <input type="number" step="0.01" min="0" placeholder="0,00" value={form.preco1}
                      onChange={(e) => setForm((f) => ({ ...f, preco1: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Preço 2">
                    <input type="number" step="0.01" min="0" placeholder="0,00" value={form.preco2}
                      onChange={(e) => setForm((f) => ({ ...f, preco2: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Preço 3">
                    <input type="number" step="0.01" min="0" placeholder="0,00" value={form.preco3}
                      onChange={(e) => setForm((f) => ({ ...f, preco3: e.target.value }))} className={inputClass} />
                  </Field>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Produto ativo</p>
                    <p className="text-xs text-muted">Produtos inativos não aparecem nas consultas do terminal</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.status}
                    onClick={() => setForm((f) => ({ ...f, status: !f.status }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.status ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.status ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={formModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleSave} isDisabled={saving || uploadingImage}>
                  {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar'}
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
                <Modal.Heading className="text-base font-semibold text-foreground">Excluir produto</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Tem certeza que deseja excluir{' '}
                  <span className="font-semibold text-foreground">{deleteTarget?.produto}</span>? Essa ação não pode ser desfeita.
                </p>
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={deleteModal.close} isDisabled={deleting}>Cancelar</Button>
                <Button variant="danger" onPress={handleDelete} isDisabled={deleting}>
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

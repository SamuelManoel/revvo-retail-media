'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { ActionTooltip } from '@/components/ui/action-tooltip';

type Store = { id: string; name: string; company: { id: string; name: string } | null };

type Integration = {
  id: string;
  baseUrl: string;
  token: string | null;
  endpointProductByEan: string;
  endpointCatalog: string;
  endpointFullLoad: string | null;
  endpointIncremental: string | null;
  lastSyncAt: string | null;
  isActive: boolean;
};

type Product = {
  id: string;
  ean: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  price: string;
  offerPrice: string | null;
  clubPrice: string | null;
  stock: number | null;
  isActive: boolean;
  externalId: string | null;
  updatedAt: string;
};

type ProductsResponse = {
  products: Product[];
  total: number;
  page: number;
  pages: number;
};

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

function fmt(val: string | null, fallback = '—') {
  if (!val) return fallback;
  return `R$ ${Number(val).toFixed(2).replace('.', ',')}`;
}

const EMPTY_INTEGRATION = {
  baseUrl: '',
  token: '',
  endpointProductByEan: '/terminal/product/{ean}',
  endpointCatalog: '/terminal/product',
  endpointFullLoad: '',
  endpointIncremental: '',
  isActive: true,
};

const EMPTY_PRODUCT = {
  ean: '', name: '', price: '', offerPrice: '', clubPrice: '',
  stock: '', imageUrl: '', description: '', externalId: '', isActive: true,
};

function IconEdit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}


export default function CatalogoPage() {
  const { id } = useParams<{ id: string }>();

  const [store, setStore] = useState<Store | null>(null);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [productsData, setProductsData] = useState<ProductsResponse>({ products: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [integrationForm, setIntegrationForm] = useState(EMPTY_INTEGRATION);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const integrationModal = useOverlayState();
  const productModal = useOverlayState();
  const editModal = useOverlayState();
  const deleteModal = useOverlayState();
  const clearModal = useOverlayState();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function fetchStore() {
    const [sr, ir] = await Promise.all([
      fetch(`/api/stores/${id}`),
      fetch(`/api/stores/${id}/integration`),
    ]);
    const [sd, id_] = await Promise.all([sr.json(), ir.json()]);
    setStore(sr.ok ? sd : null);
    setIntegration(ir.ok && id_ ? id_ : null);
    setLoading(false);
  }

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (debouncedSearch) params.set('q', debouncedSearch);
    const res = await fetch(`/api/stores/${id}/products?${params}`);
    if (res.ok) setProductsData(await res.json());
    setProductsLoading(false);
  }, [id, page, debouncedSearch]);

  useEffect(() => { fetchStore(); }, [id]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function openIntegration() {
    setIntegrationForm(integration ? {
      baseUrl: integration.baseUrl,
      token: integration.token ?? '',
      endpointProductByEan: integration.endpointProductByEan,
      endpointCatalog: integration.endpointCatalog,
      endpointFullLoad: integration.endpointFullLoad ?? '',
      endpointIncremental: integration.endpointIncremental ?? '',
      isActive: integration.isActive,
    } : EMPTY_INTEGRATION);
    setError(null);
    integrationModal.open();
  }

  function openEdit(p: Product) {
    setEditTarget(p);
    setProductForm({
      ean: p.ean,
      name: p.name,
      price: p.price,
      offerPrice: p.offerPrice ?? '',
      clubPrice: p.clubPrice ?? '',
      stock: p.stock !== null ? String(p.stock) : '',
      imageUrl: p.imageUrl ?? '',
      description: p.description ?? '',
      externalId: p.externalId ?? '',
      isActive: p.isActive,
    });
    setError(null);
    editModal.open();
  }

  function openDelete(p: Product) {
    setDeleteTarget(p);
    deleteModal.open();
  }

  async function handleSaveIntegration() {
    if (!integrationForm.baseUrl) { setError('baseUrl é obrigatório.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${id}/integration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...integrationForm,
          token: integrationForm.token || null,
          endpointFullLoad: integrationForm.endpointFullLoad || null,
          endpointIncremental: integrationForm.endpointIncremental || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao salvar.'); return; }
      setIntegration(data);
      integrationModal.close();
    } catch { setError('Erro de conexão.'); }
    finally { setSaving(false); }
  }

  async function handleSaveProduct() {
    const { ean, name, price } = productForm;
    if (!ean || !name || !price) { setError('EAN, nome e preço são obrigatórios.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          price: Number(price),
          offerPrice: productForm.offerPrice ? Number(productForm.offerPrice) : null,
          clubPrice: productForm.clubPrice ? Number(productForm.clubPrice) : null,
          stock: productForm.stock ? Number(productForm.stock) : null,
          externalId: productForm.externalId || productForm.ean,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao salvar produto.'); return; }
      productModal.close();
      setProductForm(EMPTY_PRODUCT);
      fetchProducts();
    } catch { setError('Erro de conexão.'); }
    finally { setSaving(false); }
  }

  async function handleEditProduct() {
    if (!editTarget) return;
    const { ean, name, price } = productForm;
    if (!ean || !name || !price) { setError('EAN, nome e preço são obrigatórios.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${id}/products/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ean: productForm.ean,
          name: productForm.name,
          price: Number(productForm.price),
          offerPrice: productForm.offerPrice ? Number(productForm.offerPrice) : null,
          clubPrice: productForm.clubPrice ? Number(productForm.clubPrice) : null,
          stock: productForm.stock ? Number(productForm.stock) : null,
          imageUrl: productForm.imageUrl || null,
          description: productForm.description || null,
          isActive: productForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao atualizar produto.'); return; }
      editModal.close();
      fetchProducts();
    } catch { setError('Erro de conexão.'); }
    finally { setSaving(false); }
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await fetch(`/api/stores/${id}/products/${deleteTarget.id}`, { method: 'DELETE' });
      deleteModal.close();
      fetchProducts();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleToggleActive(p: Product) {
    await fetch(`/api/stores/${id}/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    fetchProducts();
  }

  async function handleClearCatalog() {
    setSaving(true);
    try {
      await fetch(`/api/stores/${id}/products`, { method: 'DELETE' });
      clearModal.close();
      fetchProducts();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  const pageNumbers = useMemo(() => {
    const total = productsData.pages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (page >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', page - 1, page, page + 1, '...', total];
  }, [page, productsData.pages]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-surface-secondary animate-pulse" />
        <Card><Card.Content className="py-12 text-center text-sm text-muted">Carregando...</Card.Content></Card>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Loja não encontrada</h1>
        <Link href="/lojas" className="text-sm text-accent hover:underline">← Voltar para Lojas</Link>
      </div>
    );
  }

  const productFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="EAN / Código de barras">
          <input type="text" placeholder="7891234567890" value={productForm.ean}
            onChange={(e) => setProductForm((f) => ({ ...f, ean: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="ID externo (opcional)">
          <input type="text" placeholder="ID no ERP" value={productForm.externalId}
            onChange={(e) => setProductForm((f) => ({ ...f, externalId: e.target.value }))} className={inputClass} />
        </Field>
      </div>
      <Field label="Nome do produto">
        <input type="text" placeholder="Ex.: Arroz Integral 1kg" value={productForm.name}
          onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Preço (R$)">
          <input type="number" min={0} step={0.01} placeholder="9.90" value={productForm.price}
            onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="Preço oferta">
          <input type="number" min={0} step={0.01} placeholder="7.90" value={productForm.offerPrice}
            onChange={(e) => setProductForm((f) => ({ ...f, offerPrice: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="Preço clube">
          <input type="number" min={0} step={0.01} placeholder="6.90" value={productForm.clubPrice}
            onChange={(e) => setProductForm((f) => ({ ...f, clubPrice: e.target.value }))} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Estoque (opcional)">
          <input type="number" min={0} placeholder="100" value={productForm.stock}
            onChange={(e) => setProductForm((f) => ({ ...f, stock: e.target.value }))} className={inputClass} />
        </Field>
        <Field label="URL da imagem (opcional)">
          <input type="url" placeholder="https://..." value={productForm.imageUrl}
            onChange={(e) => setProductForm((f) => ({ ...f, imageUrl: e.target.value }))} className={inputClass} />
        </Field>
      </div>
      <Field label="Descrição (opcional)">
        <textarea rows={2} placeholder="Descrição do produto..." value={productForm.description}
          onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
          className={inputClass + ' resize-none'} />
      </Field>
      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          onClick={() => setProductForm((f) => ({ ...f, isActive: !f.isActive }))}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${productForm.isActive ? 'bg-accent' : 'bg-border'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${productForm.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-sm text-foreground">Produto ativo</span>
      </label>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 text-sm text-muted flex-wrap">
            <Link href="/lojas" className="hover:text-foreground transition-colors">Lojas</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{store.name}</span>
            <span>/</span>
            <span className="text-foreground">Catálogo</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{store.name}</h1>
          {store.company && <p className="text-sm text-muted mt-0.5">{store.company.name}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/lojas/${id}/licencas`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted border border-border hover:bg-surface-secondary transition-colors"
          >
            Licenças
          </Link>
          <Button variant="ghost" size="sm" onPress={openIntegration}>
            {integration ? 'Editar integração' : 'Configurar integração'}
          </Button>
          <Button variant="primary" size="sm" onPress={() => { setProductForm(EMPTY_PRODUCT); setError(null); productModal.open(); }}>
            + Produto
          </Button>
        </div>
      </div>

      {/* Integration card */}
      {integration ? (
        <Card>
          <Card.Content className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Integração</h2>
              <div className="flex items-center gap-2">
                {integration.lastSyncAt && (
                  <span className="text-xs text-muted">
                    Última sync: {new Date(integration.lastSyncAt).toLocaleString('pt-BR')}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${integration.isActive ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${integration.isActive ? 'bg-success' : 'bg-muted'}`} />
                  {integration.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1.5 text-xs">
              {[
                ['Base URL', integration.baseUrl],
                ['Por EAN', integration.endpointProductByEan],
                ['Catálogo', integration.endpointCatalog],
                ['Carga completa', integration.endpointFullLoad ?? '—'],
                ['Incremental', integration.endpointIncremental ?? '—'],
                ['Token', integration.token ? '••••••••' : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="text-muted shrink-0">{label}:</span>
                  <span className="text-foreground font-mono truncate">{value}</span>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted">Nenhuma integração configurada para esta loja.</p>
            <Button variant="ghost" size="sm" onPress={openIntegration}>Configurar agora</Button>
          </Card.Content>
        </Card>
      )}

      {/* Terminal API URL */}
      <Card>
        <Card.Content className="px-5 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-medium text-muted mb-0.5">Endpoint público por EAN</p>
              <code className="text-sm font-mono text-foreground select-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/terminal/{id}/{'{'}<span className="text-accent">ean</span>{'}'}
              </code>
            </div>
            <button
              onClick={() => {
                const url = `${window.location.origin}/api/terminal/${id}/{ean}`;
                navigator.clipboard.writeText(url);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted border border-border hover:bg-surface-secondary transition-colors shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              Copiar
            </button>
          </div>
        </Card.Content>
      </Card>

      {/* Catalog table */}
      <Card>
        <Card.Content className="p-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap gap-y-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-foreground">Catálogo</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                {productsData.total}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nome ou EAN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-surface-secondary pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors w-52"
                />
              </div>
              {productsData.total > 0 && (
                <button
                  onClick={() => clearModal.open()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
                >
                  Limpar catálogo
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['EAN', 'Produto', 'Preço', 'Oferta', 'Clube', 'Estoque', 'Status', 'Atualizado', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap last:w-24">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productsLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : productsData.products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-14 text-center text-sm text-muted">
                      {debouncedSearch ? 'Nenhum produto encontrado.' : 'Nenhum produto no catálogo.'}
                    </td>
                  </tr>
                ) : (
                  productsData.products.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted">{p.ean}</td>
                      <td className="px-5 py-3.5 w-48 max-w-48">
                        <div className="flex items-center gap-2 min-w-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="h-7 w-7 rounded object-cover shrink-0 bg-surface-secondary" />
                          ) : (
                            <div className="h-7 w-7 rounded bg-surface-secondary shrink-0 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                                <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                              </svg>
                            </div>
                          )}
                          <span className="text-foreground text-sm truncate" title={p.name}>{p.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-foreground font-medium whitespace-nowrap">{fmt(p.price)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {p.offerPrice ? (
                          <span className="text-success font-medium">{fmt(p.offerPrice)}</span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {p.clubPrice ? (
                          <span className="text-accent font-medium">{fmt(p.clubPrice)}</span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-muted text-xs">
                        {p.stock !== null ? p.stock : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${p.isActive ? 'bg-success' : 'bg-muted'}`} />
                          {p.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">
                        {new Date(p.updatedAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <ActionTooltip label="Editar produto">
                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                              <IconEdit />
                            </button>
                          </ActionTooltip>
                          <ActionTooltip label={p.isActive ? 'Desativar produto' : 'Ativar produto'}>
                            <span>
                              <Switch checked={p.isActive} onChange={() => handleToggleActive(p)} />
                            </span>
                          </ActionTooltip>
                          <ActionTooltip label="Excluir produto">
                            <button onClick={() => openDelete(p)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                              <IconTrash />
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

          {/* Pagination */}
          {productsData.pages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-muted">
                {((page - 1) * 50) + 1}–{Math.min(page * 50, productsData.total)} de{' '}
                <span className="text-foreground font-medium">{productsData.total}</span> produtos
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                {pageNumbers.map((n, i) =>
                  n === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(Number(n))}
                      className={`h-7 min-w-7 px-2 rounded-lg text-xs font-medium transition-colors ${n === page ? 'bg-accent text-white' : 'text-muted hover:text-foreground hover:bg-surface-secondary'}`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(productsData.pages, p + 1))}
                  disabled={page === productsData.pages}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* ── Integration Modal ── */}
      <Modal state={integrationModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {integration ? 'Editar integração' : 'Configurar integração'} — {store.name}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Base URL" hint="URL base da API externa (ex: https://erp.empresa.com/api)">
                  <input type="url" placeholder="https://erp.empresa.com/api" value={integrationForm.baseUrl}
                    onChange={(e) => setIntegrationForm((f) => ({ ...f, baseUrl: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Token (opcional)" hint="Bearer token ou chave de acesso">
                  <input type="password" placeholder="sk-..." value={integrationForm.token}
                    onChange={(e) => setIntegrationForm((f) => ({ ...f, token: e.target.value }))} className={inputClass} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Endpoint por EAN" hint="Use {ean} como placeholder">
                    <input type="text" value={integrationForm.endpointProductByEan}
                      onChange={(e) => setIntegrationForm((f) => ({ ...f, endpointProductByEan: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Endpoint catálogo">
                    <input type="text" value={integrationForm.endpointCatalog}
                      onChange={(e) => setIntegrationForm((f) => ({ ...f, endpointCatalog: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Carga completa (opcional)">
                    <input type="text" placeholder="/sync/full" value={integrationForm.endpointFullLoad}
                      onChange={(e) => setIntegrationForm((f) => ({ ...f, endpointFullLoad: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Incremental (opcional)">
                    <input type="text" placeholder="/sync/incremental" value={integrationForm.endpointIncremental}
                      onChange={(e) => setIntegrationForm((f) => ({ ...f, endpointIncremental: e.target.value }))} className={inputClass} />
                  </Field>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setIntegrationForm((f) => ({ ...f, isActive: !f.isActive }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${integrationForm.isActive ? 'bg-accent' : 'bg-border'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${integrationForm.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-foreground">Integração ativa</span>
                </label>
                {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={integrationModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleSaveIntegration} isDisabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar integração'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Add Product Modal ── */}
      <Modal state={productModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Adicionar produto</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">{productFormFields}</Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={productModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleSaveProduct} isDisabled={saving}>
                  {saving ? 'Salvando...' : 'Adicionar produto'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Edit Product Modal ── */}
      <Modal state={editModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Editar produto — <span className="font-mono text-sm text-muted">{editTarget?.ean}</span>
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">{productFormFields}</Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={editModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleEditProduct} isDisabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Delete Product Modal ── */}
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
                  <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
                  Essa ação não pode ser desfeita.
                </p>
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={deleteModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="danger" onPress={handleDeleteProduct} isDisabled={saving}>
                  {saving ? 'Excluindo...' : 'Excluir'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Clear Catalog Modal ── */}
      <Modal state={clearModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Limpar catálogo</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Tem certeza que deseja remover todos os <span className="font-semibold text-foreground">{productsData.total} produtos</span> do catálogo de{' '}
                  <span className="font-semibold text-foreground">{store.name}</span>? Essa ação não pode ser desfeita.
                </p>
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={clearModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="danger" onPress={handleClearCatalog} isDisabled={saving}>
                  {saving ? 'Limpando...' : 'Limpar tudo'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card } from '@heroui/react';
import Link from 'next/link';

type Product = {
  id: string;
  ean: string;
  codigo_produto: string | null;
  produto: string;
  preco1: string;
  preco2: string | null;
  preco3: string | null;
  image_url: string | null;
  updated_at: string;
};

type Store = { id: string; name: string; company: { id: string; name: string } | null };

const PAGE_SIZE_OPTIONS = [
  { value: '25',  label: '25 por página' },
  { value: '50',  label: '50 por página' },
  { value: '100', label: '100 por página' },
];

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

  async function fetchStore() {
    try {
      const res = await fetch(`/api/stores/${id}`);
      if (res.ok) setStore(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchProducts(pageNum = 1, query = '', pageLimit = limit) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(pageLimit) });
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
    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleSearch() {
    setPage(1);
    setQ(search);
    fetchProducts(1, search, limit);
  }

  function handlePageChange(next: number) {
    setPage(next);
    fetchProducts(next, q, limit);
  }

  function handleLimitChange(next: number) {
    setLimit(next);
    setPage(1);
    fetchProducts(1, q, next);
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
        <Link href="/lojas">
          <Button variant="ghost" size="sm">← Voltar</Button>
        </Link>
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
              {/* Per-page selector */}
              <select
                value={String(limit)}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="h-8 rounded-lg border border-border bg-surface-secondary px-2 pr-7 text-xs text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
              >
                {PAGE_SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {/* Search */}
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
                  {['EAN', 'Código', 'Produto', 'Preço 1', 'Preço 2', 'Preço 3', 'Atualizado'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted">
                      {q ? 'Nenhum produto encontrado para esta busca.' : 'Nenhum produto cadastrado ainda.'}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted whitespace-nowrap">{p.ean}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted">{p.codigo_produto ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.produto}
                              className="h-8 w-8 rounded object-cover shrink-0 bg-surface-secondary"
                              onError={(e) => {
                                const el = e.currentTarget;
                                el.style.display = 'none';
                                el.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`h-8 w-8 rounded bg-surface-secondary shrink-0 flex items-center justify-center ${p.image_url ? 'hidden' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                              <path d="m3.3 7 8.7 5 8.7-5"/>
                              <path d="M12 22V12"/>
                            </svg>
                          </div>
                          <span className="font-medium text-foreground">{p.produto}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-foreground font-medium whitespace-nowrap">{fmt(p.preco1)}</td>
                      <td className="px-5 py-3.5 text-muted whitespace-nowrap">{fmt(p.preco2)}</td>
                      <td className="px-5 py-3.5 text-muted whitespace-nowrap">{fmt(p.preco3)}</td>
                      <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">
                        {new Date(p.updated_at).toLocaleDateString('pt-BR')}
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
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import { ActionTooltip } from '@/components/ui/action-tooltip';

type SessionUser = {
  userId: string;
  companyId: string;
  isMaster: boolean;
  name: string;
};

type Company = { id: string; name: string };
type Store   = { id: string; name: string; companyId: string };

type StoreProduct = {
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

type OfferLayout = {
  id: string;
  name: string;
  orientation: 'portrait' | 'landscape';
  backgroundUrl: string | null;
  isActive: boolean;
};

type Campaign = {
  id: string;
  name: string;
  isActive: boolean;
  storeId: string | null;
  terminalId: string | null;
};

type Terminal = { id: string; name: string; storeId: string | null };

type OfferProduct = {
  id: string; ean: string; productName: string;
  preco1: string | null; preco2: string | null; preco3: string | null;
  imageUrl: string | null;
};

type Offer = {
  id: string;
  name: string;
  isActive: boolean;
  storeId: string;
  store: { id: string; name: string };
  layout: OfferLayout;
  layoutId: string;
  renderedImageUrl: string | null;
  products: OfferProduct[];
  terminalMedias: {
    id: string; order: number;
    terminal: { id: string; name: string };
    campaign: { id: string; name: string } | null;
  }[];
  createdAt: string;
};

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

const PAGE_SIZE_OPTIONS = [
  { value: '25',  label: '25 por página' },
  { value: '50',  label: '50 por página' },
  { value: '100', label: '100 por página' },
];

type SortKey   = 'produto' | 'ean' | 'codigo_produto' | 'preco1' | 'preco2' | 'preco3' | 'status' | 'updated_at';
type SortOrder = 'asc' | 'desc';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function fmt(v: string | null | undefined) {
  if (!v) return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProductPlaceholder() {
  return (
    <div className="h-10 w-10 rounded-md bg-surface-secondary shrink-0 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    </div>
  );
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

type WizardMode = { kind: 'create' } | { kind: 'edit'; offer: Offer };

export default function OfertasPage() {
  // ── session / scope ─────────────────────────────────────────────────────
  const [user, setUser] = useState<SessionUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoaded, setStoresLoaded] = useState(false);

  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('');

  // ── catálogo (mesmo estilo do /lojas/[id]/catalogo) ──────────────────────
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [limit, setLimit]   = useState(50);
  const [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ]           = useState('');
  const [sortBy, setSortBy]       = useState<SortKey>('produto');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterP1, setFilterP1] = useState(false);
  const [filterP2, setFilterP2] = useState(false);
  const [filterP3, setFilterP3] = useState(false);

  // ── ofertas (lista em tabela) ────────────────────────────────────────────
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  // ── wizard (create + edit) ───────────────────────────────────────────────
  const wizardModal = useOverlayState();
  const [mode, setMode] = useState<WizardMode>({ kind: 'create' });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [newName, setNewName]               = useState('');
  const [newProductEans, setNewProductEans] = useState<string[]>([]);
  // Snapshot do produto selecionado — usado pra renderizar o card "Produto
  // selecionado" no topo do step 2 (importante na edição, quando o produto
  // pode não estar na página atual do catálogo).
  type SelectedSnapshot = {
    ean: string; productName: string;
    preco1: string | null; preco2: string | null; preco3: string | null;
    imageUrl: string | null;
  };
  const [selectedSnapshot, setSelectedSnapshot] = useState<SelectedSnapshot | null>(null);
  const [newLayoutId, setNewLayoutId]       = useState<string>('');
  const [layouts, setLayouts]               = useState<OfferLayout[]>([]);
  const [layoutsLoading, setLayoutsLoading] = useState(false);
  const [withPlacement, setWithPlacement]   = useState(false);
  const [campaigns, setCampaigns]           = useState<Campaign[]>([]);
  const [terminals, setTerminals]           = useState<Terminal[]>([]);
  const [placeCampaignId, setPlaceCampaignId] = useState<string>('');
  const [placeTerminalId, setPlaceTerminalId] = useState<string>('');
  const [placePosition, setPlacePosition]     = useState<number>(0);
  const [placeDuration, setPlaceDuration]     = useState<number>(10);
  const [saving, setSaving]                   = useState(false);
  const [wizardError, setWizardError]         = useState<string | null>(null);

  // ── boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then((u) => setUser(u));
    fetch('/api/stores')
      .then((r) => r.json())
      .then((d) => setStores(Array.isArray(d) ? d : []))
      .finally(() => setStoresLoaded(true));
  }, []);

  useEffect(() => {
    if (user?.isMaster) {
      fetch('/api/companies').then((r) => r.json()).then((d) => setCompanies(Array.isArray(d) ? d : []));
    }
  }, [user?.isMaster]);

  const availableStores = useMemo(() => {
    if (!user) return [] as Store[];
    if (user.isMaster) return companyFilter ? stores.filter((s) => s.companyId === companyFilter) : stores;
    return stores.filter((s) => s.companyId === user.companyId);
  }, [user, stores, companyFilter]);

  useEffect(() => {
    // Aguarda a lista de lojas carregar para não zerar um filtro que veio da
    // URL antes do fetch terminar (caso comum quando navega de /campanhas).
    if (!storesLoaded) return;
    if (storeFilter && !availableStores.find((s) => s.id === storeFilter)) setStoreFilter('');
  }, [availableStores, storeFilter, storesLoaded]);

  // ── catálogo: fetcher ────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (
    pageNum: number, query: string, pageLimit: number,
    sb: SortKey, so: SortOrder,
    p1: boolean, p2: boolean, p3: boolean,
  ) => {
    if (!storeFilter) { setProducts([]); setTotal(0); setPages(1); return; }
    setProductsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum), limit: String(pageLimit),
        sortBy: sb, sortOrder: so,
      });
      if (query) params.set('q', query);
      if (p1) params.set('hasPreco1', 'true');
      if (p2) params.set('hasPreco2', 'true');
      if (p3) params.set('hasPreco3', 'true');
      const res = await fetch(`/api/stores/${storeFilter}/products?${params}`);
      const data = await res.json();
      setProducts(data?.products ?? []);
      setTotal(data?.total ?? 0);
      setPages(data?.pages ?? 1);
    } catch {
      setProducts([]); setTotal(0); setPages(1);
    } finally {
      setProductsLoading(false);
    }
  }, [storeFilter]);

  // Reset/refetch quando os filtros principais mudam
  useEffect(() => {
    setPage(1);
    fetchProducts(1, q, limit, sortBy, sortOrder, filterP1, filterP2, filterP3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeFilter, filterP1, filterP2, filterP3]);

  function handleSearch() {
    setPage(1);
    setQ(search);
    fetchProducts(1, search, limit, sortBy, sortOrder, filterP1, filterP2, filterP3);
  }
  function handlePageChange(next: number) {
    setPage(next);
    fetchProducts(next, q, limit, sortBy, sortOrder, filterP1, filterP2, filterP3);
  }
  function handleLimitChange(next: number) {
    setLimit(next); setPage(1);
    fetchProducts(1, q, next, sortBy, sortOrder, filterP1, filterP2, filterP3);
  }
  function handleSort(column: SortKey) {
    const newOrder: SortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(column); setSortOrder(newOrder); setPage(1);
    fetchProducts(1, q, limit, column, newOrder, filterP1, filterP2, filterP3);
  }

  // ── ofertas: fetcher ─────────────────────────────────────────────────────
  const refreshOffers = useCallback(async () => {
    if (!user) return;
    setOffersLoading(true);
    const url = new URL('/api/offers', window.location.origin);
    if (storeFilter) url.searchParams.set('storeId', storeFilter);
    if (companyFilter && user.isMaster) url.searchParams.set('companyId', companyFilter);
    try {
      const r = await fetch(url.toString());
      const d = await r.json();
      setOffers(Array.isArray(d) ? d : []);
    } catch {
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  }, [user, storeFilter, companyFilter]);
  useEffect(() => { refreshOffers(); }, [refreshOffers]);

  // Abre direto o wizard em modo edição quando a URL trouxer ?edit=<offerId>.
  // Também aceita storeId/companyId para pré-selecionar os filtros (necessário
  // para o wizard carregar o catálogo da loja correta).
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParam = searchParams.get('edit');
  const editStoreParam = searchParams.get('storeId');
  const editCompanyParam = searchParams.get('companyId');
  const editedOnceRef = useRef<string | null>(null);

  // Aplica os filtros vindos da URL antes de tentar editar.
  useEffect(() => {
    if (!editParam) return;
    if (editCompanyParam && user?.isMaster && companyFilter !== editCompanyParam) {
      setCompanyFilter(editCompanyParam);
    }
    if (editStoreParam && storeFilter !== editStoreParam) {
      setStoreFilter(editStoreParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam, editStoreParam, editCompanyParam, user]);

  useEffect(() => {
    if (!editParam) return;
    if (editedOnceRef.current === editParam) return;
    if (offersLoading) return;
    // Espera os filtros estarem aplicados pra garantir que `offers` corresponde
    // ao escopo certo (caso contrário podemos abrir uma oferta antes do refresh).
    if (editStoreParam && storeFilter !== editStoreParam) return;
    if (editCompanyParam && user?.isMaster && companyFilter !== editCompanyParam) return;
    const target = offers.find((o) => o.id === editParam);
    if (!target) return;
    editedOnceRef.current = editParam;
    openEdit(target);
    // Limpa só o `edit` da URL; storeId/companyId permanecem como filtros ativos.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('edit');
    const qs = params.toString();
    router.replace(qs ? `/ofertas?${qs}` : '/ofertas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam, offers, offersLoading, storeFilter, companyFilter, user]);

  // ── wizard handlers ──────────────────────────────────────────────────────
  function openCreate() {
    setMode({ kind: 'create' });
    setStep(1);
    setNewName('');
    setNewProductEans([]);
    setSelectedSnapshot(null);
    setNewLayoutId('');
    setLayouts([]);
    setWithPlacement(false);
    setCampaigns([]); setTerminals([]);
    setPlaceCampaignId(''); setPlaceTerminalId('');
    setPlacePosition(0); setPlaceDuration(10);
    setWizardError(null);
    wizardModal.open();
  }
  function openEdit(o: Offer) {
    setMode({ kind: 'edit', offer: o });
    setStep(1);
    setNewName(o.name);
    // Oferta só tem 1 produto agora. Pega o primeiro do snapshot.
    const first = o.products[0] ?? null;
    setNewProductEans(first ? [first.ean] : []);
    setSelectedSnapshot(first ? {
      ean:         first.ean,
      productName: first.productName,
      preco1:      first.preco1,
      preco2:      first.preco2,
      preco3:      first.preco3,
      imageUrl:    first.imageUrl,
    } : null);
    setNewLayoutId(o.layoutId);
    setLayouts([]);
    setWithPlacement(false);
    setCampaigns([]); setTerminals([]);
    setWizardError(null);
    wizardModal.open();
  }

  // Carrega os layouts da categoria oferta_item quando o modal abre
  useEffect(() => {
    if (!wizardModal.isOpen) return;
    setLayoutsLoading(true);
    fetch('/api/admin/offer-layouts?category=oferta_item')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLayouts(Array.isArray(d) ? d.filter((l: OfferLayout) => l.isActive) : []))
      .catch(() => setLayouts([]))
      .finally(() => setLayoutsLoading(false));
  }, [wizardModal.isOpen]);

  // Carrega campanhas/terminais pro step 3 (placement) só na criação
  useEffect(() => {
    if (!wizardModal.isOpen || !storeFilter || mode.kind !== 'create') return;
    fetch(`/api/campaigns?storeId=${storeFilter}`)
      .then((r) => r.json())
      .then((d) => setCampaigns(Array.isArray(d) ? d.filter((c: Campaign) => c.isActive) : []))
      .catch(() => setCampaigns([]));
    fetch('/api/terminals')
      .then((r) => r.json())
      .then((d) => setTerminals(Array.isArray(d) ? d.filter((t: Terminal) => t.storeId === storeFilter) : []))
      .catch(() => setTerminals([]));
  }, [wizardModal.isOpen, storeFilter, mode]);

  function selectProduct(p: StoreProduct) {
    // Apenas 1 produto por oferta — selecionar substitui qualquer escolha anterior.
    setNewProductEans([p.ean]);
    setSelectedSnapshot({
      ean:         p.ean,
      productName: p.produto,
      preco1:      p.preco1,
      preco2:      p.preco2,
      preco3:      p.preco3,
      imageUrl:    p.image_url,
    });
  }
  function clearSelection() {
    setNewProductEans([]);
    setSelectedSnapshot(null);
  }

  function selectedTerminalCandidate(): string {
    const c = campaigns.find((x) => x.id === placeCampaignId);
    if (c?.terminalId) return c.terminalId;
    return placeTerminalId;
  }

  async function handleSubmit() {
    if (!newName.trim()) { setWizardError('Nome obrigatório.'); return; }
    if (!newLayoutId) { setWizardError('Selecione um layout.'); return; }
    if (newProductEans.length === 0) { setWizardError('Selecione ao menos um produto.'); return; }

    setSaving(true); setWizardError(null);
    try {
      if (mode.kind === 'create') {
        const payload: Record<string, unknown> = {
          name: newName.trim(),
          storeId: storeFilter,
          layoutId: newLayoutId,
          productEans: newProductEans,
        };
        if (withPlacement && placeCampaignId) {
          const finalTerminal = selectedTerminalCandidate();
          if (!finalTerminal) { setWizardError('Selecione o terminal para colocar a oferta.'); return; }
          payload.placement = {
            campaignId: placeCampaignId,
            terminalId: finalTerminal,
            position:   placePosition,
            duration:   placeDuration,
          };
        }
        const res = await fetch('/api/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { setWizardError(data.message ?? 'Erro ao criar oferta.'); return; }
      } else {
        const payload: Record<string, unknown> = {
          name: newName.trim(),
          layoutId: newLayoutId,
          productEans: newProductEans,
        };
        const res = await fetch(`/api/offers/${mode.offer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { setWizardError(data.message ?? 'Erro ao salvar oferta.'); return; }
      }
      wizardModal.close();
      await refreshOffers();
    } catch {
      setWizardError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivateOffer(o: Offer) {
    if (!confirm(`Desativar a oferta "${o.name}"? Pode reativar depois.`)) return;
    const res = await fetch(`/api/offers/${o.id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.message ?? 'Erro ao desativar.'); return; }
    setOffers((prev) => prev.map((x) => x.id === o.id ? { ...x, isActive: false } : x));
  }
  async function reactivateOffer(o: Offer) {
    const res = await fetch(`/api/offers/${o.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.message ?? 'Erro ao reativar.'); return; }
    setOffers((prev) => prev.map((x) => x.id === o.id ? { ...x, isActive: true } : x));
  }

  // ── render ──────────────────────────────────────────────────────────────
  const pageNumbers = buildPageNumbers(page, pages);
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const currentStore = stores.find((s) => s.id === storeFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ofertas</h1>
          <p className="mt-1 text-sm text-muted">Monte ofertas comerciais a partir do catálogo da loja e adicione em campanhas.</p>
        </div>
        <Button variant="primary" size="sm" onPress={openCreate} isDisabled={!storeFilter}>+ Nova oferta</Button>
      </div>

      {/* Filtros principais */}
      <div className="flex flex-col sm:flex-row gap-3">
        {user?.isMaster && (
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className={inputClass + ' sm:max-w-xs'}>
            <option value="">Todas as empresas</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className={inputClass + ' sm:max-w-xs'}>
          <option value="">Selecione uma loja</option>
          {availableStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {!storeFilter ? (
        <Card>
          <Card.Content className="py-16 text-center text-sm text-muted">
            Selecione uma loja para ver o catálogo e as ofertas criadas.
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* ── Tabela de ofertas ── */}
          <Card>
            <Card.Content className="p-0">
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold text-foreground">Ofertas desta loja</h2>
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                    {offersLoading ? '—' : offers.length}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">Oferta</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">Layout</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">Produtos</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">Campanhas</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">Criada em</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offersLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="px-5 py-3.5"><div className="h-3.5 rounded bg-surface-secondary animate-pulse w-24" /></td>
                          ))}
                        </tr>
                      ))
                    ) : offers.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-muted">Nenhuma oferta criada ainda.</td></tr>
                    ) : (
                      offers.map((o) => (
                        <tr key={o.id} className={`border-b border-border/50 hover:bg-surface-secondary/40 transition-colors ${!o.isActive ? 'opacity-60' : ''}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              {o.renderedImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={o.renderedImageUrl} alt={o.name} className="h-10 w-10 rounded-md object-cover shrink-0 bg-surface-secondary" />
                              ) : (
                                <ProductPlaceholder />
                              )}
                              <span className="font-medium text-foreground">{o.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted">{o.layout.name}</td>
                          <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">{o.products.length}</td>
                          <td className="px-5 py-3 text-xs text-muted truncate max-w-xs">
                            {o.terminalMedias.length === 0
                              ? '—'
                              : Array.from(new Set(o.terminalMedias.map((t) => t.campaign?.name).filter(Boolean))).join(', ')}
                          </td>
                          <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</td>
                          <td className="px-5 py-3">
                            {o.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Inativa
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1">
                              <ActionTooltip label="Editar oferta">
                                <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                  </svg>
                                </button>
                              </ActionTooltip>
                              {o.isActive ? (
                                <ActionTooltip label="Desativar oferta">
                                  <button onClick={() => deactivateOffer(o)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                    </svg>
                                  </button>
                                </ActionTooltip>
                              ) : (
                                <ActionTooltip label="Reativar oferta">
                                  <button onClick={() => reactivateOffer(o)} className="p-1.5 rounded-lg text-muted hover:text-success hover:bg-success/10 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                                    </svg>
                                  </button>
                                </ActionTooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card.Content>
          </Card>

          {/* ── Catálogo (mesmo estilo do /lojas/[id]/catalogo) ── */}
          <Card>
            <Card.Content className="p-0">
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold text-foreground">Catálogo · {currentStore?.name ?? '...'}</h2>
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                    {productsLoading ? '—' : total}
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

              <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border text-xs">
                <span className="text-muted">Filtrar:</span>
                {[
                  { label: 'tem Preço 1', value: filterP1, set: setFilterP1 },
                  { label: 'tem Preço 2', value: filterP2, set: setFilterP2 },
                  { label: 'tem Preço 3', value: filterP3, set: setFilterP3 },
                ].map((f) => (
                  <button
                    key={f.label}
                    onClick={() => f.set(!f.value)}
                    className={`rounded-full px-3 py-1 border transition-colors ${
                      f.value ? 'bg-accent text-white border-accent' : 'bg-surface text-muted border-border hover:border-accent/40 hover:text-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                {(filterP1 || filterP2 || filterP3) && (
                  <button onClick={() => { setFilterP1(false); setFilterP2(false); setFilterP3(false); }} className="text-muted hover:text-foreground underline">
                    limpar
                  </button>
                )}
              </div>

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
                          <button onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
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
                    </tr>
                  </thead>
                  <tbody>
                    {productsLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-5 py-3.5"><div className="h-3.5 rounded bg-surface-secondary animate-pulse w-20" /></td>
                          ))}
                        </tr>
                      ))
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted">
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
                                <img src={p.image_url} alt={p.produto} className="h-10 w-10 rounded-md object-cover shrink-0 bg-surface-secondary" />
                              ) : <ProductPlaceholder />}
                              <span className="font-medium text-foreground">{p.produto}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-foreground font-medium whitespace-nowrap">{fmt(p.preco1)}</td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            {p.preco2 && Number(p.preco2) > 0 ? <span className="text-accent font-medium">{fmt(p.preco2)}</span> : <span className="text-muted">—</span>}
                          </td>
                          <td className="px-5 py-3 text-muted whitespace-nowrap">{fmt(p.preco3)}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${p.status ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-500/10 text-zinc-500'}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${p.status ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                              {p.status ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                            {new Date(p.updated_at).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer / Pagination */}
              {!productsLoading && total > 0 && (
                <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-wrap gap-4">
                  <p className="text-xs text-muted">
                    Mostrando <span className="text-foreground font-medium">{start}–{end}</span> de{' '}
                    <span className="text-foreground font-medium">{total}</span> produtos
                  </p>
                  {pages > 1 && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted hover:bg-surface-secondary hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                      </button>
                      {pageNumbers.map((pn, i) =>
                        pn === '...' ? (
                          <span key={`e-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted select-none">···</span>
                        ) : (
                          <button
                            key={pn}
                            onClick={() => handlePageChange(pn)}
                            className={`h-8 min-w-8 px-2 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                              pn === page
                                ? 'bg-accent text-white'
                                : 'border border-border text-muted hover:bg-surface-secondary hover:text-foreground'
                            }`}
                          >{pn}</button>
                        ),
                      )}
                      <button onClick={() => handlePageChange(page + 1)} disabled={page === pages} className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted hover:bg-surface-secondary hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card.Content>
          </Card>
        </>
      )}

      {/* ── Wizard modal (create + edit) ── */}
      <Modal state={wizardModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {mode.kind === 'create' ? `Nova oferta · etapa ${step}/3` : `Editar oferta · etapa ${step}/3`}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={`h-1 flex-1 rounded ${s <= step ? 'bg-accent' : 'bg-surface-secondary'}`} />
                  ))}
                </div>

                {step === 1 && (
                  <Field label="Nome da oferta">
                    <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Cerveja Heineken — Black Friday" autoFocus />
                  </Field>
                )}

                {step === 2 && (
                  <Field label="Produto da oferta" hint="Apenas 1 produto por oferta. Selecionar substitui o atual.">
                    {/* Card "Produto selecionado" — aparece tanto na edição (com snapshot
                        carregado) quanto na criação após escolher um item. Importante
                        para que o usuário veja o item escolhido mesmo se ele não estiver
                        na página atual do catálogo paginado. */}
                    {selectedSnapshot && (
                      <div className="mb-3 rounded-lg border border-accent/40 bg-accent/5 p-3 flex items-center gap-3">
                        {selectedSnapshot.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedSnapshot.imageUrl}
                            alt={selectedSnapshot.productName}
                            className="h-12 w-12 rounded-md object-cover shrink-0 bg-surface-secondary"
                          />
                        ) : (
                          <ProductPlaceholder />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted">Produto selecionado</p>
                          <p className="text-sm font-medium text-foreground truncate" title={selectedSnapshot.productName}>
                            {selectedSnapshot.productName}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                            <span className="font-mono">EAN: {selectedSnapshot.ean}</span>
                            <span>P1: {fmt(selectedSnapshot.preco1)}</span>
                            <span>P2: {fmt(selectedSnapshot.preco2)}</span>
                            <span>P3: {fmt(selectedSnapshot.preco3)}</span>
                          </div>
                        </div>
                        <button
                          onClick={clearSelection}
                          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-danger hover:border-danger/40 transition-colors"
                        >Limpar</button>
                      </div>
                    )}

                    <input
                      type="text" placeholder="Buscar..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className={inputClass}
                    />
                    <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-surface-secondary/50 text-xs text-muted sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium w-10"></th>
                            <th className="px-3 py-2 text-left font-medium">EAN</th>
                            <th className="px-3 py-2 text-left font-medium">Produto</th>
                            <th className="px-3 py-2 text-left font-medium">Preço 1</th>
                            <th className="px-3 py-2 text-left font-medium">Preço 2</th>
                            <th className="px-3 py-2 text-left font-medium">Preço 3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => {
                            const isSelected = newProductEans[0] === p.ean;
                            return (
                              <tr
                                key={p.id}
                                onClick={() => selectProduct(p)}
                                className={`border-t border-border cursor-pointer transition-colors ${
                                  isSelected ? 'bg-accent-soft/50' : 'hover:bg-surface-secondary/40'
                                }`}
                              >
                                <td className="px-3 py-2">
                                  <input
                                    type="radio"
                                    name="picked-product"
                                    checked={isSelected}
                                    onChange={() => selectProduct(p)}
                                    className="h-4 w-4 border-border accent-accent"
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">{p.ean}</td>
                                <td className="px-3 py-2 truncate max-w-xs" title={p.produto}>{p.produto}</td>
                                <td className="px-3 py-2">{fmt(p.preco1)}</td>
                                <td className="px-3 py-2">{fmt(p.preco2)}</td>
                                <td className="px-3 py-2">{fmt(p.preco3)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {pages > 1 && (
                      <p className="text-xs text-muted mt-1">
                        Página {page} de {pages} · {total} produtos no catálogo. Use os filtros na lista principal pra refinar.
                      </p>
                    )}
                  </Field>
                )}

                {step === 3 && (
                  <>
                    <Field label="Layout">
                      {layoutsLoading ? (
                        <p className="text-sm text-muted">Carregando layouts…</p>
                      ) : layouts.length === 0 ? (
                        <p className="text-sm text-muted">
                          Nenhum layout ativo. Peça pro master criar em <strong>Configurações → Layouts de Oferta</strong>.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-auto">
                          {layouts.map((l) => (
                            <button
                              key={l.id}
                              onClick={() => setNewLayoutId(l.id)}
                              className={`rounded-lg border p-2 text-left transition-colors ${
                                newLayoutId === l.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'
                              }`}
                            >
                              <div className={`relative overflow-hidden rounded mb-1.5 bg-surface-secondary ${l.orientation === 'portrait' ? 'aspect-3/4' : 'aspect-video'}`}>
                                {l.backgroundUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={l.backgroundUrl} alt={l.name} className="absolute inset-0 h-full w-full object-cover" />
                                )}
                              </div>
                              <p className="text-xs font-medium text-foreground truncate">{l.name}</p>
                              <p className="text-xs text-muted">{l.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>

                    {mode.kind === 'create' && (
                      <>
                        <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                          <input
                            type="checkbox" checked={withPlacement}
                            onChange={(e) => setWithPlacement(e.target.checked)}
                            className="h-4 w-4 rounded border-border accent-accent"
                          />
                          Adicionar esta oferta em uma campanha agora
                        </label>
                        {withPlacement && (
                          <div className="space-y-3 mt-2">
                            <Field label="Campanha">
                              <select className={inputClass} value={placeCampaignId} onChange={(e) => setPlaceCampaignId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </Field>
                            {(() => {
                              const c = campaigns.find((x) => x.id === placeCampaignId);
                              if (!c) return null;
                              if (c.terminalId) {
                                const t = terminals.find((x) => x.id === c.terminalId);
                                return (
                                  <p className="text-xs text-muted">
                                    Terminal: <strong>{t?.name ?? c.terminalId}</strong> (definido pela campanha)
                                  </p>
                                );
                              }
                              return (
                                <Field label="Terminal">
                                  <select className={inputClass} value={placeTerminalId} onChange={(e) => setPlaceTerminalId(e.target.value)}>
                                    <option value="">Selecione...</option>
                                    {terminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                                </Field>
                              );
                            })()}
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Posição (0 = início)">
                                <input type="number" min={0} className={inputClass} value={placePosition} onChange={(e) => setPlacePosition(parseInt(e.target.value) || 0)} />
                              </Field>
                              <Field label="Duração (segundos)" hint="3–300s, como mídias">
                                <input
                                  type="number" min={3} max={300} step={1}
                                  className={inputClass} value={placeDuration}
                                  onChange={(e) => setPlaceDuration(Math.max(3, Math.min(300, parseInt(e.target.value) || 10)))}
                                />
                              </Field>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {wizardError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{wizardError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-between gap-2 border-t border-border px-6 pb-5 pt-4">
                <div>
                  {step > 1 && <Button variant="ghost" onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>← Voltar</Button>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onPress={wizardModal.close} isDisabled={saving}>Cancelar</Button>
                  {step < 3 ? (
                    <Button
                      variant="primary"
                      onPress={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                      isDisabled={
                        (step === 1 && (!newName.trim())) ||
                        (step === 2 && newProductEans.length === 0)
                      }
                    >Avançar →</Button>
                  ) : (
                    <Button variant="primary" onPress={handleSubmit} isDisabled={saving || !newLayoutId}>
                      {saving ? 'Salvando...' : (mode.kind === 'create' ? 'Criar oferta' : 'Salvar alterações')}
                    </Button>
                  )}
                </div>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardHeader } from '@heroui/react';
import dynamic from 'next/dynamic';
import { mockContext } from '@/lib/terminal-layout/mock';

const Preview = dynamic(() => import('@/components/terminal-layout-editor/Preview'), { ssr: false });

type Layout = {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  configFound: string;
  configNotFound: string;
  configIdle: string;
};

type Store = {
  id: string;
  name: string;
  terminalLayoutId: string | null;
  terminalLayout: { id: string; name: string; thumbnailUrl: string | null } | null;
};

type Tab = 'found' | 'notFound' | 'idle';

export default function LayoutTerminalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [store, setStore] = useState<Store | null>(null);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('found');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [storeRes, layoutsRes] = await Promise.all([
        fetch(`/api/stores/${id}`),
        fetch('/api/terminal-layouts'),
      ]);
      if (storeRes.ok) setStore(await storeRes.json());
      if (layoutsRes.ok) setLayouts(await layoutsRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pickLayout(layoutId: string | null) {
    setSaving(layoutId ?? 'clear');
    setStatus(null);
    try {
      const res = await fetch(`/api/stores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminalLayoutId: layoutId }),
      });
      if (!res.ok) {
        setStatus({ type: 'error', message: (await res.json()).message ?? 'Erro ao salvar' });
        return;
      }
      setStore(await res.json());
      setStatus({ type: 'success', message: 'Layout aplicado com sucesso' });
    } finally {
      setSaving(null);
    }
  }

  if (loading || !store) {
    return <p className="py-12 text-center text-sm text-muted">Carregando...</p>;
  }

  const ctx = mockContext(tab === 'found' ? 'found' : tab === 'notFound' ? 'not-found' : 'idle');

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/lojas/${id}/catalogo`} className="text-xs text-muted hover:text-foreground">
          ← Catálogo da loja
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Layout do Terminal</h1>
        <p className="mt-1 text-sm text-muted">
          Escolha o layout que será exibido pelos terminais Price Checker da loja <strong>{store.name}</strong>.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <h2 className="text-base font-semibold text-foreground">Em uso atualmente</h2>
        </CardHeader>
        <Card.Content className="flex items-center justify-between gap-4 py-6">
          {store.terminalLayout ? (
            <>
              <div>
                <p className="text-sm font-semibold text-foreground">{store.terminalLayout.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Aplicado a esta loja. Os terminais sincronizam no próximo bootstrap.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => pickLayout(null)}
                isDisabled={saving === 'clear'}
              >
                {saving === 'clear' ? 'Removendo...' : 'Remover'}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">Nenhum layout selecionado — os terminais usam o padrão do app.</p>
          )}
        </Card.Content>
      </Card>

      {status && (
        <div className={`rounded-lg px-3 py-2 text-sm ${
          status.type === 'success' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'
        }`}>{status.message}</div>
      )}

      <div className="flex gap-2 border-b border-border">
        {[{k:'found',l:'Produto encontrado'},{k:'notFound',l:'Produto não encontrado'},{k:'idle',l:'Tela de descanso'}].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as Tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.k ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-foreground'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {layouts.length === 0 ? (
        <Card>
          <Card.Content className="py-12 text-center text-sm text-muted">
            Nenhum layout disponível. Peça ao administrador para cadastrar layouts em Configurações.
          </Card.Content>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layouts.map((layout) => {
            const isCurrent = store.terminalLayoutId === layout.id;
            const source =
              tab === 'found' ? layout.configFound :
              tab === 'notFound' ? layout.configNotFound : layout.configIdle;
            return (
              <Card key={layout.id} className={isCurrent ? 'ring-2 ring-accent' : ''}>
                <CardHeader className="border-b border-border pb-3">
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">{layout.name}</h3>
                      {layout.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{layout.description}</p>}
                    </div>
                    {isCurrent && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                        Em uso
                      </span>
                    )}
                  </div>
                </CardHeader>
                <Card.Content className="space-y-3 py-3">
                  <div className="flex justify-center bg-surface-secondary rounded-lg p-2">
                    <Preview source={source} context={ctx} width={280} ratio={16 / 9} />
                  </div>
                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    size="sm"
                    className="w-full"
                    onPress={() => pickLayout(layout.id)}
                    isDisabled={isCurrent || saving === layout.id}
                  >
                    {saving === layout.id ? 'Aplicando...' : isCurrent ? 'Já selecionado' : 'Selecionar este layout'}
                  </Button>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

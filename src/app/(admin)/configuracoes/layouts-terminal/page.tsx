'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader } from '@heroui/react';
import dynamic from 'next/dynamic';
import { mockContext } from '@/lib/terminal-layout/mock';
import { EMPTY_FOUND, EMPTY_IDLE, EMPTY_NOT_FOUND } from '@/lib/terminal-layout/EMPTY';

const Preview = dynamic(() => import('@/components/terminal-layout-editor/Preview'), { ssr: false });

type LayoutItem = {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  configFound: string;
  configNotFound: string;
  configIdle: string;
  _count?: { stores: number };
  updatedAt: string;
};

export default function LayoutsTerminalPage() {
  const router = useRouter();
  const [layouts, setLayouts] = useState<LayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/terminal-layouts');
      if (res.status === 401) { setError('Sessão expirada. Faça login novamente.'); return; }
      if (res.status === 403) { setError('Acesso restrito ao usuário Master.'); return; }
      if (!res.ok) { setError(`Erro ao carregar (${res.status}).`); return; }
      const data = await res.json();
      if (!Array.isArray(data)) { setError('Resposta inesperada do servidor.'); return; }
      setLayouts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/terminal-layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Novo layout ${new Date().toLocaleDateString('pt-BR')}`,
          configFound: EMPTY_FOUND,
          configNotFound: EMPTY_NOT_FOUND,
          configIdle: EMPTY_IDLE,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        router.push(`/configuracoes/layouts-terminal/${created.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir o layout "${name}"?`)) return;
    const res = await fetch(`/api/admin/terminal-layouts/${id}`, { method: 'DELETE' });
    if (res.ok) load();
    else alert((await res.json()).message ?? 'Erro ao excluir');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/configuracoes" className="text-xs text-muted hover:text-foreground">← Configurações</Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Layouts do Terminal</h1>
          <p className="mt-1 text-sm text-muted">
            Editor de código (HTML-like + Tailwind). Cada layout tem 3 telas: produto encontrado, não encontrado e descanso.
          </p>
        </div>
        <Button variant="primary" onPress={handleCreate} isDisabled={creating}>
          {creating ? 'Criando...' : 'Novo layout'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-danger/10 px-3 py-3 text-sm text-danger">
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted">Carregando layouts...</p>
      ) : error ? null : layouts.length === 0 ? (
        <Card>
          <Card.Content className="py-16 text-center">
            <p className="text-sm text-muted">Nenhum layout cadastrado ainda.</p>
            <Button variant="primary" size="sm" className="mt-4" onPress={handleCreate} isDisabled={creating}>
              Criar o primeiro layout
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layouts.map((layout) => (
            <Card key={layout.id}>
              <CardHeader className="border-b border-border pb-3">
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{layout.name}</h3>
                    {layout.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{layout.description}</p>}
                  </div>
                  {!layout.isActive && (
                    <span className="rounded-full bg-muted/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                      Inativo
                    </span>
                  )}
                </div>
              </CardHeader>
              <Card.Content className="space-y-3 py-3">
                <div className="flex justify-center bg-surface-secondary rounded-lg p-2">
                  <Preview source={layout.configFound} context={mockContext('found')} width={280} ratio={16 / 9} />
                </div>
                <p className="text-xs text-muted">
                  {layout._count?.stores ?? 0} loja(s) usando • atualizado em {new Date(layout.updatedAt).toLocaleString('pt-BR')}
                </p>
                <div className="flex gap-2">
                  <Link href={`/configuracoes/layouts-terminal/${layout.id}`} className="flex-1">
                    <Button variant="primary" size="sm" className="w-full">Editar</Button>
                  </Link>
                  <Button variant="secondary" size="sm" onPress={() => handleDelete(layout.id, layout.name)}>
                    Excluir
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

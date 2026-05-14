'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import {
  OFFER_LAYOUT_CATEGORY_LABEL,
  type OfferLayoutCategory,
} from '@/lib/offer-layout/categories';

type OfferLayout = {
  id: string;
  name: string;
  description: string | null;
  category: OfferLayoutCategory;
  orientation: 'portrait' | 'landscape';
  backgroundUrl: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  template: string;
  createdAt: string;
  _count: { offers: number };
};

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function LayoutsOfertasPage() {
  const [layouts, setLayouts] = useState<OfferLayout[]>([]);
  const [loading, setLoading] = useState(true);

  const createModal = useOverlayState();
  const [newName, setNewName] = useState('');
  const [newOrientation, setNewOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/offer-layouts');
      const data = await res.json();
      setLayouts(Array.isArray(data) ? data : []);
    } catch {
      setLayouts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  const filtered = layouts;

  async function handleCreate() {
    if (!newName.trim()) { setCreateError('Nome obrigatório.'); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/admin/offer-layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          category: 'oferta_item',
          orientation: newOrientation,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.message ?? 'Erro ao criar.'); return; }
      createModal.close();
      setNewName('');
      // redireciona pro editor já com o novo
      window.location.href = `/configuracoes/layouts-ofertas/${data.id}`;
    } catch {
      setCreateError('Erro de conexão.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Layouts de oferta</h1>
          <p className="mt-1 text-sm text-muted">
            Templates compartilhados entre todas as lojas — usados ao criar ofertas de item.
          </p>
        </div>
        <Button variant="primary" size="sm" onPress={() => { setNewName(''); setNewOrientation('portrait'); setCreateError(null); createModal.open(); }}>
          + Novo layout
        </Button>
      </div>


      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><Card.Content className="p-0">
              <div className="h-36 bg-surface-secondary animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-surface-secondary animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-surface-secondary animate-pulse" />
              </div>
            </Card.Content></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <Card.Content className="py-16 text-center">
            <p className="text-sm text-muted">Nenhum layout criado nessa categoria.</p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <Link key={l.id} href={`/configuracoes/layouts-ofertas/${l.id}`} className="block">
              <Card className="hover:border-accent/50 transition-colors">
                <Card.Content className="p-0">
                  <div
                    className={`relative ${l.orientation === 'landscape' ? 'h-32 aspect-video' : 'h-44 aspect-3/4'} bg-surface-secondary overflow-hidden`}
                  >
                    {l.backgroundUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.backgroundUrl} alt={l.name} className="absolute inset-0 h-full w-full object-cover" />
                    ) : l.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.thumbnailUrl} alt={l.name} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-xs text-muted/60">sem prévia</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">{l.name}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                        {OFFER_LAYOUT_CATEGORY_LABEL[l.category]}
                      </span>
                      <span className="text-muted">{l.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</span>
                      {!l.isActive && <span className="rounded-full bg-muted/15 px-2 py-0.5 text-muted">Inativo</span>}
                    </div>
                    <p className="text-xs text-muted">
                      Usado em {l._count.offers} {l._count.offers === 1 ? 'oferta' : 'ofertas'}
                    </p>
                  </div>
                </Card.Content>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Modal criar */}
      <Modal state={createModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Novo layout de oferta</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Nome">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Oferta vertical vermelha"
                    className={inputClass}
                    autoFocus
                  />
                </Field>
                <Field label="Orientação">
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                    {(['portrait', 'landscape'] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => setNewOrientation(o)}
                        className={`flex-1 py-2 transition-colors ${newOrientation === o ? 'bg-accent text-white' : 'bg-surface text-muted hover:bg-surface-secondary'}`}
                      >
                        {o === 'portrait' ? 'Retrato' : 'Paisagem'}
                      </button>
                    ))}
                  </div>
                </Field>
                {createError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{createError}</p>}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-border px-6 pb-5 pt-4">
                <Button variant="ghost" onPress={createModal.close} isDisabled={creating}>Cancelar</Button>
                <Button variant="primary" onPress={handleCreate} isDisabled={creating}>
                  {creating ? 'Criando...' : 'Criar e editar'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

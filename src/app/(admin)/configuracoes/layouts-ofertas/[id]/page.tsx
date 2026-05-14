'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button, Card } from '@heroui/react';
import {
  OFFER_LAYOUT_CATEGORY_LABEL,
  type OfferLayoutCategory,
} from '@/lib/offer-layout/categories';
import {
  parseStage,
  serializeStage,
  designSizeFor,
  type KonvaStage,
} from '@/lib/offer-layout/konva-types';
import { buildMockOfferContext } from '@/lib/offer-layout/interpolate';

// Konva precisa rodar só no client (sem SSR — usa canvas DOM)
const KonvaEditor = dynamic(
  () => import('@/components/offer-layout/KonvaEditor').then((m) => m.KonvaEditor),
  { ssr: false, loading: () => <div className="text-sm text-muted p-6">Carregando editor visual…</div> },
);
const KonvaRenderer = dynamic(
  () => import('@/components/offer-layout/KonvaRenderer').then((m) => m.KonvaRenderer),
  { ssr: false },
);

type OfferLayout = {
  id: string;
  name: string;
  description: string | null;
  category: OfferLayoutCategory;
  orientation: 'portrait' | 'landscape';
  backgroundUrl: string | null;
  template: string;
  isActive: boolean;
  _count: { offers: number };
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

export default function OfferLayoutEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<OfferLayout | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<OfferLayoutCategory>('oferta_item');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<KonvaStage>(() => parseStage('', 'portrait'));
  const [isActive, setIsActive] = useState(true);

  const previewCtx = useMemo(() => buildMockOfferContext(), []);

  useEffect(() => {
    fetch(`/api/admin/offer-layouts/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: OfferLayout) => {
        setLayout(data);
        setName(data.name);
        setDescription(data.description ?? '');
        setCategory(data.category);
        setOrientation(data.orientation);
        setBackgroundUrl(data.backgroundUrl);
        setStage(parseStage(data.template, data.orientation));
        setIsActive(data.isActive);
      })
      .catch(() => setError('Layout não encontrado.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Quando o usuário muda a orientação no UI, redimensiona o stage (mantendo nós)
  useEffect(() => {
    const target = designSizeFor(orientation);
    if (stage.width !== target.width || stage.height !== target.height) {
      setStage((s) => ({ ...s, width: target.width, height: target.height }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  async function save() {
    if (!name.trim()) { setError('Nome obrigatório.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/offer-layouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category,
          orientation,
          backgroundUrl,
          template: serializeStage(stage),
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao salvar.'); return; }
      setLayout(data);
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadBackground(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/offer-layouts/upload-background', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro no upload.'); return; }
      setBackgroundUrl(data.url);
    } catch {
      setError('Erro de conexão.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir este layout? (Só funciona se não estiver em uso.)')) return;
    const res = await fetch(`/api/admin/offer-layouts/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.message ?? 'Erro ao excluir.');
      return;
    }
    router.push('/configuracoes/layouts-ofertas');
  }

  if (loading) return <div className="p-6 text-sm text-muted">Carregando...</div>;
  if (!layout) return <div className="p-6 text-sm text-danger">{error ?? 'Layout não encontrado.'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => router.push('/configuracoes/layouts-ofertas')} className="text-xs text-muted hover:text-foreground mb-1">
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold text-foreground">{layout.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {OFFER_LAYOUT_CATEGORY_LABEL[layout.category]} ·
            {' '}{layout.orientation === 'portrait' ? 'Retrato' : 'Paisagem'} ·
            {' '}Usado em {layout._count.offers} {layout._count.offers === 1 ? 'oferta' : 'ofertas'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onPress={handleDelete}>Excluir</Button>
          <Button variant="primary" onPress={save} isDisabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <Card>
        <Card.Content className="p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Descrição (opcional)">
              <textarea className={inputClass} rows={1} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Orientação">
              <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                {(['portrait', 'landscape'] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOrientation(o)}
                    className={`flex-1 py-2.5 transition-colors ${orientation === o ? 'bg-accent text-white' : 'bg-surface text-muted hover:bg-surface-secondary'}`}
                  >
                    {o === 'portrait' ? 'Retrato (1080×1350)' : 'Paisagem (1920×1080)'}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Imagem de fundo (opcional)" hint="JPG/PNG até 8MB. Ideal: mesma proporção da orientação.">
            <div className="flex flex-col gap-2">
              {backgroundUrl && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={backgroundUrl} alt="fundo" className="h-16 w-16 rounded object-cover" />
                  <p className="text-xs text-muted truncate flex-1">{backgroundUrl}</p>
                  <button onClick={() => setBackgroundUrl(null)} className="text-xs text-muted hover:text-danger px-2 py-1 rounded">
                    Remover
                  </button>
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-dashed border-border bg-surface-secondary px-4 py-3 text-sm text-muted hover:border-accent hover:bg-accent/5 transition-colors text-left disabled:opacity-60"
              >
                {uploading ? 'Enviando...' : backgroundUrl ? 'Substituir imagem' : '+ Selecionar imagem de fundo'}
              </button>
              <input
                ref={fileRef}
                type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBackground(f); }}
              />
            </div>
          </Field>

          <Field label="Status">
            <button
              onClick={() => setIsActive((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors w-fit ${
                isActive ? 'bg-success/10 text-success border-success/30' : 'bg-muted/15 text-muted border-border'
              }`}
            >
              {isActive ? 'Ativo' : 'Inativo'}
            </button>
          </Field>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Editor visual (Konva)</p>
            <p className="text-xs text-muted">Canvas {stage.width}×{stage.height}px</p>
          </div>
          <KonvaEditor stage={stage} onChange={setStage} backgroundUrl={backgroundUrl} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Prévia com dados de exemplo</p>
          <div className={orientation === 'portrait' ? 'aspect-3/4 max-w-md mx-auto' : 'aspect-video max-w-3xl mx-auto'}>
            <KonvaRenderer
              stage={stage}
              context={previewCtx}
              backgroundUrl={backgroundUrl}
              className="h-full w-full bg-surface-secondary/40 rounded-lg border border-border"
            />
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

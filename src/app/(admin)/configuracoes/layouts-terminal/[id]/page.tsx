'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button, Card } from '@heroui/react';
import { mockContext } from '@/lib/terminal-layout/mock';
import { AVAILABLE_HELPERS, AVAILABLE_VARS } from '@/lib/terminal-layout/types';

const CodeEditor = dynamic(() => import('@/components/terminal-layout-editor/CodeEditor'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-sm text-muted">Carregando editor...</div>,
});
const Preview = dynamic(() => import('@/components/terminal-layout-editor/Preview'), { ssr: false });

type Layout = {
  id: string;
  name: string;
  description: string | null;
  configFound: string;
  configNotFound: string;
  configIdle: string;
  isActive: boolean;
};

type ScreenKey = 'configFound' | 'configNotFound' | 'configIdle';

const SCREENS: { key: ScreenKey; label: string; scenario: 'found' | 'not-found' | 'idle' }[] = [
  { key: 'configFound', label: 'Produto encontrado', scenario: 'found' },
  { key: 'configNotFound', label: 'Produto não encontrado', scenario: 'not-found' },
  { key: 'configIdle', label: 'Tela de descanso', scenario: 'idle' },
];

export default function EditorLayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState<ScreenKey>('configFound');
  const [tick, setTick] = useState(0); // força re-render do mock (clock)
  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape');

  // refresh do clock a cada 30s
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/terminal-layouts/${id}`);
        if (!res.ok) {
          alert('Layout não encontrado');
          router.push('/configuracoes/layouts-terminal');
          return;
        }
        setLayout(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  async function handleSave() {
    if (!layout) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/terminal-layouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: layout.name,
          description: layout.description,
          isActive: layout.isActive,
          configFound: layout.configFound,
          configNotFound: layout.configNotFound,
          configIdle: layout.configIdle,
        }),
      });
      if (res.ok) setLayout(await res.json());
      else alert((await res.json()).message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function patchScreen(value: string) {
    if (!layout) return;
    setLayout({ ...layout, [screen]: value });
  }

  const ctx = useMemo(() => {
    const scenario = SCREENS.find((s) => s.key === screen)?.scenario ?? 'found';
    return mockContext(scenario);
    // tick é dependência intencional: força recompute do clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tick]);

  if (loading || !layout) {
    return <p className="py-12 text-center text-sm text-muted">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/configuracoes/layouts-terminal" className="text-xs text-muted hover:text-foreground">
            ← Layouts do Terminal
          </Link>
          <input
            value={layout.name}
            onChange={(e) => setLayout({ ...layout, name: e.target.value })}
            className="mt-1 w-full bg-transparent text-2xl font-bold text-foreground outline-none"
          />
          <input
            value={layout.description ?? ''}
            placeholder="Descrição opcional"
            onChange={(e) => setLayout({ ...layout, description: e.target.value })}
            className="mt-0.5 w-full bg-transparent text-sm text-muted outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={layout.isActive}
              onChange={(e) => setLayout({ ...layout, isActive: e.target.checked })}
            />
            Ativo
          </label>
          <Button variant="primary" onPress={handleSave} isDisabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Tabs telas */}
      <div className="flex gap-2 border-b border-border">
        {SCREENS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setScreen(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              screen === key
                ? 'border-b-2 border-accent text-accent'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Preview em cima */}
      <Card>
        <Card.Content className="p-0">
          <div className="border-b border-border px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-muted">Preview ao vivo</span>
            <div className="flex gap-1">
              {(['landscape', 'portrait'] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrient(o)}
                  className={`text-[11px] px-2 py-0.5 rounded ${
                    orient === o ? 'bg-accent text-white' : 'bg-surface-secondary text-muted hover:text-foreground'
                  }`}
                >
                  {o === 'landscape' ? '🖥️ Paisagem (1920×1080)' : '📱 Retrato (1080×1920)'}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 bg-surface-secondary">
            {orient === 'landscape' ? (
              // Fluido: preenche toda largura disponível e mantém 16:9
              <Preview source={layout[screen]} context={ctx} ratio={16 / 9} designWidth={1920} />
            ) : (
              // Retrato: limita largura máxima para não ficar gigante na vertical
              <div className="mx-auto" style={{ maxWidth: 480 }}>
                <Preview source={layout[screen]} context={ctx} ratio={9 / 16} designWidth={1080} />
              </div>
            )}
          </div>
        </Card.Content>
      </Card>

      {/* Editor embaixo */}
      <Card>
        <Card.Content className="p-0">
          <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-widest text-muted">
            Código
          </div>
          <div style={{ height: 'min(70vh, 720px)', minHeight: 480 }}>
            <CodeEditor value={layout[screen]} onChange={patchScreen} />
          </div>
        </Card.Content>
      </Card>

      {/* Variáveis disponíveis */}
      <Card>
        <Card.Content className="py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Variáveis</p>
            <p className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_VARS.map((v) => (
                <code
                  key={v}
                  className="rounded-md bg-surface-secondary px-2 py-1 text-[12px] text-foreground"
                >
                  {'${' + v + '}'}
                </code>
              ))}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Helpers</p>
            <p className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_HELPERS.map((h) => (
                <code
                  key={h}
                  className="rounded-md bg-surface-secondary px-2 py-1 text-[12px] text-foreground"
                >
                  {'${' + h + '}'}
                </code>
              ))}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Tags suportadas</p>
            <p className="mt-2 text-sm text-muted">
              <code>&lt;view&gt;</code>, <code>&lt;text&gt;</code>, <code>&lt;image src=&quot;...&quot; mode=&quot;contain|cover|stretch&quot; /&gt;</code>,
              {' '}<code>&lt;row&gt;</code>, <code>&lt;column&gt;</code>. Use <code>class=&quot;...&quot;</code> com classes Tailwind.
            </p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

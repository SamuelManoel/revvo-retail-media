'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';

type IntegrationField = { key: string; label: string; type: string; placeholder?: string };
type IntegrationFeature = { key: string; label: string; description?: string; hasWorkflow?: boolean; allowManualSync?: boolean; lastSyncAt?: string | null };

type Integration = {
  slug: string;
  name: string;
  category: string;
  description: string;
  logoLetters: string;
  logoColor: string;
  fields: IntegrationField[];
  featuresDef: IntegrationFeature[];
  id: string | null;
  isEnabled: boolean;
  config: Record<string, string>;
  enabledFeatures: string[];
};

type Store = { id: string; name: string; company?: { id: string; name: string } };
type Session = { isMaster: boolean };

const CATEGORY_COLORS: Record<string, string> = {
  ERP:          'bg-violet-500/10 text-violet-400',
  PDV:          'bg-sky-500/10 text-sky-400',
  'E-commerce': 'bg-emerald-500/10 text-emerald-400',
};

function IntegrationLogo({ letters, color }: { letters: string; color: string }) {
  return (
    <div className={`h-11 w-11 rounded-xl bg-linear-to-br ${color} flex items-center justify-center shrink-0`}>
      <span className="text-xs font-bold text-white tracking-tight">{letters}</span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? 'bg-accent' : 'bg-border'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function FieldInput({ field, value, onChange }: { field: IntegrationField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{field.label}</label>
      <input
        type={field.type === 'password' ? 'password' : 'text'}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover"
      />
    </div>
  );
}

type FilterTab = 'all' | 'enabled' | 'disabled' | string;

export default function IntegracoesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string>('');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [isMaster, setIsMaster] = useState(false);

  const configModal = useOverlayState();
  const [selected, setSelected] = useState<Integration | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [featuresForm, setFeaturesForm] = useState<string[]>([]);
  const [enabledForm, setEnabledForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null); // featureKey em execução
  const [syncMessage, setSyncMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // lastSyncAt local por featureKey — substitui o valor vindo da API após cada sync
  const [localLastSync, setLocalLastSync] = useState<Record<string, string>>({});

  // Carrega lojas, categorias e sessão na montagem
  useEffect(() => {
    fetch('/api/stores')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Store[]) => {
        setStores(data);
        if (data.length > 0) {
          setStoreId(data[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => { setLoading(false); });

    fetch('/api/integration-categories')
      .then((r) => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setCategories(data.map((c) => c.name)))
      .catch(() => {});

    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data: Session | null) => { if (data) setIsMaster(data.isMaster); })
      .catch(() => {});
  }, []);

  // Carrega integrações quando a loja muda
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetch(`/api/integrations?storeId=${storeId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setIntegrations(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  async function patch(slug: string, body: object) {
    await fetch(`/api/integrations/${slug}?storeId=${storeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function handleToggle(integration: Integration) {
    const next = !integration.isEnabled;
    setIntegrations((prev) => prev.map((i) => i.slug === integration.slug ? { ...i, isEnabled: next } : i));
    await patch(integration.slug, { isEnabled: next });
  }

  async function handleSync(featureKey: string) {
    if (!selected || syncing) return;
    setSyncing(featureKey);
    setSyncMessage(null);
    try {
      const res = await fetch(
        `/api/integrations/${selected.slug}/sync?storeId=${storeId}&feature=${encodeURIComponent(featureKey)}`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const syncedAt: string = data.syncedAt ?? new Date().toISOString();
        setLocalLastSync((prev) => ({ ...prev, [featureKey]: syncedAt }));
        setSyncMessage({ type: 'ok', text: 'Sincronização concluída!' });
      } else {
        setSyncMessage({ type: 'err', text: data.message ?? 'Erro ao disparar sync.' });
      }
    } catch {
      setSyncMessage({ type: 'err', text: 'Erro de conexão com o servidor.' });
    } finally {
      setSyncing(null);
    }
  }

  function openConfig(integration: Integration) {
    setSelected(integration);
    const base = { ...integration.config };
    // Master pode ver e editar o tenantId; pré-preenche com o da loja se não tiver
    if (isMaster && !base.tenantId) {
      base.tenantId = storeId.replace(/-/g, '');
    }
    setConfigForm(base);
    setFeaturesForm([...integration.enabledFeatures]);
    setEnabledForm(integration.isEnabled);
    setSaveError(null);
    setSyncMessage(null);
    setLocalLastSync({});
    configModal.open();
  }

  async function handleSaveConfig() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/integrations/${selected.slug}?storeId=${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: enabledForm, config: configForm, features: featuresForm }),
      });
      if (!res.ok) { setSaveError('Erro ao salvar configuração.'); return; }
      setIntegrations((prev) => prev.map((i) =>
        i.slug === selected.slug
          ? { ...i, isEnabled: enabledForm, config: configForm, enabledFeatures: featuresForm }
          : i
      ));
      configModal.close();
    } catch {
      setSaveError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all',      label: 'Todas' },
    { key: 'enabled',  label: 'Ativas' },
    { key: 'disabled', label: 'Inativas' },
    ...categories.map((c) => ({ key: c, label: c })),
  ];

  const filtered = integrations.filter((i) => {
    if (activeTab === 'enabled')  return i.isEnabled;
    if (activeTab === 'disabled') return !i.isEnabled;
    if (activeTab !== 'all')      return i.category === activeTab;
    return true;
  });

  const enabledCount = integrations.filter((i) => i.isEnabled).length;
  const currentStore = stores.find((s) => s.id === storeId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="mt-1 text-sm text-muted">Conecte sua conta com serviços externos</p>
        </div>

        {/* Store selector */}
        {stores.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted shrink-0">Loja:</span>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {(() => {
                const grouped = stores.reduce<Record<string, Store[]>>((acc, s) => {
                  const key = s.company?.name ?? 'Lojas';
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(s);
                  return acc;
                }, {});
                const groups = Object.entries(grouped);
                if (groups.length === 1) {
                  return stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>);
                }
                return groups.map(([company, list]) => (
                  <optgroup key={company} label={company}>
                    {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ));
              })()}
            </select>
          </div>
        )}

        {stores.length === 1 && currentStore && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" className="text-muted shrink-0">
              <path d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12V14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14V12Z" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className="text-sm font-medium text-foreground">{currentStore.name}</span>
          </div>
        )}
      </div>

      {!storeId ? (
        <Card>
          <Card.Content className="py-16 text-center">
            <p className="text-sm text-muted">Nenhuma loja encontrada.</p>
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="p-0">
            {/* Filter tabs */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-foreground hover:bg-surface-secondary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted">
                <span className="text-foreground font-medium">{enabledCount}</span> ativa{enabledCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Grid */}
            <div className="p-5">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border p-5 space-y-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-surface-secondary" />
                        <div className="space-y-2 flex-1">
                          <div className="h-3.5 rounded bg-surface-secondary w-24" />
                          <div className="h-3 rounded bg-surface-secondary w-14" />
                        </div>
                      </div>
                      <div className="h-3 rounded bg-surface-secondary w-full" />
                      <div className="h-3 rounded bg-surface-secondary w-3/4" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">Nenhuma integração encontrada.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((integration) => (
                    <div
                      key={integration.slug}
                      className="rounded-xl border border-border bg-surface hover:border-accent/40 hover:shadow-sm transition-all p-5 flex flex-col gap-4"
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <IntegrationLogo letters={integration.logoLetters} color={integration.logoColor} />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm leading-tight">{integration.name}</p>
                            <span className={`inline-flex items-center mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[integration.category] ?? 'bg-muted/10 text-muted'}`}>
                              {integration.category}
                            </span>
                          </div>
                        </div>
                        <Toggle checked={integration.isEnabled} onChange={() => handleToggle(integration)} />
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted leading-relaxed flex-1">{integration.description}</p>

                      {/* Features preview */}
                      {integration.featuresDef.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {integration.featuresDef.map((feat) => (
                            <span
                              key={feat.key}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                integration.enabledFeatures.includes(feat.key)
                                  ? 'bg-accent/10 text-accent'
                                  : 'bg-surface-secondary text-muted'
                              }`}
                            >
                              {integration.enabledFeatures.includes(feat.key) && (
                                <span className="h-1 w-1 rounded-full bg-accent" />
                              )}
                              {feat.label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/60">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${integration.isEnabled ? 'text-success' : 'text-muted'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${integration.isEnabled ? 'bg-success' : 'bg-muted/40'}`} />
                          {integration.isEnabled ? 'Ativa' : 'Inativa'}
                        </span>
                        <button
                          onClick={() => openConfig(integration)}
                          className="text-xs text-accent hover:text-accent/80 font-medium flex items-center gap-1 transition-colors"
                        >
                          Configurar
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m9 18 6-6-6-6"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Config Modal */}
      {selected && (
        <Modal state={configModal}>
          <Modal.Backdrop isDismissable>
            <Modal.Container placement="center" size="md">
              <Modal.Dialog>
                <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                  <div className="flex items-center gap-3">
                    <IntegrationLogo letters={selected.logoLetters} color={selected.logoColor} />
                    <div>
                      <Modal.Heading className="text-base font-semibold text-foreground">{selected.name}</Modal.Heading>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[selected.category] ?? 'bg-muted/10 text-muted'}`}>
                          {selected.category}
                        </span>
                        {currentStore && (
                          <span className="text-[10px] text-muted">{currentStore.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Modal.CloseTrigger />
                </Modal.Header>

                <Modal.Body className="space-y-5 px-6 py-5 max-h-[60vh] overflow-y-auto">
                  {/* Tenant ID — visível apenas para master */}
                  {isMaster && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70">Identificação do tenant</p>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                          Tenant ID
                          <span className="ml-2 text-[10px] font-normal text-muted">(preenchido automaticamente · editável pelo master)</span>
                        </label>
                        <input
                          type="text"
                          value={configForm['tenantId'] ?? ''}
                          onChange={(e) => setConfigForm((f) => ({ ...f, tenantId: e.target.value }))}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft-hover"
                        />
                      </div>
                    </div>
                  )}

                  {/* Credentials */}
                  {selected.fields.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70">Credenciais</p>
                      {selected.fields.map((field) => (
                        <FieldInput
                          key={field.key}
                          field={field}
                          value={configForm[field.key] ?? ''}
                          onChange={(v) => setConfigForm((f) => ({ ...f, [field.key]: v }))}
                        />
                      ))}
                    </div>
                  )}

                  {/* Features */}
                  {selected.featuresDef.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70">Funcionalidades</p>
                      <div className="space-y-2">
                        {selected.featuresDef.map((feat) => {
                          const isActive = featuresForm.includes(feat.key);
                          const canSync = selected.isEnabled && isActive && feat.hasWorkflow && feat.allowManualSync;
                          return (
                            <div
                              key={feat.key}
                              className={`rounded-lg border px-4 py-3 transition-colors ${
                                isActive
                                  ? 'border-accent/40 bg-accent/5'
                                  : 'border-border bg-surface-secondary/40'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() =>
                                    setFeaturesForm((prev) =>
                                      isActive ? prev.filter((k) => k !== feat.key) : [...prev, feat.key]
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setFeaturesForm((prev) =>
                                        isActive ? prev.filter((k) => k !== feat.key) : [...prev, feat.key]
                                      );
                                    }
                                  }}
                                  className="flex-1 flex items-center justify-between gap-3 text-left cursor-pointer"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{feat.label}</p>
                                    {feat.description && <p className="text-xs text-muted mt-0.5">{feat.description}</p>}
                                  </div>
                                  <Toggle checked={isActive} onChange={() => {}} />
                                </div>
                              </div>

                              {canSync && (
                                <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    {(() => {
                                      const ts = localLastSync[feat.key] ?? feat.lastSyncAt;
                                      return ts ? (
                                        <span className="text-[10px] text-muted">
                                          Última sync: {new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-muted">Nunca sincronizado</span>
                                      );
                                    })()}
                                    <button
                                      type="button"
                                      disabled={!!syncing}
                                      onClick={() => handleSync(feat.key)}
                                      className="flex items-center gap-1.5 rounded-md bg-accent/10 hover:bg-accent-soft-hover text-accent px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={syncing === feat.key ? 'animate-spin' : ''}>
                                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                      </svg>
                                      {syncing === feat.key ? 'Sincronizando...' : 'Sincronizar agora'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {syncMessage && (
                        <p className={`rounded-lg px-3 py-2 text-sm ${syncMessage.type === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                          {syncMessage.text}
                        </p>
                      )}
                    </div>
                  )}

                  {saveError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{saveError}</p>}
                </Modal.Body>

                <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Status:</span>
                    <Toggle checked={enabledForm} onChange={setEnabledForm} />
                    <span className="text-xs text-muted">{enabledForm ? 'Ativa' : 'Inativa'}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onPress={configModal.close} isDisabled={saving}>Cancelar</Button>
                    <Button variant="primary" onPress={handleSaveConfig} isDisabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </div>
  );
}

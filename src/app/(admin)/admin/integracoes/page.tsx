'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';

type IntegrationField = { key: string; label: string; type: string; placeholder?: string };
type IntegrationFeature = {
  key: string;
  label: string;
  description?: string;
  allowManualSync?: boolean;
  workflowJson?: Record<string, unknown> | null;
  workflowRaw?: string; // só no frontend, não enviado à API
};

type Integration = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  logoLetters: string;
  logoColor: string;
  isActive: boolean;
  fields: IntegrationField[];
  features: IntegrationFeature[];
  n8nApiUrl: string | null;
  n8nApiKey: string | null;
  createdAt: string;
};

type Category = { id: string; name: string };

const LOGO_COLOR_PRESETS = [
  { label: 'Azul',       value: 'from-blue-500 to-blue-700' },
  { label: 'Azul Claro', value: 'from-sky-500 to-sky-700' },
  { label: 'Vermelho',   value: 'from-red-500 to-red-700' },
  { label: 'Laranja',    value: 'from-orange-500 to-orange-700' },
  { label: 'Verde',      value: 'from-emerald-500 to-teal-700' },
  { label: 'Violeta',    value: 'from-violet-500 to-purple-700' },
  { label: 'Rosa',       value: 'from-pink-500 to-rose-700' },
  { label: 'Neutro',     value: 'from-muted to-muted/60' },
];

const FIELD_TYPES = ['text', 'password', 'url', 'email', 'number'];

function IntegrationLogo({ letters, color }: { letters: string; color: string }) {
  return (
    <div className={`h-10 w-10 rounded-xl bg-linear-to-br ${color} flex items-center justify-center shrink-0`}>
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

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const EMPTY_FORM = {
  slug: '',
  name: '',
  category: '',
  description: '',
  logoLetters: '',
  logoColor: 'from-blue-500 to-blue-700',
  isActive: true,
  fields: [] as IntegrationField[],
  features: [] as IntegrationFeature[],
  n8nApiUrl: '',
  n8nApiKey: '',
};

// ─────────────────────────────────────────────
// Integrations tab
// ─────────────────────────────────────────────
function IntegrationsTab({ categories }: { categories: Category[] }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const formModal = useOverlayState();
  const deleteModal = useOverlayState();

  const [editing, setEditing] = useState<Integration | null>(null);
  const [toDelete, setToDelete] = useState<Integration | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [slugManual, setSlugManual] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function fetchIntegrations() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrations');
      if (res.ok) setIntegrations(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchIntegrations(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: categories[0]?.name ?? '' });
    setSlugManual(false);
    setSaveError(null);
    formModal.open();
  }

  function openEdit(integration: Integration) {
    setEditing(integration);
    setForm({
      slug: integration.slug,
      name: integration.name,
      category: integration.category,
      description: integration.description,
      logoLetters: integration.logoLetters,
      logoColor: integration.logoColor,
      isActive: integration.isActive,
      fields: integration.fields.map((f) => ({ ...f })),
      features: integration.features.map((f) => ({
        ...f,
        workflowRaw: f.workflowJson ? JSON.stringify(f.workflowJson, null, 2) : '',
      })),
      n8nApiUrl: integration.n8nApiUrl ?? '',
      n8nApiKey: integration.n8nApiKey ?? '',
    });
    setSlugManual(true);
    setSaveError(null);
    formModal.open();
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: slugManual ? f.slug : slugify(name) }));
  }

  function addField() {
    setForm((f) => ({ ...f, fields: [...f.fields, { key: '', label: '', type: 'text', placeholder: '' }] }));
  }
  function updateField(idx: number, patch: Partial<IntegrationField>) {
    setForm((f) => ({ ...f, fields: f.fields.map((field, i) => i === idx ? { ...field, ...patch } : field) }));
  }
  function removeField(idx: number) {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));
  }

  function addFeature() {
    setForm((f) => ({ ...f, features: [...f.features, { key: '', label: '', description: '', allowManualSync: false, workflowJson: null, workflowRaw: '' }] }));
  }
  function updateFeature(idx: number, patch: Partial<IntegrationFeature>) {
    setForm((f) => ({ ...f, features: f.features.map((feat, i) => i === idx ? { ...feat, ...patch } : feat) }));
  }
  function removeFeature(idx: number) {
    setForm((f) => ({ ...f, features: f.features.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    // Parseia workflowRaw de cada feature
    const parsedFeatures: IntegrationFeature[] = [];
    for (const feat of form.features) {
      if (feat.workflowRaw?.trim()) {
        try {
          const wj = JSON.parse(feat.workflowRaw);
          parsedFeatures.push({ key: feat.key, label: feat.label, description: feat.description, allowManualSync: feat.allowManualSync ?? false, workflowJson: wj });
        } catch {
          setSaveError(`JSON inválido na feature "${feat.label || feat.key}".`);
          setSaving(false);
          return;
        }
      } else {
        parsedFeatures.push({ key: feat.key, label: feat.label, description: feat.description, allowManualSync: feat.allowManualSync ?? false, workflowJson: null });
      }
    }

    try {
      const url = editing ? `/api/admin/integrations/${editing.id}` : '/api/admin/integrations';
      const method = editing ? 'PATCH' : 'POST';
      const { features: _, ...rest } = form;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, features: parsedFeatures }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message ?? 'Erro ao salvar.');
        return;
      }
      await fetchIntegrations();
      formModal.close();
    } catch {
      setSaveError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/integrations/${toDelete.id}`, { method: 'DELETE' });
      setIntegrations((prev) => prev.filter((i) => i.id !== toDelete.id));
      deleteModal.close();
    } catch { /* ignore */ } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive(integration: Integration) {
    const next = !integration.isActive;
    setIntegrations((prev) => prev.map((i) => i.id === integration.id ? { ...i, isActive: next } : i));
    await fetch(`/api/admin/integrations/${integration.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: next }),
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted">{integrations.length} integração{integrations.length !== 1 ? 'ões' : ''} cadastrada{integrations.length !== 1 ? 's' : ''}</p>
        <Button variant="primary" onPress={openCreate}>+ Nova integração</Button>
      </div>

      <Card>
        <Card.Content className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-surface-secondary animate-pulse" />
              ))}
            </div>
          ) : integrations.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">Nenhuma integração cadastrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {integrations.map((integration) => (
                <div key={integration.id} className="flex items-center gap-4 px-5 py-4">
                  <IntegrationLogo letters={integration.logoLetters} color={integration.logoColor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{integration.name}</p>
                      <span className="text-[10px] font-mono text-muted bg-surface-secondary rounded px-1.5 py-0.5">{integration.slug}</span>
                      <span className="text-[10px] font-semibold text-muted/70 bg-surface-secondary rounded-full px-2 py-0.5">{integration.category}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 truncate">{integration.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted">
                    <span>{integration.fields.length} campo{integration.fields.length !== 1 ? 's' : ''}</span>
                    <span>{integration.features.length} feature{integration.features.length !== 1 ? 's' : ''}</span>
                    {integration.features.some((f) => f.workflowJson) && (
                      <span className="flex items-center gap-1 text-accent font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        n8n
                      </span>
                    )}
                  </div>
                  <Toggle checked={integration.isActive} onChange={() => handleToggleActive(integration)} />
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(integration)} title="Editar"
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button onClick={() => { setToDelete(integration); deleteModal.open(); }} title="Excluir"
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Form Modal */}
      <Modal state={formModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {editing ? 'Editar integração' : 'Nova integração'}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>

              <Modal.Body className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-6">
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Nome <span className="text-danger">*</span></label>
                    <input type="text" value={form.name} onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ex.: Bluesoft"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft-hover" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Slug <span className="text-danger">*</span></label>
                    <input type="text" value={form.slug}
                      onChange={(e) => { setSlugManual(true); setForm((f) => ({ ...f, slug: e.target.value })); }}
                      placeholder="Ex.: bluesoft"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft-hover" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Categoria <span className="text-danger">*</span></label>
                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent">
                      <option value="">Selecione...</option>
                      {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Descrição <span className="text-danger">*</span></label>
                    <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2} placeholder="Descreva brevemente a integração..."
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent resize-none" />
                  </div>
                </div>

                {/* Logo */}
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70">Logo</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">Letras</label>
                      <input type="text" value={form.logoLetters}
                        onChange={(e) => setForm((f) => ({ ...f, logoLetters: e.target.value.slice(0, 4).toUpperCase() }))}
                        placeholder="Ex.: BS" maxLength={4}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted outline-none focus:border-accent" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">Cor</label>
                      <select value={form.logoColor} onChange={(e) => setForm((f) => ({ ...f, logoColor: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent">
                        {LOGO_COLOR_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {form.logoLetters && (
                    <div className="flex items-center gap-3">
                      <IntegrationLogo letters={form.logoLetters} color={form.logoColor} />
                      <span className="text-xs text-muted">Prévia do logo</span>
                    </div>
                  )}
                </div>

                {/* Fields */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70">Campos de credencial</p>
                    <button type="button" onClick={addField}
                      className="text-xs text-accent hover:text-accent/80 font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Adicionar campo
                    </button>
                  </div>
                  {form.fields.length === 0 && <p className="text-xs text-muted py-2">Nenhum campo adicionado.</p>}
                  {form.fields.map((field, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-surface-secondary/40 p-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted uppercase tracking-wide">Key</label>
                          <input type="text" value={field.key} onChange={(e) => updateField(idx, { key: e.target.value })}
                            placeholder="ex: token"
                            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted outline-none focus:border-accent" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted uppercase tracking-wide">Label</label>
                          <input type="text" value={field.label} onChange={(e) => updateField(idx, { label: e.target.value })}
                            placeholder="ex: Token"
                            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted uppercase tracking-wide">Tipo</label>
                          <select value={field.type} onChange={(e) => updateField(idx, { type: e.target.value })}
                            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent">
                            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[10px] font-medium text-muted uppercase tracking-wide">Placeholder</label>
                          <input type="text" value={field.placeholder ?? ''} onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                            placeholder="texto de exemplo"
                            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent" />
                        </div>
                        <button type="button" onClick={() => removeField(idx)}
                          className="mt-4 h-7 w-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70">Funcionalidades</p>
                    <button type="button" onClick={addFeature}
                      className="text-xs text-accent hover:text-accent/80 font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Adicionar funcionalidade
                    </button>
                  </div>
                  {form.features.length === 0 && <p className="text-xs text-muted py-2">Nenhuma funcionalidade adicionada.</p>}
                  {form.features.map((feat, idx) => {
                    const jsonValid = !feat.workflowRaw?.trim() || (() => { try { JSON.parse(feat.workflowRaw!); return true; } catch { return false; } })();
                    return (
                      <div key={idx} className="rounded-lg border border-border bg-surface-secondary/40 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-medium text-muted uppercase tracking-wide">Key</label>
                              <input type="text" value={feat.key} onChange={(e) => updateFeature(idx, { key: e.target.value })}
                                placeholder="ex: update_price"
                                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted outline-none focus:border-accent" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-medium text-muted uppercase tracking-wide">Label</label>
                              <input type="text" value={feat.label} onChange={(e) => updateFeature(idx, { label: e.target.value })}
                                placeholder="ex: Atualiza preço"
                                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent" />
                            </div>
                            <div className="col-span-2 flex flex-col gap-1">
                              <label className="text-[10px] font-medium text-muted uppercase tracking-wide">Descrição (opcional)</label>
                              <input type="text" value={feat.description ?? ''} onChange={(e) => updateFeature(idx, { description: e.target.value })}
                                placeholder="Descreva brevemente..."
                                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent" />
                            </div>
                            <div className="col-span-2 flex items-center justify-between rounded-md border border-border bg-surface px-2.5 py-1.5">
                              <span className="text-xs text-muted">Permitir sincronização manual pelo usuário</span>
                              <Toggle
                                checked={feat.allowManualSync ?? false}
                                onChange={(v) => updateFeature(idx, { allowManualSync: v })}
                              />
                            </div>
                          </div>
                          <button type="button" onClick={() => removeFeature(idx)}
                            className="mt-5 h-7 w-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>

                        {/* Workflow JSON por feature */}
                        <div className="flex flex-col gap-1 pt-1 border-t border-border/60">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-medium text-muted uppercase tracking-wide flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                              Workflow n8n desta feature
                            </label>
                            {feat.workflowRaw?.trim() && (
                              <span className={`text-[10px] font-medium ${jsonValid ? 'text-success' : 'text-danger'}`}>
                                {jsonValid ? 'JSON válido' : 'JSON inválido'}
                              </span>
                            )}
                          </div>
                          <textarea
                            value={feat.workflowRaw ?? ''}
                            onChange={(e) => updateFeature(idx, { workflowRaw: e.target.value })}
                            rows={4}
                            spellCheck={false}
                            placeholder={`Cole o JSON do workflow n8n para "${feat.label || feat.key}"...\nNome gerado: {loja}_{tenantId}_${feat.label || feat.key}`}
                            className={`w-full rounded-md border bg-surface px-2.5 py-2 text-xs font-mono text-foreground placeholder:text-muted outline-none focus:ring-1 resize-y ${
                              feat.workflowRaw?.trim() && !jsonValid
                                ? 'border-danger focus:border-danger focus:ring-danger/30'
                                : 'border-border focus:border-accent focus:ring-accent-soft-hover'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* n8n Workflow */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70 shrink-0">Automação n8n</p>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">URL do n8n</label>
                      <input
                        type="url"
                        value={form.n8nApiUrl}
                        onChange={(e) => setForm((f) => ({ ...f, n8nApiUrl: e.target.value }))}
                        placeholder="https://n8n.suaempresa.com"
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft-hover"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-foreground">API Key do n8n</label>
                      <input
                        type="password"
                        value={form.n8nApiKey}
                        onChange={(e) => setForm((f) => ({ ...f, n8nApiKey: e.target.value }))}
                        placeholder="••••••••••••"
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft-hover"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-muted">
                    Configure a URL e a API key do n8n. Os workflows são definidos por feature acima — um workflow por funcionalidade habilitada.
                  </p>
                </div>

                {saveError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{saveError}</p>}
              </Modal.Body>

              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Ativa:</span>
                  <Toggle checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onPress={formModal.close} isDisabled={saving}>Cancelar</Button>
                  <Button variant="primary" onPress={handleSave} isDisabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete Modal */}
      {toDelete && (
        <Modal state={deleteModal}>
          <Modal.Backdrop isDismissable>
            <Modal.Container placement="center" size="sm">
              <Modal.Dialog>
                <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                  <Modal.Heading className="text-base font-semibold text-foreground">Excluir integração</Modal.Heading>
                  <Modal.CloseTrigger />
                </Modal.Header>
                <Modal.Body className="px-6 py-5">
                  <p className="text-sm text-muted">
                    Tem certeza que deseja excluir a integração <span className="font-semibold text-foreground">{toDelete.name}</span>?
                    As configurações dos clientes vinculadas serão desassociadas.
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
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Categories tab
// ─────────────────────────────────────────────
function CategoriesTab({
  categories,
  onRefresh,
}: {
  categories: Category[];
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const deleteModal = useOverlayState();
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch('/api/admin/integration-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data.message ?? 'Erro ao criar categoria');
        return;
      }
      setNewName('');
      onRefresh();
    } catch {
      setAddError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return;
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/integration-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError(data.message ?? 'Erro ao atualizar');
        return;
      }
      setEditingId(null);
      onRefresh();
    } catch {
      setEditError('Erro de conexão.');
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/integration-categories/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message ?? 'Erro ao excluir');
        return;
      }
      deleteModal.close();
      onRefresh();
    } catch {
      setDeleteError('Erro de conexão.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add category */}
        <Card>
          <Card.Content className="p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground">Nova categoria</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Ex.: ERP, PDV, E-commerce..."
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft-hover"
              />
              <Button variant="primary" onPress={handleAdd} isDisabled={saving || !newName.trim()}>
                Adicionar
              </Button>
            </div>
            {addError && <p className="text-xs text-danger">{addError}</p>}
          </Card.Content>
        </Card>

        {/* Category list */}
        <Card>
          <Card.Content className="p-0">
            <div className="px-5 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{categories.length} categoria{categories.length !== 1 ? 's' : ''}</p>
            </div>
            {categories.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted">Nenhuma categoria cadastrada.</p>
            ) : (
              <div className="divide-y divide-border">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 px-5 py-3">
                    {editingId === cat.id ? (
                      <>
                        <input
                          autoFocus
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEdit(cat.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 rounded-lg border border-accent bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent-soft-hover"
                        />
                        <button onClick={() => handleEdit(cat.id)}
                          className="h-7 px-3 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors">
                          Salvar
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="h-7 px-2 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors text-xs">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-foreground">{cat.name}</span>
                        <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditError(null); }}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => { setToDelete(cat); setDeleteError(null); deleteModal.open(); }}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {editError && <p className="px-5 pb-3 text-xs text-danger">{editError}</p>}
          </Card.Content>
        </Card>
      </div>

      {/* Delete confirm modal */}
      {toDelete && (
        <Modal state={deleteModal}>
          <Modal.Backdrop isDismissable>
            <Modal.Container placement="center" size="sm">
              <Modal.Dialog>
                <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                  <Modal.Heading className="text-base font-semibold text-foreground">Excluir categoria</Modal.Heading>
                  <Modal.CloseTrigger />
                </Modal.Header>
                <Modal.Body className="px-6 py-5 space-y-3">
                  <p className="text-sm text-muted">
                    Tem certeza que deseja excluir a categoria <span className="font-semibold text-foreground">{toDelete.name}</span>?
                  </p>
                  {deleteError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{deleteError}</p>}
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
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
type Tab = 'integrations' | 'categories';

export default function AdminIntegracoesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('integrations');
  const [categories, setCategories] = useState<Category[]>([]);

  async function fetchCategories() {
    try {
      const res = await fetch('/api/admin/integration-categories');
      if (res.ok) setCategories(await res.json());
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchCategories(); }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'integrations', label: 'Integrações' },
    { key: 'categories',   label: 'Categorias' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catálogo de Integrações</h1>
        <p className="mt-1 text-sm text-muted">Gerencie as integrações e categorias disponíveis para todos os clientes</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'integrations' && <IntegrationsTab categories={categories} />}
      {activeTab === 'categories'   && <CategoriesTab categories={categories} onRefresh={fetchCategories} />}
    </div>
  );
}

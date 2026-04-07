'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { ActionTooltip } from '@/components/ui/action-tooltip';

type LicenseRenewal = {
  id: string;
  previousExpiresAt: string;
  newExpiresAt: string;
  addedQuantity: number;
  createdAt: string;
};

type License = {
  id: string;
  quantityTotal: number;
  quantityUsed: number;
  startsAt: string;
  expiresAt: string;
  status: string;
  renewals: LicenseRenewal[];
};

type Store = {
  id: string;
  name: string;
  address: string | null;
  company: { id: string; name: string } | null;
  license: License | null;
  _count: { terminals: number };
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

function LicenseBadge({ license }: { license: License | null }) {
  if (!license) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted/10 text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-muted" />
        Sem licença
      </span>
    );
  }
  const expired = new Date(license.expiresAt) < new Date();
  if (license.status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning/10 text-warning">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        Suspensa
      </span>
    );
  }
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-danger/10 text-danger">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        Expirada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-success/10 text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Ativa
    </span>
  );
}

export default function LicencasPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'suspended' | 'none'>('all');

  const [target, setTarget] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ quantityTotal: '', startsAt: '', expiresAt: '' });
  const [editForm, setEditForm] = useState({ newExpiresAt: '', addQuantity: '', removeQuantity: '' });
  const [historyLicense, setHistoryLicense] = useState<License | null>(null);

  const createModal = useOverlayState();
  const editModal = useOverlayState();
  const deleteModal = useOverlayState();
  const historyModal = useOverlayState();

  async function fetchStores() {
    setLoading(true);
    try {
      const res = await fetch('/api/stores');
      const data = await res.json();
      // Fetch renewals for each store that has a license
      const storesWithRenewals = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (s: Store) => {
          if (!s.license) return s;
          const lr = await fetch(`/api/stores/${s.id}/license`);
          if (!lr.ok) return s;
          const ld: License = await lr.json();
          return { ...s, license: ld };
        }),
      );
      setStores(storesWithRenewals);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStores(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stores.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(q) ||
        (s.company?.name ?? '').toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (filterStatus === 'none') return !s.license;
      if (filterStatus === 'all') return true;
      if (!s.license) return false;
      const expired = new Date(s.license.expiresAt) < new Date();
      if (filterStatus === 'active') return s.license.status === 'active' && !expired;
      if (filterStatus === 'expired') return expired || s.license.status !== 'active';
      if (filterStatus === 'suspended') return s.license.status === 'suspended';
      return true;
    });
  }, [stores, search, filterStatus]);

  const stats = useMemo(() => {
    let active = 0, expired = 0, suspended = 0, none = 0;
    for (const s of stores) {
      if (!s.license) { none++; continue; }
      if (s.license.status === 'suspended') { suspended++; continue; }
      if (new Date(s.license.expiresAt) < new Date()) { expired++; continue; }
      active++;
    }
    return { active, expired, suspended, none };
  }, [stores]);

  function openCreate(s: Store) {
    setTarget(s);
    setCreateForm({ quantityTotal: '', startsAt: new Date().toISOString().slice(0, 10), expiresAt: '' });
    setError(null);
    createModal.open();
  }

  function openEdit(s: Store) {
    setTarget(s);
    const expiresAt = s.license ? new Date(s.license.expiresAt).toISOString().slice(0, 10) : '';
    setEditForm({ newExpiresAt: expiresAt, addQuantity: '', removeQuantity: '' });
    setError(null);
    editModal.open();
  }

  function openDelete(s: Store) {
    setTarget(s);
    deleteModal.open();
  }

  function openHistory(s: Store) {
    setHistoryLicense(s.license);
    historyModal.open();
  }

  async function handleCreate() {
    if (!target) return;
    const { quantityTotal, startsAt, expiresAt } = createForm;
    if (!quantityTotal || !startsAt || !expiresAt) { setError('Preencha todos os campos.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${target.id}/license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityTotal: Number(quantityTotal), startsAt, expiresAt }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao criar licença.'); return; }
      createModal.close();
      fetchStores();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!target) return;
    const { newExpiresAt, addQuantity, removeQuantity } = editForm;

    const body: Record<string, unknown> = {};
    if (newExpiresAt && target.license && newExpiresAt !== new Date(target.license.expiresAt).toISOString().slice(0, 10)) {
      body.newExpiresAt = newExpiresAt;
    }
    if (addQuantity && Number(addQuantity) > 0) body.addQuantity = Number(addQuantity);
    if (removeQuantity && Number(removeQuantity) > 0) body.removeQuantity = Number(removeQuantity);

    if (Object.keys(body).length === 0) { setError('Nenhuma alteração detectada.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${target.id}/license`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao editar licença.'); return; }
      editModal.close();
      fetchStores();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSuspend(s: Store) {
    if (!s.license) return;
    const newStatus = s.license.status === 'suspended' ? 'active' : 'suspended';
    await fetch(`/api/stores/${s.id}/license`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchStores();
  }

  async function handleDelete() {
    if (!target) return;
    setSaving(true);
    try {
      await fetch(`/api/stores/${target.id}/license`, { method: 'DELETE' });
      deleteModal.close();
      fetchStores();
    } catch { /* ignore */ } finally {
      setSaving(false);
      setTarget(null);
    }
  }

  const FILTER_TABS = [
    { key: 'all', label: 'Todas', count: stores.length },
    { key: 'active', label: 'Ativas', count: stats.active },
    { key: 'expired', label: 'Expiradas', count: stats.expired },
    { key: 'suspended', label: 'Suspensas', count: stats.suspended },
    { key: 'none', label: 'Sem licença', count: stats.none },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Licenças</h1>
        <p className="mt-1 text-sm text-muted">Gerencie licenças de terminais por loja</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Ativas', value: stats.active, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Expiradas', value: stats.expired, color: 'text-danger', bg: 'bg-danger/10' },
          { label: 'Suspensas', value: stats.suspended, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Sem licença', value: stats.none, color: 'text-muted', bg: 'bg-muted/10' },
        ].map((s) => (
          <Card key={s.label}>
            <Card.Content className="px-4 py-3.5">
              <p className="text-xs text-muted">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.value}</p>
            </Card.Content>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <Card.Content className="p-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap gap-y-3">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    filterStatus === tab.key
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted hover:text-foreground hover:bg-surface-secondary',
                  ].join(' ')}
                >
                  {tab.label}
                  <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold ${filterStatus === tab.key ? 'bg-accent/20 text-accent' : 'bg-surface-secondary text-muted'}`}>
                    {loading ? '—' : tab.count}
                  </span>
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Pesquisar loja ou empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-lg border border-border bg-surface-secondary pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Loja / Empresa', 'Status', 'Terminais', 'Validade', 'Uso', 'Ações'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted">
                      {search ? 'Nenhuma loja encontrada.' : 'Nenhuma loja cadastrada.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const { license } = s;
                    const expired = license ? new Date(license.expiresAt) < new Date() : false;
                    const usedPct = license ? Math.min(Math.round((license.quantityUsed / license.quantityTotal) * 100), 100) : 0;
                    const available = license ? license.quantityTotal - license.quantityUsed : 0;

                    return (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                        {/* Store */}
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground text-sm leading-tight">{s.name}</p>
                          <p className="text-xs text-muted mt-0.5">{s.company?.name ?? '—'}</p>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <LicenseBadge license={license} />
                        </td>

                        {/* Terminais */}
                        <td className="px-5 py-3.5">
                          {license ? (
                            <div className="text-sm">
                              <span className="font-medium text-foreground">{available}</span>
                              <span className="text-muted"> disp. / {license.quantityTotal}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>

                        {/* Validade */}
                        <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                          {license ? (
                            <span className={expired ? 'text-danger font-medium' : 'text-foreground'}>
                              {new Date(license.expiresAt).toLocaleDateString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        {/* Uso (progress) */}
                        <td className="px-5 py-3.5">
                          {license ? (
                            <div className="w-24">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted">{license.quantityUsed}/{license.quantityTotal}</span>
                                <span className="text-[10px] text-muted">{usedPct}%</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${usedPct >= 90 ? 'bg-danger' : usedPct >= 70 ? 'bg-warning' : 'bg-accent'}`}
                                  style={{ width: `${usedPct}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            {!license ? (
                              <button
                                onClick={() => openCreate(s)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                              >
                                + Criar licença
                              </button>
                            ) : (
                              <>
                                <ActionTooltip label="Editar licença">
                                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                    </svg>
                                  </button>
                                </ActionTooltip>
                                <ActionTooltip label={license.status === 'suspended' ? 'Reativar licença' : 'Suspender licença'}>
                                  <span>
                                    <Switch checked={license.status !== 'suspended'} onChange={() => handleSuspend(s)} />
                                  </span>
                                </ActionTooltip>
                                {license.renewals && license.renewals.length > 0 && (
                                  <ActionTooltip label="Histórico de renovações">
                                    <button onClick={() => openHistory(s)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
                                      </svg>
                                    </button>
                                  </ActionTooltip>
                                )}
                                <ActionTooltip label="Remover licença">
                                  <button onClick={() => openDelete(s)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                    </svg>
                                  </button>
                                </ActionTooltip>
                              </>
                            )}
                            <ActionTooltip label="Ver detalhes">
                              <Link href={`/lojas/${s.id}/licencas`} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                                </svg>
                              </Link>
                            </ActionTooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border">
              <p className="text-xs text-muted">
                Mostrando <span className="text-foreground font-medium">{filtered.length}</span> de{' '}
                <span className="text-foreground font-medium">{stores.length}</span> lojas
              </p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* ── Create License Modal ── */}
      <Modal state={createModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Criar licença — {target?.name}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Quantidade de terminais">
                  <input type="number" min={1} placeholder="Ex.: 5" value={createForm.quantityTotal}
                    onChange={(e) => setCreateForm((f) => ({ ...f, quantityTotal: e.target.value }))} className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início">
                    <input type="date" value={createForm.startsAt}
                      onChange={(e) => setCreateForm((f) => ({ ...f, startsAt: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Vencimento">
                    <input type="date" value={createForm.expiresAt}
                      onChange={(e) => setCreateForm((f) => ({ ...f, expiresAt: e.target.value }))} className={inputClass} />
                  </Field>
                </div>
                {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={createModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleCreate} isDisabled={saving}>
                  {saving ? 'Criando...' : 'Criar licença'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Edit License Modal ── */}
      <Modal state={editModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Editar licença — {target?.name}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                {target?.license && (
                  <div className="rounded-lg bg-surface-secondary px-4 py-3 text-xs text-muted grid grid-cols-2 gap-2">
                    <div><span className="text-foreground font-medium">Total atual:</span> {target.license.quantityTotal}</div>
                    <div><span className="text-foreground font-medium">Em uso:</span> {target.license.quantityUsed}</div>
                    <div><span className="text-foreground font-medium">Vencimento atual:</span> {new Date(target.license.expiresAt).toLocaleDateString('pt-BR')}</div>
                    <div><span className="text-foreground font-medium">Status:</span> {target.license.status}</div>
                  </div>
                )}
                <Field label="Novo vencimento">
                  <input type="date" value={editForm.newExpiresAt}
                    onChange={(e) => setEditForm((f) => ({ ...f, newExpiresAt: e.target.value }))} className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Adicionar terminais">
                    <input type="number" min={0} placeholder="Ex.: 2" value={editForm.addQuantity}
                      onChange={(e) => setEditForm((f) => ({ ...f, addQuantity: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Remover terminais">
                    <input type="number" min={0} placeholder="Ex.: 1" value={editForm.removeQuantity}
                      onChange={(e) => setEditForm((f) => ({ ...f, removeQuantity: e.target.value }))} className={inputClass} />
                  </Field>
                </div>
                {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={editModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleEdit} isDisabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal state={deleteModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Remover licença</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Tem certeza que deseja remover a licença de{' '}
                  <span className="font-semibold text-foreground">{target?.name}</span>?
                  Os terminais ativos perderão o vínculo de licença.
                </p>
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={deleteModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="danger" onPress={handleDelete} isDisabled={saving}>
                  {saving ? 'Removendo...' : 'Remover licença'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* ── Renewal History Modal ── */}
      <Modal state={historyModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Histórico de renovações</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="p-0">
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface z-10">
                      <tr className="border-b border-border">
                        {['Data', 'Vencimento anterior', 'Novo vencimento', 'Qtd adicionada'].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyLicense?.renewals.map((r) => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                          <td className="px-5 py-3.5 text-muted text-xs">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</td>
                          <td className="px-5 py-3.5 text-muted text-xs">{new Date(r.previousExpiresAt).toLocaleDateString('pt-BR')}</td>
                          <td className="px-5 py-3.5 text-foreground text-xs">{new Date(r.newExpiresAt).toLocaleDateString('pt-BR')}</td>
                          <td className="px-5 py-3.5">
                            {r.addedQuantity > 0 ? (
                              <span className="text-success font-medium text-xs">+{r.addedQuantity}</span>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end">
                <Button variant="ghost" onPress={historyModal.close}>Fechar</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

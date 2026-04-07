'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import { Switch } from '@/components/ui/switch';
import { ActionTooltip } from '@/components/ui/action-tooltip';

type Store = { id: string; name: string; companyId: string };
type Company = { id: string; name: string };

type Terminal = {
  id: string;
  name: string;
  ip: string | null;
  location: string;
  isPriceChecker: boolean;
  isMediaDisplay: boolean;
  isActive: boolean;
  isBlocked: boolean;
  activationCode: string | null;
  lastSeenAt: string | null;
  storeId: string | null;
  store: { id: string; name: string } | null;
  companyId: string;
  company: { id: string; name: string } | null;
  createdAt: string;
};

const EMPTY_FORM = {
  name: '',
  ip: '',
  location: '',
  isPriceChecker: true,
  isMediaDisplay: false,
  storeId: '',
  companyId: '',
};

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-500',
];

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <div className={`h-8 w-8 shrink-0 rounded-full bg-linear-to-br ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex items-center justify-center text-xs font-semibold text-white select-none`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 15 * 60 * 1000;
}

function TypeBadges({ isPriceChecker, isMediaDisplay }: { isPriceChecker: boolean; isMediaDisplay: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isPriceChecker && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-sky-400/10 text-sky-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          Busca Preço
        </span>
      )}
      {isMediaDisplay && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-violet-400/10 text-violet-400">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          Mídia
        </span>
      )}
      {!isPriceChecker && !isMediaDisplay && (
        <span className="text-xs text-muted">—</span>
      )}
    </div>
  );
}

export default function TerminaisPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Terminal | null>(null);
  const [activationTarget, setActivationTarget] = useState<Terminal | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Terminal | null>(null);
  const [revokeResult, setRevokeResult] = useState<{ newActivationCode: string; licenseFreed: boolean } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const formModal = useOverlayState();
  const deleteModal = useOverlayState();
  const activationModal = useOverlayState();
  const revokeModal = useOverlayState();
  const revokeResultModal = useOverlayState();

  // Lojas filtradas pela empresa selecionada no form
  const filteredStores = useMemo(
    () => (form.companyId ? stores.filter((s) => s.companyId === form.companyId) : stores),
    [stores, form.companyId],
  );

  async function fetchData() {
    setLoading(true);
    try {
      const [tr, cr, sr, mr] = await Promise.all([
        fetch('/api/terminals'),
        fetch('/api/companies'),
        fetch('/api/stores'),
        fetch('/api/auth/me'),
      ]);
      const [td, cd, sd, me] = await Promise.all([tr.json(), cr.json(), sr.json(), mr.json()]);
      setTerminals(Array.isArray(td) ? td : []);
      setCompanies(Array.isArray(cd) ? cd : []);
      setStores(Array.isArray(sd) ? sd : []);
      setIsMaster(me?.isMaster === true);
    } catch {
      setTerminals([]);
      setCompanies([]);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return terminals.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.ip ?? '').includes(q) ||
        t.location.toLowerCase().includes(q) ||
        (t.store?.name ?? '').toLowerCase().includes(q) ||
        (t.company?.name ?? '').toLowerCase().includes(q),
    );
  }, [terminals, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    formModal.open();
  }

  function openEdit(t: Terminal) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      ip: t.ip ?? '',
      location: t.location,
      isPriceChecker: t.isPriceChecker,
      isMediaDisplay: t.isMediaDisplay,
      storeId: t.storeId ?? '',
      companyId: t.companyId,
    });
    setError(null);
    formModal.open();
  }

  function openDelete(t: Terminal) {
    setDeleteTarget(t);
    deleteModal.open();
  }

  function openActivation(t: Terminal) {
    setActivationTarget(t);
    activationModal.open();
  }

  function openRevoke(t: Terminal) {
    setRevokeTarget(t);
    setRevokeResult(null);
    revokeModal.open();
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/terminals/${revokeTarget.id}/revoke`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao revogar.'); return; }
      setRevokeResult({ newActivationCode: data.newActivationCode, licenseFreed: data.licenseFreed });
      revokeModal.close();
      revokeResultModal.open();
      fetchData();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setRevoking(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.location) {
      setError('Nome e localização são obrigatórios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editingId ? `/api/terminals/${editingId}` : '/api/terminals';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          ip: form.ip || undefined,
          location: form.location,
          isPriceChecker: form.isPriceChecker,
          isMediaDisplay: form.isMediaDisplay,
          storeId: form.storeId || undefined,
          companyId: form.companyId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao salvar.'); return; }
      formModal.close();
      fetchData();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleBlock(t: Terminal) {
    await fetch(`/api/terminals/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBlocked: !t.isBlocked }),
    });
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/terminals/${deleteTarget.id}`, { method: 'DELETE' });
      deleteModal.close();
      fetchData();
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Terminais</h1>
          <p className="mt-1 text-sm text-muted">Gerencie os terminais de smart price e mídia</p>
        </div>
        <Button variant="primary" size="sm" onPress={openCreate}>Novo terminal</Button>
      </div>

      <Card>
        <Card.Content className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-foreground">Todos os Terminais</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                {loading ? '—' : terminals.length}
              </span>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Pesquisar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-lg border border-border bg-surface-secondary pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors w-44"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['ID', 'Terminal', 'Tipo', 'Loja', 'Status', 'Ações'].map((h) => (
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
                      {search ? 'Nenhum terminal encontrado.' : 'Nenhum terminal cadastrado ainda.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((t, idx) => {
                    const online = isOnline(t.lastSeenAt);
                    return (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs text-muted">
                          #{t.id.slice(0, 7).toUpperCase()}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={t.name} index={idx} />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate leading-tight">{t.name}</p>
                              <p className="text-xs text-muted font-mono mt-0.5">{t.ip ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <TypeBadges isPriceChecker={t.isPriceChecker} isMediaDisplay={t.isMediaDisplay} />
                        </td>
                        <td className="px-5 py-3.5 text-muted text-sm">
                          {t.store?.name ?? <span className="text-muted/50">—</span>}
                          {t.company && (
                            <p className="text-xs text-muted/60 mt-0.5">{t.company.name}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {t.isBlocked ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-danger/10 text-danger">
                              <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                              Bloqueado
                            </span>
                          ) : !t.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted/10 text-muted">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                              Inativo
                            </span>
                          ) : online ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-success/10 text-success">
                              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning/10 text-warning">
                              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                              Offline
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <ActionTooltip label="Código de ativação">
                              <button
                                onClick={() => openActivation(t)}
                                className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </button>
                            </ActionTooltip>
                            <ActionTooltip label={t.isBlocked ? 'Desbloquear terminal' : 'Bloquear terminal'}>
                              <span>
                                <Switch checked={!t.isBlocked} onChange={() => handleToggleBlock(t)} />
                              </span>
                            </ActionTooltip>
                            <ActionTooltip label="Editar">
                              <button
                                onClick={() => openEdit(t)}
                                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M14.36 4.08l.93-.93a3 3 0 1 1 4.24 4.24l-.93.93M14.36 4.08L5.84 12.6c-.58.58-.86.86-1.11 1.2a7 7 0 0 0-.79 1.52c-.17.37-.3.76-.56 1.53L2.32 19.8M14.36 4.08l5.56 5.56M2.32 19.8l-1.9-1.9m1.9 1.9 3.28-1.08c.77-.26 1.16-.39 1.53-.56a7 7 0 0 0 1.52-.79c.34-.25.62-.53 1.2-1.11L11.4 18.16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </button>
                            </ActionTooltip>
                            {t.isActive && (
                              <ActionTooltip label="Revogar licença">
                                <button
                                  onClick={() => openRevoke(t)}
                                  className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 12h6m-3-3v6M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                  </svg>
                                </button>
                              </ActionTooltip>
                            )}
                            <ActionTooltip label="Excluir">
                              <button
                                onClick={() => openDelete(t)}
                                className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M20.5 6H3.5M18.83 8.5l-.46 6.9c-.18 2.65-.26 3.98-1.13 4.79C16.38 21 15.05 21 12.39 21h-.78c-2.66 0-3.99 0-4.86-.81-.87-.81-.95-2.14-1.13-4.8L5.17 8.5M9.5 11l.5 5M14.5 11l-.5 5M6.5 6c.06 0 .08 0 .11-.01A2.5 2.5 0 0 0 8.44 4.68c.01-.02.02-.05.05-.14l.1-.29c.08-.25.12-.37.17-.48A2.5 2.5 0 0 1 9.84 3.02C9.96 3 10.09 3 10.36 3h3.29c.27 0 .4 0 .52.02a2.5 2.5 0 0 1 1.79 1.59c.05.1.09.23.17.48l.1.28c.02.1.03.13.04.15A2.5 2.5 0 0 0 17.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </button>
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
                <span className="text-foreground font-medium">{terminals.length}</span> terminais
              </p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Create / Edit Modal */}
      <Modal state={formModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {editingId ? 'Editar terminal' : 'Novo terminal'}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Nome">
                  <input type="text" placeholder="Ex.: Terminal Caixa 1" value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="IP (opcional)">
                  <input type="text" placeholder="Ex.: 192.168.1.100" value={form.ip}
                    onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Localização">
                  <input type="text" placeholder="Ex.: Corredor A – Eletrônicos" value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className={inputClass} />
                </Field>

                {/* Tipo: switches */}
                <div className="rounded-lg border border-border bg-surface-secondary/50 px-4 py-3 space-y-3">
                  <p className="text-sm font-medium text-foreground">Tipo do terminal</p>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm text-foreground">Busca Preço</p>
                      <p className="text-xs text-muted mt-0.5">Permite consulta de preços</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, isPriceChecker: !f.isPriceChecker }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isPriceChecker ? 'bg-accent' : 'bg-border'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.isPriceChecker ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm text-foreground">Exibição de Mídia</p>
                      <p className="text-xs text-muted mt-0.5">Permite exibir banners e vídeos</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, isMediaDisplay: !f.isMediaDisplay }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isMediaDisplay ? 'bg-accent' : 'bg-border'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.isMediaDisplay ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>

                {/* Empresa (master only) + Loja */}
                {isMaster && (
                  <Field label="Empresa">
                    <select
                      value={form.companyId}
                      onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value, storeId: '' }))}
                      className={inputClass}
                    >
                      <option value="">Selecione uma empresa</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Loja">
                  <select
                    value={form.storeId}
                    onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Selecione uma loja</option>
                    {filteredStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>

                {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={formModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleSave} isDisabled={saving}>
                  {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Activation Code Modal */}
      <Modal state={activationModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Código de Ativação</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5 space-y-4">
                {activationTarget?.isActive ? (
                  <>
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-foreground text-center">
                        {activationTarget.name} já está ativo
                      </p>
                      <p className="text-xs text-muted text-center">
                        Este terminal foi ativado e está operando. O código de ativação não é exibido por segurança.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted">
                      Use este código no dispositivo para ativar o terminal <span className="font-semibold text-foreground">{activationTarget?.name}</span>.
                    </p>
                    {activationTarget?.activationCode ? (
                      <div className="flex items-center justify-center rounded-xl border border-border bg-surface-secondary py-6">
                        <span className="font-mono text-2xl font-bold tracking-widest text-foreground select-all">
                          {activationTarget.activationCode}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted text-center py-4">Código não disponível.</p>
                    )}
                    <div className="rounded-lg bg-accent/5 border border-accent-soft-hover px-3 py-2.5 text-xs text-muted space-y-1">
                      <p><span className="font-medium text-foreground">Endpoint:</span> POST /api/terminal/activate</p>
                      <p><span className="font-medium text-foreground">Body:</span> {`{ "activationCode": "${activationTarget?.activationCode ?? '...'}" }`}</p>
                    </div>
                  </>
                )}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end">
                <Button variant="ghost" onPress={activationModal.close}>Fechar</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Revoke Confirm Modal */}
      <Modal state={revokeModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Revogar licença</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5 space-y-3">
                <p className="text-sm text-muted">
                  Tem certeza que deseja revogar a licença de{' '}
                  <span className="font-semibold text-foreground">{revokeTarget?.name}</span>?
                </p>
                <div className="rounded-lg bg-danger/5 border border-danger-soft-hover px-4 py-3 text-xs text-muted space-y-1.5">
                  <p className="font-medium text-danger">O que acontece ao revogar:</p>
                  <p>• Terminal é desativado e bloqueado imediatamente</p>
                  <p>• Token JWT atual é invalidado — terminal perde acesso à API</p>
                  <p>• Código de ativação antigo é descartado</p>
                  <p>• 1 slot da licença da loja é liberado</p>
                  <p>• Um novo código de ativação será gerado para reuso futuro</p>
                </div>
                {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={() => { revokeModal.close(); setError(null); }} isDisabled={revoking}>Cancelar</Button>
                <Button variant="danger" onPress={handleRevoke} isDisabled={revoking}>
                  {revoking ? 'Revogando...' : 'Revogar licença'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Revoke Result Modal */}
      <Modal state={revokeResultModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Licença revogada</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5 space-y-4">
                <p className="text-sm text-muted">
                  A licença de <span className="font-semibold text-foreground">{revokeTarget?.name}</span> foi revogada com sucesso.
                  {revokeResult?.licenseFreed && ' 1 slot foi liberado na licença da loja.'}
                </p>
                <div>
                  <p className="text-xs text-muted mb-2">Novo código de ativação (use para reativar):</p>
                  <div className="flex items-center justify-center rounded-xl border border-border bg-surface-secondary py-5">
                    <span className="font-mono text-2xl font-bold tracking-widest text-foreground select-all">
                      {revokeResult?.newActivationCode}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-accent/5 border border-accent-soft-hover px-3 py-2.5 text-xs text-muted space-y-1">
                  <p><span className="font-medium text-foreground">Reativar via:</span> POST /api/terminal/activate</p>
                  <p><span className="font-medium text-foreground">Body:</span> {`{ "activationCode": "${revokeResult?.newActivationCode ?? '...'}" }`}</p>
                </div>
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end">
                <Button variant="primary" onPress={revokeResultModal.close}>Fechar</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete Modal */}
      <Modal state={deleteModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Excluir terminal</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Tem certeza que deseja excluir o terminal{' '}
                  <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? Essa ação não pode ser desfeita.
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
    </div>
  );
}

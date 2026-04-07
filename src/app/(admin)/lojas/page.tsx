'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import Link from 'next/link';
import { ActionTooltip } from '@/components/ui/action-tooltip';

type License = {
  quantityTotal: number;
  quantityUsed: number;
  expiresAt: string;
  status: string;
};

type Store = {
  id: string;
  name: string;
  address: string | null;
  companyId: string;
  company: { id: string; name: string } | null;
  license: License | null;
  _count: { terminals: number };
  createdAt: string;
};

type Company = { id: string; name: string };

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
    <div className={`h-8 w-8 shrink-0 rounded-lg bg-linear-to-br ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex items-center justify-center text-xs font-semibold text-white select-none`}>
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

function LicenseBadge({ license }: { license: License | null }) {
  if (!license) {
    return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted/10 text-muted">Sem licença</span>;
  }
  const expired = new Date(license.expiresAt) < new Date();
  const available = license.quantityTotal - license.quantityUsed;
  if (expired || license.status !== 'active') {
    return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-danger/10 text-danger">Expirada</span>;
  }
  if (available === 0) {
    return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-warning/10 text-warning">Limite atingido</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-success/10 text-success">{available} disponível{available !== 1 ? 'is' : ''}</span>;
}

export default function LojasPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);
  const [form, setForm] = useState({ name: '', address: '', companyId: '' });

  const formModal = useOverlayState();
  const deleteModal = useOverlayState();

  async function fetchData() {
    setLoading(true);
    try {
      const [sr, cr, mr] = await Promise.all([
        fetch('/api/stores'),
        fetch('/api/companies'),
        fetch('/api/auth/me'),
      ]);
      const [sd, cd, me] = await Promise.all([sr.json(), cr.json(), mr.json()]);
      setStores(Array.isArray(sd) ? sd : []);
      setCompanies(Array.isArray(cd) ? cd : []);
      setIsMaster(me?.isMaster === true);
    } catch {
      setStores([]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.address ?? '').toLowerCase().includes(q) ||
        (s.company?.name ?? '').toLowerCase().includes(q),
    );
  }, [stores, search]);

  function openCreate() {
    setEditingId(null);
    setForm({ name: '', address: '', companyId: '' });
    setError(null);
    formModal.open();
  }

  function openEdit(s: Store) {
    setEditingId(s.id);
    setForm({ name: s.name, address: s.address ?? '', companyId: s.companyId });
    setError(null);
    formModal.open();
  }

  function openDelete(s: Store) {
    setDeleteTarget(s);
    deleteModal.open();
  }

  async function handleSave() {
    if (!form.name) { setError('Nome é obrigatório.'); return; }
    setSaving(true);
    setError(null);
    try {
      const url = editingId ? `/api/stores/${editingId}` : '/api/stores';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          address: form.address || null,
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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/stores/${deleteTarget.id}`, { method: 'DELETE' });
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
          <h1 className="text-2xl font-bold text-foreground">Lojas</h1>
          <p className="mt-1 text-sm text-muted">Gerencie as lojas e suas licenças de terminal</p>
        </div>
        <Button variant="primary" size="sm" onPress={openCreate}>Nova loja</Button>
      </div>

      <Card>
        <Card.Content className="p-0">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-foreground">Todas as Lojas</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                {loading ? '—' : stores.length}
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

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['ID', 'Loja', 'Empresa', 'Terminais', 'Licença', 'Ações'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5"><div className="h-3.5 rounded bg-surface-secondary animate-pulse w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted">
                      {search ? 'Nenhuma loja encontrada.' : 'Nenhuma loja cadastrada ainda.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s, idx) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted">#{s.id.slice(0, 7).toUpperCase()}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} index={idx} />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate leading-tight">{s.name}</p>
                            {s.address && <p className="text-xs text-muted mt-0.5 truncate">{s.address}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted text-sm">{s.company?.name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-surface-secondary text-foreground text-xs font-semibold">
                          {s._count.terminals}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <LicenseBadge license={s.license} />
                        {s.license && (
                          <p className="text-xs text-muted mt-1">
                            {s.license.quantityUsed}/{s.license.quantityTotal} · vence {new Date(s.license.expiresAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <ActionTooltip label="Catálogo de produtos">
                            <Link href={`/lojas/${s.id}/catalogo`} className="p-1.5 rounded-lg text-muted hover:text-violet-400 hover:bg-violet-400/10 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
                              </svg>
                            </Link>
                          </ActionTooltip>
                          <ActionTooltip label="Gerenciar licença">
                            <Link href={`/lojas/${s.id}/licencas`} className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" /><path d="M12 11v10m-3-3 3 3 3-3" />
                              </svg>
                            </Link>
                          </ActionTooltip>
                          <ActionTooltip label="Editar">
                            <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M14.36 4.08l.93-.93a3 3 0 1 1 4.24 4.24l-.93.93M14.36 4.08L5.84 12.6c-.58.58-.86.86-1.11 1.2a7 7 0 0 0-.79 1.52c-.17.37-.3.76-.56 1.53L2.32 19.8M14.36 4.08l5.56 5.56M2.32 19.8l-1.9-1.9m1.9 1.9 3.28-1.08c.77-.26 1.16-.39 1.53-.56a7 7 0 0 0 1.52-.79c.34-.25.62-.53 1.2-1.11L11.4 18.16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            </button>
                          </ActionTooltip>
                          <ActionTooltip label="Excluir">
                            <button onClick={() => openDelete(s)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M20.5 6H3.5M18.83 8.5l-.46 6.9c-.18 2.65-.26 3.98-1.13 4.79C16.38 21 15.05 21 12.39 21h-.78c-2.66 0-3.99 0-4.86-.81-.87-.81-.95-2.14-1.13-4.8L5.17 8.5M9.5 11l.5 5M14.5 11l-.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            </button>
                          </ActionTooltip>
                        </div>
                      </td>
                    </tr>
                  ))
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

      {/* Create / Edit Modal */}
      <Modal state={formModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {editingId ? 'Editar loja' : 'Nova loja'}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Nome">
                  <input type="text" placeholder="Ex.: Loja Centro" value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Endereço (opcional)">
                  <input type="text" placeholder="Ex.: Rua das Flores, 123" value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={inputClass} />
                </Field>
                {isMaster && (
                  <Field label="Empresa">
                    <select value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))} className={inputClass}>
                      <option value="">Selecione uma empresa</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                )}
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

      {/* Delete Modal */}
      <Modal state={deleteModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Excluir loja</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Tem certeza que deseja excluir a loja{' '}
                  <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? Todos os terminais vinculados serão afetados.
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

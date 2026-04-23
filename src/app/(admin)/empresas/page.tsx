'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import { ActionTooltip } from '@/components/ui/action-tooltip';

// ── CNPJ helpers ──────────────────────────────────────────────────────────────
function cnpjDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
}

function cnpjMask(value: string): string {
  const d = cnpjDigits(value);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function cnpjDisplay(raw: string): string {
  // Se já tem 14 dígitos sem formatação, aplica a máscara para exibição
  const digits = cnpjDigits(raw);
  if (digits.length === 14) return cnpjMask(digits);
  return raw; // fallback: exibe como está
}

type Company = {
  id: string;
  name: string;
  legalName: string;
  cnpj: string;
  email: string;
  slug: string;
  conta: string;
  type: string;
  status: string;
  createdAt: string;
  _count?: { terminals: number; users: number };
};

type User = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isOwner: boolean;
  createdAt: string;
};

const EMPTY_COMPANY_FORM = { name: '', legalName: '', cnpj: '', email: '', slug: '', conta: '', status: 'ATIVO' };
const EMPTY_USER_FORM = { name: '', email: '', password: '', isActive: true, isOwner: false };

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
    <div
      className={`h-8 w-8 shrink-0 rounded-full bg-linear-to-br ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex items-center justify-center text-xs font-semibold text-white select-none`}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ATIVO' || status === 'ativo';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-success' : 'bg-muted'}`} />
      {isActive ? 'Ativo' : 'Inativo'}
    </span>
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

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isMaster, setIsMaster] = useState(false);

  const formModal = useOverlayState();
  const deleteModal = useOverlayState();
  const usersModal = useOverlayState();
  const userFormModal = useOverlayState();
  const deleteUserModal = useOverlayState();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usersTarget, setUsersTarget] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);

  async function fetchCompanies() {
    setLoading(true);
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers(companyId: string) {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => { fetchCompanies(); }, []);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.isMaster) setIsMaster(true); }).catch(() => {});
  }, []);
  useEffect(() => { if (usersTarget) fetchUsers(usersTarget.id); }, [usersTarget]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return companies.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.cnpj.includes(q),
    );
  }, [companies, search]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, userSearch]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_COMPANY_FORM);
    setError(null);
    formModal.open();
  }

  function openEdit(c: Company) {
    setEditingId(c.id);
    setForm({ name: c.name, legalName: c.legalName, cnpj: c.cnpj, email: c.email, slug: c.slug, conta: c.conta, status: c.status });
    setError(null);
    formModal.open();
  }

  function openDelete(c: Company) {
    setDeleteTarget(c);
    deleteModal.open();
  }

  function openUsers(c: Company) {
    setUsersTarget(c);
    setUserSearch('');
    usersModal.open();
  }

  async function handleSave() {
    if (!form.name || !form.legalName || !form.cnpj || !form.email || !form.slug || !form.conta) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/companies/${editingId}` : '/api/companies', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao salvar empresa.'); return; }
      formModal.close();
      fetchCompanies();
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
      await fetch(`/api/companies/${deleteTarget.id}`, { method: 'DELETE' });
      deleteModal.close();
      fetchCompanies();
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function openCreateUser() {
    setEditingUserId(null);
    setUserForm(EMPTY_USER_FORM);
    setUserError(null);
    userFormModal.open();
  }

  function openEditUser(u: User) {
    setEditingUserId(u.id);
    setUserForm({ name: u.name, email: u.email, password: '', isActive: u.isActive, isOwner: u.isOwner });
    setUserError(null);
    userFormModal.open();
  }

  function openDeleteUser(u: User) {
    setDeleteUserTarget(u);
    deleteUserModal.open();
  }

  async function handleSaveUser() {
    if (!userForm.name || !userForm.email) { setUserError('Preencha os campos obrigatórios.'); return; }
    if (!editingUserId && !userForm.password) { setUserError('Senha é obrigatória para novo usuário.'); return; }
    if (!usersTarget) return;
    setSavingUser(true);
    setUserError(null);
    try {
      if (editingUserId) {
        const body: Record<string, unknown> = { name: userForm.name, email: userForm.email, isActive: userForm.isActive };
        if (userForm.password) body.password = userForm.password;
        if (isMaster) body.isOwner = userForm.isOwner;
        const res = await fetch(`/api/users/${editingUserId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setUserError(data.message ?? 'Erro ao editar usuário.'); return; }
      } else {
        const body: Record<string, unknown> = { name: userForm.name, email: userForm.email, password: userForm.password, isActive: userForm.isActive, companyId: usersTarget.id };
        if (isMaster) body.isOwner = userForm.isOwner;
        const res = await fetch('/api/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setUserError(data.message ?? 'Erro ao criar usuário.'); return; }
      }
      userFormModal.close();
      fetchUsers(usersTarget.id);
    } catch {
      setUserError('Erro de conexão.');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget || !usersTarget) return;
    if (deleteUserTarget.isOwner && !isMaster) {
      deleteUserModal.close();
      return;
    }
    setDeletingUser(true);
    try {
      await fetch(`/api/users/${deleteUserTarget.id}`, { method: 'DELETE' });
      deleteUserModal.close();
      fetchUsers(usersTarget.id);
    } catch { /* ignore */ } finally {
      setDeletingUser(false);
      setDeleteUserTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="mt-1 text-sm text-muted">Gerencie as empresas e seus usuários</p>
        </div>
        <Button variant="primary" size="sm" onPress={openCreate}>Nova empresa</Button>
      </div>

      <Card>
        <Card.Content className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-foreground">Todas as Empresas</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                {loading ? '—' : companies.length}
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
                  {['ID', 'Empresa', 'CNPJ', 'Terminais', 'Usuários', 'Status', 'Ações'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted">
                      {search ? 'Nenhuma empresa encontrada.' : 'Nenhuma empresa cadastrada ainda.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, idx) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted">
                        #{c.id.slice(0, 7).toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} index={idx} />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate leading-tight">{c.name}</p>
                            <p className="text-xs text-muted truncate mt-0.5">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted whitespace-nowrap">{cnpjDisplay(c.cnpj)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                            <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
                          </svg>
                          <span className="font-medium">{c._count?.terminals ?? 0}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <span className="font-medium">{c._count?.users ?? 0}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <ActionTooltip label="Gerenciar usuários">
                            <button onClick={() => openUsers(c)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                            </button>
                          </ActionTooltip>
                          <ActionTooltip label="Editar empresa">
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                          </ActionTooltip>
                          {c.type !== 'master' && (
                            <ActionTooltip label="Excluir empresa">
                              <button onClick={() => openDelete(c)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                              </button>
                            </ActionTooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border">
              <p className="text-xs text-muted">
                Mostrando <span className="text-foreground font-medium">{filtered.length}</span> de{' '}
                <span className="text-foreground font-medium">{companies.length}</span> empresas
              </p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Create / Edit Company Modal */}
      <Modal state={formModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {editingId ? 'Editar empresa' : 'Nova empresa'}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Nome">
                  <input type="text" placeholder="Ex.: Supermercado Central" value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Razão Social">
                  <input type="text" placeholder="Ex.: Supermercado Central Ltda" value={form.legalName}
                    onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="CNPJ">
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={cnpjMask(form.cnpj)}
                    onChange={(e) => setForm((f) => ({ ...f, cnpj: cnpjDigits(e.target.value) }))}
                    maxLength={18}
                    className={inputClass}
                  />
                </Field>
                <Field label="E-mail">
                  <input type="email" placeholder="contato@empresa.com" value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Slug">
                  <input type="text" placeholder="supermercado-central" value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Conta">
                  <input type="text" placeholder="santo-antonio (usado no login)" value={form.conta}
                    onChange={(e) => setForm((f) => ({ ...f, conta: e.target.value }))} className={inputClass} />
                  <p className="text-xs text-muted">Identificador único para login. Ex.: santo-antonio</p>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
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

      {/* Delete Company Modal */}
      <Modal state={deleteModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Excluir empresa</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Tem certeza que deseja excluir a empresa{' '}
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

      {/* Users Modal */}
      <Modal state={usersModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Usuários — {usersTarget?.name}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="p-0">
                {/* Users table header */}
                <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm text-muted">Total:</span>
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                      {usersLoading ? '—' : users.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                      </svg>
                      <input
                        type="text" placeholder="Pesquisar..." value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="h-8 rounded-lg border border-border bg-surface-secondary pl-8 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors w-36"
                      />
                    </div>
                    <Button variant="primary" size="sm" onPress={openCreateUser}>Novo usuário</Button>
                  </div>
                </div>

                {/* Users table */}
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface z-10">
                      <tr className="border-b border-border">
                        {['Usuário', 'Status', 'Cadastrado em', 'Ações'].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {usersLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-b border-border/50">
                            {Array.from({ length: 4 }).map((_, j) => (
                              <td key={j} className="px-5 py-3.5">
                                <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-20" />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted">
                            {userSearch ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado ainda.'}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u, idx) => (
                          <tr key={u.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={u.name} index={idx} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-medium text-foreground truncate leading-tight text-sm">{u.name}</p>
                                    {u.isOwner && (
                                      <span className="shrink-0 inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">Proprietário</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted truncate mt-0.5">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${u.isActive ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-success' : 'bg-muted'}`} />
                                {u.isActive ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                              {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1">
                                <ActionTooltip label="Editar usuário">
                                  <button onClick={() => openEditUser(u)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                    </svg>
                                  </button>
                                </ActionTooltip>
                                {(!u.isOwner || isMaster) && (
                                  <ActionTooltip label="Excluir usuário">
                                    <button onClick={() => openDeleteUser(u)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                      </svg>
                                    </button>
                                  </ActionTooltip>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end">
                <Button variant="ghost" onPress={usersModal.close}>Fechar</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* User Form Modal */}
      <Modal state={userFormModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {editingUserId ? 'Editar usuário' : 'Novo usuário'}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Nome">
                  <input type="text" placeholder="Nome completo" value={userForm.name}
                    onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="E-mail">
                  <input type="email" placeholder="usuario@empresa.com" value={userForm.email}
                    onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Senha">
                  <input type="password" placeholder={editingUserId ? 'Deixe em branco para manter' : 'Senha do usuário'}
                    value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Status">
                  <select value={userForm.isActive ? 'true' : 'false'}
                    onChange={(e) => setUserForm((f) => ({ ...f, isActive: e.target.value === 'true' }))} className={inputClass}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </Field>
                {isMaster && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Proprietário</p>
                      <p className="text-xs text-muted">Proprietários só podem ser excluídos pelo master</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUserForm((f) => ({ ...f, isOwner: !f.isOwner }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${userForm.isOwner ? 'bg-accent' : 'bg-border'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${userForm.isOwner ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}
                {userError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{userError}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={userFormModal.close} isDisabled={savingUser}>Cancelar</Button>
                <Button variant="primary" onPress={handleSaveUser} isDisabled={savingUser}>
                  {savingUser ? 'Salvando...' : editingUserId ? 'Salvar alterações' : 'Cadastrar'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete User Modal */}
      <Modal state={deleteUserModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Excluir usuário</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-muted">
                  Tem certeza que deseja excluir o usuário{' '}
                  <span className="font-semibold text-foreground">{deleteUserTarget?.name}</span>? Essa ação não pode ser desfeita.
                </p>
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={deleteUserModal.close} isDisabled={deletingUser}>Cancelar</Button>
                <Button variant="danger" onPress={handleDeleteUser} isDisabled={deletingUser}>
                  {deletingUser ? 'Excluindo...' : 'Excluir'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

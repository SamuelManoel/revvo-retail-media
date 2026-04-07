'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';

type User = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
};

const EMPTY_FORM = { name: '', email: '', password: '', isActive: true };

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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-success' : 'bg-muted'}`} />
      {active ? 'Ativo' : 'Inativo'}
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
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover disabled:opacity-50';

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const formModal = useOverlayState();
  const deleteModal = useOverlayState();

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    formModal.open();
  }

  function openEdit(u: User) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: '', isActive: u.isActive });
    setError(null);
    formModal.open();
  }

  function openDelete(u: User) {
    setDeleteTarget(u);
    deleteModal.open();
  }

  async function handleSave() {
    if (!form.name || !form.email) { setError('Nome e e-mail são obrigatórios.'); return; }
    if (!editingId && !form.password) { setError('A senha é obrigatória ao criar um usuário.'); return; }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: form.name, email: form.email, isActive: form.isActive };
      if (form.password) body.password = form.password;
      const res = await fetch(editingId ? `/api/users/${editingId}` : '/api/users', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao salvar usuário.'); return; }
      formModal.close();
      fetchUsers();
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
      await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      deleteModal.close();
      fetchUsers();
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="mt-1 text-sm text-muted">Gerencie os usuários da sua empresa</p>
        </div>
        <Button variant="primary" size="sm" onPress={openCreate}>Novo usuário</Button>
      </div>

      <Card>
        <Card.Content className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-wrap">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-foreground">Todos os Usuários</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-accent text-xs font-semibold">
                {loading ? '—' : users.length}
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
                  {['ID', 'Usuário', 'Status', 'Cadastrado em', 'Ações'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 rounded bg-surface-secondary animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted">
                      {search ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado ainda.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u, idx) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted">
                        #{u.id.slice(0, 7).toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} index={idx} />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate leading-tight">{u.name}</p>
                            <p className="text-xs text-muted truncate mt-0.5">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge active={u.isActive} />
                      </td>
                      <td className="px-5 py-3.5 text-muted text-xs whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
                            title="Editar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDelete(u)}
                            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Excluir"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
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
                <span className="text-foreground font-medium">{users.length}</span> usuários
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
                  {editingId ? 'Editar usuário' : 'Novo usuário'}
                </Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Nome">
                  <input type="text" placeholder="Nome completo" value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="E-mail">
                  <input type="email" placeholder="email@exemplo.com" value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
                </Field>
                <Field label={editingId ? 'Nova senha (deixe em branco para não alterar)' : 'Senha'}>
                  <input type="password" placeholder={editingId ? 'Nova senha (opcional)' : 'Senha de acesso'}
                    value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Status">
                  <select value={form.isActive ? 'true' : 'false'}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === 'true' }))} className={inputClass}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
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

      {/* Delete Modal */}
      <Modal state={deleteModal}>
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

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import Link from 'next/link';

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
  company: { id: string; name: string } | null;
};

const inputClass = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ license }: { license: License }) {
  const expired = new Date(license.expiresAt) < new Date();
  if (expired || license.status !== 'active') {
    return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-danger/10 text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" />Expirada</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-success/10 text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />Ativa</span>;
}

export default function LicencasPage() {
  const { id } = useParams<{ id: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({ quantityTotal: '', startsAt: '', expiresAt: '' });
  // Renew form
  const [renewForm, setRenewForm] = useState({ newExpiresAt: '', addQuantity: '' });

  const createModal = useOverlayState();
  const renewModal = useOverlayState();

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => { if (d?.isMaster) setIsMaster(true); }).catch(() => {});
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [sr, lr] = await Promise.all([
        fetch(`/api/stores/${id}`),
        fetch(`/api/stores/${id}/license`),
      ]);
      const [sd, ld] = await Promise.all([sr.json(), lr.json()]);
      setStore(sr.ok ? sd : null);
      setLicense(lr.ok && ld ? ld : null);
    } catch {
      setStore(null);
      setLicense(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [id]);

  async function handleCreate() {
    const { quantityTotal, startsAt, expiresAt } = createForm;
    if (!quantityTotal || !startsAt || !expiresAt) { setError('Preencha todos os campos.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${id}/license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityTotal: Number(quantityTotal), startsAt, expiresAt }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao criar licença.'); return; }
      createModal.close();
      fetchData();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRenew() {
    const { newExpiresAt, addQuantity } = renewForm;
    if (!newExpiresAt && !addQuantity) { setError('Informe nova data de validade ou quantidade adicional.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${id}/license`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newExpiresAt: newExpiresAt || undefined,
          addQuantity: addQuantity ? Number(addQuantity) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Erro ao renovar licença.'); return; }
      renewModal.close();
      fetchData();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSuspend() {
    await fetch(`/api/stores/${id}/license`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: license?.status === 'suspended' ? 'active' : 'suspended' }),
    });
    fetchData();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-surface-secondary animate-pulse" />
        <Card><Card.Content className="py-12 text-center text-sm text-muted">Carregando...</Card.Content></Card>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Loja não encontrada</h1>
        <Link href="/lojas" className="text-sm text-accent hover:underline">← Voltar para Lojas</Link>
      </div>
    );
  }

  const available = license ? license.quantityTotal - license.quantityUsed : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/lojas" className="text-sm text-muted hover:text-foreground transition-colors">Lojas</Link>
            <span className="text-muted">/</span>
            <span className="text-sm text-foreground font-medium">{store.name}</span>
            <span className="text-muted">/</span>
            <span className="text-sm text-foreground">Licenças</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{store.name}</h1>
          {store.company && <p className="mt-1 text-sm text-muted">{store.company.name}</p>}
        </div>
        {isMaster && (!license ? (
          <Button variant="primary" size="sm" onPress={() => { setCreateForm({ quantityTotal: '', startsAt: '', expiresAt: '' }); setError(null); createModal.open(); }}>
            Criar licença
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onPress={handleSuspend}>
              {license.status === 'suspended' ? 'Reativar' : 'Suspender'}
            </Button>
            <Button variant="primary" size="sm" onPress={() => { setRenewForm({ newExpiresAt: '', addQuantity: '' }); setError(null); renewModal.open(); }}>
              Renovar licença
            </Button>
          </div>
        ))}
      </div>

      {/* License summary */}
      {license ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total de licenças', value: license.quantityTotal, color: 'text-foreground' },
            { label: 'Em uso', value: license.quantityUsed, color: 'text-warning' },
            { label: 'Disponíveis', value: available, color: available > 0 ? 'text-success' : 'text-danger' },
            { label: 'Vencimento', value: new Date(license.expiresAt).toLocaleDateString('pt-BR'), color: new Date(license.expiresAt) < new Date() ? 'text-danger' : 'text-foreground' },
          ].map((stat) => (
            <Card key={stat.label}>
              <Card.Content className="px-5 py-4">
                <p className="text-xs text-muted mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Card.Content className="py-12 text-center text-sm text-muted">
            Nenhuma licença configurada para esta loja.
          </Card.Content>
        </Card>
      )}

      {/* License details + status */}
      {license && (
        <Card>
          <Card.Content className="px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Detalhes da Licença</h2>
              <StatusBadge license={license} />
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Início</span>
                <span className="text-foreground">{new Date(license.startsAt).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Vencimento</span>
                <span className="text-foreground">{new Date(license.expiresAt).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <span className="text-foreground capitalize">{license.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Uso</span>
                <span className="text-foreground">{license.quantityUsed} / {license.quantityTotal}</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min((license.quantityUsed / license.quantityTotal) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted mt-1">{Math.round((license.quantityUsed / license.quantityTotal) * 100)}% utilizado</p>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Renewal history */}
      {license && license.renewals.length > 0 && (
        <Card>
          <Card.Content className="p-0">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Histórico de Renovações</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Data', 'Vencimento anterior', 'Novo vencimento', 'Qtd adicionada'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {license.renewals.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-5 py-3.5 text-muted">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-5 py-3.5 text-muted">{new Date(r.previousExpiresAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-5 py-3.5 text-foreground">{new Date(r.newExpiresAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-5 py-3.5">
                        {r.addedQuantity > 0 ? (
                          <span className="text-success font-medium">+{r.addedQuantity}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Create License Modal */}
      <Modal state={createModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Criar licença</Modal.Heading>
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

      {/* Renew Modal */}
      <Modal state={renewModal}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-border px-6 pb-4 pt-5">
                <Modal.Heading className="text-base font-semibold text-foreground">Renovar licença</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="space-y-4 px-6 py-5">
                <Field label="Novo vencimento">
                  <input type="date" value={renewForm.newExpiresAt}
                    onChange={(e) => setRenewForm((f) => ({ ...f, newExpiresAt: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Adicionar terminais (opcional)">
                  <input type="number" min={0} placeholder="Ex.: 2" value={renewForm.addQuantity}
                    onChange={(e) => setRenewForm((f) => ({ ...f, addQuantity: e.target.value }))} className={inputClass} />
                </Field>
                {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              </Modal.Body>
              <Modal.Footer className="border-t border-border px-6 pb-5 pt-4 flex justify-end gap-2">
                <Button variant="ghost" onPress={renewModal.close} isDisabled={saving}>Cancelar</Button>
                <Button variant="primary" onPress={handleRenew} isDisabled={saving}>
                  {saving ? 'Renovando...' : 'Renovar'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

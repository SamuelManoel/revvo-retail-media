'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardHeader, Separator } from '@heroui/react';

type ActionStatus = { type: 'success' | 'error'; message: string };

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft-hover disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function PerfilPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [infoStatus, setInfoStatus] = useState<ActionStatus | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<ActionStatus | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setName(data.name ?? '');
        setEmail(data.email ?? '');
        setCompany(data.company?.name ?? '');
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  async function handleSaveInfo() {
    if (!name.trim()) {
      setInfoStatus({ type: 'error', message: 'O nome não pode estar vazio.' });
      return;
    }
    setSavingInfo(true);
    setInfoStatus(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInfoStatus({ type: 'error', message: data.message ?? 'Erro ao salvar.' });
        return;
      }
      setInfoStatus({ type: 'success', message: 'Nome atualizado com sucesso.' });
    } catch {
      setInfoStatus({ type: 'error', message: 'Erro de conexão.' });
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleChangePassword() {
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setPasswordStatus({ type: 'error', message: 'Preencha todos os campos de senha.' });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordStatus({ type: 'error', message: 'A nova senha e a confirmação não coincidem.' });
      return;
    }
    setSavingPassword(true);
    setPasswordStatus(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordStatus({ type: 'error', message: data.message ?? 'Erro ao alterar senha.' });
        return;
      }
      setPasswordStatus({ type: 'success', message: 'Senha alterada com sucesso.' });
      setPasswords({ current: '', next: '', confirm: '' });
    } catch {
      setPasswordStatus({ type: 'error', message: 'Erro de conexão.' });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu perfil</h1>
        <p className="mt-1 text-sm text-muted">Gerencie suas informações de acesso</p>
      </div>

      {/* Informações */}
      <Card>
        <CardHeader className="pb-4">
          <h2 className="text-base font-semibold text-foreground">Informações</h2>
        </CardHeader>
        <Separator />
        <Card.Content className="space-y-5 py-6">
          {loadingProfile ? (
            <p className="text-sm text-muted">Carregando...</p>
          ) : (
            <>
              <Field label="Nome">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setInfoStatus(null); }}
                  className={inputClass}
                />
              </Field>
              <Field label="E-mail">
                <input type="email" value={email} disabled className={inputClass} />
              </Field>
              <Field label="Empresa">
                <input type="text" value={company} disabled className={inputClass} />
              </Field>

              {infoStatus && (
                <div className={`rounded-lg px-3 py-2 text-sm ${infoStatus.type === 'success' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'}`}>
                  {infoStatus.message}
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="primary" onPress={handleSaveInfo} isDisabled={savingInfo}>
                  {savingInfo ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Alterar senha */}
      <Card>
        <CardHeader className="pb-4">
          <h2 className="text-base font-semibold text-foreground">Alterar senha</h2>
        </CardHeader>
        <Separator />
        <Card.Content className="space-y-5 py-6">
          <Field label="Senha atual">
            <input
              type="password"
              placeholder="Sua senha atual"
              value={passwords.current}
              onChange={(e) => { setPasswords((p) => ({ ...p, current: e.target.value })); setPasswordStatus(null); }}
              className={inputClass}
            />
          </Field>
          <Field label="Nova senha">
            <input
              type="password"
              placeholder="Nova senha"
              value={passwords.next}
              onChange={(e) => { setPasswords((p) => ({ ...p, next: e.target.value })); setPasswordStatus(null); }}
              className={inputClass}
            />
          </Field>
          <Field label="Confirmar nova senha">
            <input
              type="password"
              placeholder="Repita a nova senha"
              value={passwords.confirm}
              onChange={(e) => { setPasswords((p) => ({ ...p, confirm: e.target.value })); setPasswordStatus(null); }}
              className={inputClass}
            />
          </Field>

          {passwordStatus && (
            <div className={`rounded-lg px-3 py-2 text-sm ${passwordStatus.type === 'success' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'}`}>
              {passwordStatus.message}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="primary" onPress={handleChangePassword} isDisabled={savingPassword}>
              {savingPassword ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

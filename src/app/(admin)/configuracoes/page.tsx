'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardHeader } from '@heroui/react';

type Config = {
  id: string;
  resetTime: number;
  lastSync: string | null;
  updatedAt: string;
};

type ActionStatus = {
  type: 'success' | 'error';
  message: string;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: ActionStatus | null }) {
  if (!status) return null;
  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm ${
        status.type === 'success'
          ? 'bg-accent/10 text-accent'
          : 'bg-danger/10 text-danger'
      }`}
    >
      {status.message}
    </div>
  );
}

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetTime, setResetTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ActionStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<ActionStatus | null>(null);
  const [pushStatus, setPushStatus] = useState<ActionStatus | null>(null);

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
      setResetTime(String(data.resetTime));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchConfig(); }, []);

  async function handleSave() {
    const value = parseInt(resetTime, 10);
    if (isNaN(value) || value < 1) {
      setSaveStatus({ type: 'error', message: 'Informe um tempo válido (mínimo 1 segundo).' });
      return;
    }
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetTime: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveStatus({ type: 'error', message: data.message ?? 'Erro ao salvar.' });
        return;
      }
      setConfig(data);
      setSaveStatus({ type: 'success', message: 'Configuração salva com sucesso.' });
    } catch {
      setSaveStatus({ type: 'error', message: 'Erro de conexão.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/config/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSyncStatus({ type: 'error', message: data.message ?? 'Erro ao gerar carga.' });
        return;
      }
      setSyncStatus({ type: 'success', message: data.message });
      fetchConfig();
    } catch {
      setSyncStatus({ type: 'error', message: 'Erro de conexão.' });
    } finally {
      setSyncing(false);
    }
  }

  async function handlePush() {
    setPushing(true);
    setPushStatus(null);
    try {
      const res = await fetch('/api/config/push', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setPushStatus({ type: 'error', message: data.message ?? 'Erro ao enviar carga.' });
        return;
      }
      setPushStatus({ type: 'success', message: data.message });
    } catch {
      setPushStatus({ type: 'error', message: 'Erro de conexão.' });
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="mt-1 text-sm text-muted">Configurações gerais do sistema</p>
      </div>

      {/* Configurações gerais */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <h2 className="text-base font-semibold text-foreground">Geral</h2>
        </CardHeader>
        <Card.Content className="space-y-6 py-6">
          {loading ? (
            <p className="text-center text-sm text-muted">Carregando...</p>
          ) : (
            <>
              <Field
                label="Tempo de reset (segundos)"
                hint="Tempo que o produto fica na tela antes de voltar ao início"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={resetTime}
                    onChange={(e) => { setResetTime(e.target.value); setSaveStatus(null); }}
                    className="
                      w-36 rounded-lg border border-border bg-surface px-3 py-2.5
                      text-sm text-foreground outline-none transition-colors
                      focus:border-accent focus:ring-2 focus:ring-accent-soft-hover
                    "
                  />
                  <span className="text-sm text-muted">segundos</span>
                </div>
              </Field>

              <StatusBadge status={saveStatus} />

              <div className="flex justify-end">
                <Button variant="primary" size="sm" onPress={handleSave} isDisabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar configurações'}
                </Button>
              </div>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Sincronização */}
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <h2 className="text-base font-semibold text-foreground">Sincronização</h2>
        </CardHeader>
        <Card.Content className="space-y-5 py-6">
          {/* Última sincronização */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Última sincronização</p>
              <p className="mt-0.5 text-xs text-muted">
                {config?.lastSync
                  ? new Date(config.lastSync).toLocaleString('pt-BR')
                  : 'Nenhuma carga gerada ainda'}
              </p>
            </div>
            <div className={`h-2.5 w-2.5 rounded-full ${config?.lastSync ? 'bg-accent' : 'bg-muted'}`} />
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Gerar carga */}
            <div className="flex-1 rounded-lg border border-border p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Gerar carga</p>
                <p className="mt-0.5 text-xs text-muted">
                  Processa e prepara os dados para envio aos terminais
                </p>
              </div>
              <StatusBadge status={syncStatus} />
              <Button
                variant="secondary"
                size="sm"
                onPress={handleSync}
                isDisabled={syncing}
              >
                {syncing ? 'Gerando...' : 'Gerar carga'}
              </Button>
            </div>

            {/* Enviar carga */}
            <div className="flex-1 rounded-lg border border-border p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Enviar carga aos terminais</p>
                <p className="mt-0.5 text-xs text-muted">
                  Envia a carga gerada para todos os terminais cadastrados
                </p>
              </div>
              <StatusBadge status={pushStatus} />
              <Button
                variant="primary"
                size="sm"
                onPress={handlePush}
                isDisabled={pushing || !config?.lastSync}
              >
                {pushing ? 'Enviando...' : 'Enviar aos terminais'}
              </Button>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

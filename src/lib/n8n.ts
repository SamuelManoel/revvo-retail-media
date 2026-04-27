/**
 * n8n workflow deployment service
 *
 * Cada feature habilitada tem seu próprio workflow no n8n.
 * Nome do workflow: "{storeName}_{tenantId}_{featureLabel}"
 *
 * O nó chamado "variáveis ambiente" (case-insensitive) é preenchido
 * automaticamente com as credenciais da loja.
 */

export type N8nWorkflow = Record<string, unknown>;

const ENV_NODE_NAMES = ['variáveis ambiente', 'variaveis ambiente', 'variables', 'env vars', 'environment'];

function isEnvNode(name: string) {
  return ENV_NODE_NAMES.some((n) => name.toLowerCase().includes(n));
}

/** Clona o workflow e preenche o nó "variáveis ambiente" com o config da loja. */
export function fillWorkflowVariables(
  workflowJson: N8nWorkflow,
  config: Record<string, string>,
): N8nWorkflow {
  const workflow = JSON.parse(JSON.stringify(workflowJson)) as N8nWorkflow;
  const nodes = (workflow.nodes ?? []) as Record<string, unknown>[];

  for (const node of nodes) {
    if (!isEnvNode(String(node.name ?? ''))) continue;
    const params = node.parameters as Record<string, unknown> | undefined;
    if (!params) continue;

    // formato assignments (n8n moderno)
    const assignments = (params.assignments as Record<string, unknown> | undefined)
      ?.assignments as Record<string, unknown>[] | undefined;

    if (Array.isArray(assignments)) {
      for (const a of assignments) {
        const key = String(a.name ?? a.id ?? '');
        if (key && config[key] !== undefined) a.value = config[key];
      }
      continue;
    }

    // formato values (n8n legado)
    const values = params.values as Record<string, unknown> | undefined;
    if (values) {
      for (const type of Object.keys(values)) {
        for (const item of (values[type] as Record<string, unknown>[])) {
          const key = String(item.name ?? '');
          if (key && config[key] !== undefined) item.value = config[key];
        }
      }
    }
  }

  return workflow;
}

/** Extrai os nomes de variáveis do nó "variáveis ambiente" para preview na UI. */
export function extractWorkflowVariables(workflowJson: N8nWorkflow): string[] {
  const nodes = (workflowJson.nodes ?? []) as Record<string, unknown>[];
  const vars: string[] = [];

  for (const node of nodes) {
    if (!isEnvNode(String(node.name ?? ''))) continue;
    const params = node.parameters as Record<string, unknown> | undefined;
    if (!params) continue;

    const assignments = (params.assignments as Record<string, unknown> | undefined)
      ?.assignments as Record<string, unknown>[] | undefined;

    if (Array.isArray(assignments)) {
      for (const a of assignments) {
        const key = String(a.name ?? a.id ?? '');
        if (key) vars.push(key);
      }
      break;
    }

    const values = params.values as Record<string, unknown> | undefined;
    if (values) {
      for (const type of Object.keys(values)) {
        for (const item of (values[type] as Record<string, unknown>[])) {
          const key = String(item.name ?? '');
          if (key) vars.push(key);
        }
      }
      break;
    }
  }

  return vars;
}

// ─── n8n REST API ─────────────────────────────────────────────────────────────

function n8nHeaders(apiKey: string) {
  return { 'Content-Type': 'application/json', 'X-N8N-API-KEY': apiKey };
}

function n8nBase(apiUrl: string) {
  return apiUrl.replace(/\/$/, '');
}

/**
 * URL base do n8n sem o prefixo /api/vN — usada para chamar webhooks.
 * Ex.: "http://host/api/v1" → "http://host"
 */
export function n8nWebhookBase(apiUrl: string): string {
  return apiUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '');
}

/** Retorna o path do webhook para uma feature de uma loja específica. */
export function featureWebhookPath(featureKey: string, tenantId: string): string {
  const slug = featureKey
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${tenantId}`;
}

/**
 * Localiza nós do tipo Webhook no workflow e substitui o `path`
 * pelo path único desta loja/feature, evitando colisões no n8n.
 */
export function setWebhookPathsExport(workflow: N8nWorkflow, featureKey: string, tenantId: string): void {
  setWebhookPaths(workflow, featureKey, tenantId);
}

function setWebhookPaths(workflow: N8nWorkflow, featureKey: string, tenantId: string): void {
  const nodes = (workflow.nodes ?? []) as Record<string, unknown>[];
  const path = featureWebhookPath(featureKey, tenantId);
  for (const node of nodes) {
    if (String(node.type ?? '').includes('webhook')) {
      const params = node.parameters as Record<string, unknown> | undefined;
      if (params) params.path = path;
    }
  }
}

/** Campos permitidos no settings pela API do n8n */
const ALLOWED_SETTINGS_KEYS = new Set([
  'saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
  'saveDataSuccessExecution', 'executionTimeout', 'timezone', 'errorWorkflow', 'executionOrder',
]);

/**
 * Sanitiza o workflow para o POST /workflows do n8n:
 * - Mantém apenas os campos aceitos no body root
 * - Remove propriedades extras do settings que causam erro de validação
 */
function sanitizeForCreate(workflow: N8nWorkflow): Record<string, unknown> {
  const w = workflow as Record<string, unknown>;

  const rawSettings = w.settings as Record<string, unknown> | undefined;
  const settings = rawSettings
    ? Object.fromEntries(Object.entries(rawSettings).filter(([k]) => ALLOWED_SETTINGS_KEYS.has(k)))
    : undefined;

  const body: Record<string, unknown> = {
    name:        w.name,
    nodes:       w.nodes,
    connections: w.connections ?? {},
  };
  if (settings && Object.keys(settings).length > 0) body.settings   = settings;
  if (w.staticData !== undefined)                    body.staticData = w.staticData;

  return body;
}

export async function n8nCreateWorkflow(apiUrl: string, apiKey: string, workflow: N8nWorkflow): Promise<string> {
  const res = await fetch(`${n8nBase(apiUrl)}/workflows`, {
    method: 'POST',
    headers: n8nHeaders(apiKey),
    body: JSON.stringify(sanitizeForCreate(workflow)),
  });
  if (!res.ok) throw new Error(`n8n create failed (${res.status}): ${await res.text()}`);
  return String((await res.json() as { id: string }).id);
}

export async function n8nUpdateWorkflow(apiUrl: string, apiKey: string, id: string, workflow: N8nWorkflow): Promise<void> {
  const res = await fetch(`${n8nBase(apiUrl)}/workflows/${id}`, {
    method: 'PUT',
    headers: n8nHeaders(apiKey),
    body: JSON.stringify(sanitizeForCreate(workflow)), // mesmas regras: sem active, id, versionId, meta, settings extras
  });
  if (!res.ok) throw new Error(`n8n update failed (${res.status}): ${await res.text()}`);
}

export async function n8nActivateWorkflow(apiUrl: string, apiKey: string, id: string): Promise<void> {
  const res = await fetch(`${n8nBase(apiUrl)}/workflows/${id}/activate`, {
    method: 'POST', headers: n8nHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`n8n activate failed (${res.status}): ${await res.text()}`);
}

export async function n8nDeactivateWorkflow(apiUrl: string, apiKey: string, id: string): Promise<void> {
  const res = await fetch(`${n8nBase(apiUrl)}/workflows/${id}/deactivate`, {
    method: 'POST', headers: n8nHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`n8n deactivate failed (${res.status}): ${await res.text()}`);
}

// ─── Deploy por feature ────────────────────────────────────────────────────────

export type FeatureDef = {
  key: string;
  label: string;
  workflowJson?: N8nWorkflow | null;
};

/**
 * Sincroniza todos os workflows de features para uma loja.
 *
 * Para cada feature:
 *   - Feature habilitada + tem workflowJson  → cria/atualiza + ativa
 *   - Feature desabilitada + tem workflowId  → desativa
 *
 * Retorna o mapa atualizado { featureKey: workflowId }.
 */
export async function syncFeatureWorkflows(opts: {
  apiUrl: string;
  apiKey: string;
  config: Record<string, string>;
  features: FeatureDef[];             // definição do catálogo (com workflowJson por feature)
  enabledFeatureKeys: string[];       // features que o usuário habilitou
  existingWorkflowIds: Record<string, string>; // mapa atual { featureKey: workflowId }
  integrationEnabled: boolean;        // se a integração toda está ativa
  storeName: string;
  tenantId: string;
}): Promise<Record<string, string>> {
  const {
    apiUrl, apiKey, config, features, enabledFeatureKeys,
    existingWorkflowIds, integrationEnabled, storeName, tenantId,
  } = opts;

  const updated = { ...existingWorkflowIds };

  for (const feature of features) {
    if (!feature.workflowJson) continue; // feature sem workflow configurado → pula

    const isEnabled = integrationEnabled && enabledFeatureKeys.includes(feature.key);
    const existingId = existingWorkflowIds[feature.key] ?? null;
    const workflowName = `${storeName}_${tenantId}_${feature.label}`;

    try {
      if (!isEnabled) {
        // Desabilitar: desativa no n8n se existir
        if (existingId) {
          await n8nDeactivateWorkflow(apiUrl, apiKey, existingId);
        }
      } else {
        // Habilitar: cria/atualiza e ativa
        const filled = fillWorkflowVariables(feature.workflowJson, config);
        filled.name = workflowName;
        setWebhookPaths(filled, feature.key, tenantId);

        if (existingId) {
          await n8nUpdateWorkflow(apiUrl, apiKey, existingId, filled);
          updated[feature.key] = existingId;
        } else {
          const newId = await n8nCreateWorkflow(apiUrl, apiKey, filled);
          updated[feature.key] = newId;
        }

        await n8nActivateWorkflow(apiUrl, apiKey, updated[feature.key]);
      }
    } catch (err) {
      console.error(`n8n sync error for feature "${feature.key}":`, err);
      // Non-blocking: continua para as próximas features
    }
  }

  return updated;
}

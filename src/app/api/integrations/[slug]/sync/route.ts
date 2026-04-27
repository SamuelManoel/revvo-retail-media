import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const maxDuration = 600; // 10 min (segundos) — aguarda o workflow n8n terminar
import { prisma } from '@/lib/prisma';
import {
  n8nWebhookBase, featureWebhookPath,
  fillWorkflowVariables, setWebhookPathsExport,
  n8nUpdateWorkflow, n8nActivateWorkflow,
  type FeatureDef,
} from '@/lib/n8n';

type Params = { params: Promise<{ slug: string }> };

const WEBHOOK_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — aguarda o workflow terminar (responseMode: lastNode)

async function callWebhook(webhookUrl: string): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      return { ok: false, status: 408, text: 'Timeout: workflow demorou mais de 10 minutos.' };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// POST /api/integrations/[slug]/sync?storeId=xxx&feature=featureKey
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { slug } = await params;
  const storeId    = req.nextUrl.searchParams.get('storeId');
  const featureKey = req.nextUrl.searchParams.get('feature');

  if (!storeId)    return NextResponse.json({ message: 'storeId obrigatório' }, { status: 400 });
  if (!featureKey) return NextResponse.json({ message: 'feature obrigatório' }, { status: 400 });

  const storeWhere = session.isMaster
    ? { id: storeId }
    : { id: storeId, companyId: session.companyId };

  const store = await prisma.store.findFirst({ where: storeWhere, select: { id: true, name: true, companyId: true } });
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const integrationDef = await prisma.integration.findUnique({ where: { slug } });
  if (!integrationDef?.n8nApiUrl || !integrationDef.n8nApiKey) {
    return NextResponse.json({ message: 'Integração sem n8n configurado' }, { status: 400 });
  }

  const companyIntegration = await prisma.companyIntegration.findUnique({
    where: { slug_storeId: { slug, storeId } },
  });
  if (!companyIntegration?.isEnabled) {
    return NextResponse.json({ message: 'Integração não está ativa para esta loja' }, { status: 400 });
  }

  const config   = (companyIntegration.config as Record<string, string>) ?? {};
  const tenantId = config.tenantId ?? store.id.replace(/-/g, '');
  const path     = featureWebhookPath(featureKey, tenantId);
  const webhookUrl = `${n8nWebhookBase(integrationDef.n8nApiUrl)}/webhook/${path}`;

  try {
    // 1ª tentativa
    let result = await callWebhook(webhookUrl);

    // Se webhook não registrado (404), re-deploya e tenta novamente
    if (result.status === 404) {
      const existingWorkflowIds = (companyIntegration.n8nWorkflowId as Record<string, unknown>) ?? {};
      const workflowId = existingWorkflowIds[featureKey] as string | undefined;

      if (workflowId) {
        const features = (integrationDef.features as FeatureDef[]) ?? [];
        const featureDef = features.find((f) => f.key === featureKey);

        if (featureDef?.workflowJson) {
          const filled = fillWorkflowVariables(featureDef.workflowJson, config);
          filled.name = `${store.name}_${tenantId}_${featureDef.label}`;
          setWebhookPathsExport(filled, featureKey, tenantId);

          await n8nUpdateWorkflow(integrationDef.n8nApiUrl, integrationDef.n8nApiKey, workflowId, filled);
          await n8nActivateWorkflow(integrationDef.n8nApiUrl, integrationDef.n8nApiKey, workflowId);

          result = await callWebhook(webhookUrl);
        }
      }
    }

    if (!result.ok) {
      return NextResponse.json({ message: `n8n retornou ${result.status}: ${result.text}` }, { status: 502 });
    }

    // Persiste timestamp da última sincronização em n8nWorkflowId.__lastSync
    const syncedAt = new Date().toISOString();
    const currentIds = (companyIntegration.n8nWorkflowId as Record<string, unknown>) ?? {};
    const lastSync = (currentIds.__lastSync as Record<string, string>) ?? {};
    await prisma.companyIntegration.update({
      where: { slug_storeId: { slug, storeId } },
      data: {
        n8nWorkflowId: {
          ...currentIds,
          __lastSync: { ...lastSync, [featureKey]: syncedAt },
        } as never,
      },
    });

    // Cria notificação no sino da empresa
    await prisma.notification.create({
      data: {
        title: `Sincronização concluída — ${integrationDef.name}`,
        body: `Feature "${featureKey}" sincronizada manualmente para a loja ${store.name}.`,
        type: 'success',
        companyId: store.companyId,
      },
    });

    return NextResponse.json({ ok: true, syncedAt });
  } catch (err) {
    console.error('Erro ao disparar webhook n8n:', err);
    return NextResponse.json({ message: 'Erro ao conectar com o n8n' }, { status: 502 });
  }
}

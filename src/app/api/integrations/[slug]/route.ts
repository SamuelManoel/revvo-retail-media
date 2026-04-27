import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncFeatureWorkflows, type FeatureDef } from '@/lib/n8n';

type Params = { params: Promise<{ slug: string }> };

// PATCH /api/integrations/[slug]?storeId=xxx
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { slug } = await params;
  const storeId = req.nextUrl.searchParams.get('storeId');
  if (!storeId) return NextResponse.json({ message: 'storeId obrigatório' }, { status: 400 });

  const storeWhere = session.isMaster
    ? { id: storeId }
    : { id: storeId, companyId: session.companyId };

  const store = await prisma.store.findFirst({ where: storeWhere, select: { id: true, name: true, companyId: true } });
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  const integrationDef = await prisma.integration.findUnique({ where: { slug } });
  if (!integrationDef) return NextResponse.json({ message: 'Integração não encontrada' }, { status: 404 });

  try {
    const body = await req.json();
    const { isEnabled, config, features } = body;

    const existing = await prisma.companyIntegration.findUnique({
      where: { slug_storeId: { slug, storeId } },
    });

    const resolvedFeatures = features ?? (existing?.features as string[]) ?? [];
    const resolvedEnabled  = isEnabled ?? existing?.isEnabled ?? false;

    // tenantId automático derivado da loja; master pode sobrescrever via config.tenantId
    const autoTenantId = store.id.replace(/-/g, '');
    const baseConfig = config ?? (existing?.config as Record<string, string>) ?? {};
    const resolvedConfig: Record<string, string> = { tenantId: autoTenantId, ...baseConfig };

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (isEnabled !== undefined) data.isEnabled = isEnabled;
    if (config    !== undefined) data.config    = resolvedConfig;
    if (features  !== undefined) data.features  = features;

    // Sync workflows n8n — um por feature
    if (integrationDef.n8nApiUrl && integrationDef.n8nApiKey) {
      const catalogFeatures = (integrationDef.features as FeatureDef[]) ?? [];
      const existingWorkflowIds = (existing?.n8nWorkflowId as unknown as Record<string, string>) ?? {};
      const tenantId = resolvedConfig.tenantId ?? autoTenantId;

      const updatedWorkflowIds = await syncFeatureWorkflows({
        apiUrl:              integrationDef.n8nApiUrl,
        apiKey:              integrationDef.n8nApiKey,
        config:              resolvedConfig,
        features:            catalogFeatures,
        enabledFeatureKeys:  resolvedFeatures,
        existingWorkflowIds,
        integrationEnabled:  resolvedEnabled,
        storeName:           store.name,
        tenantId,
      });

      data.n8nWorkflowId = updatedWorkflowIds;
    }

    const integration = await prisma.companyIntegration.upsert({
      where: { slug_storeId: { slug, storeId } },
      create: {
        slug,
        companyId: store.companyId,
        storeId,
        integrationId: integrationDef.id,
        isEnabled:  resolvedEnabled,
        config:     resolvedConfig as never,
        features:   resolvedFeatures,
        n8nWorkflowId: (data.n8nWorkflowId ?? {}) as never,
      },
      update: data,
    });

    return NextResponse.json(integration);
  } catch (error) {
    console.error('Erro ao salvar integração:', error);
    return NextResponse.json({ message: 'Erro ao salvar integração' }, { status: 500 });
  }
}

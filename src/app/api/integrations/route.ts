import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/integrations?storeId=xxx
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const storeId = req.nextUrl.searchParams.get('storeId');
  if (!storeId) return NextResponse.json({ message: 'storeId obrigatório' }, { status: 400 });

  // Master pode ver qualquer loja; não-master só as suas
  const storeWhere = session.isMaster
    ? { id: storeId }
    : { id: storeId, companyId: session.companyId };

  const store = await prisma.store.findFirst({ where: storeWhere, select: { id: true, companyId: true } });
  if (!store) return NextResponse.json({ message: 'Loja não encontrada' }, { status: 404 });

  try {
    const [catalog, saved] = await Promise.all([
      prisma.integration.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
      prisma.companyIntegration.findMany({ where: { storeId } }),
    ]);

    const savedMap = Object.fromEntries(saved.map((s) => [s.slug, s]));

    const result = catalog.map((def) => {
      const row = savedMap[def.slug];
      const lastSyncMap = ((row?.n8nWorkflowId as Record<string, unknown>)?.__lastSync ?? {}) as Record<string, string>;

      return {
        slug:            def.slug,
        name:            def.name,
        category:        def.category,
        description:     def.description,
        logoLetters:     def.logoLetters,
        logoColor:       def.logoColor,
        fields:          def.fields,
        featuresDef:     (def.features as { key: string; label: string; description?: string; workflowJson?: unknown; allowManualSync?: boolean }[])
                           .map(({ key, label, description, workflowJson, allowManualSync }) => ({
                             key, label, description,
                             hasWorkflow:    !!workflowJson,
                             allowManualSync: !!allowManualSync,
                             lastSyncAt:     lastSyncMap[key] ?? null,
                           })),
        id:              row?.id ?? null,
        isEnabled:       row?.isEnabled ?? false,
        config:          (row?.config as Record<string, string>) ?? {},
        enabledFeatures: (row?.features as string[]) ?? [],
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao listar integrações:', error);
    return NextResponse.json({ message: 'Erro ao listar integrações' }, { status: 500 });
  }
}

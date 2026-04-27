import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/integrations → lista todas integrações do catálogo
export async function GET() {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  try {
    const integrations = await prisma.integration.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json(integrations);
  } catch (error) {
    console.error('Erro ao listar integrações:', error);
    return NextResponse.json({ message: 'Erro ao listar integrações' }, { status: 500 });
  }
}

// POST /api/admin/integrations → cria nova integração no catálogo
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  try {
    const body = await req.json();
    const { slug, name, category, description, logoLetters, logoColor, isActive, fields, features, n8nApiUrl, n8nApiKey } = body;

    if (!slug || !name || !category || !description) {
      return NextResponse.json({ message: 'Campos obrigatórios: slug, name, category, description' }, { status: 400 });
    }

    const integration = await prisma.integration.create({
      data: {
        slug,
        name,
        category,
        description,
        logoLetters: logoLetters ?? '??',
        logoColor: logoColor ?? 'from-muted to-muted/60',
        isActive: isActive ?? true,
        fields: fields ?? [],
        features: features ?? [],
        n8nApiUrl: n8nApiUrl ?? null,
        n8nApiKey: n8nApiKey ?? null,
      },
    });

    return NextResponse.json(integration, { status: 201 });
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    if (e?.code === 'P2002') {
      return NextResponse.json({ message: 'Já existe uma integração com esse slug' }, { status: 409 });
    }
    console.error('Erro ao criar integração:', error);
    return NextResponse.json({ message: 'Erro ao criar integração' }, { status: 500 });
  }
}

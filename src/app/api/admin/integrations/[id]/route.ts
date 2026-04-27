import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/integrations/[id] → atualiza integração do catálogo
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const { slug, name, category, description, logoLetters, logoColor, isActive, fields, features, n8nApiUrl, n8nApiKey } = body;

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (slug         !== undefined) data.slug         = slug;
    if (name         !== undefined) data.name         = name;
    if (category     !== undefined) data.category     = category;
    if (description  !== undefined) data.description  = description;
    if (logoLetters  !== undefined) data.logoLetters  = logoLetters;
    if (logoColor    !== undefined) data.logoColor    = logoColor;
    if (isActive     !== undefined) data.isActive     = isActive;
    if (fields       !== undefined) data.fields       = fields;
    if (features     !== undefined) data.features     = features;
    if (n8nApiUrl    !== undefined) data.n8nApiUrl    = n8nApiUrl;
    if (n8nApiKey    !== undefined) data.n8nApiKey    = n8nApiKey;

    const integration = await prisma.integration.update({ where: { id }, data });
    return NextResponse.json(integration);
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    if (e?.code === 'P2025') {
      return NextResponse.json({ message: 'Integração não encontrada' }, { status: 404 });
    }
    if (e?.code === 'P2002') {
      return NextResponse.json({ message: 'Já existe uma integração com esse slug' }, { status: 409 });
    }
    console.error('Erro ao atualizar integração:', error);
    return NextResponse.json({ message: 'Erro ao atualizar integração' }, { status: 500 });
  }
}

// DELETE /api/admin/integrations/[id] → remove integração do catálogo
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.isMaster) return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.integration.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === 'P2025') {
      return NextResponse.json({ message: 'Integração não encontrada' }, { status: 404 });
    }
    console.error('Erro ao excluir integração:', error);
    return NextResponse.json({ message: 'Erro ao excluir integração' }, { status: 500 });
  }
}

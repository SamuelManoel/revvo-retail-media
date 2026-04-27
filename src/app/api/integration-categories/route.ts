import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const categories = await prisma.integrationCategory.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(categories);
}

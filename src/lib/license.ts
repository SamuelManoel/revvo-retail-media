import { prisma } from './prisma';

export async function checkLicenseAvailable(storeId: string): Promise<{ ok: boolean; reason?: string }> {
  const license = await prisma.storeLicense.findUnique({ where: { storeId } });

  if (!license) return { ok: false, reason: 'Loja não possui licença ativa.' };

  const now = new Date();
  if (license.status !== 'active') return { ok: false, reason: 'Licença suspensa ou inativa.' };
  if (license.expiresAt < now) return { ok: false, reason: 'Licença expirada.' };
  if (license.quantityUsed >= license.quantityTotal) return { ok: false, reason: 'Limite de terminais atingido.' };

  return { ok: true };
}

export async function incrementLicenseUsed(storeId: string): Promise<void> {
  await prisma.storeLicense.update({
    where: { storeId },
    data: { quantityUsed: { increment: 1 } },
  });
}

export async function decrementLicenseUsed(storeId: string): Promise<void> {
  const license = await prisma.storeLicense.findUnique({ where: { storeId } });
  if (!license || license.quantityUsed <= 0) return;
  await prisma.storeLicense.update({
    where: { storeId },
    data: { quantityUsed: { decrement: 1 } },
  });
}

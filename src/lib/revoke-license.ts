import { prisma } from './prisma';
import { generateActivationCode } from './terminal-auth';

export type RevokeResult =
  | { ok: true; terminalId: string; newActivationCode: string; licenseFreed: boolean }
  | { ok: false; reason: string };

/**
 * Revoga a licença de um terminal de forma atômica:
 * 1. Valida posse (companyId) e estado ativo
 * 2. Desativa o terminal (isActive=false, isBlocked=true, revokedAt, revokedBy)
 * 3. Revoga todas as TerminalCredentials — impede autenticação futura por JWT existente
 * 4. Marca a ativação mais recente como REVOKED
 * 5. Gera novo activationCode — o código antigo não pode mais ser reutilizado
 * 6. Libera 1 slot na StoreLicense da loja (quantityUsed -= 1, mín. 0)
 */
export async function revokeTerminalLicense(
  terminalId: string,
  revokedByUserId: string,
  callerCompanyId: string,
  isMaster: boolean,
): Promise<RevokeResult> {
  // ── 1. Buscar terminal com validação de tenant ──────────────────────────────
  const terminal = await prisma.terminal.findUnique({
    where: { id: terminalId },
    include: {
      credential: true,
      activations: { orderBy: { activatedAt: 'desc' }, take: 1 },
    },
  });

  if (!terminal) return { ok: false, reason: 'Terminal não encontrado' };

  if (!isMaster && terminal.companyId !== callerCompanyId) {
    return { ok: false, reason: 'Acesso não autorizado' };
  }

  if (!terminal.isActive) {
    return { ok: false, reason: 'Terminal já está inativo' };
  }

  // ── 2. Gerar novo activationCode único (verifica Terminal + histórico) ───────
  const newActivationCode = await generateActivationCode();

  const now = new Date();
  const lastActivation = terminal.activations[0] ?? null;
  let licenseFreed = false;

  // ── 3. Transação atômica ────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    // 3a. Desativar e revogar terminal
    await tx.terminal.update({
      where: { id: terminalId },
      data: {
        isActive: false,
        isBlocked: true,
        revokedAt: now,
        revokedBy: revokedByUserId,
        activationCode: newActivationCode, // invalida o código antigo
      },
    });

    // 3a.1 Registrar novo código no histórico
    await tx.activationCodeHistory.create({
      data: { code: newActivationCode, terminalId },
    });

    // 3b. Revogar credencial (impede JWT existente de passar pelo guard)
    if (terminal.credential) {
      await tx.terminalCredential.update({
        where: { terminalId },
        data: { status: 'REVOKED', revokedAt: now },
      });
    }

    // 3c. Marcar última ativação como REVOKED
    if (lastActivation) {
      await tx.terminalActivation.update({
        where: { id: lastActivation.id },
        data: { status: 'REVOKED', revokedAt: now, revokedBy: revokedByUserId },
      });
    }

    // 3d. Liberar slot da licença da loja
    if (terminal.storeId) {
      const license = await tx.storeLicense.findUnique({ where: { storeId: terminal.storeId } });
      if (license && license.quantityUsed > 0) {
        await tx.storeLicense.update({
          where: { storeId: terminal.storeId },
          data: { quantityUsed: license.quantityUsed - 1 },
        });
        licenseFreed = true;
      }
    }
  });

  return { ok: true, terminalId, newActivationCode, licenseFreed };
}

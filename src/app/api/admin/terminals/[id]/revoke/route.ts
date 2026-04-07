import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { revokeTerminalLicense } from '@/lib/revoke-license';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/terminals/:id/revoke
 *
 * Revoga a licença do terminal:
 * - isActive = false, isBlocked = true
 * - TerminalCredential.status = REVOKED  → bloqueia todos os JWTs existentes
 * - TerminalActivation mais recente → status = REVOKED
 * - StoreLicense.quantityUsed -= 1
 * - Novo activationCode gerado (o antigo não pode ser reutilizado)
 *
 * Resposta 200:
 * {
 *   "terminalId": "...",
 *   "newActivationCode": "XXXXXXXX",
 *   "licenseFreed": true,
 *   "message": "Terminal revogado com sucesso"
 * }
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });

  const { id: terminalId } = await params;

  const result = await revokeTerminalLicense(
    terminalId,
    session.userId,
    session.companyId,
    session.isMaster,
  );

  if (!result.ok) {
    const status =
      result.reason === 'Terminal não encontrado' ? 404
      : result.reason === 'Acesso não autorizado' ? 403
      : 422;
    return NextResponse.json({ message: result.reason }, { status });
  }

  return NextResponse.json({
    terminalId: result.terminalId,
    newActivationCode: result.newActivationCode,
    licenseFreed: result.licenseFreed,
    message: 'Terminal revogado com sucesso',
  });
}

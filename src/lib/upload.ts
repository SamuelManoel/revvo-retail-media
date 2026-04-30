export function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

export function getMediaType(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  throw new Error('Tipo de arquivo não suportado');
}

export function buildMediaPath(fileName: string, opts?: { storeTenantId?: string | null }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Quando uma loja está selecionada, segrega os arquivos por tenant_id (storeId sem hífens).
  // Sem loja → fica em "uploads/" (legacy/empresa).
  const prefix = opts?.storeTenantId ? `stores/${opts.storeTenantId}` : '';
  const base = prefix ? `${prefix}/uploads` : 'uploads';

  return `${base}/${year}/${month}/${Date.now()}-${fileName}`;
}

/** Caminho para o placeholder que materializa a pasta da loja no Supabase Storage. */
export function buildStoreFolderKeepPath(storeTenantId: string) {
  return `stores/${storeTenantId}/.keep`;
}
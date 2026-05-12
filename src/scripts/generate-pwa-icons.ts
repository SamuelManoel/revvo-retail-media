/**
 * Gera os ícones PWA do site institucional a partir do logo oficial
 * (public/logo-preto.png — glifo branco em fundo verde da marca).
 *
 * Execução: npx tsx src/scripts/generate-pwa-icons.ts
 *
 * Saída em /public/icons/
 *   - icon-192.png            (any)
 *   - icon-512.png            (any)
 *   - icon-maskable-192.png   (maskable, com padding interno pra safe zone)
 *   - icon-maskable-512.png   (maskable, com padding interno pra safe zone)
 *   - apple-touch-icon.png    (180x180 — sem cantos arredondados, iOS faz)
 *   - icon-32.png             (favicon)
 */

import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ACCENT = '#22c55e' // verde da marca (≈ oklch(76.97% 0.2124 148.67))

const PUBLIC_DIR = path.resolve(process.cwd(), 'public')
const ICONS_DIR  = path.join(PUBLIC_DIR, 'icons')
const SOURCE     = path.join(PUBLIC_DIR, 'logo-preto.png') // glifo branco em fundo verde

async function renderIcon(size: number, padding: number, dest: string) {
  const inner = size - padding * 2
  const buf = await sharp({
    create: { width: size, height: size, channels: 4, background: ACCENT },
  })
    .composite([{
      input: await sharp(SOURCE).resize(inner, inner, { fit: 'contain' }).toBuffer(),
      top: padding,
      left: padding,
    }])
    .png()
    .toBuffer()
  await writeFile(dest, buf)
  console.log(`  ✓ ${path.relative(PUBLIC_DIR, dest)}  (${buf.length.toLocaleString()} bytes)`)
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true })

  // Standard (any) — sem padding (o logo já tem seu próprio respiro)
  await renderIcon(192, 0,  path.join(ICONS_DIR, 'icon-192.png'))
  await renderIcon(512, 0,  path.join(ICONS_DIR, 'icon-512.png'))

  // Maskable — padding generoso para a safe zone do Android (~10-15% por lado)
  await renderIcon(192, 24, path.join(ICONS_DIR, 'icon-maskable-192.png'))
  await renderIcon(512, 64, path.join(ICONS_DIR, 'icon-maskable-512.png'))

  // Apple touch icon (iOS arredonda sozinho)
  await renderIcon(180, 0,  path.join(PUBLIC_DIR, 'apple-touch-icon.png'))

  // Favicon
  await renderIcon(32,  0,  path.join(PUBLIC_DIR, 'icon-32.png'))

  console.log('Pronto.')
}

main().catch((e) => { console.error(e); process.exit(1) })

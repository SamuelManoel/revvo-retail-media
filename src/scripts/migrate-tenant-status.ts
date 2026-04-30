import { migrateTenantSchemas } from '../lib/tenant-db'

async function main() {
  console.log('Migrando schemas tenant — adicionando coluna status...')
  const count = await migrateTenantSchemas()
  console.log(`${count} schema(s) migrado(s) com sucesso.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Erro na migração:', err)
  process.exit(1)
})

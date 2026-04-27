CREATE TABLE "integrations" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "slug"        TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "category"    TEXT        NOT NULL,
  "description" TEXT        NOT NULL,
  "logoLetters" TEXT        NOT NULL DEFAULT '??',
  "logoColor"   TEXT        NOT NULL DEFAULT 'from-muted to-muted/60',
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "fields"      JSONB       NOT NULL DEFAULT '[]',
  "features"    JSONB       NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "integrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integrations_slug_key" UNIQUE ("slug")
);

ALTER TABLE "company_integrations"
  ADD COLUMN IF NOT EXISTS "integrationId" TEXT,
  ADD CONSTRAINT "company_integrations_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL;

-- Seed das integrações padrão
INSERT INTO "integrations" ("slug","name","category","description","logoLetters","logoColor","fields","features") VALUES
('bluesoft','Bluesoft','ERP','Integre com o ERP Bluesoft para sincronizar produtos e preços automaticamente.','BS','from-blue-500 to-blue-700',
  '[{"key":"account","label":"Account","type":"text","placeholder":"Ex.: minha-loja"},{"key":"token","label":"Token","type":"password","placeholder":"Token de acesso"}]',
  '[{"key":"update_price","label":"Atualiza preço","description":"Sincroniza preços do ERP para o catálogo"},{"key":"update_product","label":"Atualiza produto","description":"Sincroniza nome e código de produto"}]'),
('totvs','TOTVS','ERP','Conecte com o TOTVS para sincronizar o catálogo de produtos e preços.','TV','from-red-500 to-red-700',
  '[{"key":"url","label":"URL da API","type":"url","placeholder":"https://api.totvs.com"},{"key":"username","label":"Usuário","type":"text","placeholder":"usuario"},{"key":"password","label":"Senha","type":"password","placeholder":"••••••••"}]',
  '[{"key":"update_price","label":"Atualiza preço"},{"key":"update_product","label":"Atualiza produto"},{"key":"update_stock","label":"Atualiza estoque"}]'),
('sap','SAP','ERP','Integração com SAP Business One para gestão completa de produtos.','SAP','from-sky-500 to-sky-700',
  '[{"key":"server","label":"Servidor","type":"text","placeholder":"sap.empresa.com"},{"key":"company","label":"Company DB","type":"text","placeholder":"SBO_EMPRESA"},{"key":"username","label":"Usuário","type":"text","placeholder":"manager"},{"key":"password","label":"Senha","type":"password","placeholder":"••••••••"}]',
  '[{"key":"update_price","label":"Atualiza preço"},{"key":"update_product","label":"Atualiza produto"}]'),
('linx','Linx','PDV','Sincronize produtos e preços com o sistema PDV Linx.','LX','from-orange-500 to-orange-700',
  '[{"key":"client_id","label":"Client ID","type":"text","placeholder":"client_id"},{"key":"client_secret","label":"Client Secret","type":"password","placeholder":"••••••••"}]',
  '[{"key":"update_price","label":"Atualiza preço"},{"key":"update_product","label":"Atualiza produto"}]'),
('tray','Tray Commerce','E-commerce','Integre seu e-commerce Tray para manter preços atualizados nos terminais.','TR','from-emerald-500 to-teal-700',
  '[{"key":"api_key","label":"API Key","type":"password","placeholder":"Sua chave de API"},{"key":"store_id","label":"Store ID","type":"text","placeholder":"ID da loja"}]',
  '[{"key":"update_price","label":"Atualiza preço"},{"key":"update_product","label":"Atualiza produto"},{"key":"sync_images","label":"Sincroniza imagens"}]'),
('nuvemshop','Nuvemshop','E-commerce','Conecte sua loja Nuvemshop e sincronize catálogo e preços.','NS','from-violet-500 to-purple-700',
  '[{"key":"access_token","label":"Access Token","type":"password","placeholder":"Token de acesso"},{"key":"store_id","label":"Store ID","type":"text","placeholder":"ID da loja"}]',
  '[{"key":"update_price","label":"Atualiza preço"},{"key":"update_product","label":"Atualiza produto"},{"key":"sync_images","label":"Sincroniza imagens"}]')
ON CONFLICT ("slug") DO NOTHING;

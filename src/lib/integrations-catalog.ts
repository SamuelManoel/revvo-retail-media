export type IntegrationField = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
};

export type IntegrationFeature = {
  key: string;
  label: string;
  description?: string;
};

export type IntegrationDefinition = {
  slug: string;
  name: string;
  category: string;
  description: string;
  fields: IntegrationField[];
  features: IntegrationFeature[];
};

export const INTEGRATIONS_CATALOG: IntegrationDefinition[] = [
  {
    slug: 'bluesoft',
    name: 'Bluesoft',
    category: 'ERP',
    description: 'Integre com o ERP Bluesoft para sincronizar produtos e preços automaticamente.',
    fields: [
      { key: 'account', label: 'Account', type: 'text', placeholder: 'Ex.: minha-loja' },
      { key: 'token',   label: 'Token',   type: 'password', placeholder: 'Token de acesso' },
    ],
    features: [
      { key: 'update_price',   label: 'Atualiza preço',   description: 'Sincroniza preços do ERP para o catálogo' },
      { key: 'update_product', label: 'Atualiza produto', description: 'Sincroniza nome e código de produto' },
    ],
  },
  {
    slug: 'totvs',
    name: 'TOTVS',
    category: 'ERP',
    description: 'Conecte com o TOTVS para sincronizar o catálogo de produtos e preços.',
    fields: [
      { key: 'url',      label: 'URL da API',  type: 'url',      placeholder: 'https://api.totvs.com' },
      { key: 'username', label: 'Usuário',     type: 'text',     placeholder: 'usuario' },
      { key: 'password', label: 'Senha',       type: 'password', placeholder: '••••••••' },
    ],
    features: [
      { key: 'update_price',   label: 'Atualiza preço' },
      { key: 'update_product', label: 'Atualiza produto' },
      { key: 'update_stock',   label: 'Atualiza estoque' },
    ],
  },
  {
    slug: 'sap',
    name: 'SAP',
    category: 'ERP',
    description: 'Integração com SAP Business One para gestão completa de produtos.',
    fields: [
      { key: 'server',   label: 'Servidor',    type: 'text',     placeholder: 'sap.empresa.com' },
      { key: 'company',  label: 'Company DB',  type: 'text',     placeholder: 'SBO_EMPRESA' },
      { key: 'username', label: 'Usuário',     type: 'text',     placeholder: 'manager' },
      { key: 'password', label: 'Senha',       type: 'password', placeholder: '••••••••' },
    ],
    features: [
      { key: 'update_price',   label: 'Atualiza preço' },
      { key: 'update_product', label: 'Atualiza produto' },
    ],
  },
  {
    slug: 'linx',
    name: 'Linx',
    category: 'PDV',
    description: 'Sincronize produtos e preços com o sistema PDV Linx.',
    fields: [
      { key: 'client_id',     label: 'Client ID',     type: 'text',     placeholder: 'client_id' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••' },
    ],
    features: [
      { key: 'update_price',   label: 'Atualiza preço' },
      { key: 'update_product', label: 'Atualiza produto' },
    ],
  },
  {
    slug: 'tray',
    name: 'Tray Commerce',
    category: 'E-commerce',
    description: 'Integre seu e-commerce Tray para manter preços atualizados nos terminais.',
    fields: [
      { key: 'api_key',    label: 'API Key',    type: 'password', placeholder: 'Sua chave de API' },
      { key: 'store_id',   label: 'Store ID',   type: 'text',     placeholder: 'ID da loja' },
    ],
    features: [
      { key: 'update_price',   label: 'Atualiza preço' },
      { key: 'update_product', label: 'Atualiza produto' },
      { key: 'sync_images',    label: 'Sincroniza imagens' },
    ],
  },
  {
    slug: 'nuvemshop',
    name: 'Nuvemshop',
    category: 'E-commerce',
    description: 'Conecte sua loja Nuvemshop e sincronize catálogo e preços.',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Token de acesso' },
      { key: 'store_id',     label: 'Store ID',     type: 'text',     placeholder: 'ID da loja' },
    ],
    features: [
      { key: 'update_price',   label: 'Atualiza preço' },
      { key: 'update_product', label: 'Atualiza produto' },
      { key: 'sync_images',    label: 'Sincroniza imagens' },
    ],
  },
];

export function getIntegration(slug: string): IntegrationDefinition | undefined {
  return INTEGRATIONS_CATALOG.find((i) => i.slug === slug);
}

export const INTEGRATION_CATEGORIES = ['ERP', 'PDV', 'E-commerce'];

import { buildContext } from './interpolate';
import type { RenderContext } from './types';

/** Mock usado pelo live preview do painel. */
export function mockContext(scenario: 'found' | 'not-found' | 'idle' = 'found'): RenderContext {
  return buildContext({
    produto:
      scenario === 'found'
        ? {
            ean: '7891234567890',
            nome: 'Chocolate em Pó 400g',
            preco1: 24.9,
            preco2: 19.9,
            preco3: 17.9,
            image_url: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600&h=600&fit=crop',
          }
        : null,
    store: {
      name: 'Mercado Exemplo',
      logoUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=ME&backgroundColor=0F2A4A&textColor=ffffff',
    },
  });
}

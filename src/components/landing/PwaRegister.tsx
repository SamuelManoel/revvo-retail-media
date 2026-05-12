'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker do site institucional. Roda só no client,
 * apenas quando suportado e quando NÃO está em rota administrativa.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const path = window.location.pathname;
    if (path.startsWith('/login') || path.startsWith('/admin') || path.startsWith('/dashboard')) {
      return;
    }

    // Em dev (Next dev server) o SW pode atrapalhar HMR — só registra em prod
    if (process.env.NODE_ENV !== 'production') return;

    const handler = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar SW:', err);
        });
    };

    if (document.readyState === 'complete') handler();
    else window.addEventListener('load', handler, { once: true });
  }, []);

  return null;
}

import { vi } from 'vitest';

// Silencia logs de console.error durante os testes
vi.spyOn(console, 'error').mockImplementation(() => {});

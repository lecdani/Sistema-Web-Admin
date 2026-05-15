import type { Product } from '@/shared/types';
import { productsApi } from '@/shared/services/products-api';

/** TTL corto: listas de producto cambian poco en una sesión de admin. */
const TTL_MS = 5 * 60 * 1000;

let cached: Product[] | null = null;
let loadedAt = 0;
let inflight: Promise<Product[]> | null = null;

export function invalidateAdminProductsCache(): void {
  cached = null;
  loadedAt = 0;
}

/**
 * Lista global de productos con deduplicación de peticiones y caché en memoria.
 * Usar en vistas de pedido/catálogo para no repetir GET en cada pestaña o cambio de pedido.
 */
export async function fetchAdminProductsCached(): Promise<Product[]> {
  const now = Date.now();
  if (cached && now - loadedAt < TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = productsApi
    .fetchAll()
    .then((list) => {
      cached = list;
      loadedAt = Date.now();
      inflight = null;
      return list;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });

  return inflight;
}

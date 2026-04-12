import type { Product } from '@/shared/types';

/** Coincide con el nombre comercial "Eternal" (insensible a mayúsculas). */
const ETERNAL_BRAND_NAME_RE = /eternal/i;

export function findEternalBrandId(
  brands: readonly { id: string; name: string }[]
): string | undefined {
  const b = brands.find((x) => ETERNAL_BRAND_NAME_RE.test(String(x.name || '').trim()));
  return b?.id;
}

export function productBelongsToBrandId(
  product: Product | null | undefined,
  brandId: string | undefined
): boolean {
  if (!product || !brandId) return false;
  const bid = String(product.brandId ?? product.presentation?.family?.brandId ?? '').trim();
  const target = String(brandId).trim();
  if (!bid || !target) return false;
  if (bid === target) return true;
  const nb = Number(bid);
  const nt = Number(target);
  if (!Number.isNaN(nb) && !Number.isNaN(nt) && nb === nt) return true;
  return false;
}

export function categoryBelongsToBrandId(
  category: { brandId?: string } | null | undefined,
  brandId: string | undefined
): boolean {
  if (!category || !brandId) return false;
  const cid = String(category.brandId ?? '').trim();
  const target = String(brandId).trim();
  if (!cid || !target) return false;
  if (cid === target) return true;
  const nc = Number(cid);
  const nt = Number(target);
  if (!Number.isNaN(nc) && !Number.isNaN(nt) && nc === nt) return true;
  return false;
}

/**
 * Resumen planograma: por brandId si la API lo trae; si no hay coincidencias, familias cuyo nombre contiene "Eternal".
 */
export function filterEternalFamiliesForPlanogram<T extends { name?: string; brandId?: string }>(
  families: T[],
  eternalBrandId: string | undefined
): T[] {
  if (eternalBrandId) {
    const byBrand = families.filter((c) => categoryBelongsToBrandId(c, eternalBrandId));
    if (byBrand.length > 0) return byBrand;
  }
  const byName = families.filter((c) => ETERNAL_BRAND_NAME_RE.test(String(c.name || '').trim()));
  return byName.length > 0 ? byName : [];
}

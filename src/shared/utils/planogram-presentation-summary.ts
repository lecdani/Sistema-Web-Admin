import type { Product } from '@/shared/types';

/** Fila de resumen «Familias» = una familia agrupada (misma lógica que la PWA). */
export type PlanogramPresentationSummaryRow = {
  presentationId: string;
  familyCode: string;
  familyName: string;
  /** Nombre de presentación (prioridad en UI sobre familyName). */
  presentationName?: string;
  volume?: number;
  unit?: string;
};

/** Normaliza campos de presentación/familia desde el producto del Admin (anidado o plano). */
function presentationViewFromProduct(p: Product | undefined) {
  if (!p) return undefined;
  const pres = p.presentation ?? {};
  const fam = pres.family ?? {};
  const presentationId = String(p.presentationId ?? (pres as { id?: string }).id ?? '').trim() || undefined;
  const familyCode = String(fam.familyCode ?? fam.code ?? p.genericCode ?? '').trim() || undefined;
  const familyName = String(fam.name ?? p.category ?? '').trim() || '';
  const volRaw = pres.volume;
  const volN =
    volRaw != null && Number.isFinite(Number(volRaw)) ? Number(volRaw) : NaN;
  const presentationVolume = Number.isFinite(volN) ? volN : undefined;
  const presentationUnit = String(pres.unit ?? '').trim() || undefined;
  const presentationName =
    String((pres as { name?: string }).name ?? '').trim() || undefined;
  const familyId = String(p.familyId ?? p.categoryId ?? fam.id ?? '').trim() || undefined;
  const presentationGenericCode =
    String(pres.genericCode ?? pres.GenericCode ?? p.genericCode ?? '').trim() || undefined;
  return {
    presentationId,
    familyCode,
    familyName,
    presentationName: presentationName || undefined,
    presentationGenericCode,
    presentationVolume,
    presentationUnit,
    category: String(p.category ?? '').trim(),
    familyId,
    categoryId: p.categoryId != null ? String(p.categoryId).trim() : undefined,
  };
}

export function getPresentationSummaryKey(p: Product | undefined): string | undefined {
  const v = presentationViewFromProduct(p);
  if (!v) return undefined;
  const fc = String(v.familyCode ?? '').trim().toLowerCase();
  if (fc) return `famc:${fc}`;
  const fid = String(v.familyId ?? v.categoryId ?? '').trim();
  if (fid) return `fami:${fid}`;
  const id = String(v.presentationId ?? '').trim();
  if (id) return `pres:${id}`;
  return undefined;
}

export function getProductFromMap(map: Map<string, Product>, productId: string | undefined): Product | undefined {
  const pid = String(productId ?? '').trim();
  if (!pid) return undefined;
  return map.get(pid) ?? map.get(String(Number(pid)));
}

export function collectPresentationRowsFromGrid<
  T extends { productId?: string },
>(cells: T[], productMap: Map<string, Product>): PlanogramPresentationSummaryRow[] {
  const byPres = new Map<string, PlanogramPresentationSummaryRow>();
  for (const cell of cells) {
    const p = getProductFromMap(productMap, cell.productId);
    if (!p) continue;
    const key = getPresentationSummaryKey(p);
    if (!key) continue;
    const pv = presentationViewFromProduct(p)!;
    if (!byPres.has(key)) {
      byPres.set(key, {
        presentationId: key,
        familyCode: String(pv.familyCode ?? '').trim(),
        familyName: String(pv.familyName || pv.category || '').trim(),
        presentationName: undefined,
        volume: undefined,
        unit: undefined,
      });
    }
  }
  return [...byPres.values()].sort((a, b) => {
    const ka = [a.familyCode, a.familyName].join('\u0000');
    const kb = [b.familyCode, b.familyName].join('\u0000');
    return ka.localeCompare(kb, undefined, { sensitivity: 'base' });
  });
}

/** Presentaciones asociadas a líneas del pedido con cantidad > 0 (vista catálogo, alineado con PWA). */
export function collectPresentationRowsFromOrderLines<
  T extends { productId?: string; quantity?: number; toOrder?: number },
>(lines: T[], productMap: Map<string, Product>): PlanogramPresentationSummaryRow[] {
  const cells = lines
    .filter((l) => (Number(l.toOrder ?? l.quantity ?? 0) || 0) > 0)
    .map((l) => ({ productId: l.productId }));
  return collectPresentationRowsFromGrid(cells, productMap);
}

export function sumQtyForPresentation<
  T extends { productId?: string; toOrder?: number; quantity?: number },
>(cells: T[], productMap: Map<string, Product>, presentationKey: string): number {
  const pres = String(presentationKey).trim();
  if (!pres) return 0;
  let sum = 0;
  for (const cell of cells) {
    const p = getProductFromMap(productMap, cell.productId);
    const k = getPresentationSummaryKey(p);
    if (!p || k !== pres) continue;
    const q = Number(cell.toOrder ?? cell.quantity ?? 0) || 0;
    sum += q;
  }
  return sum;
}

/** Importe (qty × precio línea o precio catálogo) agrupado por presentación. */
export function sumAmountForPresentation<
  T extends {
    productId?: string;
    toOrder?: number;
    quantity?: number;
    price?: number;
    unitPrice?: number;
  },
>(cells: T[], productMap: Map<string, Product>, presentationKey: string): number {
  const pres = String(presentationKey).trim();
  if (!pres) return 0;
  let sum = 0;
  for (const cell of cells) {
    const p = getProductFromMap(productMap, cell.productId);
    const k = getPresentationSummaryKey(p);
    if (!p || k !== pres) continue;
    const q = Number(cell.toOrder ?? cell.quantity ?? 0) || 0;
    const unit =
      Number((cell as { unitPrice?: number }).unitPrice ?? (cell as { price?: number }).price ?? 0) ||
      Number(p.currentPrice ?? 0) ||
      0;
    sum += q * unit;
  }
  return sum;
}

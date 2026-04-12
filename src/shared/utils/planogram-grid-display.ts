import type { Product } from '@/shared/types';

/** Igual que PlanogramViewer: prioridad a shortName para no saturar la grilla. */
export function getProductShortDisplayName(product: Product | null | undefined): string {
  if (!product) return '';
  const short = String(product.shortName ?? '').trim();
  if (short) return short;
  return String(product.name ?? '').trim() || '—';
}

/** Solo código comercial en celdas de pedidos (sin SKU). */
export function getProductCodeLine(product: Product | null | undefined): string {
  if (!product) return '—';
  const code = String(product.code ?? '').trim();
  return code || '—';
}

/** Línea código + SKU (gestión de planogramas / listados que aún muestran ambos). */
export function getProductCodeSkuLine(product: Product | null | undefined): string {
  if (!product) return '—';
  const code = String(product.code ?? '').trim();
  const sku = String(product.sku ?? '').trim();
  if (code && sku && code !== sku) return `${code} · ${sku}`;
  if (code) return code;
  if (sku) return sku;
  return '—';
}

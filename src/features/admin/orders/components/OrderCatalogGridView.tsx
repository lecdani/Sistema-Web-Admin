import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { useLanguage } from '@/shared/hooks/useLanguage';
import type { Order, Product } from '@/shared/types';
import { fetchAdminProductsCached } from '@/shared/services/admin-products-cache';
import { getProductCodeLine, getProductShortDisplayName } from '@/shared/utils/planogram-grid-display';
import { resolveProductImageAssetUrl, resolveRawProductImageAssetUrl } from '@/shared/utils/product-image-url';
import {
  collectPresentationRowsFromOrderLines,
  sumQtyForPresentation,
} from '@/shared/utils/planogram-presentation-summary';
import { PresentationSummaryCell } from '@/shared/components/PresentationSummaryCell';

interface OrderCatalogGridViewProps {
  order: Order;
  useAllActiveProducts?: boolean;
}

/** Celda vacía del catálogo (sin producto en esa posición de la matriz). */
function getCatalogCellSurface(hasProduct: boolean, hasQty: boolean): React.CSSProperties {
  if (!hasProduct) {
    return { backgroundColor: '#e5e7eb', borderColor: '#9ca3af' };
  }
  if (hasQty) {
    return { backgroundColor: '#e0e7ff', borderColor: '#6366f1' };
  }
  return { backgroundColor: '#d1d5db', borderColor: '#525252' };
}

/**
 * Misma regla que la PWA (`catalog-order.tsx` → sortedProducts): primero `code || sku`,
 * si no basta para desempatar, `name`.
 */
function sortProductsVendorCatalogOrder<T extends { code?: string; sku?: string; name?: string }>(
  products: T[]
): T[] {
  return [...products].sort((a, b) => {
    const aSku = String(a.code ?? a.sku ?? '').toLowerCase();
    const bSku = String(b.code ?? b.sku ?? '').toLowerCase();
    if (aSku && bSku && aSku !== bSku) return aSku.localeCompare(bSku);
    const aName = String(a.name ?? '').toLowerCase();
    const bName = String(b.name ?? '').toLowerCase();
    return aName.localeCompare(bName);
  });
}

const CELL_W = 78;
const CELL_H = 66;
const CELL_GAP = 5;
const COLS = 10;
const ROWS = 10;
const SLOTS = COLS * ROWS;
export const OrderCatalogGridView: React.FC<OrderCatalogGridViewProps> = ({
  order,
  useAllActiveProducts = false,
}) => {
  const { translate } = useLanguage();
  const [page, setPage] = useState(0);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
  const [allProductsOrdered, setAllProductsOrdered] = useState<Product[]>([]);
  /** Evita matriz en blanco mientras carga o si la API devuelve lista vacía con forma no estándar. */
  const [catalogProductsStatus, setCatalogProductsStatus] = useState<'loading' | 'ready'>(() =>
    useAllActiveProducts ? 'loading' : 'ready',
  );

  const items = Array.isArray(order.items) ? order.items : [];

  const bumpQtyKeys = (map: Map<string, number>, rawPid: string, qty: number) => {
    const pid = String(rawPid ?? '').trim();
    if (!pid) return;
    const keys = new Set<string>([pid, pid.replace(/-/g, '').toLowerCase()]);
    const n = Number(pid);
    if (!Number.isNaN(n)) keys.add(String(n));
    for (const k of keys) {
      map.set(k, (map.get(k) ?? 0) + qty);
    }
  };

  /**
   * Orden de lectura:
   * - Catálogo (`useAllActiveProducts`): mismos productos activos y mismo orden que la PWA del vendedor
   *   (code/sku → nombre), con cantidades del pedido/factura.
   * - Sin catálogo completo: respeta el orden de líneas del pedido.
   */
  const orderedItems = useMemo(() => {
    if (!useAllActiveProducts) return [...items];
    const qtyByProductId = new Map<string, number>();
    for (const raw of items) {
      const it = raw as any;
      const pid = String(it.productId ?? it.ProductId ?? '').trim();
      if (!pid) continue;
      const qty = Number(it.quantity ?? it.toOrder ?? 0) || 0;
      bumpQtyKeys(qtyByProductId, pid, qty);
    }
    const stillLoading = catalogProductsStatus !== 'ready' && allProductsOrdered.length === 0;
    if (stillLoading) {
      return [...items];
    }
    const active = allProductsOrdered.filter((p: any) => p?.isActive !== false && p?.IsActive !== false);
    const sorted = sortProductsVendorCatalogOrder(active);
    if (sorted.length === 0) {
      return [...items];
    }
    return sorted.map((p: any) => {
      const pid = String(p.id ?? '').trim();
      const qty =
        qtyByProductId.get(pid) ??
        qtyByProductId.get(pid.replace(/-/g, '').toLowerCase()) ??
        qtyByProductId.get(String(Number(pid))) ??
        0;
      return {
        id: pid,
        productId: pid,
        productName: getProductShortDisplayName(p as Product),
        sku: String(p.sku ?? p.code ?? '').trim(),
        quantity: qty,
        toOrder: qty,
        price: Number(p.currentPrice ?? 0) || 0,
        image: (p as any).image ?? (p as any).Image,
        imageFileName: (p as any).imageFileName ?? (p as any).ImageFileName,
      };
    });
  }, [useAllActiveProducts, items, allProductsOrdered, catalogProductsStatus]);

  const presentationSummaryRows = useMemo(
    () => collectPresentationRowsFromOrderLines(orderedItems as any[], productMap),
    [orderedItems, productMap]
  );

  const presentationRowsWithPcs = useMemo(
    () =>
      presentationSummaryRows
        .map((row) => ({
          row,
          pcs: sumQtyForPresentation(orderedItems as any[], productMap, row.presentationId),
        }))
        .filter((x) => x.pcs > 0),
    [presentationSummaryRows, orderedItems, productMap]
  );

  useEffect(() => {
    setPage(0);
  }, [order?.id]);

  useEffect(() => {
    let mounted = true;
    if (!useAllActiveProducts) {
      setCatalogProductsStatus('ready');
    } else {
      setCatalogProductsStatus('loading');
    }
    (async () => {
      try {
        const products = await fetchAdminProductsCached();
        if (!mounted) return;
        const normalizeId = (v: unknown) =>
          String(v ?? '')
            .trim()
            .replace(/-/g, '')
            .toLowerCase();
        const map = new Map<string, Product>();
        products.forEach((p: any) => {
          const idStr = String(p.id ?? '').trim();
          if (!idStr) return;
          map.set(idStr, p);
          map.set(normalizeId(idStr), p);
          const numId = Number(idStr);
          if (!Number.isNaN(numId)) {
            map.set(String(numId), p);
          }
        });
        setProductMap(map);
        setAllProductsOrdered(products as Product[]);
      } catch {
        // sin datos extra si falla
      } finally {
        if (mounted) setCatalogProductsStatus('ready');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [useAllActiveProducts]);

  const totalPages = Math.max(1, Math.ceil(orderedItems.length / SLOTS));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = orderedItems.slice(currentPage * SLOTS, currentPage * SLOTS + SLOTS);

  const filledGrid: (any | null)[] =
    pageItems.length < SLOTS
      ? [...pageItems, ...Array(SLOTS - pageItems.length).fill(null)]
      : pageItems;

  const gridWidthPx = COLS * CELL_W + (COLS - 1) * CELL_GAP;

  return (
    <div className="space-y-2 admin-planogram-print-compact">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-xs">
          {translate('catalogView') || 'Vista de catálogo'}
        </h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-gray-600 print:hidden">
            <span>
              {(translate('page') || 'Página')} {currentPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {'<'}
            </button>
            <button
              type="button"
              className="px-2 py-1 border rounded disabled:opacity-50"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              {'>'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-200 overflow-x-auto flex justify-start md:justify-center print:justify-center print:shadow-none print:border print:break-inside-avoid print:p-1">
        <div
          className="mx-auto flex-none"
          style={{
            width: gridWidthPx,
            minWidth: gridWidthPx,
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${CELL_W}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL_H}px)`,
            gap: CELL_GAP,
            boxSizing: 'content-box',
          }}
        >
          {filledGrid.map((item, index) => {
            if (!item) {
              return (
                <div
                  key={`empty-${currentPage}-${index}`}
                  className="rounded-lg border border-solid min-h-0 min-w-0 overflow-hidden box-border"
                  style={{
                    width: CELL_W,
                    height: CELL_H,
                    padding: 2,
                    boxSizing: 'border-box',
                    ...getCatalogCellSurface(false, false),
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                />
              );
            }

            const qty = Number((item as any).quantity ?? (item as any).toOrder ?? 0) || 0;
            const productId = String((item as any).productId ?? (item as any).sku ?? '');
            const productIdNorm = productId.replace(/-/g, '').toLowerCase();
            const product =
              productMap.get(productId) ||
              productMap.get(productIdNorm) ||
              productMap.get(String(Number(productId))) ||
              undefined;
            const altProduct = allProductsOrdered.find((p: any) => {
              const sku = String((item as any).sku ?? '').trim().toLowerCase();
              const code = String((item as any).code ?? '').trim().toLowerCase();
              const pSku = String(p?.sku ?? '').trim().toLowerCase();
              const pCode = String(p?.code ?? '').trim().toLowerCase();
              return (sku && (pSku === sku || pCode === sku)) || (code && (pCode === code || pSku === code));
            });
            const imageUrl =
              resolveProductImageAssetUrl((product as any)?.image, (product as any)?.imageFileName) ||
              resolveRawProductImageAssetUrl(item as Record<string, unknown>) ||
              resolveProductImageAssetUrl(altProduct?.image, altProduct?.imageFileName);
            const codeLine = product ? getProductCodeLine(product) : '—';
            const nameLabel = product
              ? getProductShortDisplayName(product)
              : String((item as any).productName ?? '').trim();
            const muted = qty <= 0;

            return (
              <div
                key={
                  ((item as any).id && String((item as any).id)) ||
                  (productId && `prod-${productId}-${index}`) ||
                  `item-${index}`
                }
                className={`rounded-md border border-solid flex flex-col items-center justify-center text-center min-h-0 min-w-0 overflow-hidden box-border ${muted ? 'opacity-[0.48]' : ''}`}
                style={{
                  width: CELL_W,
                  height: CELL_H,
                  padding: 2,
                  boxSizing: 'border-box',
                  ...getCatalogCellSurface(true, qty > 0),
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                } as React.CSSProperties}
                title={nameLabel || codeLine}
              >
                <div className="text-center w-full h-full flex flex-col justify-center items-center p-0.5 relative min-h-0 min-w-0">
                  <div className="flex justify-center w-full shrink-0 min-h-0 px-0.5">
                    <div className="inline-flex flex-row items-center justify-center gap-0.5 max-w-full min-w-0">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className="w-7 h-7 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <Package className="h-3.5 w-3.5 text-gray-600" />
                        </div>
                      )}
                      <div className="font-bold text-blue-800 truncate text-[10px] leading-tight max-w-[38px] min-w-0 text-center">
                        {codeLine}
                      </div>
                    </div>
                  </div>
                  {nameLabel ? (
                    <div
                      className="block w-full max-w-full px-0.5 text-blue-900/90 font-bold overflow-hidden mt-0.5"
                      style={{
                        fontSize: '7.5px',
                        lineHeight: 1.15,
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                      }}
                      title={nameLabel}
                    >
                      {nameLabel}
                    </div>
                  ) : null}
                  {qty > 0 ? (
                    <>
                      <div className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-indigo-600 rounded-full shadow-sm" aria-hidden />
                      <span className="text-[9px] font-bold text-indigo-900 leading-none text-center mt-0.5">
                        {qty} {translate('unitsSuffix')}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Solo presentaciones de líneas con cantidad &gt; 0 (como PWA) */}
      {presentationRowsWithPcs.length > 0 && (
        <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 print:mt-2 print:border-slate-300 print:break-inside-avoid">
          <h4 className="bg-slate-200 text-slate-800 px-3 py-1.5 text-[11px] font-semibold print:text-[10px]">
            {translate('familySummaryCatalog')}
          </h4>
          <table className="w-full text-xs print:text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="text-left py-1.5 px-2 font-semibold">{translate('familyCol')}</th>
                <th className="text-right py-1.5 px-2 font-semibold w-14">{translate('pcsCol')}</th>
              </tr>
            </thead>
            <tbody>
              {presentationRowsWithPcs.map(({ row, pcs }) => (
                <tr key={row.presentationId} className="border-t border-slate-200 bg-white">
                  <td className="py-1.5 px-2 text-slate-900 align-top">
                    <PresentationSummaryCell row={row} compact />
                  </td>
                  <td className="py-1.5 px-2 text-right font-medium text-slate-800 align-middle">{pcs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

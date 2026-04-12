import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { useLanguage } from '@/shared/hooks/useLanguage';
import type { Order, Product } from '@/shared/types';
import { productsApi } from '@/shared/services/products-api';
import { getBackendAssetUrl } from '@/shared/config/api';
import { getProductCodeLine, getProductShortDisplayName } from '@/shared/utils/planogram-grid-display';
import {
  collectPresentationRowsFromOrderLines,
  sumQtyForPresentation,
} from '@/shared/utils/planogram-presentation-summary';
import { PresentationSummaryCell } from '@/shared/components/PresentationSummaryCell';

interface OrderCatalogGridViewProps {
  order: Order;
  useAllActiveProducts?: boolean;
}

function getProductImageUrl(product: Product | null | undefined): string {
  if (!product) return '';
  if ((product as any).image) return getBackendAssetUrl((product as any).image);
  if ((product as any).imageFileName) return getBackendAssetUrl('images/url/' + (product as any).imageFileName);
  return '';
}

/** Celda catálogo: mismo criterio visual que la grilla de planograma en pedidos. */
function getCatalogCellSurface(hasProduct: boolean, hasQty: boolean): React.CSSProperties {
  if (!hasProduct) {
    return { backgroundColor: '#ffffff', borderColor: '#d1d5db' };
  }
  if (hasQty) {
    return { backgroundColor: '#e0e7ff', borderColor: '#6366f1' };
  }
  return { backgroundColor: '#d1d5db', borderColor: '#525252' };
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

  const items = Array.isArray(order.items) ? order.items : [];

  /**
   * Orden de lectura:
   * - Catálogo: todos los productos activos en orden de registro (lista backend),
   *   con cantidades del pedido/factura.
   * - Planograma/pedido: respeta el orden de líneas del pedido.
   */
  const orderedItems = useMemo(() => {
    if (!useAllActiveProducts) return [...items];
    const qtyByProductId = new Map<string, number>();
    for (const raw of items) {
      const it = raw as any;
      const pid = String(it.productId ?? it.ProductId ?? '').trim();
      if (!pid) continue;
      const qty = Number(it.quantity ?? it.toOrder ?? 0) || 0;
      qtyByProductId.set(pid, (qtyByProductId.get(pid) ?? 0) + qty);
    }
    return allProductsOrdered
      .filter((p: any) => p?.isActive !== false)
      .map((p: any) => {
        const pid = String(p.id ?? '').trim();
        const qty = qtyByProductId.get(pid) ?? 0;
        return {
          id: pid,
          productId: pid,
          productName: getProductShortDisplayName(p as Product),
          sku: String(p.sku ?? p.code ?? '').trim(),
          quantity: qty,
          toOrder: qty,
          price: Number(p.currentPrice ?? 0) || 0,
        };
      });
  }, [useAllActiveProducts, items, allProductsOrdered]);

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
    let mounted = true;
    (async () => {
      try {
        const products = await productsApi.fetchAll();
        if (!mounted) return;
        const map = new Map<string, Product>();
        products.forEach((p: any) => {
          const idStr = String(p.id);
          map.set(idStr, p);
          const numId = Number(idStr);
          if (!Number.isNaN(numId)) {
            map.set(String(numId), p);
          }
        });
        setProductMap(map);
        setAllProductsOrdered(products as Product[]);
      } catch {
        // sin datos extra si falla
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

      <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-200 overflow-x-auto flex justify-start md:justify-center print:shadow-none print:border print:break-inside-avoid print:p-1">
        <div
          className="mx-auto print:mx-0 flex-none"
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
                  }}
                />
              );
            }

            const qty = Number((item as any).quantity ?? (item as any).toOrder ?? 0) || 0;
            const productId = String((item as any).productId ?? (item as any).sku ?? '');
            const product =
              productMap.get(productId) || productMap.get(String(Number(productId))) || undefined;
            const imageUrl = getProductImageUrl(product);
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

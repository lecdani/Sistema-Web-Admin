import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { useLanguage } from '@/shared/hooks/useLanguage';
import type { Order, Product } from '@/shared/types';
import { productsApi } from '@/shared/services/products-api';
import { categoriesApi } from '@/shared/services/categories-api';
import { getBackendAssetUrl } from '@/shared/config/api';
import { formatFamilyOrderLabel } from '@/shared/utils/family-display';

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

/** Misma lógica de color que OrderPlanogramView (lectura visual idéntica). */
function getCatalogCellSurface(hasProduct: boolean, qty: number): React.CSSProperties {
  if (!hasProduct) {
    return { backgroundColor: '#94a3b8', borderColor: '#64748b' };
  }
  if (qty > 0) {
    return { backgroundColor: '#eef2ff', borderColor: '#a5b4fc' };
  }
  return { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' };
}

const CELL_SIZE = 72;
const CELL_GAP = 8;
const COLS = 10;
const ROWS = 10;
const SLOTS = COLS * ROWS;
const UNCATEGORIZED_KEY = '__uncategorized__';

export const OrderCatalogGridView: React.FC<OrderCatalogGridViewProps> = ({
  order,
  useAllActiveProducts = false,
}) => {
  const { translate } = useLanguage();
  const [page, setPage] = useState(0);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
  const [allProductsOrdered, setAllProductsOrdered] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<
    Array<{
      id: string;
      name: string;
      code?: string;
      shortName?: string;
      volume?: number;
      unit?: string;
    }>
  >([]);

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
          productName: String(p.name ?? '').trim() || '—',
          sku: String(p.code ?? p.sku ?? '').trim(),
          quantity: qty,
          toOrder: qty,
          price: Number(p.currentPrice ?? 0) || 0,
        };
      });
  }, [useAllActiveProducts, items, allProductsOrdered]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [products, categoriesList] = await Promise.all([
          productsApi.fetchAll(),
          categoriesApi.fetchAll().catch(() => [] as any[]),
        ]);
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
        setAllCategories(
          (categoriesList || []).map((c: any) => ({
            id: String(c.id),
            name: String(c.name ?? '').trim() || String(c.id),
            code: String(c.code || c.familyCode || '').trim() || undefined,
            shortName: String(c.shortName || '').trim() || undefined,
            volume: c.volume != null && Number.isFinite(Number(c.volume)) ? Number(c.volume) : undefined,
            unit: String(c.unit || '').trim() || undefined,
          }))
        );
      } catch {
        // sin datos extra si falla
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /** Pcs por id de familia (todo el pedido) — alineado con resumen del planograma. */
  const pcsByFamilyId = useMemo(() => {
    const acc = new Map<string, number>();
    for (const raw of orderedItems) {
      const it = raw as any;
      const pid = String(it.productId ?? it.ProductId ?? '').trim();
      if (!pid) continue;
      const qty = Number(it.quantity ?? it.toOrder ?? 0) || 0;
      const product = productMap.get(pid) || productMap.get(String(Number(pid)));
      const fid = String(product?.familyId ?? product?.categoryId ?? '').trim();
      if (!fid) {
        acc.set(UNCATEGORIZED_KEY, (acc.get(UNCATEGORIZED_KEY) ?? 0) + qty);
        continue;
      }
      acc.set(fid, (acc.get(fid) ?? 0) + qty);
    }
    return acc;
  }, [orderedItems, productMap]);

  const totalPages = Math.max(1, Math.ceil(orderedItems.length / SLOTS));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = orderedItems.slice(currentPage * SLOTS, currentPage * SLOTS + SLOTS);

  const filledGrid: (any | null)[] =
    pageItems.length < SLOTS
      ? [...pageItems, ...Array(SLOTS - pageItems.length).fill(null)]
      : pageItems;

  const gridWidthPx = COLS * CELL_SIZE + (COLS - 1) * CELL_GAP;

  return (
    <div className="space-y-4 admin-planogram-print-compact">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">
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

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 overflow-x-auto flex justify-start md:justify-center print:shadow-none print:border print:break-inside-avoid print:p-1.5">
        <div
          className="mx-auto print:mx-0 flex-none"
          style={{
            width: gridWidthPx,
            minWidth: gridWidthPx,
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
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
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    padding: 2,
                    boxSizing: 'border-box',
                    ...getCatalogCellSurface(false, 0),
                  }}
                />
              );
            }

            const qty = Number((item as any).quantity ?? (item as any).toOrder ?? 0) || 0;
            const productId = String((item as any).productId ?? (item as any).sku ?? '');
            const product =
              productMap.get(productId) || productMap.get(String(Number(productId))) || undefined;
            const imageUrl = getProductImageUrl(product);
            const skuLabel = String(
              product?.code ?? (item as any).sku ?? (item as any).code ?? (item as any).productId ?? '—'
            );
            const nameLabel = String((item as any).productName ?? '').trim();

            return (
              <div
                key={
                  ((item as any).id && String((item as any).id)) ||
                  (productId && `prod-${productId}-${index}`) ||
                  `item-${index}`
                }
                className="rounded-lg border border-solid flex flex-col items-center justify-center text-center min-h-0 min-w-0 overflow-hidden box-border"
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  padding: 2,
                  boxSizing: 'border-box',
                  ...getCatalogCellSurface(true, qty),
                }}
                title={nameLabel || skuLabel}
              >
                <div className="flex flex-col items-center justify-center gap-0 w-full h-full min-h-0 min-w-0">
                  <div className="flex flex-row items-center justify-center gap-0.5 w-full shrink-0 min-h-0 px-0.5">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-slate-200 flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                    )}
                    <span
                      className="text-[6.5px] leading-tight font-semibold text-slate-900 truncate min-w-0 max-w-[34px] text-center"
                      title={skuLabel}
                    >
                      {skuLabel}
                    </span>
                  </div>
                  {nameLabel ? (
                    <span
                      className="block w-full text-center text-slate-600 font-normal overflow-hidden line-clamp-2 mt-0.5 px-0.5"
                      style={{ fontSize: '12px', lineHeight: 1.2, maxHeight: '18px' }}
                      title={nameLabel}
                    >
                      {nameLabel}
                    </span>
                  ) : null}
                  {qty > 0 ? (
                    <span className="text-[10px] font-bold text-indigo-700 leading-none text-center mt-px">
                      {qty} {translate('unitsSuffix')}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen por familia (catálogo): visible en pantalla e impresión */}
      {(allCategories.length > 0 || pcsByFamilyId.size > 0) && (
        <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 print:mt-3 print:border-slate-300 print:break-inside-avoid">
          <h4 className="bg-slate-200 text-slate-800 px-3 py-2 text-xs font-semibold print:text-[10px]">
            {translate('familySummaryCatalog')}
          </h4>
          <table className="w-full text-sm print:text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="text-left py-2 px-3 font-semibold">{translate('familyCol')}</th>
                <th className="text-right py-2 px-3 font-semibold w-16">{translate('pcsCol')}</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                type RowCat = (typeof allCategories)[number] | { id: string; name: string };
                let displayRows: RowCat[];
                if (allCategories.length > 0) {
                  displayRows = [...allCategories].sort((a, b) =>
                    formatFamilyOrderLabel(a).localeCompare(formatFamilyOrderLabel(b), undefined, {
                      sensitivity: 'base',
                    })
                  );
                  if ((pcsByFamilyId.get(UNCATEGORIZED_KEY) ?? 0) > 0) {
                    displayRows = [
                      ...displayRows,
                      { id: UNCATEGORIZED_KEY, name: UNCATEGORIZED_KEY },
                    ];
                  }
                } else {
                  displayRows = [...pcsByFamilyId.keys()]
                    .filter((k) => k !== UNCATEGORIZED_KEY)
                    .sort((a, b) => a.localeCompare(b))
                    .map((id) => ({ id, name: id }));
                  if ((pcsByFamilyId.get(UNCATEGORIZED_KEY) ?? 0) > 0) {
                    displayRows = [
                      ...displayRows,
                      { id: UNCATEGORIZED_KEY, name: UNCATEGORIZED_KEY },
                    ];
                  }
                }
                return displayRows.map((cat) => {
                  const isUncat = cat.id === UNCATEGORIZED_KEY;
                  const rowLabel = isUncat
                    ? translate('withoutCategory')
                    : formatFamilyOrderLabel(cat) || cat.name;
                  const pcs = isUncat
                    ? pcsByFamilyId.get(UNCATEGORIZED_KEY) ?? 0
                    : pcsByFamilyId.get(cat.id) ??
                      pcsByFamilyId.get(String(Number(cat.id))) ??
                      0;
                  return (
                    <tr key={cat.id} className="border-t border-slate-200 bg-white">
                      <td className="py-2 px-3 text-slate-900">{rowLabel}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-800">{pcs}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

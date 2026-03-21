import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { useLanguage } from '@/shared/hooks/useLanguage';
import type { Order, Product } from '@/shared/types';
import { productsApi } from '@/shared/services/products-api';
import { getBackendAssetUrl } from '@/shared/config/api';

interface OrderCatalogGridViewProps {
  order: Order;
}

function getProductImageUrl(product: Product | null | undefined): string {
  if (!product) return '';
  if ((product as any).image) return getBackendAssetUrl((product as any).image);
  if ((product as any).imageFileName) return getBackendAssetUrl('images/url/' + (product as any).imageFileName);
  return '';
}

export const OrderCatalogGridView: React.FC<OrderCatalogGridViewProps> = ({ order }) => {
  const { translate } = useLanguage();
  const [page, setPage] = useState(0);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());

  const items = Array.isArray(order.items) ? order.items : [];

  const sortedItems = useMemo(() => {
    const copy = [...items].sort((a: any, b: any) => {
      const aSku = String(a.sku ?? a.productId ?? '').toLowerCase();
      const bSku = String(b.sku ?? b.productId ?? '').toLowerCase();
      if (aSku && bSku && aSku !== bSku) return aSku.localeCompare(bSku);
      const aName = String(a.productName ?? '').toLowerCase();
      const bName = String(b.productName ?? '').toLowerCase();
      return aName.localeCompare(bName);
    });
    // Ya están en orden por filas (React recorre en orden lineal),
    // solo nos aseguramos de trabajar con una copia independiente.
    return copy;
  }, [items]);

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
      } catch {
        // en caso de error, simplemente no mostramos imagen
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const PAGE_SIZE = 100;
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = sortedItems.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  const filledGrid: (any | null)[] =
    pageItems.length < PAGE_SIZE
      ? [...pageItems, ...Array(PAGE_SIZE - pageItems.length).fill(null)]
      : pageItems;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">
          {translate('catalogView') || 'Vista de catálogo'}
        </h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
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

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 overflow-x-auto flex justify-start md:justify-center">
        <div className="inline-grid grid-cols-10 grid-flow-row gap-2 w-[960px] flex-none">
          {filledGrid.map((item, index) =>
            item ? (
              <div
                key={
                  (item.id && String(item.id)) ||
                  (item.productId && `prod-${item.productId}-${index}`) ||
                  `item-${index}`
                }
                className="aspect-square min-w-[64px] min-h-[64px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex flex-col items-center justify-center p-1.5 text-center"
              >
                {(() => {
                  const productId = String(item.productId ?? item.sku ?? '');
                  const product = productMap.get(productId) || productMap.get(String(Number(productId)));
                  const imageUrl = getProductImageUrl(product);
                  return (
                    <div className="flex items-center justify-center gap-1 w-full mb-0.5">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className="w-5 h-5 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <Package className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                      )}
                      <span
                        className="text-[10px] leading-tight font-bold text-slate-900 truncate max-w-[44px]"
                        title={String(product?.code ?? item.sku ?? item.productId ?? '')}
                      >
                        {product?.code ?? item.sku ?? item.productId ?? '—'}
                      </span>
                    </div>
                  );
                })()}
                <span
                  className="text-[7px] leading-tight font-normal text-slate-600 break-words line-clamp-2 w-full"
                  title={item.productName ?? ''}
                >
                  {item.productName ?? ''}
                </span>
                <span className="text-[8px] text-indigo-600 mt-0.5">
                  ${Number(item.price ?? 0).toFixed(2)}
                </span>
              </div>
            ) : (
              <div
                key={`empty-${index}`}
                className="aspect-square min-w-[64px] min-h-[64px] rounded-lg border border-transparent bg-transparent"
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}


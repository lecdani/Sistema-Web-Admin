import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/shared/components/base/Badge';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { Order, Planogram, Distribution, Product } from '@/shared/types';
import { planogramsApi } from '@/shared/services/planograms-api';
import { distributionsApi } from '@/shared/services/distributions-api';
import { productsApi } from '@/shared/services/products-api';
import { categoriesApi } from '@/shared/services/categories-api';
import { ordersApi } from '@/shared/services/orders-api';
import { histpricesApi } from '@/shared/services/histprices-api';
import { getFromLocalStorage } from '@/shared/services/database';
import { getBackendAssetUrl } from '@/shared/config/api';
import { Package } from 'lucide-react';

function getProductImageUrl(product: Product | null | undefined): string {
  if (!product) return '';
  if (product.image) return getBackendAssetUrl(product.image);
  if (product.imageFileName) return getBackendAssetUrl('images/url/' + product.imageFileName);
  return '';
}

type LineItem = { qty: number; code: string; description: string; price: number; amount: number };

function normKey(s: string): string {
  return String(s || '')
    .trim()
    .replace(/-/g, '')
    .toLowerCase();
}

/**
 * Cantidades desde líneas de factura (PWA + refuerzos admin: code/sku/id/nombre en catálogo).
 */
function buildQuantitiesQueueFromInvoiceLines(
  invoiceItems: LineItem[],
  orderItems: Array<{ productId?: string; ProductId?: string; productName?: string; sku?: string; price?: number }>,
  getProduct: (id: string) =>
    | { id: string; name?: string; sku?: string; familyId?: string; categoryId?: string; currentPrice?: number }
    | undefined,
  catalogProducts: Product[]
): Map<string, Array<{ productName: string; sku: string; quantity: number; price: number }>> {
  const map = new Map<string, Array<{ productName: string; sku: string; quantity: number; price: number }>>();

  const resolveProductId = (line: LineItem): string => {
    const code = String(line.code || '').trim();
    if (!code || code === '—') return '';
    const normCode = normKey(code);
    const desc = String(line.description || '').trim();

    const oi =
      orderItems.find((x: any) => String(x.sku || '').trim() === code) ||
      orderItems.find((x: any) => String(x.productId ?? x.ProductId ?? '') === code) ||
      (code.length >= 8
        ? orderItems.find((x: any) => {
            const pid = normKey(String(x.productId ?? x.ProductId ?? ''));
            return pid && (pid === normCode || String(x.productId ?? x.ProductId) === code);
          })
        : undefined);

    let productId = oi ? String(oi.productId ?? oi.ProductId ?? '') : '';

    if (!productId && /^[0-9a-f-]{36}$/i.test(code)) {
      productId = code;
    }

    if (!productId) {
      const hit = catalogProducts.find((p) => {
        const skuT = String(p.sku || '').trim();
        const codeT = String(p.code || '').trim();
        return (
          skuT === code ||
          codeT === code ||
          normKey(skuT) === normCode ||
          normKey(codeT) === normCode ||
          normKey(String(p.id)) === normCode
        );
      });
      if (hit) productId = String(hit.id);
    }

    if (!productId && desc.length > 2) {
      const lower = desc.toLowerCase();
      const nameHits = catalogProducts.filter((p) => (p.name || '').trim().toLowerCase() === lower);
      if (nameHits.length === 1) productId = String(nameHits[0].id);
    }

    return productId;
  };

  for (const line of invoiceItems) {
    const code = String(line.code || '').trim();
    const productId = resolveProductId(line);
    if (!productId) continue;

    const oi =
      orderItems.find((x: any) => String(x.productId ?? x.ProductId ?? '') === productId) ||
      orderItems.find((x: any) => normKey(String(x.productId ?? x.ProductId ?? '')) === normKey(productId));

    const prod = getProduct(productId);
    const qty = Number(line.qty) || 0;
    const price = Number(line.price) || 0;
    const name = (line.description || (oi as any)?.productName || prod?.name || code).trim();
    const sku = String(
      (oi as any)?.sku || prod?.sku || (prod as Product | undefined)?.code || code
    ).trim();
    const row = { productName: name, sku, quantity: qty, price };
    const arr = map.get(productId) ?? [];
    arr.push(row);
    map.set(productId, arr);
  }
  return map;
}

interface OrderPlanogramViewProps {
  order: Order;
  /** Cantidades del pedido (orden) o de la factura (líneas facturadas). */
  quantitySource?: 'order' | 'invoice';
  onViewOrder?: () => void;
}

interface ProductPosition {
  row: number;
  col: number;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  toOrder: number;
  price: number;
  imageUrl?: string;
}

export const OrderPlanogramView: React.FC<OrderPlanogramViewProps> = ({
  order,
  quantitySource = 'order',
}) => {
  const { translate } = useLanguage();
  const [grid, setGrid] = useState<ProductPosition[]>([]);
  const [planogramName, setPlanogramName] = useState<string | null>(null);
  const [planogramDescription, setPlanogramDescription] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setLoadError(null);
      const orderId = String(order.id ?? (order as any).backendOrderId ?? '');
      if (!orderId) {
        setLoadError(translate('orderWithoutId'));
        setLoading(false);
        return;
      }
      try {
        let apiOrder: any = null;
        try {
          apiOrder = await ordersApi.getOrderById(orderId);
        } catch (_) {
          apiOrder = null;
        }
        if (!apiOrder && (order as any).backendOrderId != null) {
          try {
            apiOrder = await ordersApi.getOrderById(String((order as any).backendOrderId));
          } catch (_) {}
        }
        if (!mounted) return;

        if (!apiOrder) {
          setLoadError(translate('orderNotFound'));
          setLoading(false);
          return;
        }


        const planogramIdFromOrder: string =
          (apiOrder.planogramId && String(apiOrder.planogramId).trim()) ||
          (order.planogramId && String(order.planogramId).trim()) ||
          '';

        let planogram: Planogram | null = null;
        if (planogramIdFromOrder) {
          try {
            const byId = await planogramsApi.getById(planogramIdFromOrder);
            planogram = byId as Planogram | null;
          } catch {
            planogram = null;
          }
        }

        if (!planogram) {
          let planogramsData: Planogram[] = [];
          try {
            planogramsData = await planogramsApi.fetchAll();
          } catch (_) {
            planogramsData = (getFromLocalStorage('app-planograms') || []) as Planogram[];
          }
          if (!mounted || !planogramsData.length) {
            setLoadError(translate('noActivePlanogramActivate'));
      setLoading(false);
            return;
          }
          planogram =
            planogramsData.find((p: Planogram) => !!planogramIdFromOrder && p.id === planogramIdFromOrder) ||
            planogramsData.find((p: Planogram) => p.isActive) ||
            planogramsData[0];
        }

        if (!planogram) {
          setLoadError(translate('noActivePlanogramActivate'));
      setLoading(false);
          return;
        }
        setPlanogramName(planogram.name ?? null);
        setPlanogramDescription(planogram.description ?? null);

        let distList: Distribution[] = [];
        try {
          distList = await distributionsApi.getByPlanogram(planogram.id);
        } catch (_) {
          const allDist = (getFromLocalStorage('app-distributions') || []) as Distribution[];
          distList = allDist.filter((d: Distribution) => d.planogramId === planogram.id);
        }
        if (!mounted) return;

        let productsData: Product[] = [];
        let categoriesList: { id: string; name: string }[] = [];
        try {
          [productsData, categoriesList] = await Promise.all([
            (productsApi.fetchAll() as Promise<Product[]>),
            categoriesApi.fetchAll().then((list) => list.map((c) => ({ id: c.id, name: c.name }))),
          ]);
        } catch (_) {
          productsData = (getFromLocalStorage('app-products') || []) as Product[];
          categoriesList = [];
        }
        if (!mounted) return;
        setAllCategories(categoriesList);

        const categoryById = new Map<string, string>();
        categoriesList.forEach((c) => {
          categoryById.set(c.id, c.name);
          categoryById.set(String(Number(c.id)), c.name);
        });
        const resolveCategory = (p: Product | null): string => {
          if (!p) return '';
          const name = (p.category || '').trim();
          if (name) return name;
          const id = p.categoryId != null ? String(p.categoryId) : '';
          return id ? (categoryById.get(id) ?? categoryById.get(String(Number(id))) ?? '') : '';
        };

        const productMap = new Map<string, Product>();
        productsData.forEach((p) => {
          productMap.set(String(p.id), p);
          if (typeof p.id === 'string' && /^\d+$/.test(p.id)) productMap.set(String(Number(p.id)), p);
        });
        const getProduct = (id: string) => productMap.get(id) || productMap.get(String(Number(id)));

        // IMPORTANTE:
        // No agrupar por productId aquí. Con planogramas que permiten duplicados,
        // el backend puede devolver múltiples líneas con el mismo producto. Si colapsamos en Map,
        // la cantidad se "replica" en todas las celdas donde aparezca ese producto.
        // Usamos una cola (queue) por productId y vamos consumiendo por celda.
        const qtyQueueByProductId = new Map<
          string,
          Array<{ productName: string; sku: string; quantity: number; price: number }>
        >();
        const items = apiOrder.items ?? [];

        if (quantitySource === 'invoice') {
          const invHint = (apiOrder as any).invoiceId ?? (order as any).invoiceId ?? undefined;
          const invDisplay = await ordersApi.getInvoiceDisplayForOrder(orderId, invHint, apiOrder);
          let usedInvoiceQuantities = false;

          if (invDisplay?.items?.length) {
            const fromInv = buildQuantitiesQueueFromInvoiceLines(
              invDisplay.items,
              items as any[],
              (pid) => {
                const p = getProduct(pid);
                if (!p) return undefined;
                return {
                  id: String(p.id),
                  name: p.name,
                  sku: p.sku,
                  familyId: p.familyId,
                  categoryId: p.categoryId,
                  currentPrice: p.currentPrice,
                };
              },
              productsData
            );
            if (fromInv.size > 0) {
              fromInv.forEach((arr, k) => qtyQueueByProductId.set(k, [...arr]));
              usedInvoiceQuantities = true;
            }
          }

          /**
           * Si hay líneas de factura pero no hubo cruce, NO usar cantidades del pedido inicial (comportamiento PWA).
           * Solo rellenar desde el pedido si no hay factura usable.
           */
          if (!usedInvoiceQuantities && !(invDisplay?.items?.length)) {
            for (const item of items) {
              const id = String(item.productId ?? item.ProductId ?? item.product_id ?? '');
              if (!id) continue;
              let price = Number(item.price ?? item.unitPrice ?? 0) || 0;
              const p = getProduct(id);
              if (!price) {
                const familyId = String(p?.familyId ?? p?.categoryId ?? '').trim();
                if (familyId) {
                  try {
                    const hp = await histpricesApi.getLatest(familyId);
                    price = hp?.price ?? 0;
                  } catch (_) {}
                }
              }
              const name = (item.productName ?? item.sku ?? p?.name ?? '').trim();
              const sku = String(item.sku ?? p?.sku ?? p?.code ?? '').trim();
              const qty = Number(item.quantity ?? item.toOrder ?? item.Quantity ?? 0) || 0;
              if (qty > 0) {
                const arr = qtyQueueByProductId.get(id) ?? [];
                arr.push({ productName: name, sku, quantity: qty, price });
                qtyQueueByProductId.set(id, arr);
              }
            }
          } else if (usedInvoiceQuantities) {
            // Completar precios faltantes en cola
            for (const [id, arr] of qtyQueueByProductId.entries()) {
              const nextArr = await Promise.all(
                arr.map(async (row) => {
                  if (row.price > 0) return row;
                  const oi = items.find((x: any) => String(x.productId ?? x.ProductId) === id);
                  let price = Number(oi?.price ?? oi?.unitPrice ?? 0) || 0;
                  if (!price) {
                    const productForPrice = getProduct(id);
                    const familyId = String(productForPrice?.familyId ?? productForPrice?.categoryId ?? '').trim();
                    if (familyId) {
                      try {
                        const hp = await histpricesApi.getLatest(familyId);
                        price = hp?.price ?? 0;
                      } catch (_) {}
                    }
                  }
                  return { ...row, price };
                })
              );
              qtyQueueByProductId.set(id, nextArr);
            }
          }
        } else {
          for (const item of items) {
            const id = String(item.productId ?? item.ProductId ?? item.product_id ?? '');
            if (id) {
              let price = Number(item.price ?? item.unitPrice ?? 0) || 0;
              const p = getProduct(id);
              if (!price) {
                const familyId = String(p?.familyId ?? p?.categoryId ?? '').trim();
                if (familyId) {
                  try {
                    const hp = await histpricesApi.getLatest(familyId);
                    price = hp?.price ?? 0;
                  } catch (_) {}
                }
              }
              const name = (item.productName ?? item.sku ?? p?.name ?? '').trim();
              const sku = String(item.sku ?? p?.sku ?? p?.code ?? '').trim();
              const qty = item.quantity ?? item.toOrder ?? item.Quantity ?? 0;
              const q = Number(qty) || 0;
              if (q > 0) {
                const arr = qtyQueueByProductId.get(id) ?? [];
                arr.push({ productName: name, sku, quantity: q, price });
                qtyQueueByProductId.set(id, arr);
              }
            }
          }
        }

        const planogramGrid: ProductPosition[] = [];
        for (let row = 0; row < 10; row++) {
          for (let col = 0; col < 10; col++) {
            const dist = distList.find((d) => d.xPosition === row && d.yPosition === col);
            const product = dist ? getProduct(dist.productId) : null;
            const pid = product ? (String(product.id) || '') : '';
            const key = pid ? (qtyQueueByProductId.has(pid) ? pid : String(Number(pid))) : '';
            const queue = key ? qtyQueueByProductId.get(key) : undefined;
            const next = queue && queue.length > 0 ? queue.shift()! : null;
            planogramGrid.push({
              row,
              col,
              productId: product?.id ?? '',
              productName: next?.productName ?? product?.name ?? '',
              sku:
                String(next?.sku || '').trim() ||
                String(product?.sku || '').trim() ||
                String(product?.code || '').trim(),
              category: resolveCategory(product ?? null),
              toOrder: next?.quantity ?? 0,
              price: next?.price ?? product?.currentPrice ?? 0,
              imageUrl: product ? getProductImageUrl(product) : undefined,
            });
          }
        }
        if (mounted) setGrid(planogramGrid);
      } catch (e) {
        console.error('Error cargando planograma:', e);
        if (mounted) setLoadError((e as Error)?.message ?? 'Error al cargar');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [order.id, order.planogramId, quantitySource]);

  /** Colores hex iguales a Tailwind PWA (slate-400/500, indigo-50/300, slate-100/200). */
  const getCellSurface = (item: ProductPosition): React.CSSProperties => {
    if (!item.productId) {
      return { backgroundColor: '#94a3b8', borderColor: '#64748b' };
    }
    if (item.toOrder > 0) {
      return { backgroundColor: '#eef2ff', borderColor: '#a5b4fc' };
    }
    return { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' };
  };

  if (loading) {
    return (
      <div className="min-h-[280px] bg-slate-50 flex items-center justify-center rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">{translate('loadingPlanogram')}</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[280px] bg-slate-50 flex items-center justify-center rounded-lg">
        <div className="text-center px-4">
          <p className="text-slate-600 mb-2">{loadError}</p>
          <p className="text-xs text-slate-500">{translate('activatePlanogramInSection')}</p>
        </div>
      </div>
    );
  }

  const totalToOrder = grid.reduce((s, i) => s + i.toOrder, 0);
  const totalValue = grid.reduce((s, i) => s + i.toOrder * i.price, 0);
  const productsWithQty = grid.filter((i) => i.productId && i.toOrder > 0).length;

  /** Grilla 10×10 fija (misma idea que antes en admin + proporción PWA): evita que el modal rompa `grid-cols-10`. */
  const cellSize = 72;
  const cellGap = 8;
  const gridWidthPx = 10 * cellSize + 9 * cellGap;

  return (
    <div className="admin-planogram-print-compact bg-slate-50 print:bg-white">
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 print:static print:border-0 print:shadow-none print:py-2 print:px-2">
        <div className="flex items-center justify-between mb-3 gap-2 print:mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-slate-900 text-sm print:text-xs">{planogramName ?? translate('planogram')}</h2>
              {planogramDescription && (
                <p className="text-xs text-slate-500 mt-0.5 print:text-[10px] print:leading-tight">{planogramDescription}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 print:hidden">
              {translate('readOnly')}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 print:gap-1">
          <div className="bg-slate-50 rounded-lg p-2 text-center print:p-1.5">
            <p className="text-xs text-slate-500 mb-0.5 print:text-[9px] print:mb-0">{translate('productsLabel')}</p>
            <p className="text-sm text-slate-900 print:text-xs">{productsWithQty}</p>
            </div>
          <div className="bg-indigo-50 rounded-lg p-2 text-center print:p-1.5">
            <p className="text-xs text-indigo-600 mb-0.5 print:text-[9px] print:mb-0">{translate('quantityUnits')}</p>
            <p className="text-sm text-indigo-900 print:text-xs">{totalToOrder}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center print:p-1.5">
            <p className="text-xs text-green-600 mb-0.5 print:text-[9px] print:mb-0">{translate('totalLabel')}</p>
            <p className="text-sm text-green-900 print:text-xs">${totalValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 print:py-2 print:px-2">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 overflow-x-auto print:shadow-none print:overflow-visible print:border print:break-inside-avoid print:p-1.5">
          <div
            className="mx-auto print:mx-0"
            style={{
              width: gridWidthPx,
              minWidth: gridWidthPx,
              display: 'grid',
              gridTemplateColumns: `repeat(10, ${cellSize}px)`,
              gridTemplateRows: `repeat(10, ${cellSize}px)`,
              gap: cellGap,
              boxSizing: 'content-box',
            }}
          >
            {grid.map((item) => (
              <div
                key={`${item.row}-${item.col}`}
                className="rounded-lg border border-solid flex flex-col items-center justify-center text-center min-h-0 min-w-0 overflow-hidden box-border"
                style={{
                  width: cellSize,
                  height: cellSize,
                  padding: 2,
                  boxSizing: 'border-box',
                  ...getCellSurface(item),
                }}
                title={item.productName ? `${item.productName}` : item.sku}
              >
                {item.productId ? (
                  <div className="flex flex-col items-center justify-center gap-0 w-full h-full min-h-0 min-w-0">
                    <div className="flex flex-row items-center justify-center gap-0.5 w-full shrink-0 min-h-0 px-0.5">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-slate-200 flex items-center justify-center shrink-0">
                          <Package className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                      )}
                      <span
                        className="text-[6.5px] leading-tight font-semibold text-slate-900 truncate min-w-0 max-w-[34px] text-center"
                        title={item.sku || undefined}
                      >
                        {item.sku || '—'}
                      </span>
                    </div>
                    {(item.productName || '').trim() ? (
                      <span
                        className="block w-full text-center text-slate-600 font-normal overflow-hidden line-clamp-2 mt-0.5 px-0.5"
                        style={{ fontSize: '12px', lineHeight: 1.2, maxHeight: '18px' }}
                        title={item.productName}
                      >
                        {item.productName}
                      </span>
                    ) : null}
                    {item.toOrder > 0 ? (
                      <span className="text-[10px] font-bold text-indigo-700 leading-none text-center mt-px">
                        {item.toOrder} {translate('unitsSuffix')}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 print:hidden">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-400" />
            {translate('noQuantity')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-300" />
            {translate('withQuantity')}
          </span>
      </div>

        {/* Resumen por familia/categoría: visible también al imprimir pedido inicial */}
        {allCategories.length > 0 && (
          <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 print:mt-3 print:border-slate-300 print:break-inside-avoid">
            <table className="w-full text-sm print:text-xs">
              <thead>
                <tr className="bg-slate-200 text-slate-800">
                  <th className="text-left py-2 px-3 font-semibold">{translate('familyCol') || 'Family'}</th>
                  <th className="text-right py-2 px-3 font-semibold w-16">{translate('pcsCol') || 'Pcs'}</th>
                </tr>
              </thead>
              <tbody>
                {[...allCategories]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((cat) => {
                    const pcs = grid
                      .filter((item) => (item.category || '').trim() === cat.name)
                      .reduce((sum, item) => sum + item.toOrder, 0);
                    return (
                      <tr key={cat.id} className="border-t border-slate-200 bg-white">
                        <td className="py-2 px-3 text-slate-900">{cat.name}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-800">{pcs}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

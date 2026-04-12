import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Package } from 'lucide-react';
import { Badge } from '@/shared/components/base/Badge';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { Order, Planogram, Distribution, Product } from '@/shared/types';
import { planogramsApi } from '@/shared/services/planograms-api';
import { distributionsApi } from '@/shared/services/distributions-api';
import { productsApi } from '@/shared/services/products-api';
import { ordersApi } from '@/shared/services/orders-api';
import { histpricesApi } from '@/shared/services/histprices-api';
import { getFromLocalStorage } from '@/shared/services/database';
import { getBackendAssetUrl } from '@/shared/config/api';
import { getProductCodeLine, getProductShortDisplayName } from '@/shared/utils/planogram-grid-display';
import {
  collectPresentationRowsFromGrid,
  sumQtyForPresentation,
} from '@/shared/utils/planogram-presentation-summary';
import { PresentationSummaryCell } from '@/shared/components/PresentationSummaryCell';

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
    const name = prod
      ? getProductShortDisplayName(prod as Product)
      : (line.description || (oi as any)?.productName || code).trim();
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
  /** Texto de respaldo si el producto no está en catálogo. */
  productName: string;
  sku: string;
  toOrder: number;
  price: number;
  imageUrl?: string;
}

async function resolvePriceFromHistOrProduct(
  basePrice: number,
  product: Product | null | undefined
): Promise<number> {
  if (basePrice > 0) return basePrice;
  const presId = String(product?.presentationId ?? '').trim();
  if (!presId) return 0;
  try {
    const hp = await histpricesApi.getLatest(presId);
    return hp?.price ?? 0;
  } catch {
    return 0;
  }
}

export const OrderPlanogramView: React.FC<OrderPlanogramViewProps> = ({
  order,
  quantitySource = 'order',
}) => {
  const { translate } = useLanguage();
  const [grid, setGrid] = useState<ProductPosition[]>([]);
  const [planogramName, setPlanogramName] = useState<string | null>(null);
  const [planogramDescription, setPlanogramDescription] = useState<string | null>(null);
  const [productMap, setProductMap] = useState<Map<string, Product>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const presentationSummaryRows = useMemo(
    () => collectPresentationRowsFromGrid(grid.filter((c) => String(c.productId).trim()), productMap),
    [grid, productMap]
  );

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
        try {
          productsData = (await (productsApi.fetchAll() as Promise<Product[]>)) ?? [];
        } catch (_) {
          productsData = (getFromLocalStorage('app-products') || []) as Product[];
        }
        if (!mounted) return;

        const productMap = new Map<string, Product>();
        productsData.forEach((p) => {
          productMap.set(String(p.id), p);
          if (typeof p.id === 'string' && /^\d+$/.test(p.id)) productMap.set(String(Number(p.id)), p);
        });
        if (mounted) setProductMap(new Map(productMap));
        const getProduct = (id: string) => productMap.get(id) || productMap.get(String(Number(id)));

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

          if (!usedInvoiceQuantities && !(invDisplay?.items?.length)) {
            for (const item of items) {
              const id = String(item.productId ?? item.ProductId ?? item.product_id ?? '');
              if (!id) continue;
              let price = Number(item.price ?? item.unitPrice ?? 0) || 0;
              const p = getProduct(id);
              price = await resolvePriceFromHistOrProduct(price, p ?? null);
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
            for (const [id, arr] of qtyQueueByProductId.entries()) {
              const nextArr = await Promise.all(
                arr.map(async (row) => {
                  if (row.price > 0) return row;
                  const oi = items.find((x: any) => String(x.productId ?? x.ProductId) === id);
                  let price = Number(oi?.price ?? oi?.unitPrice ?? 0) || 0;
                  if (!price) {
                    const productForPrice = getProduct(id);
                    price = await resolvePriceFromHistOrProduct(0, productForPrice ?? null);
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
              price = await resolvePriceFromHistOrProduct(price, p ?? null);
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
            const pid = product ? String(product.id) || '' : '';
            const key = pid ? (qtyQueueByProductId.has(pid) ? pid : String(Number(pid))) : '';
            const queue = key ? qtyQueueByProductId.get(key) : undefined;
            const next = queue && queue.length > 0 ? queue.shift()! : null;
            planogramGrid.push({
              row,
              col,
              productId: product?.id ?? '',
              productName: (next?.productName ?? '').trim(),
              sku:
                String(next?.sku || '').trim() ||
                String(product?.sku || '').trim() ||
                String(product?.code || '').trim(),
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
    return () => {
      mounted = false;
    };
  }, [order.id, order.planogramId, quantitySource]);

  /** Celdas vacías del planograma; con producto mismo tono que gestión de planograma (ocupada / sin pedido). */
  const getCellSurface = (item: ProductPosition): React.CSSProperties => {
    if (!item.productId) {
      return { backgroundColor: '#94a3b8', borderColor: '#64748b' };
    }
    if (item.toOrder > 0) {
      return { backgroundColor: '#e0e7ff', borderColor: '#6366f1' };
    }
    return { backgroundColor: '#d1d5db', borderColor: '#525252' };
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

  /** Grilla 10×10 fija: evita que el modal rompa `grid-cols-10`. */
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
            {grid.map((item) => {
              const p =
                item.productId &&
                (productMap.get(String(item.productId)) || productMap.get(String(Number(item.productId))));
              const nameLabel = p
                ? getProductShortDisplayName(p)
                : (item.productName || '').trim();
              const codeLine = p ? getProductCodeLine(p) : '—';
              const muted = !!(item.productId && item.toOrder <= 0);
              return (
                <div
                  key={`${item.row}-${item.col}`}
                  className={`rounded-lg border border-solid flex flex-col items-center justify-center text-center min-h-0 min-w-0 overflow-hidden box-border ${muted ? 'opacity-[0.48]' : ''}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    padding: 2,
                    boxSizing: 'border-box',
                    ...getCellSurface(item),
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  } as React.CSSProperties}
                  title={nameLabel ? `${nameLabel} (${codeLine})` : codeLine}
                >
                  {item.productId ? (
                    <div className="text-center w-full h-full flex flex-col justify-center p-0.5 relative min-h-0 min-w-0">
                      <div className="flex justify-center w-full shrink-0 min-h-0 px-0.5">
                        <div className="inline-flex flex-row items-center justify-center gap-0.5 max-w-full min-w-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Package className="h-4 w-4 text-gray-600" />
                            </div>
                          )}
                          <div className="font-bold text-blue-800 truncate text-[10px] leading-tight max-w-[42px] min-w-0 text-center">
                            {codeLine}
                          </div>
                        </div>
                      </div>
                      {nameLabel ? (
                        <div
                          className="block w-full max-w-full px-0.5 text-blue-700/90 font-bold overflow-hidden mt-0.5"
                          style={{
                            fontSize: '7px',
                            lineHeight: 1.1,
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
                      {item.toOrder > 0 ? (
                        <>
                          <div
                            className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-indigo-600 rounded-full shadow-sm"
                            aria-hidden
                          />
                          <span className="text-[10px] font-bold text-indigo-800 leading-none text-center mt-0.5">
                            {item.toOrder} {translate('unitsSuffix')}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 print:hidden">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-400" />
            {translate('noQuantity')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-200 border border-indigo-600" />
            {translate('withQuantity')}
          </span>
        </div>

        {/* Presentaciones que aparecen en el planograma (celdas con producto), como en la PWA */}
        {presentationSummaryRows.length > 0 && (
          <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 print:mt-3 print:border-slate-300 print:break-inside-avoid">
            <table className="w-full text-sm print:text-xs">
              <thead>
                <tr className="bg-slate-200 text-slate-800">
                  <th className="text-left py-2 px-3 font-semibold">{translate('familyCol') || 'Family'}</th>
                  <th className="text-right py-2 px-3 font-semibold w-16">{translate('pcsCol') || 'Pcs'}</th>
                </tr>
              </thead>
              <tbody>
                {presentationSummaryRows.map((row) => {
                  const pcs = sumQtyForPresentation(grid, productMap, row.presentationId);
                  return (
                    <tr key={row.presentationId} className="border-t border-slate-200 bg-white">
                      <td className="py-2 px-3 text-slate-900 align-top">
                        <PresentationSummaryCell row={row} />
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-800 align-middle">{pcs}</td>
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

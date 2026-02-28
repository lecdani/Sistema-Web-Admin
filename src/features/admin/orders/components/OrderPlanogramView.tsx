import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/shared/components/base/Badge';
import { Order, Planogram, Distribution, Product } from '@/shared/types';
import { planogramsApi } from '@/shared/services/planograms-api';
import { distributionsApi } from '@/shared/services/distributions-api';
import { productsApi } from '@/shared/services/products-api';
import { ordersApi } from '@/shared/services/orders-api';
import { histpricesApi } from '@/shared/services/histprices-api';
import { getFromLocalStorage } from '@/shared/services/database';

interface OrderPlanogramViewProps {
  order: Order;
  onViewOrder?: () => void;
}

interface ProductPosition {
  row: number;
  col: number;
  productId: string;
  productName: string;
  sku: string;
  toOrder: number;
  price: number;
}

export const OrderPlanogramView: React.FC<OrderPlanogramViewProps> = ({ order }) => {
  const [grid, setGrid] = useState<ProductPosition[]>([]);
  const [planogramName, setPlanogramName] = useState<string | null>(null);
  const [planogramDescription, setPlanogramDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setLoadError(null);
      const orderId = String(order.id ?? (order as any).backendOrderId ?? '');
      if (!orderId) {
        setLoadError('Pedido sin ID');
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
          setLoadError('Pedido no encontrado');
          setLoading(false);
          return;
        }


        let planogramsData: Planogram[] = [];
        try {
          planogramsData = await planogramsApi.fetchAll();
        } catch (_) {
          planogramsData = (getFromLocalStorage('app-planograms') || []) as Planogram[];
        }
        if (!mounted) return;

        const activePlan =
          planogramsData.find((p: Planogram) => p.isActive) ||
          (order.planogramId && planogramsData.find((p: Planogram) => p.id === order.planogramId)) ||
          planogramsData[0];
        if (!activePlan) {
          setLoadError('No hay planograma activo. Activa uno en Planogramas.');
          setLoading(false);
          return;
        }
        setPlanogramName(activePlan.name ?? null);
        setPlanogramDescription(activePlan.description ?? null);

        let distList: Distribution[] = [];
        try {
          distList = await distributionsApi.getByPlanogram(activePlan.id);
        } catch (_) {
          const allDist = (getFromLocalStorage('app-distributions') || []) as Distribution[];
          distList = allDist.filter((d: Distribution) => d.planogramId === activePlan.id);
        }
        if (!mounted) return;

        let productsData: Product[] = [];
        try {
          productsData = (await productsApi.fetchAll()) as Product[];
        } catch (_) {
          productsData = (getFromLocalStorage('app-products') || []) as Product[];
        }
        if (!mounted) return;

        const productMap = new Map<string, Product>();
        productsData.forEach((p) => {
          productMap.set(String(p.id), p);
          if (typeof p.id === 'string' && /^\d+$/.test(p.id)) productMap.set(String(Number(p.id)), p);
        });
        const getProduct = (id: string) => productMap.get(id) || productMap.get(String(Number(id)));

        const orderItemsByProductId = new Map<string, { productName: string; sku: string; quantity: number; price: number }>();
        const items = apiOrder.items ?? [];
        for (const item of items) {
          const id = String(item.productId ?? item.ProductId ?? item.product_id ?? '');
          if (id) {
            let price = Number(item.price ?? item.unitPrice ?? 0) || 0;
            if (!price) {
              try {
                const latest = await histpricesApi.getLatest(id);
                if (latest?.price != null) price = latest.price;
              } catch (_) {}
            }
            const name = (item.productName ?? item.sku ?? getProduct(id)?.name ?? '').trim();
            const sku = item.sku ?? getProduct(id)?.sku ?? '';
            const qty = item.quantity ?? item.toOrder ?? item.Quantity ?? 0;
            orderItemsByProductId.set(id, {
              productName: name,
              sku: sku || name,
              quantity: Number(qty) || 0,
              price,
            });
          }
        }

        const planogramGrid: ProductPosition[] = [];
        for (let row = 0; row < 10; row++) {
          for (let col = 0; col < 10; col++) {
            const dist = distList.find((d) => d.xPosition === row && d.yPosition === col);
            const product = dist ? getProduct(dist.productId) : null;
            const orderItem = product
              ? orderItemsByProductId.get(product.id) ?? orderItemsByProductId.get(String(Number(product.id)))
              : null;
            planogramGrid.push({
              row,
              col,
              productId: product?.id ?? '',
              productName: orderItem?.productName ?? product?.name ?? product?.sku ?? '',
              sku: orderItem?.sku ?? product?.sku ?? '',
              toOrder: orderItem?.quantity ?? 0,
              price: orderItem?.price ?? product?.currentPrice ?? 0,
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
  }, [order.id, order.planogramId]);

  const getCellStyle = (item: ProductPosition): React.CSSProperties => {
    if (!item.productId) return { backgroundColor: '#94a3b8', borderColor: '#64748b', borderWidth: 1, borderStyle: 'solid' };
    if (item.toOrder > 0) return { backgroundColor: '#eff6ff', borderColor: '#93c5fd', borderWidth: 1, borderStyle: 'solid' };
    return { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', borderWidth: 1, borderStyle: 'solid' };
  };

  if (loading) {
    return (
      <div className="min-h-[280px] bg-slate-50 flex items-center justify-center rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">Cargando planograma...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[280px] bg-slate-50 flex items-center justify-center rounded-lg">
        <div className="text-center px-4">
          <p className="text-slate-600 mb-2">{loadError}</p>
          <p className="text-xs text-slate-500">Activa un planograma en la sección Planogramas para ver el pedido en la grilla.</p>
        </div>
      </div>
    );
  }

  const totalToOrder = grid.reduce((s, i) => s + i.toOrder, 0);
  const totalValue = grid.reduce((s, i) => s + i.toOrder * i.price, 0);
  const productsWithQty = grid.filter((i) => i.productId && i.toOrder > 0).length;

  // Celdas un poco más grandes para buena lectura
  const cellSize = 56;
  const gap = 8;
  const gridTotal = 10 * cellSize + 9 * gap;

  return (
    <div className="bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-slate-900 text-sm">{planogramName ?? 'Planograma'}</h2>
              {planogramDescription && (
                <p className="text-xs text-slate-500 mt-0.5">{planogramDescription}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Solo lectura</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Productos</p>
            <p className="text-sm text-slate-900">{productsWithQty}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-xs text-blue-600 mb-0.5">Unidades</p>
            <p className="text-sm text-blue-900">{totalToOrder}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-xs text-green-600 mb-0.5">Total</p>
            <p className="text-sm text-green-900">${totalValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="text-sm text-slate-600 mb-3">Vista del planograma según el pedido (solo lectura).</p>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 overflow-x-auto">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(10, ${cellSize}px)`,
              gap: `${gap}px`,
              width: `${gridTotal}px`,
              margin: '0 auto',
            }}
          >
            {grid.map((item) => (
              <div
                key={`${item.row}-${item.col}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 8,
                  ...getCellStyle(item),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 2,
                  textAlign: 'center',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {item.productId ? (
                  <>
                    <span
                      style={{
                        fontSize: 10,
                        lineHeight: 1.25,
                        fontWeight: 500,
                        color: '#1e293b',
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as any,
                        width: '100%',
                      }}
                      title={item.productName || item.sku}
                    >
                      {item.productName || item.sku}
                    </span>
                    <span style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>${(item.price || 0).toFixed(2)}</span>
                    {item.toOrder > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', marginTop: 2 }}>{item.toOrder} u</span>
                    )}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-400" />Sin cantidad</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-300" />Con cantidad</span>
        </div>
      </div>
    </div>
  );
};

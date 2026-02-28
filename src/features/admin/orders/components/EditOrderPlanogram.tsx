import React, { useState, useEffect } from 'react';
import { Loader2, Store as StoreIcon, Edit, Send, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { Badge } from '@/shared/components/base/Badge';
import { Card, CardContent } from '@/shared/components/base/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/base/Select';
import { Order, Planogram, Distribution, Product } from '@/shared/types';
import { planogramsApi } from '@/shared/services/planograms-api';
import { distributionsApi } from '@/shared/services/distributions-api';
import { productsApi } from '@/shared/services/products-api';
import { ordersApi } from '@/shared/services/orders-api';
import { storesApi } from '@/shared/services/stores-api';
import { histpricesApi } from '@/shared/services/histprices-api';
import { getFromLocalStorage } from '@/shared/services/database';
import { toast } from 'sonner';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { ProductModalOrderEdit, ProductPositionEdit } from './ProductModalOrderEdit';

interface EditOrderPlanogramProps {
  order: Order;
  onClose: () => void;
  onSaved: (orderId: string) => void;
}

const cellSize = 56;
const gap = 8;
const gridTotal = 10 * cellSize + 9 * gap;

export function EditOrderPlanogram({ order, onClose, onSaved }: EditOrderPlanogramProps) {
  const { translate } = useLanguage();
  const [planogramData, setPlanogramData] = useState<ProductPositionEdit[]>([]);
  const [planogramName, setPlanogramName] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string>('');
  const [storeInfo, setStoreInfo] = useState<{ id: string; name: string; address?: string } | null>(null);
  const [stores, setStores] = useState<Array<{ id: string; name: string; address?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'planogram' | 'review'>('planogram');
  const [selectedPosition, setSelectedPosition] = useState<ProductPositionEdit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const orderId = String(order.id ?? (order as any).backendOrderId ?? '');

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setLoadError(null);
      if (!orderId) {
        setLoadError('Pedido sin ID');
        setLoading(false);
        return;
      }
      try {
        const [apiOrder, planogramsData, productsData, storesList] = await Promise.all([
          ordersApi.getOrderById(orderId),
          planogramsApi.fetchAll().catch(() => getFromLocalStorage('app-planograms') || []),
          productsApi.fetchAll().catch(() => getFromLocalStorage('app-products') || []),
          storesApi.fetchAll().catch(() => []),
        ]);

        if (!mounted) return;
        if (!apiOrder) {
          setLoadError('Pedido no encontrado');
          setLoading(false);
          return;
        }

        setStoreId(apiOrder.storeId || '');
        const store = storesList.find((s: any) => String(s.id) === String(apiOrder.storeId));
        setStoreInfo(store ? { id: store.id, name: store.name, address: store.address } : null);
        setStores(
          (storesList as any[]).map((s: any) => ({
            id: String(s.id),
            name: String(s.name ?? ''),
            address: s.address,
          }))
        );

        const activePlan =
          (planogramsData as Planogram[]).find((p: Planogram) => p.isActive) ||
          (order.planogramId && (planogramsData as Planogram[]).find((p: Planogram) => p.id === order.planogramId)) ||
          (planogramsData as Planogram[])[0];
        if (!activePlan) {
          setLoadError('No hay planograma activo. Activa uno en Planogramas.');
          setLoading(false);
          return;
        }
        setPlanogramName(activePlan.name ?? null);

        let distList: Distribution[] = [];
        try {
          distList = await distributionsApi.getByPlanogram(activePlan.id);
        } catch {
          const allDist = (getFromLocalStorage('app-distributions') || []) as Distribution[];
          distList = allDist.filter((d: Distribution) => d.planogramId === activePlan.id);
        }
        if (!mounted) return;

        const productMap = new Map<string, Product>();
        (productsData as Product[]).forEach((p: Product) => {
          productMap.set(String(p.id), p);
          if (typeof p.id === 'string' && /^\d+$/.test(p.id)) productMap.set(String(Number(p.id)), p);
        });
        const getProduct = (id: string) => productMap.get(id) || productMap.get(String(Number(id)));

        const orderItemsByProductId = new Map<string, { productName: string; sku: string; quantity: number; price: number }>();
        for (const item of apiOrder.items || []) {
          const id = String(item.productId ?? '');
          if (id) {
            let price = Number(item.price ?? 0) || 0;
            if (!price) {
              try {
                const latest = await histpricesApi.getLatest(id);
                if (latest?.price != null) price = latest.price;
              } catch {}
            }
            orderItemsByProductId.set(id, {
              productName: (item.productName ?? item.sku ?? getProduct(id)?.name ?? '').trim(),
              sku: item.sku ?? getProduct(id)?.sku ?? '',
              quantity: item.quantity ?? item.toOrder ?? 0,
              price,
            });
          }
        }

        const grid: ProductPositionEdit[] = [];
        for (let row = 0; row < 10; row++) {
          for (let col = 0; col < 10; col++) {
            const dist = distList.find((d) => d.xPosition === row && d.yPosition === col);
            const product = dist ? getProduct(dist.productId) : null;
            const orderItem = product
              ? orderItemsByProductId.get(product.id) ?? orderItemsByProductId.get(String(Number(product.id)))
              : null;
            grid.push({
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
        if (mounted) setPlanogramData(grid);
      } catch (e) {
        console.error('Error cargando planograma para edición:', e);
        if (mounted) setLoadError((e as Error)?.message ?? 'Error al cargar');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [orderId, order.planogramId]);

  const handleStoreChange = (newStoreId: string) => {
    setStoreId(newStoreId);
    const store = stores.find((s) => s.id === newStoreId);
    setStoreInfo(store ?? null);
  };

  const handleUpdateQuantity = (toOrder: number) => {
    if (!selectedPosition) return;
    setPlanogramData((prev) =>
      prev.map((item) =>
        item.row === selectedPosition.row && item.col === selectedPosition.col
          ? { ...item, toOrder }
          : item
      )
    );
    setSelectedPosition(null);
    setModalOpen(false);
  };

  const getCellStyle = (item: ProductPositionEdit): React.CSSProperties => {
    if (!item.productId) return { backgroundColor: '#94a3b8', borderColor: '#64748b', borderWidth: 1, borderStyle: 'solid' };
    if (item.toOrder > 0) return { backgroundColor: '#eff6ff', borderColor: '#93c5fd', borderWidth: 1, borderStyle: 'solid' };
    return { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', borderWidth: 1, borderStyle: 'solid' };
  };

  const orderItems = planogramData.filter((i) => i.productId && i.toOrder > 0);
  const totalToOrder = planogramData.reduce((s, i) => s + i.toOrder, 0);
  const totalValue = planogramData.reduce((s, i) => s + i.toOrder * i.price, 0);

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const store = stores.find((s) => s.id === storeId) ?? storeInfo;
      const salespersonId = (order as any).salespersonId ?? (order as any).sellerId ?? '';
      const invoiceIdHint = await ordersApi.getInvoiceIdForOrder(orderId);

      const payload = {
        storeId,
        storeName: store?.name ?? storeId,
        storeAddress: store?.address ?? '',
        salespersonId: String(salespersonId),
        items: orderItems.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          productName: item.productName,
          quantity: item.toOrder,
          price: item.price,
        })),
        subtotal: totalValue,
        tax: 0,
        total: totalValue,
      };

      const ok = await ordersApi.updateOrder(orderId, payload, invoiceIdHint ?? undefined);
      if (!ok) {
        toast.error('No se pudo guardar el pedido. Revisa la conexión e inténtalo de nuevo.');
        setSaving(false);
        return;
      }
      toast.success('Pedido actualizado correctamente.');
      onSaved(orderId);
      onClose();
    } catch (e) {
      console.error('Error guardando pedido:', e);
      toast.error(translate('errorSavingOrder'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">{translate('loadingPlanogram')}</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] p-4">
        <p className="text-slate-600 mb-4">{loadError}</p>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" onClick={() => setStep('planogram')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {translate('editQuantities')}
            </Button>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{translate('reviewOrderButton')}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-500 mb-0.5">Productos</p>
              <p className="text-sm text-slate-900">{orderItems.length}</p>
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

        <div className="px-4 py-4 flex-1">
          <Card className="border-slate-200 mb-4">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-slate-900 text-sm">{translate('orderItems')}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {orderItems.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">{translate('noUnitsToOrder')}</div>
              ) : (
                orderItems.map((item, index) => (
                  <div key={`${item.row}-${item.col}-${index}`} className="p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-sm text-slate-900 font-medium">{item.productName || item.sku}</p>
                        <p className="text-xs text-slate-500">{item.sku}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {item.toOrder} u
                          </Badge>
                          {' × $'}{item.price.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-slate-900 font-medium">${(item.toOrder * item.price).toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-green-200 bg-green-50 mb-4">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-900 font-semibold">Total</span>
                <span className="text-xl text-green-900">${totalValue.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('planogram')} className="flex-1">
              <Edit className="h-4 w-4 mr-2" />
              {translate('editQuantities')}
            </Button>
            <Button
              onClick={handleSaveOrder}
              disabled={saving || orderItems.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <span className="flex items-center gap-2">Guardando...</span>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {translate('saveChanges')}
                </>
              )}
            </Button>
          </div>
        </div>

        {selectedPosition && (
          <ProductModalOrderEdit
            open={modalOpen}
            onClose={() => { setModalOpen(false); setSelectedPosition(null); }}
            position={selectedPosition}
            onUpdate={handleUpdateQuantity}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-slate-900 text-sm">{planogramName ?? 'Planograma'}</h2>
            <p className="text-xs text-slate-500">Editar pedido · Pedido #{orderId}</p>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Edición</Badge>
        </div>

        {stores.length > 0 && (
          <div className="mb-3">
            <label className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
              <StoreIcon className="h-4 w-4 text-slate-500" />
              Tienda
            </label>
            <Select value={storeId} onValueChange={handleStoreChange}>
              <SelectTrigger className="w-full max-w-xs h-10 border-slate-200 bg-white">
                <SelectValue placeholder="Seleccionar tienda" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <p className="text-xs text-slate-500 mb-0.5">Productos</p>
            <p className="text-sm text-slate-900">{orderItems.length}</p>
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

      <div className="px-4 py-4 flex-1">
        <p className="text-sm text-slate-600 mb-3">Haz clic en una celda para editar la cantidad a pedir.</p>
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
            {planogramData.map((item) => (
              <button
                key={`${item.row}-${item.col}`}
                type="button"
                onClick={() => {
                  setSelectedPosition(item);
                  setModalOpen(true);
                }}
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
                  cursor: item.productId ? 'pointer' : 'default',
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
                    >
                      {item.productName || item.sku}
                    </span>
                    <span style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>${(item.price || 0).toFixed(2)}</span>
                    {item.toOrder > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', marginTop: 2 }}>{item.toOrder} u</span>
                    )}
                  </>
                ) : null}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-400" />Sin cantidad</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-300" />Con cantidad</span>
        </div>

        <div className="mt-6">
          <Button
            onClick={() => setStep('review')}
            disabled={orderItems.length === 0}
            className="w-full sm:max-w-xs bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4 mr-2" />
            {translate('reviewOrderButton')}
          </Button>
          {orderItems.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">{translate('addUnitsToContinue')}</p>
          )}
        </div>
      </div>

      {selectedPosition && (
        <ProductModalOrderEdit
          open={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedPosition(null); }}
          position={selectedPosition}
          onUpdate={handleUpdateQuantity}
        />
      )}
    </div>
  );
}

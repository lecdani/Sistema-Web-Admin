import React, { useState, useEffect } from 'react';
import { Loader2, Store as StoreIcon, Edit, Send, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { Badge } from '@/shared/components/base/Badge';
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

const cellSize = 64;
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
        setLoadError(translate('orderWithoutId'));
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
          setLoadError(translate('orderNotFound'));
          setLoading(false);
          return;
        }

        setStoreId(String(apiOrder.storeId ?? ''));
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
          setLoadError(translate('noActivePlanogramActivate'));
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
    const store = stores.find((s) => String(s.id) === String(newStoreId));
    setStoreInfo(store ?? null);
  };

  const selectedStoreName = storeInfo?.name ?? stores.find((s) => String(s.id) === String(storeId))?.name ?? '';

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
    if (!item.productId) return { backgroundColor: '#94a3b8', borderColor: '#64748b' };
    if (item.toOrder > 0) return { backgroundColor: '#e0e7ff', borderColor: '#818cf8' };
    return { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' };
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
        toast.error(translate('errorSavingOrder'));
        setSaving(false);
        return;
      }
      toast.success(translate('orderUpdatedSuccess'));
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
      <div className="flex flex-col items-center min-h-0">
        <header className="w-full bg-white border-b border-gray-200 rounded-t-lg px-4 py-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep('planogram')} className="p-2 h-auto text-gray-700 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-base font-semibold text-gray-900">{translate('reviewOrderButton')}</h1>
                <p className="text-xs text-gray-500">{translate('orderNumber')} #{orderId}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500 mb-0.5">{translate('productsLabel')}</p>
              <p className="text-sm font-medium text-gray-900">{orderItems.length}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-xs text-blue-600 mb-0.5">{translate('quantityUnits')}</p>
              <p className="text-sm font-medium text-blue-900">{totalToOrder}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xs text-green-600 mb-0.5">{translate('totalLabel')}</p>
              <p className="text-sm font-medium text-green-900">${totalValue.toFixed(2)}</p>
            </div>
          </div>
        </header>

        <div className="w-full p-6 space-y-4">
          {orderItems.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 py-4 px-4 text-center text-amber-800 text-sm">
              {translate('noUnitsToOrder')}
            </div>
          ) : (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {orderItems.map((item, index) => (
                <div key={`${item.row}-${item.col}-${index}`} className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="bg-indigo-100 text-indigo-700 font-medium rounded-md w-6 h-6 flex items-center justify-center shrink-0 text-xs">{index + 1}</span>
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900 truncate block">{item.productName || item.sku}</span>
                      <span className="text-gray-500 text-xs">{item.toOrder} × ${item.price.toFixed(2)}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900 shrink-0">${(item.toOrder * item.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {orderItems.length > 0 && (
            <div className="flex justify-between items-center py-3 px-4 rounded-lg border border-green-200 bg-green-50 text-sm">
              <span className="font-semibold text-gray-900">{translate('totalLabel')}</span>
              <span className="font-bold text-green-600 text-base">${totalValue.toFixed(2)}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setStep('planogram')} className="h-8 px-4 text-sm">
              <Edit className="h-4 w-4 mr-2" />
              {translate('editQuantities')}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveOrder}
              disabled={saving || orderItems.length === 0}
              className="h-8 px-4 text-sm bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? translate('saving') : (
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
    <div className="flex flex-col items-center min-h-0">
      <header className="w-full bg-white border-b border-gray-200 rounded-t-lg px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-gray-100 p-1.5 rounded-lg shrink-0" aria-hidden>
            <Edit className="h-4 w-4 text-gray-700" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">{translate('editOrderTitle')} #{orderId}</h1>
            <p className="text-[11px] text-gray-500 truncate">{planogramName ?? translate('planogram')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500 mb-0.5">{translate('productsLabel')}</p>
            <p className="text-sm font-medium text-gray-900">{orderItems.length}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-xs text-blue-600 mb-0.5">{translate('quantityUnits')}</p>
            <p className="text-sm font-medium text-blue-900">{totalToOrder}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-xs text-green-600 mb-0.5">{translate('totalLabel')}</p>
            <p className="text-sm font-medium text-green-900">${totalValue.toFixed(2)}</p>
          </div>
        </div>
      </header>

      <div className="w-full p-6 flex flex-col items-center">
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-center max-w-xl">
          {translate('editOnlyWhenNecessary')}
        </p>
        <p className="text-sm text-gray-500 mb-4">{translate('clickCellToEdit')}</p>
        {stores.length > 0 && (
          <div className="flex flex-col items-center mb-4">
            <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
              <StoreIcon className="h-4 w-4 text-blue-600 shrink-0" aria-hidden />
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-blue-700 whitespace-nowrap">{translate('storeLabel')}</label>
                <Select value={storeId} onValueChange={handleStoreChange}>
                  <SelectTrigger className="h-7 min-w-[140px] border-blue-200 bg-white text-gray-900 text-sm [&>span]:truncate">
                    <SelectValue placeholder={translate('selectStorePlaceholder')}>
                      {selectedStoreName || translate('selectStorePlaceholder')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={String(store.id)}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        <div className="overflow-x-auto py-1">
          <div
            className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 shadow-sm inline-block"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(10, ${cellSize}px)`,
              gap: `${gap}px`,
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
                className={`rounded-md border transition-colors min-w-0 ${item.productId ? 'hover:bg-indigo-50/70 cursor-pointer' : 'cursor-default'}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  ...getCellStyle(item),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 5,
                  textAlign: 'center',
                  overflow: 'hidden',
                }}
              >
                {item.productId ? (
                  <>
                    <span className="text-[10px] leading-snug font-medium text-gray-900 line-clamp-2 w-full break-words">
                      {item.productName || item.sku}
                    </span>
                    <span className="text-[9px] text-gray-600 mt-1">${(item.price || 0).toFixed(2)}</span>
                    {item.toOrder > 0 && (
                      <span className="text-[10px] font-semibold text-indigo-600 mt-0.5">{item.toOrder} u</span>
                    )}
                  </>
                ) : null}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
          <span className="text-xs text-gray-500">
            <span className="inline-block w-2 h-2 rounded bg-gray-400 align-middle mr-1.5" />{translate('emptyCell')}
            <span className="mx-2">·</span>
            <span className="inline-block w-2 h-2 rounded bg-indigo-200 border border-indigo-300 align-middle mr-1.5" />{translate('withQuantity')}
          </span>
          {orderItems.length === 0 && (
            <span className="text-sm text-amber-600">{translate('addUnitsToContinue')}</span>
          )}
          <Button
            onClick={() => setStep('review')}
            disabled={orderItems.length === 0}
            size="sm"
            className="h-8 px-4 text-sm bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            <Send className="h-4 w-4" />
            {translate('reviewOrderButton')}
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

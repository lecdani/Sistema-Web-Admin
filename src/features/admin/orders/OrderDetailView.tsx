import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Badge } from '@/shared/components/base/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/base/Card';
import {
  ShoppingCart,
  FileText,
  Package,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Download,
  Upload,
  Layout,
} from 'lucide-react';
import { ordersApi, OrderForUI } from '@/shared/services/orders-api';
import { toast } from 'sonner';
import { histpricesApi } from '@/shared/services/histprices-api';
import { productsApi } from '@/shared/services/products-api';
import { storesApi } from '@/shared/services/stores-api';
import { usersApi } from '@/shared/services/users-api';
import { Invoice } from './components/Invoice';
import { OrderPlanogramView } from './components/OrderPlanogramView';
import type { Order } from '@/shared/types';

interface OrderDetailViewProps {
  orderId: string;
  onClose?: () => void;
  onOrderUpdated?: () => void;
}

function looksLikeId(name: string): boolean {
  if (!name || !name.trim()) return true;
  return /^[0-9a-f-]{36}$/i.test(name.trim()) || /^\d+$/.test(name.trim());
}

export function OrderDetailView({ orderId, onClose, onOrderUpdated }: OrderDetailViewProps) {
  const [order, setOrder] = useState<OrderForUI | null>(null);
  const [uploadingPod, setUploadingPod] = useState(false);
  const [invoiceDisplay, setInvoiceDisplay] = useState<{
    invoiceNumber: string;
    date: string;
    total: number;
    subtotal: number;
    storeId?: string;
    pod?: string;
    items: Array<{ qty: number; code: string; description: string; price: number; amount: number }>;
  } | null>(null);
  const [podImageError, setPodImageError] = useState(false);
  const [storeNameDisplay, setStoreNameDisplay] = useState<string>('');
  const [storeAddressDisplay, setStoreAddressDisplay] = useState<string>('');
  const [sellerNameDisplay, setSellerNameDisplay] = useState<string>('');
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    const load = async () => {
      const ord = await ordersApi.getOrderById(orderId);
      if (!ord) {
        setOrder(null);
        setInvoiceDisplay(null);
        return;
      }
      // Enriquecer items con precio desde histprices cuando falte (igual que PWA)
      const needsPrice = ord.items.some((i: any) => i.productId && !Number(i.price));
      const needsProductName = ord.items.some(
        (i: any) => i.productId && !(i.productName || i.sku || '').trim()
      );
      let orderToSet = ord;
      if (needsPrice || needsProductName) {
        const enrichedItems = await Promise.all(
          ord.items.map(async (item: any) => {
            let productName = (item.productName || item.sku || '').trim();
            let price = Number(item.price) || 0;
            if (item.productId) {
              if (!price) {
                const latest = await histpricesApi.getLatest(item.productId);
                price = latest?.price ?? 0;
              }
              if (!productName) {
                const product = await productsApi.getById(item.productId);
                if (product) productName = product.name || product.sku || '';
              }
            }
            return { ...item, productName: productName || item.productName, price };
          })
        );
        const computedSubtotal = enrichedItems.reduce(
          (s: number, i: any) => s + (i.quantity ?? i.toOrder ?? 0) * (i.price || 0),
          0
        );
        orderToSet = {
          ...ord,
          items: enrichedItems,
          subtotal: ord.subtotal || computedSubtotal,
          total: ord.total || computedSubtotal + (ord.tax || 0),
        };
      }
      setOrder(orderToSet);

      // Nombre de tienda: si storeName parece id, resolver desde API
      const name = (orderToSet.storeName || '').trim();
      if (orderToSet.storeId && looksLikeId(name)) {
        try {
          const store = await storesApi.getById(orderToSet.storeId);
          if (store) {
            setStoreNameDisplay(store.name);
            setStoreAddressDisplay(store.address || '');
          } else {
            setStoreNameDisplay(name || orderToSet.storeName || '—');
            setStoreAddressDisplay(orderToSet.storeAddress || '');
          }
        } catch {
          setStoreNameDisplay(name || orderToSet.storeName || '—');
          setStoreAddressDisplay(orderToSet.storeAddress || '');
        }
      } else {
        setStoreNameDisplay(name || orderToSet.storeName || '—');
        setStoreAddressDisplay(orderToSet.storeAddress || '');
      }

      // Nombre del vendedor desde API
      if (orderToSet.salespersonId) {
        try {
          const user = await usersApi.getById(orderToSet.salespersonId);
          if (user) {
            setSellerNameDisplay(
              `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '—'
            );
          } else {
            setSellerNameDisplay(orderToSet.salespersonId);
          }
        } catch {
          setSellerNameDisplay(orderToSet.salespersonId);
        }
      } else {
        setSellerNameDisplay('—');
      }

      const inv = await ordersApi.getInvoiceDisplayForOrder(orderId, orderToSet.invoiceId);
      setInvoiceDisplay(inv);
    };
    load();
  }, [orderId]);

  useEffect(() => {
    setPodImageError(false);
  }, [order?.podImageUrl, order?.podFileName, invoiceDisplay?.pod]);

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Cargando pedido...</p>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    const map: Record<string, string> = {
      pending: 'Pendiente',
      completed: 'Completado',
      invoiced: 'Facturado',
      delivered: 'Entregado',
    };
    return map[s] || status || '—';
  };
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    const statusConfig: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Completado', color: 'bg-green-100 text-green-800' },
      invoiced: { label: 'Facturado', color: 'bg-green-100 text-green-800' },
      delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800' },
    };
    const config = statusConfig[s] || { label: status || '—', color: 'bg-gray-100 text-gray-800' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  // Total y subtotal: factura → pedido → calculado desde items (siempre mostrar algo)
  const items = order.items || [];
  const computedFromItems = items.reduce(
    (sum, i) => sum + (i.quantity ?? i.toOrder ?? 0) * (i.price ?? 0),
    0
  );
  const displaySubtotal =
    (invoiceDisplay?.subtotal ?? order.subtotal ?? 0) > 0
      ? (invoiceDisplay?.subtotal ?? order.subtotal ?? 0)
      : computedFromItems;
  const displayTotal =
    (invoiceDisplay?.total ?? order.total ?? 0) > 0
      ? (invoiceDisplay?.total ?? order.total ?? 0)
      : computedFromItems;

  // POD: igual que PWA — orden, factura o vacío
  const displayPod = (order.podImageUrl || order.podFileName || (invoiceDisplay?.pod ?? '') || '').trim();
  const buildPodImageUrl = (podPath: string): string => {
    const raw = (podPath || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `/api/pod-image?path=${encodeURIComponent(raw)}`;
  };
  const podImageUrl = displayPod ? buildPodImageUrl(displayPod) : '';
  const isPodPath = displayPod && !displayPod.startsWith('data:') && !displayPod.startsWith('http');

  // Pedidos pendientes: permitir cargar POD (con advertencia de que deberían ser los vendedores)
  const isPending = (order?.status || '').toLowerCase() === 'pending';
  const canUploadPod = isPending && order?.invoiceId;
  const handleUploadPodClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !file.type.startsWith('image/')) {
        toast.error('Seleccione un archivo de imagen válido.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no debe superar 5 MB.');
        return;
      }
      const invId = String(order?.invoiceId ?? '');
      if (!invId) {
        toast.error('Este pedido no tiene factura asociada.');
        return;
      }
      setUploadingPod(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const podOk = await ordersApi.uploadPODForInvoice({
          invoiceId: invId,
          fileName: file.name || 'POD.png',
          imageDataUrl: dataUrl,
        });
        if (!podOk) {
          setUploadingPod(false);
          toast.error('No se pudo subir el POD.');
          return;
        }
        // Actualizar estado del pedido a facturado/entregado (como en la PWA)
        const backendId = (order as any)?.backendOrderId ?? order?.id ?? orderId;
        const statusOk = await ordersApi.updateOrderStatus(backendId, true);
        setUploadingPod(false);
        if (!statusOk) {
          toast.warning('POD guardado pero no se pudo actualizar el estado del pedido.');
        } else {
          toast.success('POD subido y pedido marcado como facturado.');
        }
        onOrderUpdated?.();
        const ord = await ordersApi.getOrderById(orderId);
        if (ord) setOrder(ord);
        const inv = await ordersApi.getInvoiceDisplayForOrder(orderId, invId);
        if (inv) setInvoiceDisplay(inv);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Fecha factura como en PWA (en-US)
  const formatInvoiceDate = (d: string) => {
    if (!d) return '—';
    return d.includes(',') ? d : new Date(d).toLocaleDateString('en-US');
  };

  return (
    <div className="space-y-0">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-t-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Pedido #{(order as any).po ?? order.id ?? order.backendOrderId ?? '—'}</h2>
              <p className="text-blue-100 text-sm mt-1">
                Creado el {new Date(order.date || (order as any).createdAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-3 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="text-3xl font-bold">${displayTotal.toFixed(2)}</span>
            </div>
            <div className="inline-flex bg-white/90 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
              {getStatusLabel(order.status)}
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-auto p-0 bg-gray-50 border-b rounded-none">
          <TabsTrigger value="info" className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
            <Package className="h-4 w-4" />
            Información y productos
          </TabsTrigger>
          <TabsTrigger value="planogram" className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
            <Layout className="h-4 w-4" />
            Planograma
          </TabsTrigger>
          <TabsTrigger value="invoice" className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
            <FileText className="h-4 w-4" />
            Factura
          </TabsTrigger>
          <TabsTrigger value="pod" className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
            <ImageIcon className="h-4 w-4" />
            POD
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="p-6 space-y-0 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Detalles del Pedido</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Vendedor:</span>
                  <span className="font-medium text-gray-900">{sellerNameDisplay || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Tienda:</span>
                  <span className="font-medium text-gray-900">{storeNameDisplay || order.storeName || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Estado:</span>
                  {getStatusBadge(order.status)}
                </div>
                {order.deliveredAt && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-gray-600 text-sm">Fecha Entrega:</span>
                    <span className="font-medium text-green-600 text-sm">{new Date(order.deliveredAt).toLocaleDateString('es-ES')}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-5 border border-green-100">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Resumen Financiero</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Productos:</span>
                  <span className="font-medium text-gray-900">{(order.items || []).length} items</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Subtotal:</span>
                  <span className="font-medium text-gray-900">${displaySubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-green-200">
                  <span className="text-gray-900 font-semibold">TOTAL:</span>
                  <span className="text-xl font-bold text-green-600">${displayTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          {order.notes && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 mt-4">
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">Notas del Pedido</h4>
              <p className="text-sm text-gray-700">{order.notes}</p>
            </div>
          )}
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Líneas del pedido</h3>
            <div className="space-y-3">
              {order.items.map((item, index) => {
                const quantity = item.quantity ?? item.toOrder ?? 0;
                const unitPrice = item.price ?? 0;
                return (
                  <div key={`${item.productId}-${index}`} className="border rounded-lg p-4 hover:shadow-sm transition-shadow bg-white">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-indigo-100 text-indigo-700 font-semibold rounded-full w-6 h-6 flex items-center justify-center text-xs">{index + 1}</span>
                          <h3 className="font-semibold text-gray-900">{item.productName || 'N/A'}</h3>
                        </div>
                        <p className="text-xs text-gray-500">{item.sku}</p>
                      </div>
                      <div className="text-right ml-4 space-y-1">
                        <div className="text-sm text-gray-600">{quantity} × ${unitPrice.toFixed(2)}</div>
                        <div className="font-semibold text-gray-900">${(quantity * unitPrice).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="planogram" className="p-6 mt-0">
          <OrderPlanogramView
            order={
              {
                id: order.id,
                backendOrderId: (order as any).backendOrderId,
                salespersonId: (order as any).salespersonId ?? '',
                storeId: (order as any).storeId ?? '',
                createdAt: order.date ? new Date(order.date) : new Date(),
                po: (order as any).po ?? order.id,
                status: order.status === 'invoiced' || order.status === 'completed' ? 'completed' : 'pending',
                storeName: order.storeName,
                subtotal: displaySubtotal,
                total: displayTotal,
                items: (order.items || []).map((it: any) => ({
                  id: it.id ?? '',
                  orderId: order.id,
                  productId: it.productId ?? it.sku ?? '',
                  quantity: it.quantity ?? it.toOrder ?? 0,
                  productName: it.productName,
                  unitPrice: Number(it.price) || 0,
                  subtotal: (it.quantity ?? it.toOrder ?? 0) * (Number(it.price) || 0),
                  status: 'pending',
                })),
                updatedAt: new Date(),
              } as Order
            }
          />
        </TabsContent>

        <TabsContent value="invoice" className="p-6 mt-0">
          {(() => {
            const invFromApi = invoiceDisplay?.items?.length ? invoiceDisplay : null;
            const invFromOrder =
              order.items?.length && !invFromApi
                ? {
                    invoiceNumber: order.id,
                    date: order.date,
                    total: displayTotal,
                    subtotal: displaySubtotal,
                    items: order.items.map((it: any) => {
                      const q = it.quantity ?? it.toOrder ?? 0;
                      const p = Number(it.price) || 0;
                      return { qty: q, code: it.sku || '', description: it.productName || '—', price: p, amount: q * p };
                    }),
                  }
                : null;
            const inv = invFromApi ?? invFromOrder;
            if (!inv || !inv.items.length) {
              return (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 ml-2">Este pedido no tiene líneas ni factura en la API.</AlertDescription>
                </Alert>
              );
            }
            const invoiceDateStr = typeof inv.date === 'string' ? inv.date : inv.date ? String(inv.date) : new Date().toISOString();
            return (
              <Card className="border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
                <CardHeader className="px-4 pt-4 pb-2 print:hidden">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Factura</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                      <Download className="h-4 w-4" />
                      Imprimir / Descargar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Invoice
                    invoiceNumber={String(inv.invoiceNumber)}
                    date={formatInvoiceDate(invoiceDateStr)}
                    vendorName={sellerNameDisplay}
                    storeName={storeNameDisplay || order.storeName || '—'}
                    storeAddress={storeAddressDisplay || order.storeAddress || ''}
                    items={inv.items.map((it: any) => ({
                      qty: it.qty,
                      code: it.code,
                      description: it.description,
                      price: Number(it.price) || 0,
                      amount: Number(it.amount) ?? it.qty * (Number(it.price) || 0),
                    }))}
                    comments={order.comments}
                  />
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        <TabsContent value="pod" className="p-6 mt-0">
          <Card className="border-slate-200 overflow-hidden">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Comprobante de entrega (POD)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {isPending && (
                <Alert className="mb-4 border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    Deberían ser los vendedores quienes carguen el POD. Use esta opción solo si es necesario (por ejemplo, apoyo administrativo).
                  </AlertDescription>
                </Alert>
              )}
              {displayPod ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <p className="text-xs text-slate-500">Comprobante registrado</p>
                  </div>
                  {isPodPath && <p className="text-xs text-slate-500 font-mono break-all">{displayPod}</p>}
                  {podImageUrl && (
                    <div className="relative w-full max-w-2xl mx-auto rounded-lg border border-slate-200 overflow-hidden bg-slate-50 min-h-[280px] flex items-center justify-center p-2">
                      {podImageError ? (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                          <p className="text-sm text-amber-700 mb-1">No se pudo cargar la imagen</p>
                          <p className="text-xs text-slate-500 mb-2">Ruta: {displayPod}</p>
                          <a href={podImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline break-all">Abrir enlace</a>
                        </div>
                      ) : (
                        <img
                          key={podImageUrl}
                          src={podImageUrl}
                          alt="Comprobante de entrega (POD)"
                          className="w-full max-w-full max-h-[520px] object-contain"
                          style={{ minHeight: '280px' }}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          onLoad={() => setPodImageError(false)}
                          onError={() => setPodImageError(true)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : null}
              {displayPod && canUploadPod && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    onClick={handleUploadPodClick}
                    disabled={uploadingPod}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingPod ? 'Subiendo…' : 'Reemplazar POD'}
                  </Button>
                </div>
              )}
              {!displayPod && (
                <>
                  {canUploadPod ? (
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        onClick={handleUploadPodClick}
                        disabled={uploadingPod}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingPod ? 'Subiendo…' : 'Cargar POD'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Este pedido no tiene un POD registrado en la factura del backend.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
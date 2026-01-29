import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Badge } from '@/shared/components/base/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import { 
  ShoppingCart,
  FileText,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  Image as ImageIcon,
  Download,
  Upload
} from 'lucide-react';
import { getFromLocalStorage } from '@/shared/services/database';
import { Order, OrderItem, Product, Invoice, POD } from '@/shared/types';
import { InvoicePreview } from './components/InvoicePreview';
import { handleDownloadInvoicePDF, handleUploadPODImage, handleDownloadPODImage } from './services/orderDetailHelpers';

interface OrderDetailViewProps {
  orderId: string;
}

export function OrderDetailView({ orderId }: OrderDetailViewProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [relatedInvoice, setRelatedInvoice] = useState<Invoice | null>(null);
  const [relatedPOD, setRelatedPOD] = useState<POD | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadOrderAndRelatedData();
  }, [orderId]);

  const loadOrderAndRelatedData = () => {
    const orders = getFromLocalStorage('app-orders') || [];
    const foundOrder = orders.find((o: Order) => o.id === orderId);
    setOrder(foundOrder || null);

    if (!foundOrder) return;

    const invoices = getFromLocalStorage('app-invoices') || [];
    const pods = getFromLocalStorage('app-pods') || [];
    const productsData = getFromLocalStorage('app-products') || [];

    const invoice = invoices.find((inv: Invoice) => inv.orderId === foundOrder.id);
    setRelatedInvoice(invoice || null);

    if (invoice && invoice.podId) {
      const pod = pods.find((p: POD) => p.id === invoice.podId);
      setRelatedPOD(pod || null);
    }

    setProducts(productsData);
  };

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Cargando pedido...</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Completado', color: 'bg-green-100 text-green-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getProductDetails = (item: OrderItem) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return { hasVariants: false, variantInfo: null };

    const hasVariants = product.variants && product.variants.length > 0;
    const variant = hasVariants ? product.variants?.find(v => v.id === item.variantId) : null;

    return { hasVariants, variant, product };
  };

  return (
    <div className="space-y-0">
      {/* Header Compacto y Profesional */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-t-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Pedido #{order.po}</h2>
              <p className="text-blue-100 text-sm mt-1">
                Creado el {new Date(order.createdAt).toLocaleDateString('es-ES', { 
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
              <span className="text-3xl font-bold">€{(order.total || 0).toFixed(2)}</span>
            </div>
            <div className="inline-flex bg-white/90 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
              {order.status === 'pending' && 'Pendiente'}
              {order.status === 'completed' && 'Completado'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Simples */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="w-full justify-start h-auto p-0 bg-gray-50 border-b rounded-none">
          <TabsTrigger 
            value="info" 
            className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600"
          >
            <Package className="h-4 w-4" />
            Información
          </TabsTrigger>
          <TabsTrigger 
            value="products" 
            className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600"
          >
            <ShoppingCart className="h-4 w-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger 
            value="invoice" 
            className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600"
          >
            <FileText className="h-4 w-4" />
            Factura
          </TabsTrigger>
          <TabsTrigger 
            value="pod" 
            className="flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600"
          >
            <ImageIcon className="h-4 w-4" />
            POD
          </TabsTrigger>
        </TabsList>

        {/* Tab: Información General */}
        <TabsContent value="info" className="p-6 space-y-0 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Detalles del Pedido */}
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Detalles del Pedido</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Vendedor:</span>
                  <span className="font-medium text-gray-900">{order.sellerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Tienda:</span>
                  <span className="font-medium text-gray-900">{order.storeName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Planograma:</span>
                  <span className="font-medium text-gray-900">{order.planogramName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Estado:</span>
                  {getStatusBadge(order.status)}
                </div>
                {order.deliveredAt && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-gray-600 text-sm">Fecha Entrega:</span>
                    <span className="font-medium text-green-600 text-sm">
                      {new Date(order.deliveredAt).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Resumen Financiero */}
            <div className="bg-green-50 rounded-lg p-5 border border-green-100">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Resumen Financiero</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Productos:</span>
                  <span className="font-medium text-gray-900">
                    {(order.items || []).length} items
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Cantidad:</span>
                  <span className="font-medium text-gray-900">
                    {(order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)} unidades
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Subtotal:</span>
                  <span className="font-medium text-gray-900">
                    €{(order.subtotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-green-200">
                  <span className="text-gray-900 font-semibold">TOTAL:</span>
                  <span className="text-xl font-bold text-green-600">
                    €{(order.total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notas del Pedido */}
          {order.notes && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 mt-4">
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">Notas del Pedido</h4>
              <p className="text-sm text-gray-700">{order.notes}</p>
            </div>
          )}
        </TabsContent>

        {/* Tab: Productos */}
        <TabsContent value="products" className="p-6 mt-0">
          <div className="space-y-3">
            {order.items.map((item, index) => {
              const { hasVariants, variant } = getProductDetails(item);
              return (
                <div 
                  key={item.id} 
                  className="border rounded-lg p-4 hover:shadow-sm transition-shadow bg-white"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-indigo-100 text-indigo-700 font-semibold rounded-full w-6 h-6 flex items-center justify-center text-xs">
                          {index + 1}
                        </span>
                        <h3 className="font-semibold text-gray-900">{item.productName || 'N/A'}</h3>
                      </div>
                      
                      {hasVariants && variant && (
                        <div className="ml-8 text-sm text-gray-600">
                          Variante: <span className="font-medium">{variant.name}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right ml-4 space-y-1">
                      <div className="text-sm text-gray-600">
                        {item.quantity} × €{(item.unitPrice || 0).toFixed(2)}
                      </div>
                      <div className="font-semibold text-gray-900">
                        €{(item.subtotal || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab: Factura */}
        <TabsContent value="invoice" className="p-6 mt-0">
          {relatedInvoice ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button 
                  onClick={() => handleDownloadInvoicePDF(relatedInvoice, order)} 
                  className="bg-green-600 hover:bg-green-700 gap-2"
                >
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </Button>
              </div>
              <InvoicePreview invoice={relatedInvoice} order={order} companyName="TU EMPRESA" />
            </div>
          ) : (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 ml-2">
                Este pedido aún no tiene una factura asociada. La factura se genera automáticamente cuando el pedido es procesado.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Tab: POD */}
        <TabsContent value="pod" className="p-6 mt-0">
          {relatedPOD ? (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline"
                  onClick={() => handleUploadPODImage(
                    relatedInvoice!.id,
                    order.id,
                    loadRelatedData
                  )}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Actualizar Imagen
                </Button>
                <Button 
                  onClick={() => handleDownloadPODImage(relatedPOD)}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-600 font-medium mb-1">Fecha de Entrega</p>
                  <p className="font-semibold text-gray-900 text-sm">
                    {new Date(relatedPOD.deliveryDate).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                  <p className="text-xs text-green-600 font-medium mb-1">Estado</p>
                  <div>
                    {relatedPOD.isValidated ? (
                      <span className="text-sm font-semibold text-green-700">Validado</span>
                    ) : (
                      <span className="text-sm font-semibold text-yellow-700">Pendiente</span>
                    )}
                  </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                  <p className="text-xs text-purple-600 font-medium mb-1">Receptor</p>
                  <p className="font-semibold text-gray-900 text-sm">{relatedPOD.receiverName || 'No especificado'}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <img 
                  src={relatedPOD.photoUrl} 
                  alt="Comprobante de Entrega" 
                  className="w-full max-h-[500px] object-contain bg-gray-50"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Imagen+No+Disponible';
                  }}
                />
              </div>

              {relatedPOD.notes && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <p className="text-xs text-purple-600 font-medium mb-1">Notas de Entrega</p>
                  <p className="text-sm text-gray-700">{relatedPOD.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 ml-2">
                  {relatedInvoice 
                    ? 'La factura existe pero aún no se ha subido el comprobante de entrega (POD).'
                    : 'Este pedido aún no tiene un comprobante de entrega. El POD se genera después de la factura.'
                  }
                </AlertDescription>
              </Alert>
              
              {relatedInvoice && (
                <div className="flex justify-center py-6">
                  <Button 
                    onClick={() => handleUploadPODImage(
                      relatedInvoice.id,
                      order.id,
                      loadRelatedData
                    )}
                    className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Cargar Imagen del POD
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
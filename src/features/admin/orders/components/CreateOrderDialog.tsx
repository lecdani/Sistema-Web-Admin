import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Badge } from '@/shared/components/base/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/base/Select';
import { Textarea } from '@/shared/components/base/Textarea';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/base/Dialog';
import { 
  ShoppingCart, 
  Store as StoreIcon, 
  User as UserIcon, 
  Package, 
  Minus, 
  Plus, 
  X,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { Store, User, Product, Planogram, Distribution, Order, OrderItem, Invoice, POD } from '@/shared/types';
import { planogramsApi } from '@/shared/services/planograms-api';
import { distributionsApi } from '@/shared/services/distributions-api';
import { productsApi } from '@/shared/services/products-api';
import { toast } from 'sonner';
import { InvoicePreview } from './InvoicePreview';
import { handleUploadPODImage } from '../services/orderDetailHelpers';

interface CreateOrderDialogProps {
  onClose: () => void;
  onOrderCreated: () => void;
  editingOrder?: Order | null; // Nuevo: Para modo edición
}

interface ProductQuantity {
  productId: string;
  product: Product;
  quantity: number;
  position: { x: number; y: number };
}

interface GridCell {
  x: number;
  y: number;
  product: Product | null;
  productId: string | null;
  quantity: number;
}

const GRID_SIZE = 10;

export function CreateOrderDialog({ onClose, onOrderCreated, editingOrder }: CreateOrderDialogProps) {
  const { translate } = useLanguage();
  const [stores, setStores] = useState<Store[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [planograms, setPlanograms] = useState<Planogram[]>([]);
  const [activePlanogram, setActivePlanogram] = useState<Planogram | null>(null);
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'select' | 'review' | 'confirm'>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string>('');
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string>('');
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [tempQuantity, setTempQuantity] = useState<string>('0');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPODModal, setShowPODModal] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [isOrderDataLoaded, setIsOrderDataLoaded] = useState(false); // Nuevo flag

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Si estamos en modo edición y aún no se han cargado los datos del pedido
    if (editingOrder && grid.length > 0 && !isOrderDataLoaded) {
      loadOrderData();
    }
  }, [editingOrder, grid.length, isOrderDataLoaded]);

  const loadData = async () => {
    try {
      const storesData = getFromLocalStorage('app-stores') || [];
      const usersData = getFromLocalStorage('app-users') || [];
      let planogramsData: Planogram[] = [];
      let productsData: Product[] = [];
      try {
        planogramsData = await planogramsApi.fetchAll();
        productsData = await productsApi.fetchAll();
      } catch {
        planogramsData = getFromLocalStorage('app-planograms') || [];
        productsData = getFromLocalStorage('app-products') || [];
      }

      const activeStores = storesData.filter((s: Store) => s.isActive);
      setStores(activeStores);
      const activeSellers = usersData.filter(
        (u: User) => u.role === 'user' && u.isActive
      );
      setSellers(activeSellers);

      const activePlan = planogramsData.find((p: Planogram) => p.isActive);
      if (!activePlan) {
        toast.error(translate('noActivePlanogram'));
        return;
      }
      setActivePlanogram(activePlan);

      let planDistributions: Distribution[] = [];
      try {
        planDistributions = await distributionsApi.getByPlanogram(activePlan.id);
      } catch {
        const allDist = getFromLocalStorage('app-distributions') || [];
        planDistributions = allDist.filter((d: Distribution) => d.planogramId === activePlan.id);
      }

      // Crear lista de productos con cantidades iniciales
      const productsWithQty: ProductQuantity[] = planDistributions.map(
        (dist: Distribution) => {
          const product = productsData.find((p: Product) => p.id === dist.productId);
          return {
            productId: dist.productId,
            product: product || {
              id: dist.productId,
              name: translate('productNotFound'),
              currentPrice: 0,
              sku: '',
              category: '',
              isActive: false
            },
            quantity: 0,
            position: { x: dist.xPosition, y: dist.yPosition }
          };
        }
      );

      // Inicializar la cuadrícula
      const initialGrid: GridCell[][] = Array.from({ length: GRID_SIZE }, (_, y) =>
        Array.from({ length: GRID_SIZE }, (_, x) => ({
          x: x,
          y: y,
          product: null,
          productId: null,
          quantity: 0
        }))
      );

      productsWithQty.forEach((pq) => {
        const cell = initialGrid[pq.position.y][pq.position.x];
        cell.product = pq.product;
        cell.productId = pq.productId;
        cell.quantity = pq.quantity;
      });

      setGrid(initialGrid);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error(translate('errorLoadData'));
    }
  };

  const loadOrderData = () => {
    if (!editingOrder) return;

    // Cargar datos del pedido existente
    setSelectedStoreId(editingOrder.storeId);
    setSelectedSellerId(editingOrder.salespersonId);
    setNotes(editingOrder.notes || '');

    // Cargar cantidades de los items del pedido en el grid
    const updatedGrid = grid.map((row) =>
      row.map((cell) => {
        if (cell.productId) {
          const orderItem = editingOrder.items?.find(
            (item) => item.productId === cell.productId
          );
          if (orderItem) {
            return { ...cell, quantity: orderItem.quantity };
          }
        }
        return cell;
      })
    );
    setGrid(updatedGrid);
    setIsOrderDataLoaded(true); // Marcar que los datos del pedido están cargados
  };

  const updateQuantity = (x: number, y: number, delta: number) => {
    setGrid((prev) =>
      prev.map((row) =>
        row.map((cell) => {
          if (cell.x === x && cell.y === y) {
            const newQty = Math.max(0, cell.quantity + delta);
            return { ...cell, quantity: newQty };
          }
          return cell;
        })
      )
    );
  };

  const setQuantity = (x: number, y: number, value: string) => {
    const qty = parseInt(value) || 0;
    if (qty < 0) return;

    setGrid((prev) =>
      prev.map((row) =>
        row.map((cell) =>
          cell.x === x && cell.y === y ? { ...cell, quantity: Math.max(0, qty) } : cell
        )
      )
    );
  };

  const getSelectedItems = () => {
    return grid.flat().filter((cell) => cell.quantity > 0);
  };

  const calculateSubtotal = () => {
    return getSelectedItems().reduce(
      (sum, cell) => sum + cell.product!.currentPrice * cell.quantity,
      0
    );
  };

  const calculateTotal = () => {
    return calculateSubtotal(); // Por ahora sin impuestos adicionales
  };

  const canProceedToReview = () => {
    return (
      selectedStoreId &&
      selectedSellerId &&
      getSelectedItems().length > 0
    );
  };

  const handleReview = () => {
    if (!canProceedToReview()) {
      toast.error(translate('completeFieldsAndProducts'));
      return;
    }
    setCurrentStep('review');
  };

  const handleConfirmOrder = async () => {
    if (!activePlanogram) {
      toast.error(translate('noActivePlanogramShort'));
      return;
    }

    setIsLoading(true);

    try {
      if (editingOrder) {
        // Modo edición
        await handleUpdateOrder();
      } else {
        // Modo creación
        await handleCreateOrder();
      }
    } catch (error) {
      console.error('Error procesando pedido:', error);
      toast.error(translate('errorProcessOrder'));
      setIsLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    const selectedItems = getSelectedItems();
    const subtotal = calculateSubtotal();
    const total = calculateTotal();

    // Generar ID único para el pedido
    const orderId = `order_${Date.now()}`;
    const orderNumber = `PED-${new Date().getFullYear()}-${String(
      (getFromLocalStorage('app-orders') || []).length + 1
    ).padStart(3, '0')}`;

    // Crear items del pedido
    const orderItems: OrderItem[] = selectedItems.map((cell, index) => ({
      id: `item_${orderId}_${index}`,
      orderId: orderId,
      productId: cell.productId!,
      quantity: cell.quantity,
      unitPrice: cell.product!.currentPrice,
      subtotal: cell.product!.currentPrice * cell.quantity,
      status: 'pending'
    }));

    // Obtener información de la tienda para el pedido
    const selectedStore = stores.find((s) => s.id === selectedStoreId);

    // Crear el pedido
    const newOrder: Order = {
      id: orderId,
      po: orderNumber,
      storeId: selectedStoreId,
      storeName: selectedStore?.name,
      salespersonId: selectedSellerId,
      status: 'pending',
      planogramId: activePlanogram!.id,
      subtotal: subtotal,
      total: total,
      notes: notes,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: orderItems
    };

    // Guardar el pedido
    const orders = getFromLocalStorage('app-orders') || [];
    orders.push(newOrder);
    setToLocalStorage('app-orders', orders);

    // Crear la factura automáticamente
    const invoiceId = `invoice_${Date.now()}`;
    const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(
      (getFromLocalStorage('app-invoices') || []).length + 1
    ).padStart(3, '0')}`;

    const currentUser = getFromLocalStorage('current-user');
    const invoiceItems = selectedItems.map((cell, index) => ({
      id: `inv_item_${invoiceId}_${index}`,
      invoiceId: invoiceId,
      productId: cell.productId!,
      quantity: cell.quantity,
      unitPrice: cell.product!.currentPrice,
      subtotal: cell.product!.currentPrice * cell.quantity
    }));

    const newInvoice: Invoice = {
      id: invoiceId,
      invoiceNumber: invoiceNumber,
      orderId: orderId,
      storeId: selectedStoreId,
      sellerId: selectedSellerId,
      status: 'draft',
      generationType: 'automatic',
      subtotal: subtotal,
      taxes: subtotal * 0.21, // 21% IVA
      total: subtotal * 1.21,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: currentUser?.id || '1',
      items: invoiceItems
    };

    // Guardar la factura
    const invoices = getFromLocalStorage('app-invoices') || [];
    invoices.push(newInvoice);
    setToLocalStorage('app-invoices', invoices);

    setCreatedOrderId(orderId);
    setCreatedInvoiceId(invoiceId);
    setCreatedInvoice(newInvoice);
    setCreatedOrder(newOrder);
    
    setCurrentStep('confirm');
    setIsLoading(false);
    toast.success(translate('orderAndInvoiceCreated'));
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;

    const selectedItems = getSelectedItems();
    const subtotal = calculateSubtotal();
    const total = calculateTotal();

    // Actualizar items del pedido
    const orderItems: OrderItem[] = selectedItems.map((cell, index) => ({
      id: `item_${editingOrder.id}_${index}`,
      orderId: editingOrder.id,
      productId: cell.productId!,
      quantity: cell.quantity,
      unitPrice: cell.product!.currentPrice,
      subtotal: cell.product!.currentPrice * cell.quantity,
      status: 'pending'
    }));

    // Obtener información de la tienda para el pedido
    const selectedStore = stores.find((s) => s.id === selectedStoreId);

    // Actualizar el pedido
    const updatedOrder: Order = {
      ...editingOrder,
      storeId: selectedStoreId,
      storeName: selectedStore?.name,
      salespersonId: selectedSellerId,
      planogramId: activePlanogram!.id,
      subtotal: subtotal,
      total: total,
      notes: notes,
      updatedAt: new Date(),
      items: orderItems
    };

    // Guardar el pedido actualizado
    const orders = getFromLocalStorage('app-orders') || [];
    const orderIndex = orders.findIndex((o: Order) => o.id === editingOrder.id);
    if (orderIndex !== -1) {
      orders[orderIndex] = updatedOrder;
      setToLocalStorage('app-orders', orders);
    }

    // Actualizar la factura asociada
    const invoices = getFromLocalStorage('app-invoices') || [];
    const invoiceIndex = invoices.findIndex((inv: Invoice) => inv.orderId === editingOrder.id);
    
    if (invoiceIndex !== -1) {
      const existingInvoice = invoices[invoiceIndex];
      const currentUser = getFromLocalStorage('current-user');
      
      const updatedInvoiceItems = selectedItems.map((cell, index) => ({
        id: `inv_item_${existingInvoice.id}_${index}`,
        invoiceId: existingInvoice.id,
        productId: cell.productId!,
        quantity: cell.quantity,
        unitPrice: cell.product!.currentPrice,
        subtotal: cell.product!.currentPrice * cell.quantity
      }));

      const updatedInvoice: Invoice = {
        ...existingInvoice,
        storeId: selectedStoreId,
        sellerId: selectedSellerId,
        subtotal: subtotal,
        taxes: subtotal * 0.21,
        total: subtotal * 1.21,
        updatedAt: new Date(),
        items: updatedInvoiceItems
      };

      invoices[invoiceIndex] = updatedInvoice;
      setToLocalStorage('app-invoices', invoices);

      setCreatedInvoice(updatedInvoice);
    }

    setCreatedOrder(updatedOrder);
    setCreatedOrderId(editingOrder.id);
    setCreatedInvoiceId(invoices[invoiceIndex]?.id || '');
    
    setIsLoading(false);
    toast.success(translate('orderAndInvoiceUpdated'));
    onOrderCreated();
    onClose();
  };

  const handleUploadPOD = () => {
    toast.info(translate('podFeatureComing'));
    onOrderCreated();
    onClose();
  };

  const handleViewInvoice = () => {
    toast.info(translate('navigatingToInvoices'));
    onOrderCreated();
    onClose();
  };

  const handleCloseSuccess = () => {
    onOrderCreated();
    onClose();
  };

  // Renderizado según el paso actual
  if (currentStep === 'confirm') {
    return (
      <>
        <div className="p-6">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {translate('orderCreatedSuccess')}
              </h2>
              <p className="text-gray-600">
                {translate('orderAndInvoiceGenerated')}
              </p>
            </div>

            {/* 3 Cards Clickeables */}
            <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
              {/* Card 1: Estado del Pedido */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-blue-200 hover:border-blue-400"
                onClick={() => {
                  toast.info(translate('orderViewComing'));
                }}
              >
                <CardContent className="p-6 text-center">
                  <ShoppingCart className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-2">{translate('orderStatus')}</p>
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    {translate('pendingStatus')}
                  </Badge>
                </CardContent>
              </Card>

              {/* Card 2: Ver Factura */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-green-200 hover:border-green-400"
                onClick={() => setShowInvoiceModal(true)}
              >
                <CardContent className="p-6 text-center">
                  <FileText className="h-10 w-10 text-green-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-2">{translate('invoiceLabel')}</p>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    {translate('viewInvoice')}
                  </Badge>
                </CardContent>
              </Card>

              {/* Card 3: Subir POD */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-purple-200 hover:border-purple-400"
                onClick={() => setShowPODModal(true)}
              >
                <CardContent className="p-6 text-center">
                  <ImageIcon className="h-10 w-10 text-purple-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-2">POD</p>
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                    {translate('uploadPod')}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {translate('orderPendingUntilPod')}
              </AlertDescription>
            </Alert>
          </div>
        </div>

        {/* Modal Ver Factura */}
        <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
          <DialogContent className="!w-[70vw] !max-w-[1200px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
<DialogTitle>{translate('invoiceLabel')} {createdInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
                {translate('invoicePreviewDesc')}
              </DialogDescription>
            </DialogHeader>
            {createdInvoice && createdOrder && (
              <InvoicePreview invoice={createdInvoice} order={createdOrder} />
            )}
          </DialogContent>
        </Dialog>

        {/* Modal Subir POD */}
        <Dialog open={showPODModal} onOpenChange={setShowPODModal}>
          <DialogContent className="!w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{translate('uploadPodTitleFull')}</DialogTitle>
              <DialogDescription>
                {translate('uploadPodDesc')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  {translate('onceUploadPodCompleted')}
                </AlertDescription>
              </Alert>

              <div className="flex justify-center py-6">
                <Button 
                  onClick={() => {
                    if (createdInvoiceId && createdOrderId) {
                      handleUploadPODImage(
                        createdInvoiceId,
                        createdOrderId,
                        () => {
                          setShowPODModal(false);
                          toast.success(translate('podUploadedSuccess'));
                          onOrderCreated();
                          onClose();
                        }
                      );
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                  size="lg"
                >
                  <Upload className="h-5 w-5" />
                  {translate('selectPODImage')}
                </Button>
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>{translate('supportedFormats')}</p>
                <p>{translate('maxSize')}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (currentStep === 'review') {
    const selectedItems = getSelectedItems();
    const selectedStore = stores.find((s) => s.id === selectedStoreId);
    const selectedSeller = sellers.find((s) => s.id === selectedSellerId);

    return (
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header fijo */}
        <div className="p-6 pb-4 border-b bg-white flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {translate('reviewOrder')}
          </h2>
          <p className="text-gray-600">
            {translate('verifyBeforeConfirm')}
          </p>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Información del pedido */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <StoreIcon className="h-4 w-4" />
                  {translate('storeLabel')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{selectedStore?.name}</p>
                <p className="text-sm text-gray-500">{selectedStore?.address}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  {translate('sellerLabel')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">
                  {selectedSeller?.firstName} {selectedSeller?.lastName}
                </p>
                <p className="text-sm text-gray-500">{selectedSeller?.email}</p>
              </CardContent>
            </Card>
          </div>

          {/* Productos seleccionados */}
          <Card>
            <CardHeader>
              <CardTitle>{translate('orderProducts')}</CardTitle>
              <CardDescription>
                {translate('productsSelectedCount').replace('{n}', String(selectedItems.length))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Lista de productos con scroll si hay muchos */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {selectedItems.map((cell) => (
                  <div
                    key={cell.productId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-blue-100 rounded flex-shrink-0">
                        <Package className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {cell.product!.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {cell.product!.sku} • {cell.product!.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="font-medium text-gray-900 whitespace-nowrap">
                        {cell.quantity} × €{cell.product!.currentPrice.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600 whitespace-nowrap">
                        {translate('subtotal')}: €{(cell.quantity * cell.product!.currentPrice).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="mt-6 pt-6 border-t space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>{translate('subtotal')}:</span>
                  <span>€{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{translate('iva21')}:</span>
                  <span>€{(calculateSubtotal() * 0.21).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                  <span>{translate('totalCol')}:</span>
                  <span>€{(calculateTotal() * 1.21).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          {notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{translate('orderNotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-h-32 overflow-y-auto">
                  <p className="text-gray-700 whitespace-pre-wrap break-words">{notes}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Información importante */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {translate('confirmCreatesOrder')}
            </AlertDescription>
          </Alert>
        </div>

        {/* Botones fijos en el footer */}
        <div className="flex gap-3 justify-end p-6 pt-4 border-t bg-white flex-shrink-0">
          <Button variant="outline" onClick={() => setCurrentStep('select')}>
            {translate('back')}
          </Button>
          <Button
            onClick={handleConfirmOrder}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? translate('creating') : translate('confirmOrder')}
          </Button>
        </div>
      </div>
    );
  }

  // Paso 1: Selección
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {translate('newOrderFromPlanogram')}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {translate('selectQuantitiesPerProduct')}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Información del pedido en una fila */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{translate('storeLabel')} *</Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder={translate('selectStore')}>
                  {stores.find((s) => s.id === selectedStoreId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    <div className="flex items-center gap-2">
                      <StoreIcon className="h-4 w-4" />
                      {store.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{translate('sellerLabel')} *</Label>
            <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
              <SelectTrigger>
                <SelectValue placeholder={translate('selectSeller')}>
                  {(() => { const s = sellers.find((x) => x.id === selectedSellerId); return s ? `${s.firstName} ${s.lastName}` : null; })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      {seller.firstName} {seller.lastName}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activePlanogram && (
            <div className="space-y-2">
              <Label>{translate('planogram')}</Label>
              <div className="flex items-center gap-2 h-10 px-3 bg-blue-50 rounded-lg border border-blue-200">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-gray-900 text-sm">{activePlanogram.name}</span>
                <Badge className="ml-auto bg-green-100 text-green-800 border-green-200 text-xs">
                  v{activePlanogram.version}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Planograma completo - área principal */}
      <div className="flex-1 overflow-auto p-8 bg-gradient-to-br from-gray-50 to-slate-50">
        <div className="flex items-center justify-between mb-4 px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">{translate('productSelection')}</span>
            <span className="text-sm text-gray-500">{translate('clickCellsToAddQuantities')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-green-200 border border-green-600 rounded"></div>
              <span>{translate('withQuantity')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-blue-100 border border-blue-600 rounded"></div>
              <span>{translate('available')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-white border border-gray-400 border-dashed rounded"></div>
              <span>{translate('empty')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-full">
          <div className="inline-block border-4 border-gray-800 bg-white shadow-2xl rounded-xl overflow-hidden">
            {/* Header con letras (A-J) */}
            <div className="flex">
              <div className="w-16 h-12 bg-gray-400 border-r-4 border-b-4 border-gray-800 flex items-center justify-center font-bold text-gray-900"></div>
              {[...Array(GRID_SIZE)].map((_, i) => (
                <div key={i} className="w-24 h-12 bg-gray-400 border-r-2 border-b-4 border-gray-800 flex items-center justify-center font-bold text-gray-900 text-lg">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>

            {/* Filas de la grilla */}
            {grid.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {/* Número de fila */}
                <div className="w-16 h-20 bg-gray-400 border-r-4 border-b-2 border-gray-800 flex items-center justify-center font-bold text-gray-900 text-lg">
                  {rowIndex + 1}
                </div>

                {/* Celdas */}
                {row.map((cell, colIndex) => {
                  const cellRef = `${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`;
                  const hasQuantity = cell.quantity > 0;
                  const hasProduct = cell.product !== null;
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-24 h-20 border-r-2 border-b-2 flex flex-col items-center justify-center relative transition-all p-1 ${
                        hasProduct
                          ? hasQuantity
                            ? 'bg-green-200 hover:bg-green-300 border-green-600 border-2'
                            : 'bg-blue-100 hover:bg-blue-200 border-blue-600'
                          : 'bg-white hover:bg-gray-50 border-gray-400 border-dashed'
                      }`}
                    >
                      {hasProduct ? (
                        <div className="text-center w-full h-full flex flex-col justify-between">
                          {/* Información del producto */}
                          <div className="flex-1 flex flex-col justify-center px-1">
                            <div className={`font-bold truncate text-[10px] leading-tight ${hasQuantity ? 'text-green-800' : 'text-blue-800'}`}>
                              {cell.product!.sku}
                            </div>
                            <div className={`text-[9px] truncate leading-tight ${hasQuantity ? 'text-green-700' : 'text-blue-600'}`}>
                              {cell.product!.name.split(' ').slice(0, 2).join(' ')}
                            </div>
                          </div>
                          
                          {/* Input de cantidad */}
                          <div className="w-full">
                            <Input
                              type="number"
                              min="0"
                              value={cell.quantity || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                const val = e.target.value;
                                setQuantity(cell.x, cell.y, val);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="0"
                              className={`h-6 text-center text-xs font-bold border-2 p-0 ${
                                hasQuantity 
                                  ? 'bg-green-50 border-green-500 text-green-900' 
                                  : 'bg-white border-blue-400 text-gray-600'
                              }`}
                              title={`${cell.product!.name}\nPrecio: €${cell.product!.currentPrice.toFixed(2)}\nCelda: ${cellRef}`}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-400 text-xs font-medium">
                          {cellRef}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer fijo con resumen y acciones */}
      <div className="border-t bg-white">
        <div className="p-6">
          <div className="flex items-center justify-between gap-6">
            {/* Notas */}
            <div className="flex-1 max-w-md">
              <Label className="mb-2 block">{translate('notesOptional')}</Label>
              <Textarea
                placeholder={translate('addOrderNotes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Resumen de productos */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">
                  {translate('productsAndUnits')
                    .replace('{n}', String(getSelectedItems().length))
                    .replace('{u}', String(getSelectedItems().reduce((sum, cell) => sum + cell.quantity, 0)))}
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">{translate('subtotal')}:</span>
                    <span className="font-medium">€{calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">{translate('iva21')}:</span>
                    <span className="font-medium">€{(calculateSubtotal() * 0.21).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t">
                    <span className="font-bold text-gray-900">Total:</span>
                    <span className="font-bold text-2xl text-blue-600">
                      €{(calculateTotal() * 1.21).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón de acción */}
              <Button
                onClick={handleReview}
                disabled={!canProceedToReview()}
                className="bg-indigo-600 hover:bg-indigo-700 h-14 px-8"
                size="lg"
              >
                <span className="flex items-center gap-2">
                  {translate('reviewOrderButton')}
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Button>
            </div>
          </div>

          {/* Mensaje de validación */}
          {!canProceedToReview() && (
            <Alert className="mt-4 bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                {!selectedStoreId || !selectedSellerId 
                  ? translate('selectStoreAndSeller') 
                  : translate('addAtLeastOneProduct')}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
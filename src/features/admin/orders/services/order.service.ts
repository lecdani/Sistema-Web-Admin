import { Order, OrderItem, Invoice, POD, Product, Store, User } from '@/shared/types';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';

/**
 * Servicio completo para gestión de pedidos
 * Incluye lógica de negocio y validaciones
 */

// Generar un número único de Purchase Order
export const generatePONumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PO-${timestamp}-${random}`;
};

// Crear un nuevo pedido
export const createOrder = (data: {
  salespersonId: string;
  storeId: string;
  planogramId?: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
}): Order => {
  const orders = getFromLocalStorage('app-orders') || [];
  const products = getFromLocalStorage('app-products') || [];
  
  // Calcular subtotal y total
  const items: OrderItem[] = data.items.map(item => {
    const product = products.find((p: Product) => p.id === item.productId);
    const subtotal = item.quantity * item.unitPrice;
    
    return {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      orderId: '', // Se asignará después
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal,
      status: 'pending' as const,
      productName: product?.name,
      productBrand: product?.category
    };
  });
  
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal; // Sin impuestos por ahora
  
  const newOrder: Order = {
    id: `order-${Date.now()}`,
    salespersonId: data.salespersonId,
    storeId: data.storeId,
    createdAt: new Date(),
    po: generatePONumber(),
    status: 'pending',
    planogramId: data.planogramId,
    subtotal,
    total,
    notes: data.notes,
    updatedAt: new Date(),
    items: items.map(item => ({ ...item, orderId: `order-${Date.now()}` }))
  };
  
  orders.push(newOrder);
  setToLocalStorage('app-orders', orders);
  
  return newOrder;
};

// Actualizar estado de un pedido
export const updateOrderStatus = (
  orderId: string,
  status: 'pending' | 'completed',
  completedAt?: Date
): Order | null => {
  const orders = getFromLocalStorage('app-orders') || [];
  const orderIndex = orders.findIndex((o: Order) => o.id === orderId);
  
  if (orderIndex === -1) {
    return null;
  }
  
  orders[orderIndex] = {
    ...orders[orderIndex],
    status,
    completedAt: completedAt || (status === 'completed' ? new Date() : orders[orderIndex].completedAt),
    updatedAt: new Date()
  };
  
  setToLocalStorage('app-orders', orders);
  return orders[orderIndex];
};

// Actualizar ítems de un pedido
export const updateOrderItems = (
  orderId: string,
  items: Array<{ productId: string; quantity: number; unitPrice: number }>
): Order | null => {
  const orders = getFromLocalStorage('app-orders') || [];
  const products = getFromLocalStorage('app-products') || [];
  const orderIndex = orders.findIndex((o: Order) => o.id === orderId);
  
  if (orderIndex === -1) return null;
  
  const updatedItems: OrderItem[] = items.map(item => {
    const product = products.find((p: Product) => p.id === item.productId);
    const subtotal = item.quantity * item.unitPrice;
    
    return {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal,
      status: 'pending' as const,
      productName: product?.name,
      productBrand: product?.category
    };
  });
  
  const subtotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal;
  
  orders[orderIndex] = {
    ...orders[orderIndex],
    items: updatedItems,
    subtotal,
    total,
    updatedAt: new Date()
  };
  
  setToLocalStorage('app-orders', orders);
  return orders[orderIndex];
};

// Obtener pedidos por vendedor
export const getOrdersBySalesperson = (salespersonId: string): Order[] => {
  const orders = getFromLocalStorage('app-orders') || [];
  return orders.filter((o: Order) => o.salespersonId === salespersonId);
};

// Obtener pedidos por tienda
export const getOrdersByStore = (storeId: string): Order[] => {
  const orders = getFromLocalStorage('app-orders') || [];
  return orders.filter((o: Order) => o.storeId === storeId);
};

// Obtener pedidos sin factura
export const getOrdersWithoutInvoice = (): Order[] => {
  const orders = getFromLocalStorage('app-orders') || [];
  const invoices = getFromLocalStorage('app-invoices') || [];
  
  return orders.filter((order: Order) => {
    return !invoices.some((invoice: Invoice) => invoice.orderId === order.id);
  });
};

// Eliminar un pedido (solo si no tiene factura)
export const deleteOrder = (orderId: string): boolean => {
  const orders = getFromLocalStorage('app-orders') || [];
  const invoices = getFromLocalStorage('app-invoices') || [];
  
  // Verificar que no tenga factura asociada
  const hasInvoice = invoices.some((invoice: Invoice) => invoice.orderId === orderId);
  if (hasInvoice) {
    throw new Error('No se puede eliminar un pedido que tiene factura asociada');
  }
  
  const filteredOrders = orders.filter((o: Order) => o.id !== orderId);
  setToLocalStorage('app-orders', filteredOrders);
  
  return true;
};

// Obtener estadísticas de pedidos
export const getOrderStats = () => {
  const orders = getFromLocalStorage('app-orders') || [];
  
  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter((o: Order) => o.status === 'pending').length,
    completedOrders: orders.filter((o: Order) => o.status === 'completed').length,
    totalRevenue: orders.reduce((sum: number, o: Order) => sum + o.total, 0),
    averageOrderValue: orders.length > 0 
      ? orders.reduce((sum: number, o: Order) => sum + o.total, 0) / orders.length 
      : 0
  };
};

// Enriquecer pedido con información relacionada
export const enrichOrder = (order: Order): Order => {
  const stores = getFromLocalStorage('app-stores') || [];
  const users = getFromLocalStorage('app-users') || [];
  const products = getFromLocalStorage('app-products') || [];
  const planograms = getFromLocalStorage('app-planograms') || [];
  
  const store = stores.find((s: Store) => s.id === order.storeId);
  const seller = users.find((u: User) => u.id === order.salespersonId);
  const planogram = planograms.find((p: any) => p.id === order.planogramId);
  
  return {
    ...order,
    storeName: store?.name || 'Tienda no encontrada',
    sellerName: `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim() || 'Vendedor no encontrado',
    planogramName: planogram?.name || 'Sin planograma',
    items: order.items?.map(item => {
      const product = products.find((p: Product) => p.id === item.productId);
      return {
        ...item,
        productName: product?.name || 'Producto no encontrado',
        productBrand: product?.category || 'Sin categoría'
      };
    }) || []
  };
};
import { Invoice, InvoiceItem, Order, POD, Product, Store, User } from '@/shared/types';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';

/**
 * Servicio completo para gestión de facturas
 * Incluye lógica de negocio y validaciones
 */

// Generar un número único de factura
export const generateInvoiceNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${timestamp}-${random}`;
};

// Crear factura desde un pedido
export const createInvoiceFromOrder = (
  orderId: string,
  createdBy: string,
  generationType: 'manual' | 'automatic' = 'manual'
): Invoice => {
  const orders = getFromLocalStorage('app-orders') || [];
  const invoices = getFromLocalStorage('app-invoices') || [];
  
  const order = orders.find((o: Order) => o.id === orderId);
  if (!order) {
    throw new Error('Pedido no encontrado');
  }
  
  // Verificar que no exista ya una factura para este pedido
  const existingInvoice = invoices.find((inv: Invoice) => inv.orderId === orderId);
  if (existingInvoice) {
    throw new Error('Ya existe una factura para este pedido');
  }
  
  // Crear ítems de factura desde ítems del pedido
  const items: InvoiceItem[] = order.items.map(item => ({
    id: `inv-item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    billId: '', // Se asignará después
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
    productName: item.productName,
    productBrand: item.productBrand
  }));
  
  const subtotal = order.subtotal;
  const taxes = subtotal * 0.21; // IVA 21%
  const total = subtotal + taxes;
  
  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30); // 30 días de plazo
  
  const newInvoice: Invoice = {
    id: `invoice-${Date.now()}`,
    orderId,
    invoiceNumber: generateInvoiceNumber(),
    createdAt: issueDate,
    total,
    storeId: order.storeId,
    sellerId: order.salespersonId,
    status: 'draft',
    generationType,
    subtotal,
    taxes,
    issueDate,
    dueDate,
    updatedAt: new Date(),
    createdBy,
    items: items.map(item => ({ ...item, billId: `invoice-${Date.now()}` }))
  };
  
  invoices.push(newInvoice);
  setToLocalStorage('app-invoices', invoices);
  
  return newInvoice;
};

// Crear factura manualmente (sin pedido previo)
export const createManualInvoice = (data: {
  storeId: string;
  sellerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  createdBy: string;
  notes?: string;
}): Invoice => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  const products = getFromLocalStorage('app-products') || [];
  
  const items: InvoiceItem[] = data.items.map(item => {
    const product = products.find((p: Product) => p.id === item.productId);
    const subtotal = item.quantity * item.unitPrice;
    
    return {
      id: `inv-item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      billId: '', // Se asignará después
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal,
      productName: product?.name,
      productBrand: product?.category
    };
  });
  
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxes = subtotal * 0.21; // IVA 21%
  const total = subtotal + taxes;
  
  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  
  const newInvoice: Invoice = {
    id: `invoice-${Date.now()}`,
    orderId: '', // Sin pedido asociado
    invoiceNumber: generateInvoiceNumber(),
    createdAt: issueDate,
    total,
    storeId: data.storeId,
    sellerId: data.sellerId,
    status: 'draft',
    generationType: 'manual',
    subtotal,
    taxes,
    issueDate,
    dueDate,
    updatedAt: new Date(),
    createdBy: data.createdBy,
    items: items.map(item => ({ ...item, billId: `invoice-${Date.now()}` }))
  };
  
  invoices.push(newInvoice);
  setToLocalStorage('app-invoices', invoices);
  
  return newInvoice;
};

// Actualizar estado de una factura
export const updateInvoiceStatus = (
  invoiceId: string,
  status: 'draft' | 'sent' | 'paid' | 'cancelled',
  paidDate?: Date
): Invoice | null => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  const invoiceIndex = invoices.findIndex((inv: Invoice) => inv.id === invoiceId);
  
  if (invoiceIndex === -1) return null;
  
  invoices[invoiceIndex] = {
    ...invoices[invoiceIndex],
    status,
    paidDate: paidDate || (status === 'paid' ? new Date() : invoices[invoiceIndex].paidDate),
    updatedAt: new Date()
  };
  
  setToLocalStorage('app-invoices', invoices);
  return invoices[invoiceIndex];
};

// Vincular POD a factura
export const linkPODToInvoice = (invoiceId: string, podId: string): Invoice | null => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  const invoiceIndex = invoices.findIndex((inv: Invoice) => inv.id === invoiceId);
  
  if (invoiceIndex === -1) return null;
  
  invoices[invoiceIndex] = {
    ...invoices[invoiceIndex],
    podId,
    updatedAt: new Date()
  };
  
  setToLocalStorage('app-invoices', invoices);
  return invoices[invoiceIndex];
};

// Obtener facturas sin POD
export const getInvoicesWithoutPOD = (): Invoice[] => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  return invoices.filter((invoice: Invoice) => !invoice.podId);
};

// Obtener facturas por vendedor
export const getInvoicesBySeller = (sellerId: string): Invoice[] => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  return invoices.filter((inv: Invoice) => inv.sellerId === sellerId);
};

// Obtener facturas por tienda
export const getInvoicesByStore = (storeId: string): Invoice[] => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  return invoices.filter((inv: Invoice) => inv.storeId === storeId);
};

// Eliminar una factura (solo si no tiene POD)
export const deleteInvoice = (invoiceId: string): boolean => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  const invoice = invoices.find((inv: Invoice) => inv.id === invoiceId);
  
  if (!invoice) {
    throw new Error('Factura no encontrada');
  }
  
  if (invoice.podId) {
    throw new Error('No se puede eliminar una factura que tiene POD asociado');
  }
  
  const filteredInvoices = invoices.filter((inv: Invoice) => inv.id !== invoiceId);
  setToLocalStorage('app-invoices', filteredInvoices);
  
  return true;
};

// Generar facturas automáticas para pedidos entregados sin factura
export const generateAutomaticInvoices = (createdBy: string): Invoice[] => {
  const orders = getFromLocalStorage('app-orders') || [];
  const invoices = getFromLocalStorage('app-invoices') || [];
  
  // Encontrar pedidos entregados sin factura
  const ordersWithoutInvoice = orders.filter((order: Order) => {
    const hasInvoice = invoices.some((inv: Invoice) => inv.orderId === order.id);
    return order.status === 'completed' && !hasInvoice;
  });
  
  const newInvoices: Invoice[] = [];
  
  ordersWithoutInvoice.forEach((order: Order) => {
    try {
      const invoice = createInvoiceFromOrder(order.id, createdBy, 'automatic');
      newInvoices.push(invoice);
    } catch (error) {
      console.error(`Error creando factura para pedido ${order.id}:`, error);
    }
  });
  
  return newInvoices;
};

// Obtener estadísticas de facturas
export const getInvoiceStats = () => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  
  const total = invoices.reduce((sum: number, inv: Invoice) => sum + inv.total, 0);
  const pending = invoices
    .filter((inv: Invoice) => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum: number, inv: Invoice) => sum + inv.total, 0);
  
  return {
    totalInvoices: invoices.length,
    draftInvoices: invoices.filter((inv: Invoice) => inv.status === 'draft').length,
    sentInvoices: invoices.filter((inv: Invoice) => inv.status === 'sent').length,
    paidInvoices: invoices.filter((inv: Invoice) => inv.status === 'paid').length,
    totalAmount: total,
    pendingAmount: pending
  };
};

// Enriquecer factura con información relacionada
export const enrichInvoice = (invoice: Invoice): Invoice => {
  const stores = getFromLocalStorage('app-stores') || [];
  const users = getFromLocalStorage('app-users') || [];
  const products = getFromLocalStorage('app-products') || [];
  const orders = getFromLocalStorage('app-orders') || [];
  
  const store = stores.find((s: Store) => s.id === invoice.storeId);
  const seller = users.find((u: User) => u.id === invoice.sellerId);
  const order = orders.find((o: Order) => o.id === invoice.orderId);
  
  return {
    ...invoice,
    storeName: store?.name || 'Tienda no encontrada',
    sellerName: `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim() || 'Vendedor no encontrado',
    orderNumber: order?.po || 'Sin pedido',
    items: invoice.items?.map(item => {
      const product = products.find((p: Product) => p.id === item.productId);
      return {
        ...item,
        productName: product?.name || 'Producto no encontrado',
        productBrand: product?.category || 'Sin categoría'
      };
    }) || []
  };
};
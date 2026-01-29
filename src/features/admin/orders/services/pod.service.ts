import { POD, Invoice, Order, Store, User, IntegrityIssue } from '@/shared/types';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';

/**
 * Servicio completo para gestión de PODs (Proof of Delivery)
 * Incluye lógica de negocio y validaciones
 */

// Crear un POD desde una factura
export const createPODFromInvoice = (data: {
  invoiceId: string;
  imageUrl: string;
  uploadedBy: string;
  notes?: string;
}): POD => {
  const invoices = getFromLocalStorage('app-invoices') || [];
  const orders = getFromLocalStorage('app-orders') || [];
  const pods = getFromLocalStorage('app-pods') || [];
  
  const invoice = invoices.find((inv: Invoice) => inv.id === data.invoiceId);
  if (!invoice) {
    throw new Error('Factura no encontrada');
  }
  
  // Verificar que no exista ya un POD para esta factura
  const existingPOD = pods.find((pod: POD) => pod.invoiceId === data.invoiceId);
  if (existingPOD) {
    throw new Error('Ya existe un POD para esta factura');
  }
  
  const order = orders.find((o: Order) => o.id === invoice.orderId);
  
  const newPOD: POD = {
    id: `pod-${Date.now()}`,
    salespersonId: invoice.sellerId,
    storeId: invoice.storeId,
    createdAt: new Date(),
    po: order?.po || invoice.invoiceNumber,
    status: 'completed',
    orderId: invoice.orderId,
    invoiceId: data.invoiceId,
    imageUrl: data.imageUrl,
    uploadedAt: new Date(),
    uploadedBy: data.uploadedBy,
    notes: data.notes,
    isValidated: false
  };
  
  pods.push(newPOD);
  setToLocalStorage('app-pods', pods);
  
  // Actualizar la factura con el POD
  const invoiceIndex = invoices.findIndex((inv: Invoice) => inv.id === data.invoiceId);
  if (invoiceIndex !== -1) {
    invoices[invoiceIndex].podId = newPOD.id;
    setToLocalStorage('app-invoices', invoices);
  }
  
  return newPOD;
};

// Crear un POD manual (sin factura previa)
export const createManualPOD = (data: {
  salespersonId: string;
  storeId: string;
  po: string;
  imageUrl: string;
  uploadedBy: string;
  notes?: string;
}): POD => {
  const pods = getFromLocalStorage('app-pods') || [];
  
  const newPOD: POD = {
    id: `pod-${Date.now()}`,
    salespersonId: data.salespersonId,
    storeId: data.storeId,
    createdAt: new Date(),
    po: data.po,
    status: 'completed',
    imageUrl: data.imageUrl,
    uploadedAt: new Date(),
    uploadedBy: data.uploadedBy,
    notes: data.notes,
    isValidated: false
  };
  
  pods.push(newPOD);
  setToLocalStorage('app-pods', pods);
  
  return newPOD;
};

// Validar un POD
export const validatePOD = (podId: string, validatedBy: string): POD | null => {
  const pods = getFromLocalStorage('app-pods') || [];
  const podIndex = pods.findIndex((p: POD) => p.id === podId);
  
  if (podIndex === -1) return null;
  
  pods[podIndex] = {
    ...pods[podIndex],
    isValidated: true,
    validatedAt: new Date(),
    validatedBy
  };
  
  setToLocalStorage('app-pods', pods);
  return pods[podIndex];
};

// Invalidar un POD
export const invalidatePOD = (podId: string): POD | null => {
  const pods = getFromLocalStorage('app-pods') || [];
  const podIndex = pods.findIndex((p: POD) => p.id === podId);
  
  if (podIndex === -1) return null;
  
  pods[podIndex] = {
    ...pods[podIndex],
    isValidated: false,
    validatedAt: undefined,
    validatedBy: undefined
  };
  
  setToLocalStorage('app-pods', pods);
  return pods[podIndex];
};

// Actualizar estado del POD
export const updatePODStatus = (
  podId: string,
  status: 'pending' | 'completed'
): POD | null => {
  const pods = getFromLocalStorage('app-pods') || [];
  const podIndex = pods.findIndex((p: POD) => p.id === podId);
  
  if (podIndex === -1) {
    return null;
  }
  
  pods[podIndex] = {
    ...pods[podIndex],
    status,
    updatedAt: new Date()
  };
  
  setToLocalStorage('app-pods', pods);
  return pods[podIndex];
};

// Obtener PODs por vendedor
export const getPODsBySalesperson = (salespersonId: string): POD[] => {
  const pods = getFromLocalStorage('app-pods') || [];
  return pods.filter((pod: POD) => pod.salespersonId === salespersonId);
};

// Obtener PODs por tienda
export const getPODsByStore = (storeId: string): POD[] => {
  const pods = getFromLocalStorage('app-pods') || [];
  return pods.filter((pod: POD) => pod.storeId === storeId);
};

// Obtener PODs sin validar
export const getUnvalidatedPODs = (): POD[] => {
  const pods = getFromLocalStorage('app-pods') || [];
  return pods.filter((pod: POD) => !pod.isValidated);
};

// Eliminar un POD
export const deletePOD = (podId: string): boolean => {
  const pods = getFromLocalStorage('app-pods') || [];
  const invoices = getFromLocalStorage('app-invoices') || [];
  
  const pod = pods.find((p: POD) => p.id === podId);
  if (!pod) {
    throw new Error('POD no encontrado');
  }
  
  // Desvincular de la factura si existe
  if (pod.invoiceId) {
    const invoiceIndex = invoices.findIndex((inv: Invoice) => inv.id === pod.invoiceId);
    if (invoiceIndex !== -1) {
      invoices[invoiceIndex].podId = undefined;
      setToLocalStorage('app-invoices', invoices);
    }
  }
  
  const filteredPods = pods.filter((p: POD) => p.id !== podId);
  setToLocalStorage('app-pods', filteredPods);
  
  return true;
};

// Verificar integridad del flujo Pedido -> Factura -> POD
export const checkIntegrity = (): IntegrityIssue[] => {
  const orders = getFromLocalStorage('app-orders') || [];
  const invoices = getFromLocalStorage('app-invoices') || [];
  const pods = getFromLocalStorage('app-pods') || [];
  const issues: IntegrityIssue[] = [];
  
  // 1. Pedidos entregados sin factura
  orders.forEach((order: Order) => {
    if (order.status === 'delivered') {
      const hasInvoice = invoices.some((inv: Invoice) => inv.orderId === order.id);
      if (!hasInvoice) {
        issues.push({
          id: `issue-${Date.now()}-${Math.random()}`,
          type: 'order_without_invoice',
          orderId: order.id,
          description: `Pedido ${order.po} está entregado pero no tiene factura asociada`,
          severity: 'high',
          createdAt: new Date()
        });
      }
    }
  });
  
  // 2. Facturas pagadas sin POD
  invoices.forEach((invoice: Invoice) => {
    if (invoice.status === 'paid' && !invoice.podId) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random()}`,
        type: 'invoice_without_pod',
        invoiceId: invoice.id,
        description: `Factura ${invoice.invoiceNumber} está pagada pero no tiene POD asociado`,
        severity: 'high',
        createdAt: new Date()
      });
    }
  });
  
  // 3. PODs huérfanos (sin factura ni pedido)
  pods.forEach((pod: POD) => {
    if (!pod.invoiceId && !pod.orderId) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random()}`,
        type: 'orphan_pod',
        podId: pod.id,
        description: `POD ${pod.po} no está vinculado a ninguna factura ni pedido`,
        severity: 'medium',
        createdAt: new Date()
      });
    }
  });
  
  // 4. Inconsistencias de datos
  invoices.forEach((invoice: Invoice) => {
    if (invoice.podId) {
      const pod = pods.find((p: POD) => p.id === invoice.podId);
      if (pod && pod.invoiceId !== invoice.id) {
        issues.push({
          id: `issue-${Date.now()}-${Math.random()}`,
          type: 'data_mismatch',
          invoiceId: invoice.id,
          podId: pod.id,
          description: `Inconsistencia entre factura ${invoice.invoiceNumber} y POD ${pod.po}`,
          severity: 'medium',
          createdAt: new Date()
        });
      }
    }
  });
  
  return issues;
};

// Reparar problemas de integridad automáticamente
export const autoFixIntegrityIssues = (userId: string): { fixed: number; errors: number } => {
  const issues = checkIntegrity();
  let fixed = 0;
  let errors = 0;
  
  issues.forEach(issue => {
    try {
      if (issue.type === 'order_without_invoice' && issue.orderId) {
        // Crear factura automática para el pedido
        const invoices = getFromLocalStorage('app-invoices') || [];
        const orders = getFromLocalStorage('app-orders') || [];
        const order = orders.find((o: Order) => o.id === issue.orderId);
        
        if (order) {
          const items: any[] = order.items.map((item: any) => ({
            id: `inv-item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            billId: '',
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            productName: item.productName,
            productBrand: item.productBrand
          }));
          
          const subtotal = order.subtotal;
          const taxes = subtotal * 0.21;
          const total = subtotal + taxes;
          
          const newInvoice: Invoice = {
            id: `invoice-${Date.now()}`,
            orderId: order.id,
            invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            createdAt: new Date(),
            total,
            storeId: order.storeId,
            sellerId: order.salespersonId,
            status: 'draft',
            generationType: 'automatic',
            subtotal,
            taxes,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
            createdBy: userId,
            items
          };
          
          invoices.push(newInvoice);
          setToLocalStorage('app-invoices', invoices);
          fixed++;
        }
      }
    } catch (error) {
      console.error('Error fixing issue:', error);
      errors++;
    }
  });
  
  return { fixed, errors };
};

// Enriquecer POD con información relacionada
export const enrichPOD = (pod: POD): POD => {
  const stores = getFromLocalStorage('app-stores') || [];
  const users = getFromLocalStorage('app-users') || [];
  const orders = getFromLocalStorage('app-orders') || [];
  const invoices = getFromLocalStorage('app-invoices') || [];
  
  const store = stores.find((s: Store) => s.id === pod.storeId);
  const seller = users.find((u: User) => u.id === pod.salespersonId);
  const uploader = users.find((u: User) => u.id === pod.uploadedBy);
  const order = orders.find((o: Order) => o.id === pod.orderId);
  const invoice = invoices.find((inv: Invoice) => inv.id === pod.invoiceId);
  
  return {
    ...pod,
    storeName: store?.name || 'Tienda no encontrada',
    sellerName: `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim() || 'Vendedor no encontrado',
    uploadedByName: `${uploader?.firstName || ''} ${uploader?.lastName || ''}`.trim() || 'Usuario no encontrado',
    orderNumber: order?.po || 'Sin pedido',
    invoiceNumber: invoice?.invoiceNumber || 'Sin factura'
  };
};
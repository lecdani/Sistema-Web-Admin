// Tipos compartidos entre múltiples features
export interface User {
  id: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'admin' | 'user';
  cityId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  avatar?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export type Language = 'es' | 'en';

export interface AppSettings {
  id: string;
  language: Language;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
}

export interface ValidationErrors {
  [key: string]: string;
}

export interface City {
  id: string;
  name: string;
  state?: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  cityId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Brand {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brandId?: string;
  categoryId?: string;
  description?: string;
  currentPrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceHistory {
  id: string;
  productId: string;
  price: number;
  effectiveDate: Date;
  reason?: string;
  createdBy: string;
  createdAt: Date;
}

export interface Planogram {
  id: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
}

export interface Distribution {
  id: string;
  planogramId: string;
  productId: string;
  xPosition: number;
  yPosition: number;
  createdAt: Date;
}

export interface PlanogramWithDistribution extends Planogram {
  distributions: Distribution[];
  products?: Product[];
}

export interface Order {
  id: string;
  salespersonId: string;
  storeId: string;
  createdAt: Date;
  po: string;
  status: 'completed' | 'pending';
  storeName?: string;
  sellerName?: string;
  planogramId?: string;
  planogramName?: string;
  subtotal: number;
  total: number;
  notes?: string;
  updatedAt: Date;
  completedAt?: Date;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  productName?: string;
  productBrand?: string;
  unitPrice: number;
  subtotal: number;
  status: 'pending' | 'fulfilled' | 'partial' | 'cancelled';
}

export interface Invoice {
  id: string;
  orderId: string;
  podId?: string;
  createdAt: Date;
  total: number;
  invoiceNumber: string;
  orderNumber?: string;
  storeId: string;
  storeName?: string;
  sellerId: string;
  sellerName?: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  generationType: 'manual' | 'automatic';
  subtotal: number;
  taxes: number;
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  updatedAt: Date;
  createdBy: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  billId: string;
  productId: string;
  quantity: number;
  subtotal: number;
  productName?: string;
  productBrand?: string;
  unitPrice: number;
}

export interface POD {
  id: string;
  salespersonId: string;
  storeId: string;
  createdAt: Date;
  po: string;
  status: 'pending' | 'completed';
  orderId?: string;
  invoiceId?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  storeName?: string;
  sellerName?: string;
  imageUrl: string;
  uploadedAt: Date;
  uploadedBy: string;
  uploadedByName?: string;
  notes?: string;
  isValidated: boolean;
  validatedAt?: Date;
  validatedBy?: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  totalStores: number;
  activeStores: number;
  totalProducts: number;
  activeProducts: number;
  totalPlanograms: number;
  activePlanogram: number;
  totalCities: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export interface OrderFilters {
  dateFrom?: string;
  dateTo?: string;
  sellerId?: string;
  storeId?: string;
  status?: string;
}

export interface InvoiceFilters {
  dateFrom?: string;
  dateTo?: string;
  sellerId?: string;
  storeId?: string;
  status?: string;
}

export interface PODFilters {
  sellerId?: string;
  storeId?: string;
  isValidated?: boolean;
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface InvoiceStats {
  totalInvoices: number;
  draftInvoices: number;
  sentInvoices: number;
  paidInvoices: number;
  totalAmount: number;
  pendingAmount: number;
}

export interface IntegrityIssue {
  id: string;
  type: 'order_without_invoice' | 'invoice_without_pod' | 'orphan_pod' | 'data_mismatch';
  orderId?: string;
  invoiceId?: string;
  podId?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: Date;
}

// Interfaces específicas según el diagrama ER para el módulo de reportes
export interface OrderHeader {
  orderHeaderSerial: string;
  salespersonId: number;
  storeId: string;
  createdAt: string;
  po: string;
}

export interface OrderDetail {
  orderDetailId: string;
  orderHeaderId: string;
  productId: string;
  quantity: number;
}

export interface BillHeader {
  billHeaderSerial: string;
  orderHeaderId: string;
  podSerial?: string;
  createdAt: string;
  total: number;
  storeId: string;
}

export interface BillDetail {
  billDetailId: string;
  billHeaderId: string;
  productId: string;
  quantity: number;
  subtotal: number;
  unitPrice: number;
}

export interface PODHeader {
  podSerial: string;
  salespersonId: number;
  storeId: string;
  createdAt: string;
  po: string;
  status: string;
}

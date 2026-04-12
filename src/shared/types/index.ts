// Tipos compartidos entre múltiples features
export interface User {
  id: string;
  /** Id para auth/admin (p. ej. `userId` o `identityUserId` en el GET; se envía como `userId` al actualizar contraseña). */
  identityUserId?: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'admin' | 'user';
  /** Ciudad legacy (no usar para SellerCode). */
  cityId?: string;
  /** Ciudad base del vendedor (FK a City). */
  baseCityId?: string;
  /** Objeto ciudad base (cuando la API lo incluye). */
  baseCity?: { id: string; name: string; prefix?: string };
  /** Código del vendedor generado por backend (ej. FL-01). */
  sellerCode?: string;
  /** Ruta de ventas asignada al usuario (FK SALES_ROUTE, según modelo ER). */
  salesRouteId?: string;
  /** Nombre de la ruta si la API lo envía embebido (sin depender del catálogo). */
  salesRouteName?: string;
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
  /** Prefijo del estado (ej. CA). */
  statePrefix?: string;
  /** Nombre completo del estado (ej. California). */
  stateFullName?: string;
  country?: string;
  /** Código de estado (p. ej. AL) o enum numérico legacy. */
  state?: string | number;
  createdAt: Date;
  updatedAt: Date;
}

/** Opción de `GET /utilities/states` (`value` + `label`) o formato legacy numérico. */
export interface CityStateOption {
  value: string | number;
  code?: string;
  label: string;
  /** Entero para POST `state` (p. ej. `id` o `enumValue` del ítem de `GET /utilities/states`). */
  apiEnumValue?: number;
}

export interface Area {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Region {
  id: string;
  areaId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface District {
  id: string;
  regionId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Ruta de ventas (catálogo; puede existir sin usuarios asignados). */
export interface SalesRoute {
  id: string;
  name: string;
  cityId: string;
  code?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Store {
  id: string;
  storeNumber?: string;
  zoneNumber?: string;
  zipCode?: string;
  name: string;
  street?: string;
  /** Mantener `address` como alias legacy para vistas existentes. */
  address: string;
  cityId: string;
  districtId?: string;
  /** Indica si la tienda usa planograma en la PWA/backend. */
  hasPlanogram?: boolean;
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

/**
 * Familia (FAMILY en BD): family_id, brand_id, class_id, name (VARCHAR 25), family_code (VARCHAR 4), is_active.
 * Los campos shortName/genericCode/sku/volume/unit son opcionales solo por compatibilidad con respuestas antiguas.
 */
export interface Category {
  id: string;
  /** name en BD (VARCHAR 25) */
  name: string;
  /** short_name */
  shortName?: string;
  /** family_code (VARCHAR 4) — `code` es alias legado para el mismo valor. */
  code?: string;
  familyCode?: string;
  /** generic_code (VARCHAR 12) */
  genericCode?: string;
  sku?: string;
  volume?: number;
  unit?: string;
  brandId?: string;
  classId?: string;
  presentationId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductClass {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Familia anidada bajo `presentation` (respuesta típica de productos). */
export interface ProductFamilyEmbed {
  id?: string;
  name?: string;
  familyCode?: string;
  code?: string;
  brandId?: string;
  classId?: string;
}

/** Presentación embebida en GET `/products/products` (y similares). */
export interface ProductPresentationEmbed {
  id?: string;
  /** Nombre comercial de la presentación (API). */
  name?: string;
  sku?: string;
  genericCode?: string;
  volume?: number;
  unit?: string;
  family?: ProductFamilyEmbed;
}

export interface Product {
  id: string;
  name: string;
  /** Nombre corto comercial para listados. */
  shortName?: string;
  /** Código del producto (identificador comercial, distinto del SKU de familia). */
  code?: string;
  brandId?: string;
  familyId?: string;
  categoryId?: string;
  category?: string;
  presentationId?: string;
  /** Objeto anidado cuando el API lo devuelve (ej. genericCode/family). */
  presentation?: ProductPresentationEmbed;
  /** SKU del producto (ya no depende de Presentation). */
  sku?: string;
  /** Código genérico asociado al producto (normalmente por su presentación/familia). */
  genericCode?: string;
  description?: string;
  /** URL de la imagen del producto (devuelta por getProducts cuando tiene imagen) */
  image?: string;
  /** Nombre del archivo en S3 (solo para enviar en create/update) */
  imageFileName?: string;
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
  /** Si el backend devuelve filas desactivadas, la UI puede ignorarlas al pintar el planograma. */
  isActive?: boolean;
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
  status: 'initial' | 'confirmed' | 'invoiced' | 'completed' | 'pending' | 'delivered' | 'cancelled';
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
  /** Factura asociada (API admin) */
  invoiceId?: string | number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  productName?: string;
  /** Código de producto (preferente frente a sku legado) */
  code?: string;
  sku?: string;
  productBrand?: string;
  unitPrice: number;
  subtotal: number;
  status: 'pending' | 'fulfilled' | 'partial' | 'cancelled';
}

// ============================
// Rutas / Assignments (vendedor -> tiendas)
// ============================

export interface Assignment {
  id: string;
  /** Legacy: vendedor directo en la asignación. */
  userId?: string;
  storeId: string;
  /** Nombre de tienda si la API lo devuelve anidado (evita mostrar solo GUID). */
  storeName?: string;
  /** Modelo ER: asignación ruta + tienda. */
  salesRouteId?: string;
  createdAt?: Date;
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
  /** Nombre del archivo en S3 (para resolver URL si imageUrl no viene del backend). */
  imageFileName?: string;
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
  /** Pedidos con status completed/invoiced/delivered */
  totalCompletedOrders: number;
  /** Pedidos pendientes (no completados) */
  totalPendingOrders: number;
  /** Total de pedidos (transacciones) */
  totalTransactions: number;
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

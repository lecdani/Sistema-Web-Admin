import Dexie, { Table } from 'dexie';
import { User, AuthSession, AppSettings, Store, Product, Planogram, Distribution, City, Order, Invoice, POD } from '../types';

export class AppDatabase extends Dexie {
  users!: Table<User>;
  sessions!: Table<AuthSession>;
  settings!: Table<AppSettings>;

  constructor() {
    super('AppDatabase');
    
    this.version(1).stores({
      users: 'id',
      sessions: 'token',
      settings: 'id'
    });
  }
}

// Usar localStorage para almacenamiento
let db: AppDatabase;

// Crear instancia mínima de AppDatabase
db = {} as AppDatabase;

// Funciones para localStorage (solo en cliente)
const getFromLocalStorage = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const setToLocalStorage = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error guardando en localStorage:', error);
  }
};

export { db, getFromLocalStorage, setToLocalStorage };

// Crear usuarios por defecto
const createDefaultUsers = (): User[] => {
  const defaultUsers: User[] = [
    {
      id: '1',
      email: 'admin@empresa.com',
      password: 'admin123456', // Contraseña simple para demostración
      firstName: 'Administrador',
      lastName: 'Sistema',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      email: 'vendedor@empresa.com',
      password: 'vendedor123', // Contraseña simple para demostración  
      firstName: 'Vendedor',
      lastName: 'Sistema',
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  setToLocalStorage('app-users', defaultUsers);
  return defaultUsers;
};

// Verificar y asegurar que los usuarios existen
export const ensureUsersExist = (): User[] => {
  let users = getFromLocalStorage('app-users');
  
  if (!users || !Array.isArray(users) || users.length === 0) {
    users = createDefaultUsers();
    return users;
  }
  
  // Verificar que los usuarios del sistema existen y tienen contraseñas
  const admin = users.find((u: User) => u.email === 'admin@empresa.com');
  const vendedor = users.find((u: User) => u.email === 'vendedor@empresa.com');
  
  const needsRecreation = !admin || !vendedor || !admin.password || !vendedor.password;
  
  if (needsRecreation) {
    // Recreando usuarios con contraseñas
    users = createDefaultUsers();
  }
  
  return users;
};

// Buscar usuario por email
export const getUserByEmail = (email: string): User | null => {
  const users = getFromLocalStorage('app-users') || [];
  return users.find((u: User) => u.email === email) || null;
};

// Función auxiliar para inicializar datos
export const initializeDefaultData = () => {
  ensureUsersExist();
  ensureCitiesExist();
  ensureStoresExist();
  ensureProductsExist();
  ensurePlanogramsExist();
  ensureDistributionsExist();
  ensureOrdersExist();
  ensureInvoicesExist();
  ensurePODsExist();
  
  // Migrar estados antiguos a nuevos
  migrateOrderStatuses();
  migratePODStatuses();
};

// Migrar estados de pedidos antiguos a nuevos
const migrateOrderStatuses = () => {
  const orders = getFromLocalStorage('app-orders') || [];
  let needsUpdate = false;
  
  const updatedOrders = orders.map((order: Order) => {
    let status = order.status;
    
    // Convertir estados antiguos a nuevos
    if (status === 'delivered' || status === 'processing') {
      status = 'completed';
      needsUpdate = true;
    }
    if (status === 'cancelled') {
      status = 'pending';
      needsUpdate = true;
    }
    
    // Convertir deliveredAt a completedAt
    const updatedOrder = { ...order, status };
    if (order.deliveredAt && !order.completedAt) {
      updatedOrder.completedAt = order.deliveredAt;
      delete updatedOrder.deliveredAt;
      needsUpdate = true;
    }
    
    return updatedOrder;
  });
  
  if (needsUpdate) {
    setToLocalStorage('app-orders', updatedOrders);
    console.log('Estados de pedidos migrados correctamente');
  }
};

// Migrar estados de PODs antiguos a nuevos
const migratePODStatuses = () => {
  const pods = getFromLocalStorage('app-pods') || [];
  let needsUpdate = false;
  
  const updatedPods = pods.map((pod: POD) => {
    let status = pod.status;
    
    // Convertir estados antiguos a nuevos
    if (status === 'delivered') {
      status = 'completed';
      needsUpdate = true;
    }
    if (status === 'cancelled') {
      status = 'pending';
      needsUpdate = true;
    }
    
    return { ...pod, status };
  });
  
  if (needsUpdate) {
    setToLocalStorage('app-pods', updatedPods);
    console.log('Estados de PODs migrados correctamente');
  }
};

// Crear ciudades por defecto
const createDefaultCities = (): City[] => {
  const defaultCities: City[] = [
    {
      id: 'city_madrid_001',
      name: 'Madrid',
      state: 'Comunidad de Madrid',
      country: 'España',
      code: '28001',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'city_barcelona_001',
      name: 'Barcelona',
      state: 'Cataluña',
      country: 'España',
      code: '08001',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'city_valencia_001',
      name: 'Valencia',
      state: 'Comunidad Valenciana',
      country: 'España',
      code: '46001',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'city_sevilla_001',
      name: 'Sevilla',
      state: 'Andalucía',
      country: 'España',
      code: '41001',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'city_bilbao_001',
      name: 'Bilbao',
      state: 'País Vasco',
      country: 'España',
      code: '48001',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  setToLocalStorage('app-cities', defaultCities);
  return defaultCities;
};

// Verificar y asegurar que las ciudades existen
export const ensureCitiesExist = (): City[] => {
  let cities = getFromLocalStorage('app-cities');
  
  if (!cities || !Array.isArray(cities) || cities.length === 0) {
    cities = createDefaultCities();
  }
  
  return cities;
};

// Crear tiendas por defecto
const createDefaultStores = (): Store[] => {
  const defaultStores: Store[] = [
    {
      id: '1',
      serialNumber: 'ST001',
      name: 'Tienda Centro Madrid',
      address: 'Gran Vía 123',
      cityId: 'city_madrid_001',
      phone: '+34 91 234 5678',
      email: 'madrid@empresa.com',
      manager: 'María García',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2', 
      serialNumber: 'ST002',
      name: 'Tienda Eixample',
      address: 'Passeig de Gràcia 456',
      cityId: 'city_barcelona_001',
      phone: '+34 93 123 4567',
      email: 'barcelona@empresa.com', 
      manager: 'Carlos López',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '3',
      serialNumber: 'ST003', 
      name: 'Tienda Ciudad de las Artes',
      address: 'Av. de las Artes 789',
      cityId: 'city_valencia_001',
      phone: '+34 96 345 6789',
      email: 'valencia@empresa.com',
      manager: 'Ana Martínez',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  setToLocalStorage('app-stores', defaultStores);
  return defaultStores;
};

// Verificar y asegurar que las tiendas existen
export const ensureStoresExist = (): Store[] => {
  let stores = getFromLocalStorage('app-stores');
  
  if (!stores || !Array.isArray(stores) || stores.length === 0) {
    stores = createDefaultStores();
    return stores;
  }
  
  // Migrar tiendas que tengan el campo 'city' al nuevo campo 'cityId'
  let needsMigration = false;
  const cities = ensureCitiesExist();
  
  stores = stores.map((store: any) => {
    if (store.city && !store.cityId) {
      needsMigration = true;
      // Buscar una ciudad que coincida o usar la primera disponible
      const matchingCity = cities.find(city => 
        city.name.toLowerCase().includes(store.city.toLowerCase()) ||
        store.city.toLowerCase().includes(city.name.toLowerCase())
      );
      
      const { city, ...storeWithoutCity } = store;
      return {
        ...storeWithoutCity,
        cityId: matchingCity ? matchingCity.id : cities[0]?.id || 'city_madrid_001'
      };
    }
    return store;
  });
  
  if (needsMigration) {
    setToLocalStorage('app-stores', stores);
  }
  
  return stores;
};

// Crear productos por defecto
const createDefaultProducts = (): Product[] => {
  const defaultProducts: Product[] = [
    {
      id: '1',
      sku: 'PROD001',
      name: 'Smartphone Galaxy',
      category: 'Electrónicos',
      description: 'Smartphone de última generación',
      currentPrice: 129.00,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2', 
      sku: 'PROD002',
      name: 'Auriculares Bluetooth',
      category: 'Electrónicos',
      description: 'Auriculares inalámbricos con cancelación de ruido',
      currentPrice: 89.99,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '3',
      sku: 'PROD003',
      name: 'Camiseta Casual',
      category: 'Ropa',
      description: 'Camiseta de algodón 100%',
      currentPrice: 24.95,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '4',
      sku: 'PROD004',
      name: 'Zapatillas Deportivas',
      category: 'Calzado',
      description: 'Zapatillas para running y ejercicio',
      currentPrice: 79.90,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '5',
      sku: 'PROD005',
      name: 'Libro de Programación',
      category: 'Libros',
      description: 'Guía completa de desarrollo web',
      currentPrice: 45.00,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '6',
      sku: 'PROD006',
      name: 'Tablet Pro',
      category: 'Electrónicos',
      description: 'Tablet profesional con stylus incluido',
      currentPrice: 299.99,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '7',
      sku: 'PROD007',
      name: 'Pantalón Vaquero',
      category: 'Ropa',
      description: 'Jeans clásicos de corte recto',
      currentPrice: 59.90,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '8',
      sku: 'PROD008',
      name: 'Reloj Inteligente',
      category: 'Electrónicos',
      description: 'Smartwatch con monitor de salud',
      currentPrice: 199.00,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  setToLocalStorage('app-products', defaultProducts);
  return defaultProducts;
};

// Verificar y asegurar que los productos existen
export const ensureProductsExist = (): Product[] => {
  let products = getFromLocalStorage('app-products');
  
  if (!products || !Array.isArray(products) || products.length === 0) {
    products = createDefaultProducts();
    return products;
  }
  
  return products;
};

// Crear planogramas por defecto
const createDefaultPlanograms = (): Planogram[] => {
  const defaultPlanograms: Planogram[] = [
    {
      id: '1',
      name: 'Planograma Principal',
      description: 'Distribución principal de productos en tienda',
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      activatedAt: new Date()
    },
    {
      id: '2',
      name: 'Planograma Temporal',
      description: 'Distribución temporal para promociones',
      version: 1,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  setToLocalStorage('app-planograms', defaultPlanograms);
  return defaultPlanograms;
};

// Verificar y asegurar que los planogramas existen
export const ensurePlanogramsExist = (): Planogram[] => {
  let planograms = getFromLocalStorage('app-planograms');
  
  if (!planograms || !Array.isArray(planograms) || planograms.length === 0) {
    planograms = createDefaultPlanograms();
    return planograms;
  }
  
  return planograms;
};

// Crear distribuciones por defecto
const createDefaultDistributions = (): Distribution[] => {
  const defaultDistributions: Distribution[] = [
    {
      id: '1',
      planogramId: '1',
      productId: '1',
      xPosition: 0,
      yPosition: 0,
      createdAt: new Date()
    },
    {
      id: '2',
      planogramId: '1',
      productId: '2',
      xPosition: 1,
      yPosition: 0,
      createdAt: new Date()
    },
    {
      id: '3',
      planogramId: '1',
      productId: '3',
      xPosition: 2,
      yPosition: 0,
      createdAt: new Date()
    },
    {
      id: '4',
      planogramId: '1',
      productId: '4',
      xPosition: 0,
      yPosition: 1,
      createdAt: new Date()
    },
    {
      id: '5',
      planogramId: '1',
      productId: '6',
      xPosition: 1,
      yPosition: 1,
      createdAt: new Date()
    }
  ];
  
  setToLocalStorage('app-distributions', defaultDistributions);
  return defaultDistributions;
};

// Verificar y asegurar que las distribuciones existen
export const ensureDistributionsExist = (): Distribution[] => {
  let distributions = getFromLocalStorage('app-distributions');
  
  if (!distributions || !Array.isArray(distributions) || distributions.length === 0) {
    distributions = createDefaultDistributions();
    return distributions;
  }
  
  return distributions;
}

// Crear pedidos por defecto
const createDefaultOrders = () => {
  const users = getFromLocalStorage('app-users') || [];
  const stores = getFromLocalStorage('app-stores') || [];
  const products = getFromLocalStorage('app-products') || [];
  
  const sellers = users.filter(u => u.role === 'user');
  if (sellers.length === 0 || stores.length === 0 || products.length === 0) {
    return [];
  }

  const defaultOrders = [
    {
      id: 'order_001',
      po: 'PED-2024-001',
      storeId: stores[0]?.id || '1',
      salespersonId: sellers[0]?.id || 'user_001',
      status: 'completed',
      planogramId: '1',
      subtotal: 245.50,
      total: 245.50,
      notes: 'Pedido prioritario para reposición de stock',
      createdAt: new Date(2024, 0, 15),
      updatedAt: new Date(2024, 0, 17),
      completedAt: new Date(2024, 0, 17),
      items: [
        {
          id: 'item_001',
          orderId: 'order_001',
          productId: products[0]?.id || '1',
          quantity: 5,
          unitPrice: 25.90,
          subtotal: 129.50,
          status: 'fulfilled'
        },
        {
          id: 'item_002',
          orderId: 'order_001',
          productId: products[1]?.id || '2',
          quantity: 3,
          unitPrice: 38.67,
          subtotal: 116.00,
          status: 'fulfilled'
        }
      ]
    },
    {
      id: 'order_002',
      po: 'PED-2024-002',
      storeId: stores[1]?.id || '2',
      salespersonId: sellers[0]?.id || 'user_001',
      status: 'pending',
      planogramId: '1',
      subtotal: 189.99,
      total: 189.99,
      notes: 'Pedido regular semanal',
      createdAt: new Date(2024, 0, 20),
      updatedAt: new Date(2024, 0, 20),
      items: [
        {
          id: 'item_003',
          orderId: 'order_002',
          productId: products[2]?.id || '3',
          quantity: 2,
          unitPrice: 45.50,
          subtotal: 91.00,
          status: 'pending'
        },
        {
          id: 'item_004',
          orderId: 'order_002',
          productId: products[3]?.id || '4',
          quantity: 4,
          unitPrice: 24.75,
          subtotal: 99.00,
          status: 'pending'
        }
      ]
    },
    {
      id: 'order_003',
      po: 'PED-2024-003',
      storeId: stores[0]?.id || '1',
      salespersonId: sellers[0]?.id || 'user_001',
      status: 'pending',
      planogramId: '1',
      subtotal: 156.75,
      total: 156.75,
      createdAt: new Date(2024, 0, 22),
      updatedAt: new Date(2024, 0, 23),
      items: [
        {
          id: 'item_005',
          orderId: 'order_003',
          productId: products[4]?.id || '5',
          quantity: 6,
          unitPrice: 19.99,
          subtotal: 119.94,
          status: 'partial'
        },
        {
          id: 'item_006',
          orderId: 'order_003',
          productId: products[5]?.id || '6',
          quantity: 1,
          unitPrice: 36.81,
          subtotal: 36.81,
          status: 'fulfilled'
        }
      ]
    }
  ];

  setToLocalStorage('app-orders', defaultOrders);
  return defaultOrders;
};

// Crear facturas por defecto
const createDefaultInvoices = () => {
  const orders = getFromLocalStorage('app-orders') || [];
  const users = getFromLocalStorage('app-users') || [];
  
  if (orders.length === 0) return [];

  const defaultInvoices = [
    {
      id: 'invoice_001',
      invoiceNumber: 'FAC-2024-001',
      orderId: orders[0]?.id || 'order_001',
      storeId: orders[0]?.storeId || '1',
      sellerId: orders[0]?.sellerId || 'user_001',
      status: 'paid',
      generationType: 'automatic',
      subtotal: 245.50,
      taxes: 51.56,
      total: 297.06,
      issueDate: new Date(2024, 0, 17),
      dueDate: new Date(2024, 1, 16),
      paidDate: new Date(2024, 0, 25),
      createdAt: new Date(2024, 0, 17),
      updatedAt: new Date(2024, 0, 25),
      createdBy: users.find(u => u.role === 'admin')?.id || 'admin_001',
      items: [
        {
          id: 'inv_item_001',
          invoiceId: 'invoice_001',
          productId: '1',
          quantity: 5,
          unitPrice: 25.90,
          subtotal: 129.50
        },
        {
          id: 'inv_item_002',
          invoiceId: 'invoice_001',
          productId: '2',
          quantity: 3,
          unitPrice: 38.67,
          subtotal: 116.00
        }
      ]
    },
    {
      id: 'invoice_002',
      invoiceNumber: 'FAC-2024-002',
      orderId: orders[2]?.id || 'order_003',
      storeId: orders[2]?.storeId || '1',
      sellerId: orders[2]?.sellerId || 'user_001',
      status: 'sent',
      generationType: 'manual',
      subtotal: 156.75,
      taxes: 32.92,
      total: 189.67,
      issueDate: new Date(2024, 0, 23),
      dueDate: new Date(2024, 1, 22),
      createdAt: new Date(2024, 0, 23),
      updatedAt: new Date(2024, 0, 23),
      createdBy: users.find(u => u.role === 'admin')?.id || 'admin_001',
      items: [
        {
          id: 'inv_item_003',
          invoiceId: 'invoice_002',
          productId: '5',
          quantity: 6,
          unitPrice: 19.99,
          subtotal: 119.94
        },
        {
          id: 'inv_item_004',
          invoiceId: 'invoice_002',
          productId: '6',
          quantity: 1,
          unitPrice: 36.81,
          subtotal: 36.81
        }
      ]
    }
  ];

  setToLocalStorage('app-invoices', defaultInvoices);
  return defaultInvoices;
};

// Crear PODs por defecto
const createDefaultPODs = () => {
  const orders = getFromLocalStorage('app-orders') || [];
  const invoices = getFromLocalStorage('app-invoices') || [];
  const users = getFromLocalStorage('app-users') || [];
  
  if (orders.length === 0 || invoices.length === 0) return [];

  const defaultPODs = [
    {
      id: 'pod_001',
      orderId: orders[0]?.id || 'order_001',
      invoiceId: invoices[0]?.id || 'invoice_001',
      storeId: orders[0]?.storeId || '1',
      sellerId: orders[0]?.sellerId || 'user_001',
      imageUrl: '/placeholder-pod-image-1.jpg',
      uploadedAt: new Date(2024, 0, 17, 14, 30),
      uploadedBy: orders[0]?.sellerId || 'user_001',
      notes: 'Entrega realizada sin observaciones. Cliente satisfecho.',
      isValidated: true,
      validatedAt: new Date(2024, 0, 18, 9, 15),
      validatedBy: users.find(u => u.role === 'admin')?.id || 'admin_001'
    },
    {
      id: 'pod_002',
      orderId: orders[2]?.id || 'order_003',
      invoiceId: invoices[1]?.id || 'invoice_002',
      storeId: orders[2]?.storeId || '1',
      sellerId: orders[2]?.sellerId || 'user_001',
      imageUrl: '/placeholder-pod-image-2.jpg',
      uploadedAt: new Date(2024, 0, 23, 16, 45),
      uploadedBy: orders[2]?.sellerId || 'user_001',
      notes: 'Entrega parcial. Falta un producto que se entregará mañana.',
      isValidated: false
    }
  ];

  setToLocalStorage('app-pods', defaultPODs);
  return defaultPODs;
};

// Verificar y asegurar que los pedidos existen
export const ensureOrdersExist = () => {
  let orders = getFromLocalStorage('app-orders');
  
  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    orders = createDefaultOrders();
  }
  
  return orders;
};

// Verificar y asegurar que las facturas existen
export const ensureInvoicesExist = () => {
  let invoices = getFromLocalStorage('app-invoices');
  
  if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
    invoices = createDefaultInvoices();
  }
  
  return invoices;
};

// Verificar y asegurar que los PODs existen
export const ensurePODsExist = () => {
  let pods = getFromLocalStorage('app-pods');
  
  if (!pods || !Array.isArray(pods) || pods.length === 0) {
    pods = createDefaultPODs();
  }
  
  return pods;
};

// Crear datos según el diagrama ER para el módulo de reportes

// Crear ORDER_HEADER según el ER
const createDefaultOrderHeaders = () => {
  const stores = getFromLocalStorage('app-stores') || [];
  
  const orderHeaders = [
    {
      orderHeaderSerial: 'ORD-2024-001',
      salespersonId: 2, // vendedor@empresa.com id
      storeId: stores[0]?.id || 'store_madrid_001',
      createdAt: '2024-01-15',
      po: 'PO-001-2024'
    },
    {
      orderHeaderSerial: 'ORD-2024-002',
      salespersonId: 2,
      storeId: stores[1]?.id || 'store_barcelona_001',
      createdAt: '2024-01-18',
      po: 'PO-002-2024'
    },
    {
      orderHeaderSerial: 'ORD-2024-003',
      salespersonId: 2,
      storeId: stores[2]?.id || 'store_valencia_001',
      createdAt: '2024-01-22',
      po: 'PO-003-2024'
    },
    {
      orderHeaderSerial: 'ORD-2024-004',
      salespersonId: 2,
      storeId: stores[0]?.id || 'store_madrid_001',
      createdAt: '2024-02-05',
      po: 'PO-004-2024'
    },
    {
      orderHeaderSerial: 'ORD-2024-005',
      salespersonId: 2,
      storeId: stores[1]?.id || 'store_barcelona_001',
      createdAt: '2024-02-12',
      po: 'PO-005-2024'
    }
  ];
  
  setToLocalStorage('app-order-headers', orderHeaders);
  return orderHeaders;
};

// Crear ORDER_DETAIL según el ER
const createDefaultOrderDetails = () => {
  const products = getFromLocalStorage('app-products') || [];
  
  const orderDetails = [
    // Detalles para ORD-2024-001
    {
      orderDetailId: 'ODT-001',
      orderHeaderId: 'ORD-2024-001',
      productId: products[0]?.id || 'product_001',
      quantity: 10
    },
    {
      orderDetailId: 'ODT-002',
      orderHeaderId: 'ORD-2024-001',
      productId: products[1]?.id || 'product_002',
      quantity: 8
    },
    // Detalles para ORD-2024-002
    {
      orderDetailId: 'ODT-003',
      orderHeaderId: 'ORD-2024-002',
      productId: products[2]?.id || 'product_003',
      quantity: 15
    },
    {
      orderDetailId: 'ODT-004',
      orderHeaderId: 'ORD-2024-002',
      productId: products[3]?.id || 'product_004',
      quantity: 6
    },
    // Detalles para ORD-2024-003
    {
      orderDetailId: 'ODT-005',
      orderHeaderId: 'ORD-2024-003',
      productId: products[4]?.id || 'product_005',
      quantity: 12
    },
    {
      orderDetailId: 'ODT-006',
      orderHeaderId: 'ORD-2024-003',
      productId: products[5]?.id || 'product_006',
      quantity: 4
    },
    // Detalles para ORD-2024-004
    {
      orderDetailId: 'ODT-007',
      orderHeaderId: 'ORD-2024-004',
      productId: products[0]?.id || 'product_001',
      quantity: 20
    },
    {
      orderDetailId: 'ODT-008',
      orderHeaderId: 'ORD-2024-004',
      productId: products[2]?.id || 'product_003',
      quantity: 18
    },
    // Detalles para ORD-2024-005
    {
      orderDetailId: 'ODT-009',
      orderHeaderId: 'ORD-2024-005',
      productId: products[1]?.id || 'product_002',
      quantity: 25
    },
    {
      orderDetailId: 'ODT-010',
      orderHeaderId: 'ORD-2024-005',
      productId: products[4]?.id || 'product_005',
      quantity: 14
    }
  ];
  
  setToLocalStorage('app-order-details', orderDetails);
  return orderDetails;
};

// Crear BILL_HEADER según el ER
const createDefaultBillHeaders = () => {
  const stores = getFromLocalStorage('app-stores') || [];
  
  const billHeaders = [
    {
      billHeaderSerial: 'BILL-2024-001',
      orderHeaderId: 'ORD-2024-001',
      podSerial: 'POD-2024-001',
      createdAt: '2024-01-16',
      total: 2580.50,
      storeId: stores[0]?.id || 'store_madrid_001'
    },
    {
      billHeaderSerial: 'BILL-2024-002',
      orderHeaderId: 'ORD-2024-002',
      podSerial: 'POD-2024-002',
      createdAt: '2024-01-19',
      total: 1845.75,
      storeId: stores[1]?.id || 'store_barcelona_001'
    },
    {
      billHeaderSerial: 'BILL-2024-003',
      orderHeaderId: 'ORD-2024-003',
      podSerial: 'POD-2024-003',
      createdAt: '2024-01-23',
      total: 3120.00,
      storeId: stores[2]?.id || 'store_valencia_001'
    },
    {
      billHeaderSerial: 'BILL-2024-004',
      orderHeaderId: 'ORD-2024-004',
      podSerial: 'POD-2024-004',
      createdAt: '2024-02-06',
      total: 4250.25,
      storeId: stores[0]?.id || 'store_madrid_001'
    },
    {
      billHeaderSerial: 'BILL-2024-005',
      orderHeaderId: 'ORD-2024-005',
      podSerial: 'POD-2024-005',
      createdAt: '2024-02-13',
      total: 3675.80,
      storeId: stores[1]?.id || 'store_barcelona_001'
    }
  ];
  
  setToLocalStorage('app-bill-headers', billHeaders);
  return billHeaders;
};

// Crear BILL_DETAIL según el ER
const createDefaultBillDetails = () => {
  const products = getFromLocalStorage('app-products') || [];
  
  const billDetails = [
    // Detalles para BILL-2024-001
    {
      billDetailId: 'BDT-001',
      billHeaderId: 'BILL-2024-001',
      productId: products[0]?.id || 'product_001',
      quantity: 10,
      subtotal: 1290.00,
      unitPrice: 129.00
    },
    {
      billDetailId: 'BDT-002',
      billHeaderId: 'BILL-2024-001',
      productId: products[1]?.id || 'product_002',
      quantity: 8,
      subtotal: 1290.50,
      unitPrice: 161.31
    },
    // Detalles para BILL-2024-002
    {
      billDetailId: 'BDT-003',
      billHeaderId: 'BILL-2024-002',
      productId: products[2]?.id || 'product_003',
      quantity: 15,
      subtotal: 1125.00,
      unitPrice: 75.00
    },
    {
      billDetailId: 'BDT-004',
      billHeaderId: 'BILL-2024-002',
      productId: products[3]?.id || 'product_004',
      quantity: 6,
      subtotal: 720.75,
      unitPrice: 120.13
    },
    // Detalles para BILL-2024-003
    {
      billDetailId: 'BDT-005',
      billHeaderId: 'BILL-2024-003',
      productId: products[4]?.id || 'product_005',
      quantity: 12,
      subtotal: 1800.00,
      unitPrice: 150.00
    },
    {
      billDetailId: 'BDT-006',
      billHeaderId: 'BILL-2024-003',
      productId: products[5]?.id || 'product_006',
      quantity: 4,
      subtotal: 1320.00,
      unitPrice: 330.00
    },
    // Detalles para BILL-2024-004
    {
      billDetailId: 'BDT-007',
      billHeaderId: 'BILL-2024-004',
      productId: products[0]?.id || 'product_001',
      quantity: 20,
      subtotal: 2580.00,
      unitPrice: 129.00
    },
    {
      billDetailId: 'BDT-008',
      billHeaderId: 'BILL-2024-004',
      productId: products[2]?.id || 'product_003',
      quantity: 18,
      subtotal: 1670.25,
      unitPrice: 92.79
    },
    // Detalles para BILL-2024-005
    {
      billDetailId: 'BDT-009',
      billHeaderId: 'BILL-2024-005',
      productId: products[1]?.id || 'product_002',
      quantity: 25,
      subtotal: 2425.50,
      unitPrice: 97.02
    },
    {
      billDetailId: 'BDT-010',
      billHeaderId: 'BILL-2024-005',
      productId: products[4]?.id || 'product_005',
      quantity: 14,
      subtotal: 1250.30,
      unitPrice: 89.31
    }
  ];
  
  setToLocalStorage('app-bill-details', billDetails);
  return billDetails;
};

// Funciones para asegurar que los datos ER existen
export const ensureOrderHeadersExist = () => {
  let orderHeaders = getFromLocalStorage('app-order-headers');
  
  if (!orderHeaders || !Array.isArray(orderHeaders) || orderHeaders.length === 0) {
    orderHeaders = createDefaultOrderHeaders();
  }
  
  return orderHeaders;
};

export const ensureOrderDetailsExist = () => {
  let orderDetails = getFromLocalStorage('app-order-details');
  
  if (!orderDetails || !Array.isArray(orderDetails) || orderDetails.length === 0) {
    orderDetails = createDefaultOrderDetails();
  }
  
  return orderDetails;
};

export const ensureBillHeadersExist = () => {
  let billHeaders = getFromLocalStorage('app-bill-headers');
  
  if (!billHeaders || !Array.isArray(billHeaders) || billHeaders.length === 0) {
    billHeaders = createDefaultBillHeaders();
  }
  
  return billHeaders;
};

export const ensureBillDetailsExist = () => {
  let billDetails = getFromLocalStorage('app-bill-details');
  
  if (!billDetails || !Array.isArray(billDetails) || billDetails.length === 0) {
    billDetails = createDefaultBillDetails();
  }
  
  return billDetails;
};

// Función principal para inicializar la base de datos
export const initializeDatabase = async () => {
  // Solo ejecutar en el cliente
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    console.log('Inicializando base de datos...');
    initializeDefaultData();
    console.log('Base de datos inicializada correctamente');
  } catch (error) {
    console.error('Error inicializando base de datos:', error);
    throw error;
  }
};
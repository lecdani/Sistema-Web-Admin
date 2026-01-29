import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  FileText, 
  Search, 
  Calendar, 
  Store as StoreIcon, 
  Package, 
  MapPin,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Download,
  FileSpreadsheet,
  RefreshCw,
  X,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Button } from '@/shared/components/base/Button';
import { Badge } from '@/shared/components/base/Badge';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/base/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/base/Table';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart as RechartsPieChart, 
  Cell, 
  LineChart, 
  Line, 
  Pie 
} from 'recharts';
import { getFromLocalStorage } from '@/shared/services/database';
import { Order, Invoice, Product, Store, City, User } from '@/shared/types';
import { toast } from 'sonner';

interface ReportsManagementProps {
  onBack: () => void;
}

interface SalesReport {
  id: string;
  orderId: string;
  invoiceId: string;
  productId: string;
  productName: string;
  productSku: string;
  storeId: string;
  storeName: string;
  cityId: string;
  cityName: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  date: Date;
  invoiceNumber: string;
  orderNumber: string;
}

interface FilterState {
  dateFrom: string;
  dateTo: string;
  productId: string;
  storeId: string;
  cityId: string;
  sellerId: string;
}

const COLORS = ['#4f46e5', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ReportsManagement({ onBack }: ReportsManagementProps) {
  const [salesData, setSalesData] = useState<SalesReport[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    productId: 'all',
    storeId: 'all',
    cityId: 'all',
    sellerId: 'all'
  });

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = () => {
    try {
      setIsLoading(true);
      
      // Cargar datos base
      const ordersData = getFromLocalStorage('app-orders') || [];
      const invoicesData = getFromLocalStorage('app-invoices') || [];
      const productsData = getFromLocalStorage('app-products') || [];
      const storesData = getFromLocalStorage('app-stores') || [];
      const citiesData = getFromLocalStorage('app-cities') || [];
      const usersData = getFromLocalStorage('app-users') || [];

      setProducts(productsData);
      setStores(storesData);
      setCities(citiesData);
      setSellers(usersData.filter((u: User) => u.role === 'user'));

      // Generar datos de ventas desde facturas completadas
      const salesReports: SalesReport[] = [];

      invoicesData.forEach((invoice: Invoice) => {
        const order = ordersData.find((o: Order) => o.id === invoice.orderId);
        if (!order) return;

        const store = storesData.find((s: Store) => s.id === invoice.storeId);
        const city = store ? citiesData.find((c: City) => c.id === store.cityId) : null;
        const seller = usersData.find((u: User) => u.id === invoice.sellerId);

        if (invoice.items && invoice.items.length > 0) {
          invoice.items.forEach((item: any) => {
            const product = productsData.find((p: Product) => p.id === item.productId);
            
            if (product && store && city && seller) {
              salesReports.push({
                id: `${invoice.id}-${item.id}`,
                orderId: order.id,
                invoiceId: invoice.id,
                productId: product.id,
                productName: product.name,
                productSku: product.sku,
                storeId: store.id,
                storeName: store.name,
                cityId: city.id,
                cityName: city.name,
                sellerId: seller.id,
                sellerName: `${seller.firstName} ${seller.lastName}`,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalAmount: item.subtotal,
                date: new Date(invoice.issueDate),
                invoiceNumber: invoice.invoiceNumber,
                orderNumber: order.po
              });
            }
          });
        }
      });

      setSalesData(salesReports);
      toast.success('Datos de ventas cargados correctamente');
    } catch (error) {
      console.error('Error cargando datos de reportes:', error);
      toast.error('Error al cargar los datos de reportes');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar datos según filtros activos
  const filteredSalesData = useMemo(() => {
    return salesData.filter(sale => {
      const saleDate = new Date(sale.date);
      const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
      const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

      if (fromDate && saleDate < fromDate) return false;
      if (toDate && saleDate > toDate) return false;
      if (filters.productId !== 'all' && sale.productId !== filters.productId) return false;
      if (filters.storeId !== 'all' && sale.storeId !== filters.storeId) return false;
      if (filters.cityId !== 'all' && sale.cityId !== filters.cityId) return false;
      if (filters.sellerId !== 'all' && sale.sellerId !== filters.sellerId) return false;

      return true;
    });
  }, [salesData, filters]);

  // Calcular métricas
  const salesMetrics = useMemo(() => {
    const totalSales = filteredSalesData.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalQuantity = filteredSalesData.reduce((sum, sale) => sum + sale.quantity, 0);
    const uniqueInvoices = new Set(filteredSalesData.map(s => s.invoiceId)).size;
    const averageTicket = uniqueInvoices > 0 ? totalSales / uniqueInvoices : 0;

    // Top productos
    const productSales = filteredSalesData.reduce((acc, sale) => {
      if (!acc[sale.productId]) {
        acc[sale.productId] = {
          productId: sale.productId,
          productName: sale.productName,
          productSku: sale.productSku,
          totalSales: 0,
          totalQuantity: 0
        };
      }
      acc[sale.productId].totalSales += sale.totalAmount;
      acc[sale.productId].totalQuantity += sale.quantity;
      return acc;
    }, {} as Record<string, { productId: string; productName: string; productSku: string; totalSales: number; totalQuantity: number }>);

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10);

    // Top tiendas
    const storeSales = filteredSalesData.reduce((acc, sale) => {
      if (!acc[sale.storeId]) {
        acc[sale.storeId] = {
          storeId: sale.storeId,
          storeName: sale.storeName,
          cityName: sale.cityName,
          totalSales: 0,
          totalQuantity: 0,
          transactions: 0
        };
      }
      acc[sale.storeId].totalSales += sale.totalAmount;
      acc[sale.storeId].totalQuantity += sale.quantity;
      return acc;
    }, {} as Record<string, { storeId: string; storeName: string; cityName: string; totalSales: number; totalQuantity: number; transactions: number }>);

    const topStores = Object.values(storeSales)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10);

    // Top vendedores
    const sellerSales = filteredSalesData.reduce((acc, sale) => {
      if (!acc[sale.sellerId]) {
        acc[sale.sellerId] = {
          sellerId: sale.sellerId,
          sellerName: sale.sellerName,
          totalSales: 0,
          totalQuantity: 0,
          transactions: 0
        };
      }
      acc[sale.sellerId].totalSales += sale.totalAmount;
      acc[sale.sellerId].totalQuantity += sale.quantity;
      return acc;
    }, {} as Record<string, { sellerId: string; sellerName: string; totalSales: number; totalQuantity: number; transactions: number }>);

    const topSellers = Object.values(sellerSales)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10);

    return {
      totalSales,
      totalQuantity,
      averageTicket,
      totalTransactions: uniqueInvoices,
      topProducts,
      topStores,
      topSellers
    };
  }, [filteredSalesData]);

  // Datos para gráficos
  const chartData = useMemo(() => {
    // Ventas por mes
    const monthlyData = filteredSalesData.reduce((acc, sale) => {
      const month = new Date(sale.date).toISOString().slice(0, 7);
      if (!acc[month]) {
        acc[month] = { month, sales: 0, quantity: 0, transactions: new Set() };
      }
      acc[month].sales += sale.totalAmount;
      acc[month].quantity += sale.quantity;
      acc[month].transactions.add(sale.invoiceId);
      return acc;
    }, {} as Record<string, { month: string; sales: number; quantity: number; transactions: Set<string> }>);

    const monthlyChart = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month: new Date(month).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' }),
        ventas: data.sales,
        cantidad: data.quantity,
        transacciones: data.transactions.size
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Ventas por producto (top 10)
    const productChart = salesMetrics.topProducts.map(product => ({
      name: product.productName.length > 20 ? product.productName.substring(0, 20) + '...' : product.productName,
      ventas: product.totalSales,
      cantidad: product.totalQuantity
    }));

    // Ventas por tienda (top 10)
    const storeChart = salesMetrics.topStores.map(store => ({
      name: store.storeName,
      ventas: store.totalSales,
      cantidad: store.totalQuantity,
      ciudad: store.cityName
    }));

    // Distribución por ciudad
    const cityData = filteredSalesData.reduce((acc, sale) => {
      if (!acc[sale.cityId]) {
        acc[sale.cityId] = {
          name: sale.cityName,
          value: 0
        };
      }
      acc[sale.cityId].value += sale.totalAmount;
      return acc;
    }, {} as Record<string, { name: string; value: number }>);

    const cityChart = Object.values(cityData);

    // Ventas por vendedor
    const sellerChart = salesMetrics.topSellers.map(seller => ({
      name: seller.sellerName,
      ventas: seller.totalSales,
      cantidad: seller.totalQuantity
    }));

    return {
      monthly: monthlyChart,
      products: productChart,
      stores: storeChart,
      cities: cityChart,
      sellers: sellerChart
    };
  }, [filteredSalesData, salesMetrics]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dateTo: new Date().toISOString().split('T')[0],
      productId: 'all',
      storeId: 'all',
      cityId: 'all',
      sellerId: 'all'
    });
  };

  const exportToCSV = () => {
    const csvContent = [
      'Fecha,Factura,Pedido,Producto,SKU,Tienda,Ciudad,Vendedor,Cantidad,Precio Unit.,Total',
      ...filteredSalesData.map(sale => 
        `"${new Date(sale.date).toLocaleDateString('es-ES')}","${sale.invoiceNumber}","${sale.orderNumber}","${sale.productName}","${sale.productSku}","${sale.storeName}","${sale.cityName}","${sale.sellerName}",${sale.quantity},${sale.unitPrice.toFixed(2)},${sale.totalAmount.toFixed(2)}`
      )
    ].join('\n');
    
    const element = document.createElement('a');
    const file = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    element.href = URL.createObjectURL(file);
    element.download = `reporte-ventas-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Reporte exportado a CSV');
  };

  const exportToPDF = () => {
    // Crear un reporte simple en formato texto para simular PDF
    const reportContent = `
REPORTE DE VENTAS
Período: ${filters.dateFrom} a ${filters.dateTo}
Generado: ${new Date().toLocaleDateString('es-ES')}

RESUMEN
========
Total Ventas: €${salesMetrics.totalSales.toFixed(2)}
Cantidad Total: ${salesMetrics.totalQuantity}
Ticket Promedio: €${salesMetrics.averageTicket.toFixed(2)}
Transacciones: ${salesMetrics.totalTransactions}

TOP 10 PRODUCTOS
================
${salesMetrics.topProducts.map((p, i) => 
  `${i + 1}. ${p.productName} - €${p.totalSales.toFixed(2)} (${p.totalQuantity} unidades)`
).join('\n')}

TOP 10 TIENDAS
==============
${salesMetrics.topStores.map((s, i) => 
  `${i + 1}. ${s.storeName} (${s.cityName}) - €${s.totalSales.toFixed(2)}`
).join('\n')}

TOP 10 VENDEDORES
=================
${salesMetrics.topSellers.map((s, i) => 
  `${i + 1}. ${s.sellerName} - €${s.totalSales.toFixed(2)}`
).join('\n')}
    `;
    
    const element = document.createElement('a');
    const file = new Blob([reportContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `reporte-ventas-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Reporte exportado (formato texto)');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600">Cargando datos de reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-blue-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reportes de Ventas</h1>
            <p className="text-gray-500">Análisis detallado del desempeño comercial</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadReportData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div>
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            <div>
              <Label>Producto</Label>
              <Select value={filters.productId} onValueChange={(value) => handleFilterChange('productId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los productos</SelectItem>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tienda</Label>
              <Select value={filters.storeId} onValueChange={(value) => handleFilterChange('storeId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tiendas</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ciudad</Label>
              <Select value={filters.cityId} onValueChange={(value) => handleFilterChange('cityId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ciudades</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendedor</Label>
              <Select value={filters.sellerId} onValueChange={(value) => handleFilterChange('sellerId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {sellers.map(seller => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.firstName} {seller.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <Badge variant="outline" className="text-sm">
              {filteredSalesData.length} registros encontrados
            </Badge>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Ventas Totales</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  €{salesMetrics.totalSales.toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Cantidad Vendida</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {salesMetrics.totalQuantity.toLocaleString()}
                </p>
              </div>
              <div className="p-2.5 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Ticket Promedio</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  €{salesMetrics.averageTicket.toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 bg-purple-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Transacciones</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {salesMetrics.totalTransactions.toLocaleString()}
                </p>
              </div>
              <div className="p-2.5 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs de Reportes */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <TabsList className="grid w-full lg:w-auto grid-cols-4">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="stores">Tiendas</TabsTrigger>
            <TabsTrigger value="sellers">Vendedores</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button onClick={exportToPDF} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Exportar TXT
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ventas por Mes */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Ventas Mensual</CardTitle>
                <CardDescription>Evolución de ventas en el período seleccionado</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => `€${value.toFixed(2)}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="ventas" stroke="#4f46e5" strokeWidth={2} name="Ventas (€)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución por Ciudad */}
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Ciudad</CardTitle>
                <CardDescription>Distribución geográfica de ventas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={chartData.cities}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: €${entry.value.toFixed(0)}`}
                    >
                      {chartData.cities.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Detalle */}
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Transacciones</CardTitle>
              <CardDescription>
                Últimas {Math.min(filteredSalesData.length, 50)} transacciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Factura</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Tienda</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesData.slice(0, 50).map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{new Date(sale.date).toLocaleDateString('es-ES')}</TableCell>
                        <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sale.productName}</p>
                            <p className="text-sm text-gray-500">{sale.productSku}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{sale.storeName}</p>
                            <p className="text-sm text-gray-500">{sale.cityName}</p>
                          </div>
                        </TableCell>
                        <TableCell>{sale.sellerName}</TableCell>
                        <TableCell className="text-right">{sale.quantity}</TableCell>
                        <TableCell className="text-right">€{sale.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">€{sale.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredSalesData.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay datos para mostrar con los filtros seleccionados
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Productos */}
        <TabsContent value="products" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Top Productos */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Productos por Ventas</CardTitle>
                <CardDescription>Productos con mayores ingresos</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData.products} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
                    <Bar dataKey="ventas" fill="#4f46e5" name="Ventas (€)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabla de Top Productos */}
            <Card>
              <CardHeader>
                <CardTitle>Ranking de Productos</CardTitle>
                <CardDescription>Top 10 por ingresos generados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {salesMetrics.topProducts.map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                          #{index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium text-gray-900">{product.productName}</p>
                          <p className="text-sm text-gray-500">{product.productSku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">€{product.totalSales.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{product.totalQuantity} unidades</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Tiendas */}
        <TabsContent value="stores" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Top Tiendas */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Tiendas por Ventas</CardTitle>
                <CardDescription>Tiendas con mejores resultados</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData.stores}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
                    <Bar dataKey="ventas" fill="#10b981" name="Ventas (€)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabla de Top Tiendas */}
            <Card>
              <CardHeader>
                <CardTitle>Ranking de Tiendas</CardTitle>
                <CardDescription>Top 10 por desempeño en ventas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {salesMetrics.topStores.map((store, index) => (
                    <div key={store.storeId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          #{index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium text-gray-900">{store.storeName}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {store.cityName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">€{store.totalSales.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{store.totalQuantity} unidades</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Vendedores */}
        <TabsContent value="sellers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Top Vendedores */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Vendedores por Ventas</CardTitle>
                <CardDescription>Rendimiento del equipo de ventas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData.sellers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
                    <Bar dataKey="ventas" fill="#7c3aed" name="Ventas (€)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabla de Top Vendedores */}
            <Card>
              <CardHeader>
                <CardTitle>Ranking de Vendedores</CardTitle>
                <CardDescription>Top 10 por desempeño comercial</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {salesMetrics.topSellers.map((seller, index) => (
                    <div key={seller.sellerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                          #{index + 1}
                        </Badge>
                        <p className="font-medium text-gray-900">{seller.sellerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">€{seller.totalSales.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{seller.totalQuantity} unidades</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

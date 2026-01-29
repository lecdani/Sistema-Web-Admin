import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Badge } from '@/shared/components/base/Badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/base/Dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/base/Table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/base/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import { 
  ArrowLeft,
  ShoppingCart,
  Eye,
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  Calendar,
  Package,
  User as UserIcon,
  Store as StoreIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Layout,
  Image as ImageIcon,
  ExternalLink,
  Printer,
  Upload,
  Edit
} from 'lucide-react';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';
import { Order, OrderItem, Store as StoreType, User, Product, Planogram, OrderFilters, Invoice, POD } from '@/shared/types';
import { toast } from 'sonner';
import { OrderDetailView } from './OrderDetailView';
import { OrderPlanogramView } from './components/OrderPlanogramView';
import { CreateOrderDialog } from './components/CreateOrderDialog';

interface OrderManagementProps {
  onBack: () => void;
}

export function OrderManagement({ onBack }: OrderManagementProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [planograms, setPlanograms] = useState<Planogram[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showPlanogramDialog, setShowPlanogramDialog] = useState(false);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [filters, setFilters] = useState<OrderFilters>({
    dateFrom: '',
    dateTo: '',
    sellerId: 'all',
    storeId: 'all',
    status: 'all'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [orders, searchTerm, filters]);

  const loadData = () => {
    try {
      const ordersData = getFromLocalStorage('app-orders') || [];
      const storesData = getFromLocalStorage('app-stores') || [];
      const usersData = getFromLocalStorage('app-users') || [];
      const productsData = getFromLocalStorage('app-products') || [];
      const planogramsData = getFromLocalStorage('app-planograms') || [];

      // Enriquecer pedidos con información adicional
      const enrichedOrders = ordersData.map((order: Order) => {
        const store = storesData.find((s: StoreType) => s.id === order.storeId);
        const seller = usersData.find((u: User) => u.id === order.salespersonId); // Corregido: salespersonId
        const planogram = planogramsData.find((p: Planogram) => p.id === order.planogramId);

        return {
          ...order,
          storeName: store?.name || 'Tienda no encontrada',
          sellerName: `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim() || 'Vendedor no encontrado',
          planogramName: planogram?.name || 'Sin planograma',
          items: order.items?.map((item: OrderItem) => {
            const product = productsData.find((p: Product) => p.id === item.productId);
            return {
              ...item,
              productName: product?.name || 'Producto no encontrado',
              productBrand: product?.category || 'Sin categoría'
            };
          }) || []
        };
      });

      setOrders(enrichedOrders);
      setStores(storesData);
      setUsers(usersData.filter((u: User) => u.role === 'user')); // Solo vendedores
      setProducts(productsData);
      setPlanograms(planogramsData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar los datos');
    }
  };

  const applyFilters = () => {
    let filtered = [...orders];

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.po.toLowerCase().includes(searchTerm.toLowerCase()) || // Corregido: po es el Purchase Order number
        order.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.sellerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtros específicos
    if (filters.dateFrom) {
      filtered = filtered.filter(order => 
        new Date(order.createdAt) >= new Date(filters.dateFrom!)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(order => 
        new Date(order.createdAt) <= new Date(filters.dateTo!)
      );
    }

    if (filters.sellerId && filters.sellerId !== 'all') {
      filtered = filtered.filter(order => order.salespersonId === filters.sellerId); // Corregido: salespersonId
    }

    if (filters.storeId && filters.storeId !== 'all') {
      filtered = filtered.filter(order => order.storeId === filters.storeId);
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(order => order.status === filters.status);
    }

    setFilteredOrders(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completado
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const handleViewPlanogram = (order: Order) => {
    if (order.planogramId) {
      setSelectedOrder(order);
      setShowPlanogramDialog(true);
    } else {
      toast.error('Este pedido no tiene un planograma asociado');
    }
  };

  const handleEditOrder = (order: Order) => {
    if (order.status === 'completed') {
      toast.error('No se puede editar un pedido completado');
      return;
    }
    setEditingOrder(order);
    setShowCreateOrderDialog(true);
  };

  const exportOrders = () => {
    try {
      const dataStr = JSON.stringify(filteredOrders, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `pedidos_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast.success('Pedidos exportados correctamente');
    } catch (error) {
      console.error('Error exportando pedidos:', error);
      toast.error('Error al exportar los pedidos');
    }
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      sellerId: 'all',
      storeId: 'all',
      status: 'all'
    });
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-blue-100 rounded-lg">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Pedidos</h1>
            <p className="text-gray-500">Administra todos los pedidos del sistema</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportOrders}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowCreateOrderDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pedido
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Total Pedidos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{orders.length}</p>
              </div>
              <div className="p-2.5 bg-indigo-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {orders.filter(o => o.status === 'pending').length}
                </p>
              </div>
              <div className="p-2.5 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Completados</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {orders.filter(o => o.status === 'completed').length}
                </p>
              </div>
              <div className="p-2.5 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Valor Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  €{orders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por PO Number, tienda o vendedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <Select value={filters.sellerId} onValueChange={(value) => setFilters(prev => ({ ...prev, sellerId: value }))}>
                <SelectTrigger className="w-48">
                  <UserIcon className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.storeId} onValueChange={(value) => setFilters(prev => ({ ...prev, storeId: value }))}>
                <SelectTrigger className="w-48">
                  <StoreIcon className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por tienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tiendas</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos ({filteredOrders.length})</CardTitle>
          <CardDescription>
            Lista de todos los pedidos registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow 
                    key={order.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleViewDetail(order)}
                  >
                    <TableCell className="font-medium">{order.po}</TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        {order.sellerName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StoreIcon className="h-4 w-4 text-gray-400" />
                        {order.storeName}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell>€{order.total.toFixed(2)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(order)}
                          title="Ver detalles del pedido"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.planogramId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPlanogram(order)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Ver planograma del pedido"
                          >
                            <Layout className="h-4 w-4" />
                          </Button>
                        )}
                        {order.status !== 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditOrder(order)}
                            className="text-amber-600 hover:text-amber-700"
                            title="Editar pedido"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No se encontraron pedidos
                </h3>
                <p className="text-gray-500">
                  {searchTerm || Object.values(filters).some(v => v !== '' && v !== 'all') 
                    ? 'Intenta ajustar los filtros de búsqueda'
                    : 'No hay pedidos registrados en el sistema'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={showOrderDetail} onOpenChange={setShowOrderDetail}>
        <DialogContent className="!w-[65vw] !max-w-[1200px] max-h-[90vh] overflow-y-auto p-0">
          {selectedOrder && <OrderDetailView order={selectedOrder} />}
        </DialogContent>
      </Dialog>

      {/* Planogram Dialog */}
      <Dialog open={showPlanogramDialog} onOpenChange={setShowPlanogramDialog}>
        <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[98vh] max-h-[98vh] overflow-hidden p-6">
          {selectedOrder && <OrderPlanogramView order={selectedOrder} />}
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={showCreateOrderDialog} onOpenChange={(open) => {
        setShowCreateOrderDialog(open);
        if (!open) {
          setEditingOrder(null); // Limpiar el pedido en edición al cerrar
        }
      }}>
        <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[98vh] max-h-[98vh] overflow-hidden p-0">
          <CreateOrderDialog 
            onClose={() => {
              setShowCreateOrderDialog(false);
              setEditingOrder(null);
            }}
            onOrderCreated={() => {
              loadData();
              setEditingOrder(null);
            }}
            editingOrder={editingOrder}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
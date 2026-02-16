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
import { useLanguage } from '@/shared/hooks/useLanguage';
import { Order, OrderItem, Store as StoreType, User, Product, Planogram, OrderFilters, Invoice, POD } from '@/shared/types';
import { planogramsApi } from '@/shared/services/planograms-api';
import { toast } from 'sonner';
import { OrderDetailView } from './OrderDetailView';
import { OrderPlanogramView } from './components/OrderPlanogramView';
import { CreateOrderDialog } from './components/CreateOrderDialog';

interface OrderManagementProps {
  onBack: () => void;
}

export function OrderManagement({ onBack }: OrderManagementProps) {
  const { translate } = useLanguage();
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

  const loadData = async () => {
    try {
      const ordersData = getFromLocalStorage('app-orders') || [];
      const storesData = getFromLocalStorage('app-stores') || [];
      const usersData = getFromLocalStorage('app-users') || [];
      const productsData = getFromLocalStorage('app-products') || [];
      let planogramsData: Planogram[] = [];
      try {
        planogramsData = await planogramsApi.fetchAll();
      } catch {
        planogramsData = getFromLocalStorage('app-planograms') || [];
      }

      const enrichedOrders = ordersData.map((order: Order) => {
        const store = storesData.find((s: StoreType) => s.id === order.storeId);
        const seller = usersData.find((u: User) => u.id === order.salespersonId);
        const planogram = planogramsData.find((p: Planogram) => p.id === order.planogramId);

        return {
          ...order,
          storeName: store?.name || translate('storeNotFound'),
          sellerName: `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim() || translate('sellerNotFound'),
          planogramName: planogram?.name || translate('noPlanogram'),
          items: order.items?.map((item: OrderItem) => {
            const product = productsData.find((p: Product) => p.id === item.productId);
            return {
              ...item,
              productName: product?.name || translate('productNotFound'),
              productBrand: product?.category || translate('noCategory')
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
      toast.error(translate('errorLoadData'));
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
            {translate('completedStatus')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            {translate('pendingStatus')}
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
      toast.error(translate('orderNoPlanogram'));
    }
  };

  const handleEditOrder = (order: Order) => {
    if (order.status === 'completed') {
      toast.error(translate('cannotEditCompletedOrder'));
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
      
      toast.success(translate('ordersExportedSuccess'));
    } catch (error) {
      console.error('Error exportando pedidos:', error);
      toast.error(translate('errorExportOrders'));
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
            <h1 className="text-2xl font-bold text-gray-900">{translate('ordersTitle')}</h1>
            <p className="text-gray-500">{translate('ordersSubtitle')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportOrders}>
            <Download className="h-4 w-4 mr-2" />
            {translate('export')}
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowCreateOrderDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {translate('newOrder')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalOrders')}</p>
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
                <p className="text-xs font-medium text-gray-500">{translate('pending')}</p>
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
                <p className="text-xs font-medium text-gray-500">{translate('completed')}</p>
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
                <p className="text-xs font-medium text-gray-500">{translate('totalValue')}</p>
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
                  placeholder={translate('searchOrdersPlaceholder')}
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
                  <SelectValue placeholder={translate('filterBySeller')}>
                    {filters.sellerId === 'all' ? translate('allSellers') : (() => { const u = users.find((x) => x.id === filters.sellerId); return u ? `${u.firstName} ${u.lastName}` : null; })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allSellers')}</SelectItem>
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
                  <SelectValue placeholder={translate('filterByStore')}>
                    {filters.storeId === 'all' ? translate('allStores') : stores.find((s) => s.id === filters.storeId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allStores')}</SelectItem>
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
                  <SelectValue placeholder={translate('filterByStatus')}>
                    {filters.status === 'all' && translate('allStatuses')}
                    {filters.status === 'pending' && translate('pendingStatus')}
                    {filters.status === 'completed' && translate('completedStatus')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allStatuses')}</SelectItem>
                  <SelectItem value="pending">{translate('pendingStatus')}</SelectItem>
                  <SelectItem value="completed">{translate('completedStatus')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>{translate('ordersTitle').replace('Gestión de Pedidos', 'Pedidos').replace('Order Management', 'Orders')} ({filteredOrders.length})</CardTitle>
          <CardDescription>
            {translate('ordersListDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate('poNumber')}</TableHead>
                  <TableHead>{translate('date')}</TableHead>
                  <TableHead>{translate('seller')}</TableHead>
                  <TableHead>{translate('storeHeader')}</TableHead>
                  <TableHead>{translate('status')}</TableHead>
                  <TableHead>{translate('ordersTotalColumn')}</TableHead>
                  <TableHead>{translate('actions')}</TableHead>
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
                          title={translate('viewOrderDetails')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.planogramId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPlanogram(order)}
                            className="text-blue-600 hover:text-blue-700"
                            title={translate('viewOrderPlanogram')}
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
                            title={translate('editOrder')}
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
                  {translate('noOrdersSearch')}
                </h3>
                <p className="text-gray-500">
                  {searchTerm || Object.values(filters).some(v => v !== '' && v !== 'all') 
                    ? translate('tryOtherSearchOrders')
                    : translate('noOrdersInSystem')
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
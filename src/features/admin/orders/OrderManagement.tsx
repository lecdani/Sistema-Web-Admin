import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Edit,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/base/DropdownMenu';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { Order, OrderItem, Store as StoreType, User, Product, Planogram, OrderFilters, Invoice, POD } from '@/shared/types';
import { planogramsApi } from '@/shared/services/planograms-api';
import { ordersApi } from '@/shared/services/orders-api';
import { usersApi } from '@/shared/services/users-api';
import { storesApi } from '@/shared/services/stores-api';
import { toast } from 'sonner';
import { OrderDetailView } from './OrderDetailView';
import { OrderPlanogramView } from './components/OrderPlanogramView';
import { EditOrderPlanogram } from './components/EditOrderPlanogram';

interface OrderManagementProps {
  onBack?: () => void;
}

export function OrderManagement({ onBack }: OrderManagementProps) {
  const router = useRouter();
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
  const [planogramDialogMode, setPlanogramDialogMode] = useState<'view' | 'edit'>('view');
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

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
      let storesData = getFromLocalStorage('app-stores') || [];
      const usersData: User[] = getFromLocalStorage('app-users') || [];
      const productsData: Product[] = getFromLocalStorage('app-products') || [];
      let planogramsData: Planogram[] = [];
      try {
        planogramsData = await planogramsApi.fetchAll();
      } catch {
        planogramsData = getFromLocalStorage('app-planograms') || [];
      }

      // Tiendas siempre desde la API para mostrar NOMBRE de tienda en la tabla (no el id)
      try {
        storesData = await storesApi.fetchAll();
        setToLocalStorage('app-stores', storesData);
      } catch (e) {
        console.error('[OrderManagement] Error cargando tiendas desde la API', e);
        if (!storesData.length) storesData = [];
      }

      // Lista de pedidos desde API (getAllOrders usa la misma lógica que la PWA para total/subtotal)
      const apiOrders = await ordersApi.getAllOrders();

      // Mapear al tipo Order del Admin (total/subtotal ya vienen de getAllOrders)
      const mappedOrders: Order[] = apiOrders.map((o) => {
        const rawStatus = (o.status || '').toLowerCase();
        const normalizedStatus: 'completed' | 'pending' =
          rawStatus === 'completed' || rawStatus === 'invoiced' || rawStatus === 'delivered'
            ? 'completed'
            : 'pending';
        const total = Number(o.total) || 0;
        const subtotal = Number(o.subtotal) || 0 || total;

        return {
          id: o.id,
          salespersonId: o.salespersonId || '',
          storeId: o.storeId,
          createdAt: new Date(o.date),
          po: o.id,
          status: normalizedStatus,
          storeName: o.storeName,
          sellerName: undefined,
          planogramId: undefined,
          planogramName: undefined,
          subtotal,
          total,
          notes: undefined,
          updatedAt: new Date(o.date),
          completedAt: normalizedStatus === 'completed' ? new Date(o.date) : undefined,
          items: [],
        };
      });

      // Asegurar que tenemos los datos de los vendedores desde la API cuando falten en local
      const salespersonIds = Array.from(
        new Set(
          mappedOrders
            .map((o) => o.salespersonId)
            .filter((id): id is string => !!id)
        )
      );
      const knownUserIds = new Set(usersData.map((u) => u.id));
      const missingSalespersons = salespersonIds.filter(
        (id) => !knownUserIds.has(id)
      );

      let apiUsers: User[] = [];
      if (missingSalespersons.length > 0) {
        try {
          const fetched = await Promise.all(
            missingSalespersons.map((id) => usersApi.getById(id))
          );
          apiUsers = fetched.filter((u): u is User => u != null);
        } catch (e) {
          console.error(
            '[OrderManagement] Error cargando vendedores desde la API',
            e
          );
        }
      }

      const allUsers: User[] = [
        ...usersData,
        ...apiUsers.filter((u) => !knownUserIds.has(u.id)),
      ];

      const enrichedOrders = mappedOrders.map((order: Order) => {
        const store = storesData.find((s: StoreType) => String(s.id) === String(order.storeId));
        const seller = allUsers.find((u: User) => u.id === order.salespersonId);
        const planogram = planogramsData.find((p: Planogram) => p.id === order.planogramId);

        return {
          ...order,
          storeName: store?.name || order.storeName || translate('storeNotFound'),
          sellerName:
            `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim() ||
            order.sellerName ||
            translate('sellerNotFound'),
          planogramName: planogram?.name || order.planogramName || translate('noPlanogram'),
          items:
            order.items?.map((item: OrderItem) => {
              const product = productsData.find((p: Product) => p.id === item.productId);
              return {
                ...item,
                productName: item.productName || product?.name || translate('productNotFound'),
                productBrand: item.productBrand || product?.category || translate('noCategory'),
              };
            }) || [],
        };
      });

      setOrders(enrichedOrders);
      // Sincronizar con el almacenamiento local para mantener compatibilidad con otras pantallas
      setToLocalStorage('app-orders', enrichedOrders);
      setStores(storesData);
      setUsers(allUsers.filter((u: User) => u.role === 'user')); // Solo vendedores
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

    // Ordenar por fecha: más recientes primero
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
      setPlanogramDialogMode('view');
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
    setSelectedOrder(order);
    setPlanogramDialogMode('edit');
    setShowPlanogramDialog(true);
  };

  const handleEditOrderSaved = (orderId: string) => {
    setShowPlanogramDialog(false);
    loadData();
    setSelectedOrder({
      id: orderId,
      storeId: '',
      createdAt: new Date(),
      po: orderId,
      status: 'pending',
      storeName: '',
      sellerName: undefined,
      planogramId: undefined,
      planogramName: undefined,
      subtotal: 0,
      total: 0,
      notes: undefined,
      updatedAt: new Date(),
      completedAt: undefined,
      items: [],
      salespersonId: '',
    } as Order);
    setShowOrderDetail(true);
  };

  const handleDeleteOrderClick = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    if ((order.status || '').toLowerCase() !== 'pending') {
      toast.error('Solo se puede eliminar pedidos en estado pendiente.');
      return;
    }
    setOrderToDelete(order);
  };

  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setDeletingOrderId(orderToDelete.id);
    const ok = await ordersApi.deleteOrder(orderToDelete.id);
    setDeletingOrderId(null);
    setOrderToDelete(null);
    if (ok) {
      toast.success('Pedido eliminado.');
      loadData();
    } else {
      toast.error('No se pudo eliminar el pedido.');
    }
  };

  const escapeCsv = (v: string | number | undefined | null): string => {
    const s = v == null ? '' : String(v).trim();
    if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const exportOrders = () => {
    try {
      const BOM = '\uFEFF';
      const sep = ';';
      const lines: string[] = [];
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      // Bloque de cabecera profesional
      lines.push('');
      lines.push('ETERNAL COSMETICS, LLC');
      lines.push('Informe de pedidos');
      lines.push('');
      lines.push(`Generado;${dateStr} a las ${timeStr}`);
      const hasFilters = !!(filters.dateFrom || filters.dateTo || filters.sellerId !== 'all' || filters.storeId !== 'all' || filters.status !== 'all');
      lines.push(`Filtros aplicados;${hasFilters ? 'Sí' : 'Todos'}`);
      if (filters.dateFrom || filters.dateTo) {
        lines.push(`Rango fechas;${filters.dateFrom || '—'} a ${filters.dateTo || '—'}`);
      }
      lines.push('');
      lines.push('========================================');
      lines.push('  DETALLE DE PEDIDOS');
      lines.push('========================================');
      lines.push('');

      // Encabezados de datos
      const headers = ['Nº Pedido', 'ID', 'Fecha', 'Estado', 'Tienda', 'Vendedor', 'Subtotal ($)', 'Total ($)', 'Notas'];
      lines.push(headers.join(sep));
      let sumSubtotal = 0;
      let sumTotal = 0;
      for (const o of filteredOrders) {
        const subtotal = Number(o.subtotal ?? 0);
        const total = Number(o.total ?? 0);
        sumSubtotal += subtotal;
        sumTotal += total;
        const row = [
          escapeCsv(o.po ?? o.id),
          escapeCsv(o.id),
          new Date(o.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          (o.status === 'completed' ? 'Completado' : 'Pendiente'),
          escapeCsv(o.storeName),
          escapeCsv(o.sellerName),
          subtotal.toFixed(2),
          total.toFixed(2),
          escapeCsv((o as any).notes),
        ];
        lines.push(row.join(sep));
      }

      // Pie con resumen
      lines.push('');
      lines.push('========================================');
      lines.push('  RESUMEN');
      lines.push('========================================');
      lines.push('');
      lines.push(`Total pedidos exportados;${filteredOrders.length}`);
      lines.push(`Pendientes;${filteredOrders.filter((o) => (o.status || '').toLowerCase() === 'pending').length}`);
      lines.push(`Completados;${filteredOrders.filter((o) => (o.status || '').toLowerCase() === 'completed').length}`);
      lines.push(`Suma subtotales ($);${sumSubtotal.toFixed(2)}`);
      lines.push(`Suma totales ($);${sumTotal.toFixed(2)}`);
      lines.push('');
      lines.push('========================================');
      lines.push('  Fin del informe');
      lines.push('========================================');
      lines.push('');

      const csv = BOM + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Informe_Pedidos_${now.toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
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
                  ${Number(orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)).toFixed(2)}
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
                    <TableCell className="font-medium tabular-nums whitespace-nowrap">${Number(order.total ?? 0).toFixed(2)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-center">
                      <div className="flex items-center justify-center">
                        {(order.status || '').toLowerCase() === 'completed' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg border-slate-200 bg-white px-3 text-slate-600 shadow-sm hover:bg-slate-50"
                            onClick={() => handleViewDetail(order)}
                            title={translate('viewOrderDetails')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="hidden sm:inline">Acciones</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" usePortal className="min-w-[14rem] py-1.5">
                              <DropdownMenuItem onClick={() => handleViewDetail(order)} className="gap-3 py-3 px-4 text-base text-slate-800 hover:bg-slate-100 cursor-pointer">
                                <Eye className="h-4 w-4 shrink-0" />
                                <span>{translate('viewOrderDetails')}</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditOrder(order)} className="gap-3 py-3 px-4 text-base text-slate-800 hover:bg-slate-100 cursor-pointer">
                                <Edit className="h-4 w-4 shrink-0" />
                                <span>{translate('editOrder')}</span>
                              </DropdownMenuItem>
                              {(order.status || '').toLowerCase() === 'pending' && (
                                <DropdownMenuItem
                                  onClick={(e) => handleDeleteOrderClick(order, e as unknown as React.MouseEvent)}
                                  className="gap-3 py-3 px-4 text-base text-red-600 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />
                                  <span>Eliminar pedido</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
          {selectedOrder && (
            <OrderDetailView
              orderId={selectedOrder.id}
              onClose={() => {
                setShowOrderDetail(false);
                setSelectedOrder(null);
                loadData();
              }}
              onOrderUpdated={loadData}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal confirmar eliminar pedido */}
      <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader className="pb-2">
            <DialogTitle>Eliminar pedido</DialogTitle>
            <DialogDescription>
              ¿Eliminar este pedido? No podrás deshacer esta acción.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setOrderToDelete(null)} disabled={!!deletingOrderId}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteOrder} disabled={!!deletingOrderId}>
              {deletingOrderId ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Planogram Dialog (ver solo lectura o editar como en PWA) */}
      <Dialog open={showPlanogramDialog} onOpenChange={setShowPlanogramDialog}>
        <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[98vh] max-h-[98vh] overflow-hidden p-6">
          {selectedOrder && planogramDialogMode === 'edit' && (
            <EditOrderPlanogram
              order={selectedOrder}
              onClose={() => setShowPlanogramDialog(false)}
              onSaved={handleEditOrderSaved}
            />
          )}
          {selectedOrder && planogramDialogMode === 'view' && (
            <OrderPlanogramView
              order={selectedOrder}
              onViewOrder={() => {
                setShowPlanogramDialog(false);
                setShowOrderDetail(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
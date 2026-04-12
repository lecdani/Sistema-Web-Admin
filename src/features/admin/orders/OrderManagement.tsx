import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Badge } from '@/shared/components/base/Badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/base/Dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/base/Table';
import { SearchableSelect } from '@/shared/components/base/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import { 
  ArrowLeft,
  ShoppingCart,
  Eye,
  Search,
  Filter,
  Download,
  Calendar,
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
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { OrderDetailView } from './OrderDetailView';
import { OrderPlanogramView } from './components/OrderPlanogramView';

interface OrderManagementProps {
  onBack?: () => void;
}

export function OrderManagement({ onBack }: OrderManagementProps) {
  const router = useRouter();
  const { translate, locale } = useLanguage();
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

  /** Alineado con backend: 1=creado, 2=facturado, 3=cancelado (sin estado "confirmado" separado). */
  const getOrderLifecycleStatus = (orderLike: {
    status?: string;
    invoiceId?: string | number;
  }): 'initial' | 'invoiced' | 'cancelled' => {
    const s = String(orderLike?.status || '').toLowerCase().trim();
    if (s === 'cancelled' || s === 'canceled' || s === 'cancelado' || s === '3') return 'cancelled';
    if (
      s === 'invoiced' ||
      s === 'delivered' ||
      s === '2' ||
      s === 'completed' ||
      s === 'confirmed' ||
      s === 'confirmado'
    ) {
      return 'invoiced';
    }
    return 'initial';
  };

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
        const normalizedStatus: Order['status'] =
          rawStatus === 'invoiced' ||
          rawStatus === 'delivered' ||
          rawStatus === '2' ||
          rawStatus === 'completed' ||
          rawStatus === 'confirmed' ||
          rawStatus === 'confirmado'
            ? 'invoiced'
            : rawStatus === 'cancelled' || rawStatus === 'canceled' || rawStatus === 'cancelado' || rawStatus === '3'
            ? 'cancelled'
            : 'initial';
        const total = Number(o.total) || 0;
        const subtotal = Number(o.subtotal) || 0 || total;

        const ui = o as import('@/shared/services/orders-api').OrderForUI;
        return {
          id: o.id,
          salespersonId: o.salespersonId || '',
          storeId: o.storeId,
          createdAt: new Date(o.date),
          po: (ui.po ?? '').trim(),
          status: normalizedStatus,
          storeName: o.storeName,
          sellerName: undefined,
          planogramId: ui.planogramId,
          planogramName: undefined,
          subtotal,
          total,
          notes: undefined,
          updatedAt: new Date(o.date),
          completedAt: normalizedStatus !== 'initial' ? new Date(o.date) : undefined,
          invoiceId: ui.invoiceId,
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
      filtered = filtered.filter(
        (order) => getOrderLifecycleStatus(order) === filters.status
      );
    }

    // Ordenar por fecha: más recientes primero
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredOrders(filtered);
  };

  const getStatusBadge = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    switch (s) {
      case 'invoiced':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {translate('statusInvoiced')}
          </Badge>
        );
      case 'confirmed':
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {translate('statusInvoiced')}
          </Badge>
        );
      case 'initial':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            {translate('initialStatus')}
          </Badge>
        );
      case 'canceled':
      case 'cancelled':
      case 'cancelado':
      case '3':
        return (
          <Badge variant="secondary" className="bg-slate-200 text-slate-800 border-slate-300">
            <AlertCircle className="h-3 w-3 mr-1" />
            {translate('statusCancelled') || 'Cancelado'}
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'invoiced':
        return <CheckCircle className="h-4 w-4" />;
      case 'confirmed':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'initial':
        return <Clock className="h-4 w-4" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" />;
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

  const handleDeleteOrderClick = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    const life = getOrderLifecycleStatus(order);
    if (life !== 'cancelled') {
      toast.error(translate('onlyDeleteCancelledOrders') || translate('onlyDeletePendingOrders'));
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
      toast.success(translate('orderDeleted'));
      loadData();
    } else {
      toast.error(translate('orderDeleteFailed'));
    }
  };

  const exportOrders = async (scope: 'all' | 'initial' | 'invoiced' = 'all') => {
    try {
      const sectionFont = { bold: true, size: 11 };
      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E293B' } };
      const headerFont = { color: { argb: 'FFFFFFFF' as const }, bold: true };

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(locale.startsWith('es') ? 'Pedidos' : 'Orders', { views: [{ state: 'frozen', ySplit: 1 }] });
      const now = new Date();
      const genDate = now.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' });
      let row = 1;

      ws.getCell(row, 1).value = translate('reportCompanyName');
      ws.getCell(row, 1).font = { bold: true, size: 16 };
      row += 1;
      ws.getCell(row, 1).value = translate('reportConfidential');
      ws.getCell(row, 1).font = { size: 9, color: { argb: 'FF64748B' } };
      row += 1;
      ws.getCell(row, 1).value = translate('ordersReportTitle');
      ws.getCell(row, 1).font = { size: 10 };
      row += 2;

      ws.getCell(row, 1).value = `${translate('generatedLabel')}: ${genDate}`;
      row += 1;
      const hasFilters = !!(filters.dateFrom || filters.dateTo || filters.sellerId !== 'all' || filters.storeId !== 'all' || filters.status !== 'all');
      ws.getCell(row, 1).value = (locale.startsWith('es') ? 'Filtros' : 'Filters') + ': ' + (hasFilters ? (locale.startsWith('es') ? 'Sí' : 'Yes') : (locale.startsWith('es') ? 'Todos' : 'All'));
      if (filters.dateFrom || filters.dateTo) {
        ws.getCell(row, 2).value = `${filters.dateFrom || '—'} ${translate('to')} ${filters.dateTo || '—'}`;
      }
      row += 2;

      ws.getCell(row, 1).value = translate('ordersDetailSection');
      ws.getCell(row, 1).font = sectionFont;
      row += 1;

      const orderHeaders = [
        translate('poNumber'),
        'ID',
        translate('date'),
        translate('status'),
        translate('storeHeader'),
        translate('seller'),
        translate('subtotal'),
        translate('ordersTotalColumn'),
        translate('orderNotes')
      ];
      orderHeaders.forEach((val, c) => {
        const cell = ws.getCell(row, c + 1);
        cell.value = val;
        cell.fill = headerFill;
        cell.font = headerFont;
      });
      row += 1;

      const exportRows =
        scope === 'all'
          ? filteredOrders
          : filteredOrders.filter((o) => getOrderLifecycleStatus(o) === scope);
      let sumSubtotal = 0;
      let sumTotal = 0;
      for (const o of exportRows) {
        const subtotal = Number(o.subtotal ?? 0);
        const total = Number(o.total ?? 0);
        sumSubtotal += subtotal;
        sumTotal += total;
        const lifecycle = getOrderLifecycleStatus({
          status: (o as any).status,
          invoiceId: (o as any).invoiceId,
        });
        const statusLabel =
          lifecycle === 'invoiced'
            ? translate('statusInvoiced')
            : lifecycle === 'cancelled'
            ? translate('statusCancelled') || 'Cancelado'
            : translate('initialStatus');
        ws.getCell(row, 1).value = (o as any).po ?? o.id ?? '';
        ws.getCell(row, 2).value = o.id ?? '';
        ws.getCell(row, 3).value = new Date((o as any).createdAt ?? new Date().toISOString()).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
        ws.getCell(row, 4).value = statusLabel;
        ws.getCell(row, 5).value = (o as any).storeName ?? '';
        ws.getCell(row, 6).value = (o as any).sellerName ?? '';
        ws.getCell(row, 7).value = Number(subtotal.toFixed(2));
        ws.getCell(row, 8).value = Number(total.toFixed(2));
        ws.getCell(row, 9).value = (o as any).notes ?? '';
        row += 1;
      }
      row += 1;

      ws.getCell(row, 1).value = translate('ordersSummarySection');
      ws.getCell(row, 1).font = sectionFont;
      row += 1;
      ws.getCell(row, 1).value = translate('ordersTotalExported');
      ws.getCell(row, 1).font = { bold: true };
      ws.getCell(row, 2).value = exportRows.length;
      row += 1;
      ws.getCell(row, 1).value = translate('initialStatus');
      ws.getCell(row, 2).value = exportRows.filter((o) => getOrderLifecycleStatus(o) === 'initial').length;
      row += 1;
      ws.getCell(row, 1).value = translate('statusInvoiced');
      ws.getCell(row, 2).value = exportRows.filter((o) => getOrderLifecycleStatus(o) === 'invoiced').length;
      row += 1;
      ws.getCell(row, 1).value = translate('statusCancelled') || 'Cancelado';
      ws.getCell(row, 2).value = exportRows.filter((o) => getOrderLifecycleStatus(o) === 'cancelled').length;
      row += 1;
      ws.getCell(row, 1).value = translate('ordersSumSubtotals');
      ws.getCell(row, 2).value = Number(sumSubtotal.toFixed(2));
      row += 1;
      ws.getCell(row, 1).value = translate('ordersSumTotals');
      ws.getCell(row, 2).value = Number(sumTotal.toFixed(2));
      row += 2;

      ws.getCell(row, 1).value = translate('ordersReportEnd') + ' — ' + translate('reportPreparedBy');
      ws.getCell(row, 1).font = { size: 9, color: { argb: 'FF64748B' } };

      ws.columns = [
        { width: 14 }, { width: 28 }, { width: 12 }, { width: 12 }, { width: 22 },
        { width: 20 }, { width: 12 }, { width: 12 }, { width: 28 }
      ];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const scopeSuffix =
        scope === 'initial'
          ? 'Iniciales'
          : scope === 'invoiced'
          ? 'Facturados'
          : 'Todos';
      link.download = `Informe_Pedidos_${scopeSuffix}_${now.toISOString().slice(0, 10)}.xlsx`;
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

  const orderMetrics = useMemo(() => {
    const source = filteredOrders.length > 0 ? filteredOrders : orders;
    const totalOrders = source.length;
    const initialCount = source.filter((o) => getOrderLifecycleStatus(o) === 'initial').length;
    const invoicedCount = source.filter((o) => getOrderLifecycleStatus(o) === 'invoiced').length;
    const cancelledCount = source.filter((o) => getOrderLifecycleStatus(o) === 'cancelled').length;
    return {
      totalOrders,
      initialCount,
      invoicedCount,
      cancelledCount,
    };
  }, [orders, filteredOrders]);

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
          <Button variant="outline" onClick={() => exportOrders('all')}>
            <Download className="h-4 w-4 mr-2" />
            {translate('export')} (Todo)
          </Button>
          <Button variant="outline" onClick={() => exportOrders('initial')}>
            <Download className="h-4 w-4 mr-2" />
            {translate('initialStatus')}
          </Button>
          <Button variant="outline" onClick={() => exportOrders('invoiced')}>
            <Download className="h-4 w-4 mr-2" />
            {translate('statusInvoiced')}
          </Button>
        </div>
      </div>

      {/* Métricas (estados backend: creado / facturado / cancelado) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{translate('totalOrders')}</p>
                <p className="text-2xl font-bold text-slate-900">{orderMetrics.totalOrders}</p>
              </div>
              <div className="rounded-lg bg-indigo-100 p-2.5">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{translate('initialStatus')}</p>
                <p className="text-2xl font-bold text-amber-700">{orderMetrics.initialCount}</p>
              </div>
              <div className="rounded-lg bg-amber-100 p-2.5">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{translate('statusInvoiced')}</p>
                <p className="text-2xl font-bold text-green-700">{orderMetrics.invoicedCount}</p>
              </div>
              <div className="rounded-lg bg-green-100 p-2.5">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{translate('statusCancelled') || 'Cancelados'}</p>
                <p className="text-2xl font-bold text-slate-700">{orderMetrics.cancelledCount}</p>
              </div>
              <div className="rounded-lg bg-slate-200 p-2.5">
                <X className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </CardContent>
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
              <div className="flex items-center gap-2 w-48 min-w-0">
                <UserIcon className="h-4 w-4 shrink-0 text-gray-500" />
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={filters.sellerId}
                  placeholder={translate('filterBySeller')}
                  clearable
                  clearToValue="all"
                  options={[
                    { value: 'all', label: translate('allSellers') },
                    ...users.map((u) => ({
                      value: u.id,
                      label: `${u.firstName} ${u.lastName}`,
                    })),
                  ]}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, sellerId: value }))}
                />
              </div>

              <div className="flex items-center gap-2 w-48 min-w-0">
                <StoreIcon className="h-4 w-4 shrink-0 text-gray-500" />
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={filters.storeId}
                  placeholder={translate('filterByStore')}
                  clearable
                  clearToValue="all"
                  options={[
                    { value: 'all', label: translate('allStores') },
                    ...stores.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, storeId: value }))}
                />
              </div>

              <div className="flex items-center gap-2 w-48 min-w-0">
                <Filter className="h-4 w-4 shrink-0 text-gray-500" />
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={filters.status}
                  placeholder={translate('filterByStatus')}
                  clearable
                  clearToValue="all"
                  options={[
                    { value: 'all', label: translate('allStatuses') },
                    { value: 'initial', label: translate('initialStatus') },
                    { value: 'invoiced', label: translate('statusInvoiced') },
                    { value: 'cancelled', label: translate('statusCancelled') || 'Cancelado' },
                  ]}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                />
              </div>
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
                    <TableCell className="font-medium">{order.po ? `${order.po}` : '—'}</TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleDateString(locale)}
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
                        {getOrderLifecycleStatus(order) === 'invoiced' ? (
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
                                <span className="hidden sm:inline">{translate('actions')}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" usePortal className="min-w-[14rem] py-1.5">
                              <DropdownMenuItem onClick={() => handleViewDetail(order)} className="gap-3 py-3 px-4 text-base text-slate-800 hover:bg-slate-100 cursor-pointer">
                                <Eye className="h-4 w-4 shrink-0" />
                                <span>{translate('viewOrderDetails')}</span>
                              </DropdownMenuItem>
                              {getOrderLifecycleStatus(order) === 'cancelled' && (
                                <DropdownMenuItem
                                  onClick={(e) => handleDeleteOrderClick(order, e as unknown as React.MouseEvent)}
                                  className="gap-3 py-3 px-4 text-base text-red-600 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />
                                  <span>{translate('deleteOrder')}</span>
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
        <DialogContent className="order-detail-dialog-inner !w-[65vw] !max-w-[1200px] max-h-[90vh] overflow-y-auto p-0">
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
            <DialogTitle>{translate('deleteOrder')}</DialogTitle>
            <DialogDescription>
              {translate('deleteOrderConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setOrderToDelete(null)} disabled={!!deletingOrderId}>
              {translate('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteOrder} disabled={!!deletingOrderId}>
              {deletingOrderId ? translate('deleting') : translate('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Planogram Dialog (ver solo lectura o editar) */}
      <Dialog open={showPlanogramDialog} onOpenChange={setShowPlanogramDialog}>
        <DialogContent className="!w-[65vw] !max-w-[1200px] max-h-[90vh] overflow-y-auto p-0">
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
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
import { Textarea } from '@/shared/components/base/Textarea';
import { 
  ArrowLeft,
  FileImage,
  Eye,
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  User as UserIcon,
  Store as StoreIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  ShoppingCart,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { POD, Store, User, Order, Invoice, PODFilters, IntegrityIssue } from '@/shared/types';
import { toast } from 'sonner';

interface PODManagementProps {
  onBack?: () => void;
}

export function PODManagement({ onBack }: PODManagementProps) {
  const router = useRouter();
  const { translate, locale } = useLanguage();
  const [pods, setPods] = useState<POD[]>([]);
  const [filteredPods, setFilteredPods] = useState<POD[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPod, setSelectedPod] = useState<POD | null>(null);
  const [showPodDetail, setShowPodDetail] = useState(false);
  const [showIntegrityIssues, setShowIntegrityIssues] = useState(false);

  const [filters, setFilters] = useState<PODFilters>({
    sellerId: 'all',
    storeId: 'all',
    isValidated: undefined
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [pods, searchTerm, filters]);

  useEffect(() => {
    checkIntegrity();
  }, [pods, orders, invoices, translate]);

  const loadData = () => {
    try {
      const podsData = getFromLocalStorage('app-pods') || [];
      const storesData = getFromLocalStorage('app-stores') || [];
      const usersData = getFromLocalStorage('app-users') || [];
      const ordersData = getFromLocalStorage('app-orders') || [];
      const invoicesData = getFromLocalStorage('app-invoices') || [];

      // Enriquecer PODs con información adicional
      const enrichedPods = podsData.map((pod: POD) => {
        const store = storesData.find((s: Store) => s.id === pod.storeId);
        const seller = usersData.find((u: User) => u.id === pod.salespersonId); // Corregido: salespersonId
        const uploader = usersData.find((u: User) => u.id === pod.uploadedBy);
        const order = ordersData.find((o: Order) => o.id === pod.orderId);
        const invoice = invoicesData.find((i: Invoice) => i.id === pod.invoiceId);

        return {
          ...pod,
          storeName: store?.name || translate('storeNotFound'),
          sellerName: `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim() || translate('sellerNotFound'),
          uploadedByName: `${uploader?.firstName || ''} ${uploader?.lastName || ''}`.trim() || translate('userNotFound'),
          orderNumber: order?.po || translate('noPo'),
          invoiceNumber: invoice?.invoiceNumber || translate('noInvoice')
        };
      });

      setPods(enrichedPods);
      setStores(storesData);
      setUsers(usersData);
      setOrders(ordersData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error(translate('errorLoadData'));
    }
  };

  const applyFilters = () => {
    let filtered = [...pods];

    // Filtro por búsqueda (incluyendo detección de rango de fechas)
    if (searchTerm) {
      // Detectar rango de fechas en el formato: YYYY-MM-DD YYYY-MM-DD
      const dateRangeMatch = searchTerm.match(/(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})/);
      
      if (dateRangeMatch) {
        const [_, dateFrom, dateTo] = dateRangeMatch;
        filtered = filtered.filter(pod => {
          const podDate = new Date(pod.uploadedAt);
          const fromDate = new Date(dateFrom);
          const toDate = new Date(dateTo);
          return podDate >= fromDate && podDate <= toDate;
        });
      } else {
        // Búsqueda normal por texto
        filtered = filtered.filter(pod =>
          pod.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pod.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pod.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pod.sellerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pod.uploadedByName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    }

    if (filters.sellerId && filters.sellerId !== 'all') {
      filtered = filtered.filter(pod => pod.salespersonId === filters.sellerId); // Corregido: salespersonId
    }

    if (filters.storeId && filters.storeId !== 'all') {
      filtered = filtered.filter(pod => pod.storeId === filters.storeId);
    }

    if (filters.isValidated !== undefined) {
      filtered = filtered.filter(pod => pod.isValidated === filters.isValidated);
    }

    setFilteredPods(filtered);
  };

  const checkIntegrity = () => {
    const issues: IntegrityIssue[] = [];

    // Buscar pedidos sin POD
    orders.forEach(order => {
      if (order.status === 'delivered') {
        const hasPod = pods.some(pod => pod.orderId === order.id);
        if (!hasPod) {
          issues.push({
            id: `order-${order.id}`,
            type: 'order_without_invoice',
            orderId: order.id,
            description: translate('orderWithoutPod').replace('{po}', order.po || order.id),
            severity: 'high',
            createdAt: new Date()
          });
        }
      }
    });

    // Buscar facturas sin POD
    invoices.forEach(invoice => {
      if (invoice.status === 'paid') {
        const hasPod = pods.some(pod => pod.invoiceId === invoice.id);
        if (!hasPod) {
          issues.push({
            id: `invoice-${invoice.id}`,
            type: 'invoice_without_pod',
            invoiceId: invoice.id,
            description: translate('invoiceWithoutPod').replace('{invoice}', invoice.invoiceNumber),
            severity: 'medium',
            createdAt: new Date()
          });
        }
      }
    });

    // Buscar PODs huérfanos
    pods.forEach(pod => {
      if (pod.orderId) {
        const orderExists = orders.some(order => order.id === pod.orderId);
        if (!orderExists) {
          issues.push({
            id: `pod-${pod.id}`,
            type: 'orphan_pod',
            podId: pod.id,
            description: translate('orphanPodOrder').replace('{id}', pod.id),
            severity: 'low',
            createdAt: new Date()
          });
        }
      }

      if (pod.invoiceId) {
        const invoiceExists = invoices.some(invoice => invoice.id === pod.invoiceId);
        if (!invoiceExists) {
          issues.push({
            id: `pod-invoice-${pod.id}`,
            type: 'orphan_pod',
            podId: pod.id,
            description: translate('orphanPodInvoice').replace('{id}', pod.id),
            severity: 'low',
            createdAt: new Date()
          });
        }
      }
    });

    setIntegrityIssues(issues);
  };

  const getValidationBadge = (isValidated: boolean) => {
    return isValidated ? (
      <Badge className="bg-green-100 text-green-800">
        {translate('validated')}
      </Badge>
    ) : (
      <Badge className="bg-yellow-100 text-yellow-800">
        {translate('pendingStatus')}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      low: { label: translate('severityLow'), color: 'bg-blue-100 text-blue-800' },
      medium: { label: translate('severityMedium'), color: 'bg-yellow-100 text-yellow-800' },
      high: { label: translate('severityHigh'), color: 'bg-red-100 text-red-800' }
    };

    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.low;
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const handleViewDetail = (pod: POD) => {
    setSelectedPod(pod);
    setShowPodDetail(true);
  };

  const handleValidatePod = async (podId: string) => {
    try {
      const updatedPods = pods.map(pod => 
        pod.id === podId 
          ? { ...pod, isValidated: true, validatedAt: new Date(), validatedBy: 'current-user' }
          : pod
      );
      
      setPods(updatedPods);
      setToLocalStorage('app-pods', updatedPods);
      
      toast.success(translate('podValidatedSuccess'));
    } catch (error) {
      console.error('Error validando POD:', error);
      toast.error(translate('errorValidatePod'));
    }
  };

  const handleDeletePod = async (podId: string) => {
    try {
      const updatedPods = pods.filter(pod => pod.id !== podId);
      
      setPods(updatedPods);
      setToLocalStorage('app-pods', updatedPods);
      
      toast.success(translate('podDeletedSuccess'));
      
      if (selectedPod?.id === podId) {
        setShowPodDetail(false);
        setSelectedPod(null);
      }
    } catch (error) {
      console.error('Error eliminando POD:', error);
      toast.error(translate('errorDeletePod'));
    }
  };

  const exportSinglePod = (pod: POD) => {
    try {
      const dataStr = JSON.stringify(pod, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `pod_${pod.id}_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast.success(translate('podExportedSuccess'));
    } catch (error) {
      console.error('Error exportando POD:', error);
      toast.error(translate('errorExportPod'));
    }
  };

  const clearFilters = () => {
    setFilters({
      sellerId: 'all',
      storeId: 'all',
      isValidated: undefined
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
          <div className="p-2.5 bg-green-100 rounded-lg">
            <FileImage className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('podsTitle')}</h1>
            <p className="text-gray-500">{translate('podsSubtitle')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowIntegrityIssues(true)}
            className={integrityIssues.length > 0 ? 'border-red-200 text-red-600' : ''}
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            <span className="whitespace-nowrap">{translate('integrity')} ({integrityIssues.length})</span>
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Upload className="h-3.5 w-3.5 mr-1" />
            <span className="whitespace-nowrap">{translate('uploadPod')}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalPods')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{pods.length}</p>
              </div>
              <div className="p-2.5 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FileImage className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('pendingLabel')}</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {pods.filter(p => !p.isValidated).length}
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
                <p className="text-xs font-medium text-gray-500">{translate('validatedLabel')}</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {pods.filter(p => p.isValidated).length}
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
                <p className="text-xs font-medium text-gray-500">{translate('problems')}</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {integrityIssues.length}
                </p>
              </div>
              <div className="p-2.5 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
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
                  placeholder={translate('searchPodsPlaceholder')}
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
                    {filters.sellerId === 'all' ? translate('allSellers') : (() => { const u = users.filter(x => x.role === 'user').find((x) => x.id === filters.sellerId); return u ? `${u.firstName} ${u.lastName}` : null; })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allSellers')}</SelectItem>
                  {users.filter(u => u.role === 'user').map((user) => (
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

              <Select 
                value={filters.isValidated === undefined ? 'all' : filters.isValidated.toString()} 
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  isValidated: value === 'all' ? undefined : value === 'true' 
                }))}
              >
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={translate('filterByStatus')}>
                    {filters.isValidated === undefined && translate('allStatuses')}
                    {filters.isValidated === true && translate('validatedFilter')}
                    {filters.isValidated === false && translate('pendingFilter')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allStatuses')}</SelectItem>
                  <SelectItem value="true">{translate('validatedFilter')}</SelectItem>
                  <SelectItem value="false">{translate('pendingFilter')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PODs Table */}
      <Card>
        <CardHeader>
          <CardTitle>{translate('deliveryReceiptsList')} ({filteredPods.length})</CardTitle>
          <CardDescription>
            {translate('listOfPods')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate('imageCol')}</TableHead>
                  <TableHead>{translate('orderInvoiceCol')}</TableHead>
                  <TableHead>{translate('uploadDateCol')}</TableHead>
                  <TableHead>{translate('uploadedByCol')}</TableHead>
                  <TableHead>{translate('sellerLabel')}</TableHead>
                  <TableHead>{translate('storeLabel')}</TableHead>
                  <TableHead>{translate('statusLabel')}</TableHead>
                  <TableHead>{translate('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPods.map((pod) => (
                  <TableRow key={pod.id}>
                    <TableCell>
                      <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {pod.orderNumber && pod.orderNumber !== translate('noOrder') && (
                          <div className="flex items-center gap-1 text-sm">
                            <ShoppingCart className="h-3 w-3 text-gray-400" />
                            {pod.orderNumber}
                          </div>
                        )}
                        {pod.invoiceNumber && pod.invoiceNumber !== translate('noInvoice') && (
                          <div className="flex items-center gap-1 text-sm">
                            <FileText className="h-3 w-3 text-gray-400" />
                            {pod.invoiceNumber}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(pod.uploadedAt).toLocaleDateString(locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        {pod.uploadedByName}
                      </div>
                    </TableCell>
                    <TableCell>{pod.sellerName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StoreIcon className="h-4 w-4 text-gray-400" />
                        {pod.storeName}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getValidationBadge(pod.isValidated)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(pod)}
                          title={translate('viewDetail')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportSinglePod(pod)}
                          title={translate('exportPodTitle')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {!pod.isValidated && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleValidatePod(pod.id)}
                            title={translate('validatePodTitle')}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePod(pod.id)}
                          title={translate('deletePodTitle')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredPods.length === 0 && (
              <div className="text-center py-12">
                <FileImage className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {translate('noPodsSearch')}
                </h3>
                <p className="text-gray-500">
                  {searchTerm || Object.entries(filters).some(([key, value]) => 
                    key === 'isValidated' ? value !== undefined : (value !== '' && value !== 'all')
                  ) 
                    ? translate('tryOtherSearchPods')
                    : translate('noPodsInSystem')
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* POD Detail Dialog */}
      <Dialog open={showPodDetail} onOpenChange={setShowPodDetail}>
        <DialogContent className="!w-[75vw] !max-w-[1300px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate('podDetailTitle')}</DialogTitle>
            <DialogDescription>
              {translate('podDetailDesc')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPod && (
            <div className="space-y-6">
              {/* POD Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translate('generalInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('statusLabel')}:</span>
                      {getValidationBadge(selectedPod.isValidated)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('orderLabel')}:</span>
                      <span>{selectedPod.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('invoiceLabel')}:</span>
                      <span>{selectedPod.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('sellerLabel')}:</span>
                      <span>{selectedPod.sellerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('storeLabel')}:</span>
                      <span>{selectedPod.storeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('uploadedByLabel')}:</span>
                      <span>{selectedPod.uploadedByName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('uploadDateLabel')}:</span>
                      <span>{new Date(selectedPod.uploadedAt).toLocaleString(locale)}</span>
                    </div>
                    {selectedPod.validatedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">{translate('validationDate')}:</span>
                        <span>{new Date(selectedPod.validatedAt).toLocaleString(locale)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translate('podImageTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">{translate('previewNotAvailable')}</p>
                        <Button variant="outline" size="sm" className="mt-2">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {translate('viewImage')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notes */}
              {selectedPod.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translate('notes')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{selectedPod.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => exportSinglePod(selectedPod)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {translate('exportPod')}
                </Button>
                {!selectedPod.isValidated && (
                  <Button
                    onClick={() => {
                      handleValidatePod(selectedPod.id);
                      setShowPodDetail(false);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {translate('validatePod')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleDeletePod(selectedPod.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {translate('deletePod')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Integrity Issues Dialog */}
      <Dialog open={showIntegrityIssues} onOpenChange={setShowIntegrityIssues}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate('integrityIssuesTitle')}</DialogTitle>
            <DialogDescription>
              {translate('integrityIssuesDesc')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {integrityIssues.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {translate('systemIntegrityOk')}
                </h3>
                <p className="text-gray-500">
                  {translate('noIntegrityIssues')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {integrityIssues.map((issue) => (
                  <Card key={issue.id} className="border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            <span className="font-medium">{issue.description}</span>
                            {getSeverityBadge(issue.severity)}
                          </div>
                          <p className="text-sm text-gray-500">
                            {translate('detectedOn')} {new Date(issue.createdAt).toLocaleString(locale)}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          {translate('review')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
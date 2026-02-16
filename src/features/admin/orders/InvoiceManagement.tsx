import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Badge } from '@/shared/components/base/Badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/base/Dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/base/Table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/base/Select';
import { 
  ArrowLeft,
  FileText,
  Eye,
  Search,
  Filter,
  Download,
  Plus,
  DollarSign,
  Calendar,
  User as UserIcon,
  Store as StoreIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  CreditCard,
  X,
  Settings,
  Zap
} from 'lucide-react';
import { getFromLocalStorage } from '@/shared/services/database';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { Invoice, InvoiceItem, Store as StoreType, User, Product, Order, InvoiceFilters } from '@/shared/types';
import { toast } from '@/shared/components/base/Toast';

interface InvoiceManagementProps {
  onBack: () => void;
}

export function InvoiceManagement({ onBack }: InvoiceManagementProps) {
  const { translate } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);

  const [filters, setFilters] = useState<InvoiceFilters>({
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
  }, [invoices, searchTerm, filters]);

  const loadData = () => {
    try {
      const invoicesData = getFromLocalStorage('app-invoices') || [];
      const storesData = getFromLocalStorage('app-stores') || [];
      const usersData = getFromLocalStorage('app-users') || [];
      const productsData = getFromLocalStorage('app-products') || [];
      const ordersData = getFromLocalStorage('app-orders') || [];

      // Enriquecer facturas con información adicional
      const enrichedInvoices = invoicesData.map((invoice: Invoice) => {
        const order = ordersData.find((o: Order) => o.id === invoice.orderId);
        const store = storesData.find((s: StoreType) => s.id === order?.storeId || invoice.storeId);
        const seller = usersData.find((u: User) => u.id === order?.salespersonId || invoice.sellerId);

        return {
          ...invoice,
          storeName: store?.name || translate('storeNotFound'),
          sellerName: `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim() || translate('sellerNotFound'),
          orderNumber: order?.po || translate('poNotFound'),
          items: invoice.items?.map((item: InvoiceItem) => {
            const product = productsData.find((p: Product) => p.id === item.productId);
            return {
              ...item,
              productName: product?.name || translate('productNotFound'),
              productBrand: product?.category || translate('noCategory')
            };
          }) || []
        };
      });

      setInvoices(enrichedInvoices);
      setStores(storesData);
      setUsers(usersData.filter((u: User) => u.role === 'user')); // Solo vendedores
      setProducts(productsData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error(translate('errorLoadData'));
    }
  };

  const applyFilters = () => {
    let filtered = [...invoices];

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.sellerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtros específicos
    if (filters.dateFrom) {
      filtered = filtered.filter(invoice => 
        new Date(invoice.issueDate) >= new Date(filters.dateFrom!)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(invoice => 
        new Date(invoice.issueDate) <= new Date(filters.dateTo!)
      );
    }

    if (filters.sellerId && filters.sellerId !== 'all') {
      filtered = filtered.filter(invoice => invoice.sellerId === filters.sellerId);
    }

    if (filters.storeId && filters.storeId !== 'all') {
      filtered = filtered.filter(invoice => invoice.storeId === filters.storeId);
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === filters.status);
    }

    setFilteredInvoices(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: translate('statusDraft'), color: 'bg-gray-100 text-gray-800' },
      sent: { label: translate('statusSent'), color: 'bg-blue-100 text-blue-800' },
      paid: { label: translate('statusPaid'), color: 'bg-green-100 text-green-800' },
      cancelled: { label: translate('statusCancelled'), color: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4" />;
      case 'sent':
        return <Send className="h-4 w-4" />;
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <X className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getGenerationIcon = (type: string) => {
    return type === 'automatic' ? (
      <div className="flex items-center gap-1 text-indigo-600">
        <Zap className="h-4 w-4" />
        <span className="text-xs">{translate('generationAuto')}</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-amber-600">
        <Settings className="h-4 w-4" />
        <span className="text-xs">{translate('generationManual')}</span>
      </div>
    );
  };

  const handleViewDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetail(true);
  };

  const exportInvoices = () => {
    try {
      const dataStr = JSON.stringify(filteredInvoices, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `facturas_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast.success(translate('invoicesExportedSuccess'));
    } catch (error) {
      console.error('Error exportando facturas:', error);
      toast.error(translate('errorExportInvoices'));
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

  // Calcular estadísticas
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const paidAmount = invoices.filter(i => i.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0);
  const pendingAmount = totalAmount - paidAmount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-indigo-100 rounded-lg">
            <FileText className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('invoicesTitle')}</h1>
            <p className="text-gray-500">{translate('invoicesSubtitle')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportInvoices}>
            <Download className="h-4 w-4 mr-2" />
            {translate('exportLabel')}
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            {translate('newInvoice')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalInvoices')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{invoices.length}</p>
              </div>
              <div className="p-2.5 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('pendingPayment')}</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {invoices.filter(i => i.status === 'sent').length}
                </p>
              </div>
              <div className="p-2.5 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('paidLabel')}</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {invoices.filter(i => i.status === 'paid').length}
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
                <p className="text-xs font-medium text-gray-500">{translate('totalAmountLabel')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  €{totalAmount.toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('amountCollected')}</p>
                <p className="text-xl font-bold text-green-600 mt-1">€{paidAmount.toFixed(2)}</p>
              </div>
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('amountPending')}</p>
                <p className="text-xl font-bold text-amber-600 mt-1">€{pendingAmount.toFixed(2)}</p>
              </div>
              <AlertCircle className="h-5 w-5 text-amber-600" />
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
                  placeholder={translate('searchInvoicesPlaceholder')}
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
                    {filters.status === 'draft' && translate('statusDraft')}
                    {filters.status === 'sent' && translate('statusSent')}
                    {filters.status === 'paid' && translate('statusPaid')}
                    {filters.status === 'cancelled' && translate('statusCancelled')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allStatuses')}</SelectItem>
                  <SelectItem value="draft">{translate('statusDraft')}</SelectItem>
                  <SelectItem value="sent">{translate('statusSent')}</SelectItem>
                  <SelectItem value="paid">{translate('statusPaid')}</SelectItem>
                  <SelectItem value="cancelled">{translate('statusCancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>{translate('invoices')} ({filteredInvoices.length})</CardTitle>
          <CardDescription>
            {translate('invoicesListDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate('invoiceNumberCol')}</TableHead>
                  <TableHead>{translate('poNumberCol')}</TableHead>
                  <TableHead>{translate('issueDateCol')}</TableHead>
                  <TableHead>{translate('sellerLabel')}</TableHead>
                  <TableHead>{translate('storeLabel')}</TableHead>
                  <TableHead>{translate('statusLabel')}</TableHead>
                  <TableHead>{translate('typeCol')}</TableHead>
                  <TableHead>{translate('totalCol')}</TableHead>
                  <TableHead>{translate('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.orderNumber}</TableCell>
                    <TableCell>
                      {new Date(invoice.issueDate).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        {invoice.sellerName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StoreIcon className="h-4 w-4 text-gray-400" />
                        {invoice.storeName}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(invoice.status)}
                    </TableCell>
                    <TableCell>
                      {getGenerationIcon(invoice.generationType)}
                    </TableCell>
                    <TableCell>€{invoice.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(invoice)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredInvoices.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {translate('noInvoicesSearch')}
                </h3>
                <p className="text-gray-500">
                  {searchTerm || Object.values(filters).some(v => v !== '' && v !== 'all') 
                    ? translate('tryOtherSearchInvoices')
                    : translate('noInvoicesInSystem')
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={showInvoiceDetail} onOpenChange={setShowInvoiceDetail}>
        <DialogContent className="!w-[70vw] !max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{translate('invoiceDetailTitle')} {selectedInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              {translate('invoiceDetailDesc')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translate('generalInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('statusLabel')}:</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(selectedInvoice.status)}
                        {getStatusBadge(selectedInvoice.status)}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('generationTypeLabel')}:</span>
                      {getGenerationIcon(selectedInvoice.generationType)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('poNumberCol')}:</span>
                      <span>{selectedInvoice.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('sellerLabel')}:</span>
                      <span>{selectedInvoice.sellerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('storeLabel')}:</span>
                      <span>{selectedInvoice.storeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('issueDateCol')}:</span>
                      <span>{new Date(selectedInvoice.issueDate).toLocaleDateString('es-ES')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('dueDate')}:</span>
                      <span>{new Date(selectedInvoice.dueDate).toLocaleDateString('es-ES')}</span>
                    </div>
                    {selectedInvoice.paidDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">{translate('paidDate')}:</span>
                        <span>{new Date(selectedInvoice.paidDate).toLocaleDateString('es-ES')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translate('financialSummary')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('subtotal')}:</span>
                      <span>€{selectedInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('taxes')}:</span>
                      <span>€{selectedInvoice.taxes.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>{translate('totalCol')}:</span>
                      <span>€{selectedInvoice.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('productsCount')}:</span>
                      <span>{selectedInvoice.items.length} {translate('itemsCount')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{translate('quantity')} Total:</span>
                      <span>{selectedInvoice.items.reduce((sum, item) => sum + item.quantity, 0)} {translate('totalQuantityUnits')}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Invoice Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{translate('invoicedProducts')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{translate('productLabel')}</TableHead>
                          <TableHead>{translate('category')}</TableHead>
                          <TableHead>{translate('quantity')}</TableHead>
                          <TableHead>{translate('unitPrice')}</TableHead>
                          <TableHead>{translate('subtotal')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell>{item.productBrand}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>€{item.unitPrice.toFixed(2)}</TableCell>
                            <TableCell>€{item.subtotal.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
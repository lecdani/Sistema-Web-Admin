import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/base/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Badge } from '@/shared/components/base/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import {
  ArrowLeft,
  ShoppingCart,
  FileText,
  Image as ImageIcon,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Workflow
} from 'lucide-react';
import { Order, Invoice, POD, IntegrityIssue } from '@/shared/types';
import { getFromLocalStorage } from '@/shared/services/database';
import { getOrderStats } from './services/order.service';
import { getInvoiceStats } from './services/invoice.service';
import { checkIntegrity, autoFixIntegrityIssues, getUnvalidatedPODs } from './services/pod.service';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/hooks/useLanguage';

interface UnifiedSalesFlowProps {
  onBack?: () => void;
}

export function UnifiedSalesFlow({ onBack }: UnifiedSalesFlowProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pods, setPods] = useState<POD[]>([]);
  const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([]);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);

  useEffect(() => {
    loadData();
    checkDataIntegrity();
  }, []);

  const loadData = () => {
    const ordersData = getFromLocalStorage('app-orders') || [];
    const invoicesData = getFromLocalStorage('app-invoices') || [];
    const podsData = getFromLocalStorage('app-pods') || [];

    setOrders(ordersData);
    setInvoices(invoicesData);
    setPods(podsData);
  };

  const checkDataIntegrity = () => {
    setIsCheckingIntegrity(true);
    try {
      const issues = checkIntegrity();
      setIntegrityIssues(issues);
    } catch (error) {
      console.error('Error verificando integridad:', error);
      toast.error(translate('errorVerifyIntegrity'));
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  const handleAutoFix = async () => {
    if (!user) return;

    try {
      const result = autoFixIntegrityIssues(user.id);
      toast.success(translate('fixedProblemsErrors').replace('{fixed}', String(result.fixed)).replace('{errors}', String(result.errors)));
      loadData();
      checkDataIntegrity();
    } catch (error) {
      console.error('Error al reparar problemas:', error);
      toast.error(translate('errorRepairProblems'));
    }
  };

  const orderStats = getOrderStats();
  const invoiceStats = getInvoiceStats();
  const unvalidatedPods = getUnvalidatedPODs();

  // Calcular flujo completo
  const ordersWithInvoice = orders.filter(o => 
    invoices.some(inv => inv.orderId === o.id)
  );
  const invoicesWithPOD = invoices.filter(inv => inv.podId);
  
  const completionRate = orders.length > 0 
    ? ((invoicesWithPOD.length / orders.length) * 100).toFixed(1)
    : '0';

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
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Workflow className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('unifiedSalesFlowTitle')}</h1>
            <p className="text-gray-500">{translate('fullManagementFlow')}</p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          onClick={checkDataIntegrity}
          disabled={isCheckingIntegrity}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isCheckingIntegrity ? 'animate-spin' : ''}`} />
          {translate('verifyIntegrity')}
        </Button>
      </div>

      {/* Alertas de Integridad */}
      {integrityIssues.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <p className="font-medium text-yellow-900">
                {translate('integrityIssuesFound').replace('{count}', String(integrityIssues.length))}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                {integrityIssues.filter(i => i.severity === 'high').length} {translate('criticalCount')}, {' '}
                {integrityIssues.filter(i => i.severity === 'medium').length} {translate('mediumCount')}
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={handleAutoFix}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {translate('repairAutomatically')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-all">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalOrders')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{orders.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {orderStats.pendingOrders} {translate('pendingCount')}
                </p>
              </div>
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-lg transition-all">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalInvoices')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{invoices.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  ${invoiceStats.totalAmount.toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-lg transition-all">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalPODs')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{pods.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {unvalidatedPods.length} {translate('unvalidatedCount')}
                </p>
              </div>
              <div className="p-2.5 bg-purple-100 rounded-lg">
                <ImageIcon className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-lg transition-all">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('completionRateLabel')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{completionRate}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {translate('flowComplete')}
                </p>
              </div>
              <div className="p-2.5 bg-indigo-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Visualización del Flujo */}
      <Card>
        <CardHeader>
<CardTitle>{translate('salesFlowTitle')}</CardTitle>
        <CardDescription>
            {translate('salesFlowDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {/* Pedidos */}
            <div className="flex-1 text-center">
              <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <ShoppingCart className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{translate('ordersLabel')}</h3>
              <p className="text-2xl font-bold text-blue-600 my-2">{orders.length}</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>{orderStats.deliveredOrders} {translate('deliveredCount')}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-yellow-600" />
                  <span>{orderStats.pendingOrders} {translate('pendingCount')}</span>
                </div>
              </div>
            </div>

            <ArrowRight className="h-8 w-8 text-gray-400 flex-shrink-0" />

            {/* Facturas */}
            <div className="flex-1 text-center">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                <FileText className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{translate('invoices')}</h3>
              <p className="text-2xl font-bold text-green-600 my-2">{invoices.length}</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>{ordersWithInvoice.length} {translate('withInvoice')}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span>{orders.length - ordersWithInvoice.length} {translate('withoutInvoice')}</span>
                </div>
              </div>
            </div>

            <ArrowRight className="h-8 w-8 text-gray-400 flex-shrink-0" />

            {/* PODs */}
            <div className="flex-1 text-center">
              <div className="w-20 h-20 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-3">
                <ImageIcon className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">PODs</h3>
              <p className="text-2xl font-bold text-purple-600 my-2">{pods.length}</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>{invoicesWithPOD.length} {translate('withPOD')}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span>{invoices.length - invoicesWithPOD.length} {translate('withoutPOD')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Indicador de Progreso */}
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>{translate('completedLabel')}</span>
              <span>{completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-600 via-green-600 to-purple-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problemas de Integridad */}
      {integrityIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              {translate('integrityProblemsTitle')}
            </CardTitle>
            <CardDescription>
              {translate('inconsistenciesAttention')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {integrityIssues.map((issue) => (
                <Alert 
                  key={issue.id}
                  className={`
                    ${issue.severity === 'high' ? 'border-red-200 bg-red-50' : ''}
                    ${issue.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' : ''}
                    ${issue.severity === 'low' ? 'border-blue-200 bg-blue-50' : ''}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {issue.type === 'order_without_invoice' && translate('orderWithoutInvoice')}
                        {issue.type === 'invoice_without_pod' && translate('invoiceWithoutPOD')}
                        {issue.type === 'orphan_pod' && translate('orphanPOD')}
                        {issue.type === 'data_mismatch' && translate('dataMismatch')}
                      </p>
                      <p className="text-sm mt-1">{issue.description}</p>
                    </div>
                    <Badge 
                      className={`
                        ${issue.severity === 'high' ? 'bg-red-100 text-red-800' : ''}
                        ${issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${issue.severity === 'low' ? 'bg-blue-100 text-blue-800' : ''}
                      `}
                    >
                      {issue.severity === 'high' && translate('severityCritical')}
                      {issue.severity === 'medium' && translate('severityMedium')}
                      {issue.severity === 'low' && translate('severityLow')}
                    </Badge>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

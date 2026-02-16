import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Badge } from '@/shared/components/base/Badge';
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
import { OrderManagement } from '@/features/admin/orders/OrderManagement';

interface UnifiedSalesFlowCompleteProps {
  onBack: () => void;
}

export function UnifiedSalesFlowComplete({ onBack }: UnifiedSalesFlowCompleteProps) {
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

  // Callback para refrescar datos después de cambios
  const handleRefreshData = () => {
    loadData();
    checkDataIntegrity();
  };

  return (
    <div className="space-y-6">
      {/* Gestión de Pedidos Completa */}
      <OrderManagement onBack={onBack} />
    </div>
  );
}
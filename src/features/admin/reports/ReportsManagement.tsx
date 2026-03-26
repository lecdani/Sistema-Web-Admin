import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowLeft,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { getBackendAssetUrl } from '@/shared/config/api';
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
import { useLanguage } from '@/shared/hooks/useLanguage';
import { Order, Invoice, Product, Store, City, User } from '@/shared/types';
import { toast } from 'sonner';
import { ordersApi, fetchAllOrderSummaries, type AdminOrderSummary } from '@/shared/services/orders-api';
import {
  computeShortageAnalytics,
  getOrderLifecycleFromStatus,
  type ShortageAnalyticsResult,
} from '@/features/admin/reports/reportOrdersExcel';
import { productsApi } from '@/shared/services/products-api';
import { storesApi } from '@/shared/services/stores-api';
import { citiesApi } from '@/shared/services/cities-api';
import { usersApi } from '@/shared/services/users-api';
import { categoriesApi } from '@/shared/services/categories-api';
import ExcelJS from 'exceljs';

interface ReportsManagementProps {
  onBack?: () => void;
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

function getProductImageUrl(product: Product | null | undefined): string {
  if (!product) return '';
  if (product.image) return getBackendAssetUrl(product.image);
  if (product.imageFileName) return getBackendAssetUrl('images/url/' + product.imageFileName);
  return '';
}

/** Nombre legible de tienda: catálogo cargado en reportes o texto del pedido. */
function resolveStoreLabelFromList(
  stores: Store[],
  storeId: string | undefined,
  fallbackName: string
): string {
  const id = storeId?.trim();
  if (id) {
    const st =
      stores.find((s) => String(s.id) === id) ??
      stores.find((s) => !Number.isNaN(Number(id)) && Number(s.id) === Number(id));
    if (st?.name?.trim()) return st.name.trim();
  }
  const fb = (fallbackName || '').trim();
  return fb || '—';
}

export function ReportsManagement({ onBack }: ReportsManagementProps) {
  const router = useRouter();
  const { translate, locale } = useLanguage();
  const [salesData, setSalesData] = useState<SalesReport[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** Resumen de pedidos desde API (pipeline: pendientes / facturados / cancelados). */
  const [orderSummaries, setOrderSummaries] = useState<AdminOrderSummary[]>([]);
  /** Análisis pedido vs factura (faltantes), según pedidos facturados en el ámbito de filtros. */
  const [shortageAnalytics, setShortageAnalytics] = useState<ShortageAnalyticsResult | null>(null);
  const [shortageLoading, setShortageLoading] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: '',
    dateTo: '',
    productId: 'all',
    storeId: 'all',
    cityId: 'all',
    sellerId: 'all'
  });

  const [transactionsPage, setTransactionsPage] = useState(1);
  const TRANSACTIONS_PAGE_SIZE = 10;

  useEffect(() => {
    loadReportData();
  }, []);

  useEffect(() => {
    setTransactionsPage(1);
  }, [filters.dateFrom, filters.dateTo, filters.productId, filters.storeId, filters.cityId, filters.sellerId]);

  const loadReportData = async () => {
    try {
      setIsLoading(true);
      
      let productsData: Product[] = [];
      let storesData: Store[] = [];
      let citiesData: City[] = [];
      let usersData: User[] = [];
      const salesReports: SalesReport[] = [];

      try {
        const [invoicesForReport, productsRes, storesRes, citiesRes, usersRes, ordersSummaries] = await Promise.all([
          ordersApi.getInvoicesForSalesReport(),
          productsApi.fetchAll().catch(() => []),
          storesApi.fetchAll().catch(() => []),
          citiesApi.fetchAll().catch(() => []),
          usersApi.fetchAll().catch(() => []),
          fetchAllOrderSummaries().catch(() => [])
        ]);

        productsData = Array.isArray(productsRes) ? productsRes : [];
        storesData = Array.isArray(storesRes) ? storesRes : [];
        citiesData = Array.isArray(citiesRes) ? citiesRes : [];
        usersData = Array.isArray(usersRes) ? usersRes : [];

        const orderIdToPo = new Map<string, string>();
        const orderIdToSummary = new Map<string, { storeName?: string; storeId?: string; salespersonId?: string; salespersonName?: string }>();
        setOrderSummaries(Array.isArray(ordersSummaries) ? (ordersSummaries as AdminOrderSummary[]) : []);

        (ordersSummaries as any[]).forEach((o: any) => {
          const id = String(o?.id ?? o?.backendOrderId ?? '');
          if (id) {
            orderIdToPo.set(id, String(o?.po ?? o?.orderNumber ?? o?.id ?? id));
            const spId = o?.salespersonId ?? o?.SalespersonId ?? o?.sellerId ?? o?.SellerId;
            const spIdStr = spId != null ? String(spId) : '';
            const spName =
              o?.salespersonName ?? o?.SalespersonName ?? o?.sellerName ?? o?.SellerName ?? o?.user?.name ?? (o?.user?.firstName != null ? `${o?.user?.firstName ?? ''} ${o?.user?.lastName ?? ''}`.trim() : undefined);
            const storeIdVal = o?.storeId != null ? String(o.storeId) : o?.StoreId != null ? String(o.StoreId) : '';
            const rawStoreName = o?.storeName ?? o?.StoreName;
            const storeNameOnlyIfNotId =
              rawStoreName &&
              typeof rawStoreName === 'string' &&
              rawStoreName.trim() !== storeIdVal &&
              rawStoreName.trim() !== String(Number(storeIdVal) || storeIdVal)
                ? rawStoreName.trim()
                : undefined;
            const salespersonNameOnlyIfNotId =
              typeof spName === 'string' && spName.trim() && spName.trim() !== spIdStr && spName.trim() !== String(Number(spIdStr) || spIdStr)
                ? spName.trim()
                : undefined;
            orderIdToSummary.set(id, {
              storeName: storeNameOnlyIfNotId,
              storeId: storeIdVal || undefined,
              salespersonId: spId != null ? String(spId) : undefined,
              salespersonName: salespersonNameOnlyIfNotId
            });
          }
        });

        const productMap = new Map<string | number, Product>();
        productsData.forEach((p) => {
          productMap.set(p.id, p);
          if (!Number.isNaN(Number(p.id))) productMap.set(Number(p.id), p);
        });
        const storeMap = new Map<string, Store>();
        storesData.forEach((s) => {
          storeMap.set(String(s.id), s);
          if (!Number.isNaN(Number(s.id))) storeMap.set(String(Number(s.id)), s);
        });
        const cityMap = new Map<string, City>();
        citiesData.forEach((c) => {
          cityMap.set(String(c.id), c);
          if (!Number.isNaN(Number(c.id))) cityMap.set(String(Number(c.id)), c);
        });
        const userMap = new Map<string, User>();
        usersData.forEach((u) => {
          userMap.set(String(u.id), u);
          if (!Number.isNaN(Number(u.id))) userMap.set(String(Number(u.id)), u);
        });

        const storeIdsFromInvoices = new Set(invoicesForReport.map((inv) => String(inv.storeId).trim()).filter(Boolean));
        const sellerIdsFromInvoices = new Set(invoicesForReport.map((inv) => String(inv.sellerId).trim()).filter(Boolean));
        orderIdToSummary.forEach((sum) => {
          if (sum.storeId) storeIdsFromInvoices.add(String(sum.storeId).trim());
          if (sum.salespersonId) sellerIdsFromInvoices.add(String(sum.salespersonId).trim());
        });
        const missingStoreIds = [...storeIdsFromInvoices].filter(
          (id) => !storeMap.has(id) && !storeMap.has(String(Number(id)))
        );
        const missingSellerIds = [...sellerIdsFromInvoices].filter(
          (id) => !userMap.has(id) && !userMap.has(String(Number(id)))
        );
        const fetchedStores = await Promise.all(missingStoreIds.map((id) => storesApi.getById(id).catch(() => null)));
        const fetchedUsers = await Promise.all(
          missingSellerIds.map((id) => usersApi.getById(id).catch(() => null))
        );
        const numericSellerIds = missingSellerIds.filter((id) => id !== '' && !Number.isNaN(Number(id)));
        const fetchedUsersByNumericId = await Promise.all(
          numericSellerIds.map((id) => usersApi.getById(String(Number(id))).catch(() => null))
        );
        fetchedUsersByNumericId.forEach((u) => {
          if (u) {
            userMap.set(String(u.id), u);
            if (!Number.isNaN(Number(u.id))) userMap.set(String(Number(u.id)), u);
          }
        });
        fetchedStores.forEach((s) => {
          if (s) {
            storeMap.set(String(s.id), s);
            if (!Number.isNaN(Number(s.id))) storeMap.set(String(Number(s.id)), s);
          }
        });
        fetchedUsers.forEach((u) => {
          if (u) {
            userMap.set(String(u.id), u);
            if (!Number.isNaN(Number(u.id))) userMap.set(String(Number(u.id)), u);
          }
        });

        const cityIdsFromStores = new Set<string>();
        storeMap.forEach((s) => {
          if (s.cityId && !cityMap.has(String(s.cityId)) && !cityMap.has(String(Number(s.cityId)))) cityIdsFromStores.add(String(s.cityId));
        });
        const fetchedCities = await Promise.all([...cityIdsFromStores].map((id) => citiesApi.getById(id)));
        fetchedCities.forEach((c) => {
          if (c) {
            cityMap.set(String(c.id), c);
            if (!Number.isNaN(Number(c.id))) cityMap.set(String(Number(c.id)), c);
          }
        });

        for (const inv of invoicesForReport) {
          const orderSummary = orderIdToSummary.get(inv.orderId) ?? orderIdToSummary.get(String(Number(inv.orderId)));
          // Usar IDs del PEDIDO (como en Gestión de pedidos) para resolver tienda y vendedor; la factura puede traer otros formatos
          const effectiveStoreId = (orderSummary?.storeId ?? inv.storeId ?? '').toString().trim();
          const effectiveSellerId = (orderSummary?.salespersonId ?? inv.sellerId ?? '').toString().trim();
          const storeKey = effectiveStoreId || String(inv.storeId).trim();
          const store = storeMap.get(storeKey) ?? storeMap.get(String(Number(storeKey) || storeKey));
          const city = store
            ? cityMap.get(String(store.cityId)) ?? cityMap.get(String(Number(store.cityId)))
            : null;
          const sellerKey = effectiveSellerId || String(inv.sellerId).trim();
          const seller = userMap.get(sellerKey) ?? userMap.get(String(Number(sellerKey) || sellerKey));

          for (const item of inv.details) {
            if (!item.productId) continue;
            const product =
              productMap.get(item.productId) ?? productMap.get(Number(item.productId));
            const storeIdStr = String(inv.storeId).trim();
            const sellerIdStr = String(inv.sellerId).trim();
            const invStoreNameOk =
              inv.storeName &&
              inv.storeName.trim() !== storeIdStr &&
              inv.storeName.trim() !== String(Number(inv.storeId) || storeIdStr);
            const orderStoreName = orderSummary?.storeName;
            const orderStoreNameOk =
              orderStoreName &&
              orderStoreName.trim() !== storeIdStr &&
              orderStoreName.trim() !== String(Number(inv.storeId) || storeIdStr);
            const storeName =
              store?.name ??
              (invStoreNameOk ? inv.storeName!.trim() : null) ??
              (orderStoreNameOk ? orderStoreName!.trim() : null) ??
              '—';
            const cityName = city?.name ?? '';
            const cityId = city?.id ?? store?.cityId ?? '';
            const sellerDisplay =
              seller ? `${seller.firstName} ${seller.lastName}`.trim() || seller.email || '—' : null;
            const invSellerNameOk =
              inv.sellerName &&
              inv.sellerName.trim() !== sellerIdStr &&
              inv.sellerName.trim() !== String(Number(inv.sellerId) || sellerIdStr);
            const orderSellerName = orderSummary?.salespersonName;
            const orderSellerNameOk =
              orderSellerName &&
              orderSellerName.trim() !== sellerIdStr &&
              orderSellerName.trim() !== String(Number(inv.sellerId) || sellerIdStr);
            const sellerName =
              sellerDisplay ??
              (invSellerNameOk ? inv.sellerName!.trim() : null) ??
              (orderSellerNameOk ? orderSellerName!.trim() : null) ??
              '—';
            const productName = item.productName ?? product?.name ?? item.productId;
            const productSku = String(
              item.sku ?? item.Sku ?? item.code ?? item.Code ?? product?.sku ?? (product as any)?.code ?? ''
            ).trim();

            const poDisplay = orderIdToPo.get(inv.orderId) ?? inv.orderId;
            salesReports.push({
              id: `${inv.invoiceId}-${item.productId}-${item.quantity}`,
              orderId: inv.orderId,
              invoiceId: inv.invoiceId,
              productId: item.productId,
              productName,
              productSku,
              storeId: store?.id ?? (effectiveStoreId || inv.storeId),
              storeName,
              cityId,
              cityName,
              sellerId: seller?.id ?? (effectiveSellerId || inv.sellerId),
              sellerName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalAmount: item.subtotal,
              date: new Date(inv.issueDate),
              invoiceNumber: poDisplay,
              orderNumber: poDisplay
            });
          }
        }
      } catch (apiError) {
        console.warn('Reportes: API no disponible, usando datos locales.', apiError);
        const ordersData = getFromLocalStorage('app-orders') || [];
        setOrderSummaries(
          (ordersData as Order[]).map(
            (o): AdminOrderSummary => ({
              id: o.id,
              storeId: o.storeId,
              storeName: o.storeName ?? '',
              date: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
              status: o.status,
              subtotal: o.subtotal ?? 0,
              tax: 0,
              total: o.total ?? 0,
              po: o.po,
              invoiceId: (o as any).invoiceId,
              salespersonId: o.salespersonId,
            })
          )
        );
        const invoicesData = getFromLocalStorage('app-invoices') || [];
        productsData = getFromLocalStorage('app-products') || [];
        storesData = getFromLocalStorage('app-stores') || [];
        citiesData = getFromLocalStorage('app-cities') || [];
        usersData = getFromLocalStorage('app-users') || [];

        invoicesData.forEach((invoice: Invoice) => {
          const order = ordersData.find((o: Order) => String(o.id) === String(invoice.orderId));
          if (!order) return;
          const store = storesData.find((s: Store) => String(s.id) === String(invoice.storeId));
          const city = store ? citiesData.find((c: City) => String(c.id) === String(store.cityId)) : null;
          const seller = usersData.find((u: User) => String(u.id) === String(invoice.sellerId));
          const storeName = store?.name ?? invoice.storeName ?? '—';
          const sellerName = seller ? `${seller.firstName} ${seller.lastName}`.trim() || seller.email : (invoice.sellerName ?? '—');
        if (invoice.items && invoice.items.length > 0) {
          invoice.items.forEach((item: any) => {
              const product = productsData.find((p: Product) => String(p.id) === String(item.productId));
              if (!product) return;
              const qty = Number(item?.quantity ?? item?.Quantity ?? 0) || 0;
              let unitPrice = Number(item?.unitPrice ?? item?.UnitPrice ?? item?.price ?? item?.Price ?? (product as any)?.currentPrice ?? 0);
              let totalAmount = Number(item?.subtotal ?? item?.Subtotal ?? item?.total ?? item?.Total ?? item?.amount ?? item?.Amount ?? 0);
              if (unitPrice <= 0 && totalAmount > 0 && qty > 0) unitPrice = totalAmount / qty;
              if (totalAmount <= 0 && unitPrice > 0 && qty > 0) totalAmount = qty * unitPrice;
              const poDisplay = (order as any).po ?? order.id;
              salesReports.push({
                id: `${invoice.id}-${item.id ?? item.productId}`,
                orderId: order.id,
                invoiceId: invoice.id,
                productId: product.id,
                productName: product.name,
                productSku: product.sku,
                storeId: store?.id ?? invoice.storeId,
                storeName,
                cityId: city?.id ?? store?.cityId ?? '',
                cityName: city?.name ?? '',
                sellerId: seller?.id ?? invoice.sellerId,
                sellerName,
                quantity: qty,
                unitPrice,
                totalAmount,
                date: new Date(invoice.issueDate),
                invoiceNumber: poDisplay,
                orderNumber: poDisplay
              });
          });
        }
      });
      }

      setProducts(productsData);
      setStores(storesData);
      setCities(citiesData);
      setSellers(usersData.filter((u: User) => u.role === 'user'));
      setSalesData(salesReports);
      toast.success(translate('reportDataLoaded'));
    } catch (error) {
      console.error('Error cargando datos de reportes:', error);
      setOrderSummaries([]);
      toast.error(translate('errorLoadReports'));
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
      if (filters.productId !== 'all' && String(sale.productId) !== String(filters.productId)) return false;
      if (filters.storeId !== 'all' && String(sale.storeId) !== String(filters.storeId)) return false;
      if (filters.cityId !== 'all' && String(sale.cityId) !== String(filters.cityId)) return false;
      if (filters.sellerId !== 'all' && String(sale.sellerId) !== String(filters.sellerId)) return false;

      return true;
    });
  }, [salesData, filters]);

  /** Pedidos filtrados por los mismos criterios de fecha / tienda / vendedor (sin filtro por producto). */
  const filteredOrderSummaries = useMemo(() => {
    return orderSummaries.filter((o) => {
      const d = new Date(o.date);
      if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && d > new Date(`${filters.dateTo}T23:59:59.999`)) return false;
      if (filters.storeId !== 'all' && String(o.storeId) !== String(filters.storeId)) return false;
      if (filters.sellerId !== 'all' && String(o.salespersonId ?? '') !== String(filters.sellerId))
        return false;
      return true;
    });
  }, [orderSummaries, filters.dateFrom, filters.dateTo, filters.storeId, filters.sellerId]);

  const invoicedOrderSummaries = useMemo(
    () => filteredOrderSummaries.filter((o) => getOrderLifecycleFromStatus(o.status) === 'invoiced'),
    [filteredOrderSummaries]
  );

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    const empty: ShortageAnalyticsResult = {
      analyzed: 0,
      ordersWithShort: 0,
      totalShortUnits: 0,
      totalShortLines: 0,
      topProducts: [],
      topStores: [],
      shortUnitsByMonth: [],
      detailSample: [],
    };
    setShortageLoading(true);
    setShortageAnalytics(null);
    (async () => {
      try {
        if (invoicedOrderSummaries.length === 0) {
          if (!cancelled) setShortageAnalytics(empty);
          return;
        }
        const data = await computeShortageAnalytics(invoicedOrderSummaries);
        if (!cancelled) setShortageAnalytics(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error(translate('reportsShortageErrorCompute'));
          setShortageAnalytics(empty);
        }
      } finally {
        if (!cancelled) setShortageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- datos numéricos; no recargar al cambiar idioma
  }, [isLoading, invoicedOrderSummaries]);

  const shortageMonthChart = useMemo(() => {
    if (!shortageAnalytics?.shortUnitsByMonth?.length) return [];
    return shortageAnalytics.shortUnitsByMonth.map((m) => ({
      mes: new Date(`${m.monthKey}-01T12:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'short' }),
      unidades: m.units,
    }));
  }, [shortageAnalytics, locale]);

  const shortageProductChart = useMemo(() => {
    if (!shortageAnalytics?.topProducts?.length) return [];
    return shortageAnalytics.topProducts.slice(0, 12).map((p) => ({
      label:
        `${(p.sku || '—').slice(0, 14)}${p.name ? ` · ${p.name.slice(0, 24)}` : ''}`.trim() || '—',
      unidades: p.units,
    }));
  }, [shortageAnalytics]);

  const shortageStoreChart = useMemo(() => {
    if (!shortageAnalytics?.topStores?.length) return [];
    return shortageAnalytics.topStores.slice(0, 10).map((s) => ({
      label: resolveStoreLabelFromList(stores, s.storeId, s.name),
      unidades: s.units,
    }));
  }, [shortageAnalytics, stores]);

  const shortagePieData = useMemo(() => {
    if (!shortageAnalytics || shortageAnalytics.analyzed === 0) return [];
    const complete = shortageAnalytics.analyzed - shortageAnalytics.ordersWithShort;
    return [
      { name: translate('reportsShortagePieComplete'), value: complete },
      { name: translate('reportsShortagePieWithGap'), value: shortageAnalytics.ordersWithShort },
    ].filter((x) => x.value > 0);
  }, [shortageAnalytics, translate]);

  const orderPipelineMetrics = useMemo(() => {
    const initial = filteredOrderSummaries.filter((o) => getOrderLifecycleFromStatus(o.status) === 'initial');
    const invoiced = filteredOrderSummaries.filter((o) => getOrderLifecycleFromStatus(o.status) === 'invoiced');
    const cancelled = filteredOrderSummaries.filter((o) => getOrderLifecycleFromStatus(o.status) === 'cancelled');
    const pendingValue = initial.reduce(
      (s, o) => s + (Number(o.total) > 0 ? Number(o.total) : Number(o.subtotal) || 0),
      0
    );
    const pendingSorted = [...initial].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return {
      initialCount: initial.length,
      invoicedCount: invoiced.length,
      cancelledCount: cancelled.length,
      pendingValue,
      totalInScope: filteredOrderSummaries.length,
      pendingList: pendingSorted.slice(0, 25),
    };
  }, [filteredOrderSummaries]);

  const ordersPipelineChartData = useMemo(
    () => [
      { name: translate('reportsPendingOrdersCard'), cantidad: orderPipelineMetrics.initialCount },
      { name: translate('reportsInvoicedCountCard'), cantidad: orderPipelineMetrics.invoicedCount },
      { name: translate('reportsCancelledCountCard'), cantidad: orderPipelineMetrics.cancelledCount },
    ],
    [orderPipelineMetrics, translate]
  );

  // Transacciones ordenadas por fecha (más reciente primero) para la tabla de detalle
  const filteredSalesDataSorted = useMemo(() => {
    return [...filteredSalesData].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredSalesData]);

  const totalTransactionsPages = Math.max(
    1,
    Math.ceil(filteredSalesDataSorted.length / TRANSACTIONS_PAGE_SIZE)
  );
  const paginatedTransactions = useMemo(() => {
    const start = (transactionsPage - 1) * TRANSACTIONS_PAGE_SIZE;
    return filteredSalesDataSorted.slice(start, start + TRANSACTIONS_PAGE_SIZE);
  }, [filteredSalesDataSorted, transactionsPage]);

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
        month: new Date(month).toLocaleDateString(locale, { year: 'numeric', month: 'short' }),
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
  }, [filteredSalesData, salesMetrics, locale]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      productId: 'all',
      storeId: 'all',
      cityId: 'all',
      sellerId: 'all'
    });
  };

  const exportToExcel = async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(locale.startsWith('es') ? 'Transacciones' : 'Transactions');
      ws.columns = [
        { header: translate('csvColDate'), key: 'date', width: 14 },
        { header: translate('csvColInvoice'), key: 'invoice', width: 20 },
        { header: translate('csvColOrder'), key: 'orderId', width: 18 },
        { header: translate('csvColStore'), key: 'store', width: 28 },
        { header: translate('csvColCity'), key: 'city', width: 20 },
        { header: translate('csvColSeller'), key: 'seller', width: 24 },
        { header: translate('csvColSku'), key: 'sku', width: 18 },
        { header: translate('csvColProduct'), key: 'product', width: 38 },
        { header: translate('csvColQty'), key: 'qty', width: 10 },
        { header: translate('csvColUnitPrice'), key: 'unitPrice', width: 14 },
        { header: translate('csvColTotal'), key: 'lineTotal', width: 14 },
      ];
      const detailRows = filteredSalesDataSorted.slice(0, 50000);
      const categories = await categoriesApi.fetchAll().catch(() => []);
      const familyById = new Map<string, { sku?: string; code?: string; name?: string }>();
      categories.forEach((c: any) => {
        const id = String(c?.id ?? '').trim();
        if (!id) return;
        familyById.set(id, { sku: c?.sku, code: c?.code, name: c?.name });
        if (!Number.isNaN(Number(id))) {
          familyById.set(String(Number(id)), { sku: c?.sku, code: c?.code, name: c?.name });
        }
      });
      const productById = new Map<string, Product>();
      products.forEach((p) => {
        const id = String(p.id);
        productById.set(id, p);
        if (!Number.isNaN(Number(id))) productById.set(String(Number(id)), p);
      });
      detailRows.forEach((sale) => {
        const product = productById.get(String(sale.productId)) ?? productById.get(String(Number(sale.productId)));
        const skuFallback = String(
          sale.productSku ||
            (product as any)?.sku ||
            (product as any)?.code ||
            sale.productId ||
            ''
        ).trim();
        ws.addRow({
          date: new Date(sale.date).toLocaleDateString(locale),
          invoice: sale.invoiceNumber ? `${sale.invoiceNumber}` : '',
          orderId: String((sale as any).orderId ?? (sale as any).orderNumber ?? '').trim(),
          store: sale.storeName ?? '',
          city: sale.cityName ?? '',
          seller: sale.sellerName ?? '',
          sku: skuFallback || '—',
          product: sale.productName ?? '',
          qty: sale.quantity,
          unitPrice: Number(sale.unitPrice.toFixed(2)),
          lineTotal: Number(sale.totalAmount.toFixed(2)),
        });
      });

      const wsFamily = wb.addWorksheet(locale.startsWith('es') ? 'Transacciones_Familia' : 'Transactions_Family');
      wsFamily.columns = [
        { header: translate('csvColDate'), key: 'date', width: 14 },
        { header: translate('csvColInvoice'), key: 'invoice', width: 20 },
        { header: translate('csvColOrder'), key: 'orderId', width: 18 },
        { header: translate('csvColStore'), key: 'store', width: 28 },
        { header: translate('csvColCity'), key: 'city', width: 20 },
        { header: translate('csvColSeller'), key: 'seller', width: 24 },
        { header: translate('familyCodeLabel') || 'Código familia', key: 'familyCode', width: 18 },
        { header: translate('familySkuLabel') || 'SKU familia', key: 'familySku', width: 18 },
        { header: translate('family_col') || 'Familia', key: 'familyName', width: 30 },
        { header: translate('csvColQty'), key: 'qty', width: 10 },
        { header: translate('csvColTotal'), key: 'lineTotal', width: 14 },
      ];
      const byInvoiceFamily = new Map<
        string,
        {
          date: string;
          invoice: string;
          orderId: string;
          store: string;
          city: string;
          seller: string;
          familyCode: string;
          familySku: string;
          familyName: string;
          qty: number;
          lineTotal: number;
        }
      >();
      detailRows.forEach((sale) => {
        const product = productById.get(String(sale.productId)) ?? productById.get(String(Number(sale.productId)));
        const familyId = String((product as any)?.familyId ?? (product as any)?.categoryId ?? '').trim();
        const fam = familyById.get(familyId) ?? familyById.get(String(Number(familyId)));
        const familySku = String(fam?.sku ?? '').trim();
        const familyCode = String(fam?.code ?? '').trim();
        const familyName = String(fam?.name ?? (product as any)?.category ?? '').trim() || '—';
        const familyKey = (familySku || familyCode || familyName).toLowerCase();
        const invKey = String(sale.invoiceId || sale.invoiceNumber || '').trim();
        const key = `${invKey}::${familyKey}`;
        const existing = byInvoiceFamily.get(key);
        if (existing) {
          existing.qty += Number(sale.quantity) || 0;
          existing.lineTotal += Number(sale.totalAmount) || 0;
          return;
        }
        byInvoiceFamily.set(key, {
          date: new Date(sale.date).toLocaleDateString(locale),
          invoice: sale.invoiceNumber ? `${sale.invoiceNumber}` : '',
          orderId: String((sale as any).orderId ?? (sale as any).orderNumber ?? '').trim(),
          store: sale.storeName ?? '',
          city: sale.cityName ?? '',
          seller: sale.sellerName ?? '',
          familyCode: familyCode || '—',
          familySku: familySku || '—',
          familyName,
          qty: Number(sale.quantity) || 0,
          lineTotal: Number(sale.totalAmount) || 0,
        });
      });
      [...byInvoiceFamily.values()].forEach((row) => {
        wsFamily.addRow({
          ...row,
          lineTotal: Number(row.lineTotal.toFixed(2)),
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${translate('exportFilenameSales')}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(translate('reportExportedExcel'));
  };

  const exportToPDF = () => {
    const u = translate('unitsShort');
    const reportContent = `
================================================================================
                    ${translate('reportConfidential')}
================================================================================

                    ${translate('reportDocumentType')}
                    ${translate('reportTitleAdmin')}

--------------------------------------------------------------------------------
  ${translate('periodLabel')}: ${filters.dateFrom} ${translate('to')} ${filters.dateTo}
  ${translate('generatedLabel')}: ${new Date().toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' })}
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
  ${translate('reportSection1')}
--------------------------------------------------------------------------------

  ${translate('totalSales')} ...................... $${salesMetrics.totalSales.toFixed(2)}
  ${translate('unitsSold')} ...................... ${salesMetrics.totalQuantity.toLocaleString(locale)}
  ${translate('averageTicket')} .................. $${salesMetrics.averageTicket.toFixed(2)}
  ${translate('transactionsCount')} ............. ${salesMetrics.totalTransactions}

--------------------------------------------------------------------------------
  ${translate('reportSection2')}
--------------------------------------------------------------------------------

${salesMetrics.topProducts.map((p, i) => 
  `  ${(i + 1).toString().padStart(2)}. ${(p.productName || '').substring(0, 40)} (${p.productSku || ''})  |  $${p.totalSales.toFixed(2)}  |  ${p.totalQuantity} ${u}`
).join('\n')}

--------------------------------------------------------------------------------
  ${translate('reportSection3')}
--------------------------------------------------------------------------------

${salesMetrics.topStores.map((s, i) => 
  `  ${(i + 1).toString().padStart(2)}. ${(s.storeName || '').substring(0, 35)} - ${(s.cityName || '').substring(0, 20)}  |  $${s.totalSales.toFixed(2)}`
).join('\n')}

--------------------------------------------------------------------------------
  ${translate('reportSection4')}
--------------------------------------------------------------------------------

${salesMetrics.topSellers.map((s, i) => 
  `  ${(i + 1).toString().padStart(2)}. ${(s.sellerName || '').substring(0, 35)}  |  $${s.totalSales.toFixed(2)}  |  ${s.totalQuantity} ${u}`
).join('\n')}

================================================================================
  ${translate('endOfReport')}
  ${translate('reportPreparedBy')}
  ${new Date().toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
================================================================================
`;
    const element = document.createElement('a');
    const file = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${translate('exportFilenameSales')}-${filters.dateFrom}-${filters.dateTo}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success(translate('reportExportedTXT'));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600">{translate('loadingReportData')}</p>
        </div>
      </div>
    );
  }

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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-blue-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('reportsTitle')}</h1>
            <p className="text-gray-500">{translate('reportsSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadReportData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {translate('update')}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {translate('searchFilters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>{translate('dateFrom')}</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div>
              <Label>{translate('dateTo')}</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            <div>
              <Label>{translate('productLabel')}</Label>
              <Select value={filters.productId} onValueChange={(value) => handleFilterChange('productId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={translate('allShort')}>
                    {filters.productId === 'all' ? translate('allProducts') : products.find(p => p.id === filters.productId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allProducts')}</SelectItem>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate('storeHeader')}</Label>
              <Select value={filters.storeId} onValueChange={(value) => handleFilterChange('storeId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={translate('allShort')}>
                    {filters.storeId === 'all' ? translate('allStoresReport') : stores.find(s => s.id === filters.storeId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allStoresReport')}</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate('city')}</Label>
              <Select value={filters.cityId} onValueChange={(value) => handleFilterChange('cityId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={translate('allShort')}>
                    {filters.cityId === 'all' ? translate('allCitiesReport') : cities.find(c => c.id === filters.cityId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allCitiesReport')}</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{translate('seller')}</Label>
              <Select value={filters.sellerId} onValueChange={(value) => handleFilterChange('sellerId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={translate('allShort')}>
                    {filters.sellerId === 'all' ? translate('allSellers') : (() => { const s = sellers.find(x => x.id === filters.sellerId); return s ? `${s.firstName} ${s.lastName}` : null; })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allSellers')}</SelectItem>
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
              {filteredSalesData.length} {translate('recordsFound')}
            </Badge>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              {translate('clearFilters')}
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
                <p className="text-xs font-medium text-gray-500">{translate('totalSales')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ${salesMetrics.totalSales.toFixed(2)}
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
                <p className="text-xs font-medium text-gray-500">{translate('quantitySold')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {salesMetrics.totalQuantity.toLocaleString(locale)}
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
                <p className="text-xs font-medium text-gray-500">{translate('averageTicket')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ${salesMetrics.averageTicket.toFixed(2)}
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
                <p className="text-xs font-medium text-gray-500">{translate('transactions')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {salesMetrics.totalTransactions.toLocaleString(locale)}
                </p>
              </div>
              <div className="p-2.5 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Pipeline de pedidos (pendientes / facturados / cancelados) — respeta filtros de fecha, tienda y vendedor */}
      <p className="text-sm text-gray-500 -mt-2">{translate('reportsOrdersHintFilters')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-amber-100 bg-amber-50/40 hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-800">{translate('reportsPendingOrdersCard')}</p>
                <p className="text-2xl font-bold text-amber-950 mt-1">
                  {orderPipelineMetrics.initialCount.toLocaleString(locale)}
                </p>
              </div>
              <div className="p-2.5 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-700" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('reportsPendingValueCard')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ${orderPipelineMetrics.pendingValue.toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 bg-slate-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('reportsInvoicedCountCard')}</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {orderPipelineMetrics.invoicedCount.toLocaleString(locale)}
                </p>
              </div>
              <div className="p-2.5 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('reportsCancelledCountCard')}</p>
                <p className="text-2xl font-bold text-slate-700 mt-1">
                  {orderPipelineMetrics.cancelledCount.toLocaleString(locale)}
                </p>
              </div>
              <div className="p-2.5 bg-slate-200 rounded-lg flex items-center justify-center">
                <X className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs de Reportes */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <TabsList className="grid w-full lg:w-auto grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 h-auto">
            <TabsTrigger value="overview">{translate('overview')}</TabsTrigger>
            <TabsTrigger value="products">{translate('tabProducts')}</TabsTrigger>
            <TabsTrigger value="stores">{translate('stores')}</TabsTrigger>
            <TabsTrigger value="sellers">{translate('sellers')}</TabsTrigger>
            <TabsTrigger value="orders">{translate('reportsTabOrders')}</TabsTrigger>
            <TabsTrigger value="orderVsInvoice" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
              {translate('reportsTabOrderVsInvoice')}
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button onClick={exportToPDF} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              {translate('exportTXT')}
            </Button>
            <Button onClick={() => exportToExcel()} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              {translate('exportExcel')}
            </Button>
          </div>
        </div>

        {/* Tab: Resumen */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ventas por Mes */}
            <Card>
              <CardHeader>
<CardTitle>{translate('salesTrendMonthly')}</CardTitle>
              <CardDescription>{translate('salesEvolutionPeriod')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="ventas" stroke="#4f46e5" strokeWidth={2} name={translate('salesEuro')} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución por Ciudad */}
            <Card>
              <CardHeader>
<CardTitle>{translate('salesByCity')}</CardTitle>
              <CardDescription>{translate('salesByCityDesc')}</CardDescription>
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
                      label={(entry) => `${entry.name}: $${entry.value.toFixed(0)}`}
                    >
                      {chartData.cities.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Detalle: agrupada por factura, ordenada por fecha (más reciente primero), paginada */}
          <Card>
            <CardHeader>
              <CardTitle>{translate('transactionDetail')}</CardTitle>
              <CardDescription>
                {filteredSalesDataSorted.length} {translate('recordsFound')} · {translate('dateCol')} {translate('mostRecentFirst')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate('dateCol')}</TableHead>
                      <TableHead className="min-w-[230px] w-[230px]">{translate('poNumber')}</TableHead>
                      <TableHead>{translate('productLabel')}</TableHead>
                      <TableHead>{translate('storeLabel')}</TableHead>
                      <TableHead>{translate('sellerLabel')}</TableHead>
                      <TableHead className="text-right">{translate('qtyShort')}</TableHead>
                      <TableHead className="text-right">{translate('priceCol')}</TableHead>
                      <TableHead className="text-right">{translate('totalCol')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          {translate('noDataWithFilters')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTransactions.map((sale, idx) => {
                        const isNewInvoice =
                          idx === 0 ||
                          paginatedTransactions[idx - 1].invoiceId !== sale.invoiceId;
                        const invoiceTotal = filteredSalesDataSorted
                          .filter((r) => r.invoiceId === sale.invoiceId)
                          .reduce((sum, r) => sum + r.totalAmount, 0);
                        return (
                          <React.Fragment key={sale.id}>
                            {isNewInvoice && (
                              <TableRow key={`inv-header-${sale.invoiceId}`} className="bg-muted/60 hover:bg-muted/60">
                                <TableCell colSpan={8} className="py-2 font-medium text-sm">
                                  <span className="text-primary inline-block min-w-[230px]">
                                    {sale.invoiceNumber ? `${sale.invoiceNumber}` : '—'}
                                  </span>
                                  {' · '}
                                  {new Date(sale.date).toLocaleDateString(locale, {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                  {' · '}
                                  {sale.storeName}
                                  {sale.cityName ? ` (${sale.cityName})` : ''}
                                  {' · '}
                                  {sale.sellerName}
                                  {' · '}
                                  <span className="font-semibold">
                                    ${invoiceTotal.toFixed(2)} {translate('totalCol')}
                                  </span>
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow key={sale.id} className={isNewInvoice ? 'border-t-2 border-border' : ''}>
                              <TableCell className="text-muted-foreground">
                                {new Date(sale.date).toLocaleDateString(locale)}
                              </TableCell>
                              <TableCell className="font-medium min-w-[230px] w-[230px]">{sale.invoiceNumber ? `${sale.invoiceNumber}` : '—'}</TableCell>
                        <TableCell>
                                <div className="flex items-center gap-3">
                                  {(() => {
                                    const product = products.find((p) => String(p.id) === String(sale.productId));
                                    const imgUrl = getProductImageUrl(product);
                                    return imgUrl ? (
                                      <img src={imgUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                                    ) : (
                                      <div className="w-9 h-9 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                        <Package className="h-4 w-4 text-gray-500" />
                                      </div>
                                    );
                                  })()}
                          <div>
                            <p className="font-medium">{sale.productName}</p>
                            <p className="text-sm text-gray-500">{sale.productSku}</p>
                                  </div>
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
                              <TableCell className="text-right">${sale.unitPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium">${sale.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                {filteredSalesDataSorted.length > 0 && (
                  <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
                    <p className="text-sm text-muted-foreground">
                      {translate('showingPage')}{' '}
                      {(transactionsPage - 1) * TRANSACTIONS_PAGE_SIZE + 1}–
                      {Math.min(
                        transactionsPage * TRANSACTIONS_PAGE_SIZE,
                        filteredSalesDataSorted.length
                      )}{' '}
                      {translate('of')} {filteredSalesDataSorted.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTransactionsPage((p) => Math.max(1, p - 1))}
                        disabled={transactionsPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium">
                        {translate('page')} {transactionsPage} / {totalTransactionsPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setTransactionsPage((p) => Math.min(totalTransactionsPages, p + 1))
                        }
                        disabled={transactionsPage >= totalTransactionsPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Pedidos (pipeline y pendientes) */}
        <TabsContent value="orders" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{translate('reportsOrdersPipelineChartTitle')}</CardTitle>
                <CardDescription>{translate('reportsOrdersHintFilters')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ordersPipelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={70} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="cantidad" fill="#d97706" name={translate('transactions')} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{translate('reportsPendingOrdersListSection')}</CardTitle>
                <CardDescription>
                  {orderPipelineMetrics.initialCount}{' '}
                  {translate('reportsPendingOrdersCard').toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{translate('poNumber')}</TableHead>
                        <TableHead>{translate('storeHeader')}</TableHead>
                        <TableHead>{translate('dateCol')}</TableHead>
                        <TableHead className="text-right">{translate('totalCol')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderPipelineMetrics.pendingList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                    {translate('noDataWithFilters')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        orderPipelineMetrics.pendingList.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">{o.po ?? o.id}</TableCell>
                            <TableCell>{o.storeName || o.storeId}</TableCell>
                            <TableCell>
                              {new Date(o.date).toLocaleDateString(locale, {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              ${(Number(o.total) > 0 ? Number(o.total) : Number(o.subtotal) || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Pedido inicial vs facturado (faltantes) */}
        <TabsContent value="orderVsInvoice" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                {translate('reportsOrderVsInvoiceTitle')}
              </CardTitle>
              <CardDescription>{translate('reportsOrderVsInvoiceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {shortageLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {translate('reportsShortageLoading')}
                  </div>
                )}
              {!shortageLoading && invoicedOrderSummaries.length === 0 && (
                <p className="text-sm text-muted-foreground">{translate('reportsShortageNoInvoiced')}</p>
              )}
              {!shortageLoading &&
                invoicedOrderSummaries.length > 0 &&
                shortageAnalytics &&
                shortageAnalytics.analyzed === 0 && (
                  <p className="text-sm text-muted-foreground">{translate('reportsShortageNoneComparable')}</p>
                )}
              {!shortageLoading && shortageAnalytics && shortageAnalytics.analyzed > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        {translate('reportsShortageKpiUnits')}
                      </p>
                      <p className="text-2xl font-bold text-amber-700 mt-1">
                        {shortageAnalytics.totalShortUnits.toLocaleString(locale)}
                      </p>
              </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        {translate('reportsShortageKpiLines')}
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {shortageAnalytics.totalShortLines.toLocaleString(locale)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        {translate('reportsShortageKpiOrders')}
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        {shortageAnalytics.ordersWithShort.toLocaleString(locale)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        {translate('reportsShortageKpiAnalyzed')}
                      </p>
                      <p className="text-2xl font-bold text-green-700 mt-1">
                        {shortageAnalytics.analyzed.toLocaleString(locale)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{translate('reportsShortagePieTitle')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {shortagePieData.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{translate('noDataWithFilters')}</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <RechartsPieChart>
                              <Pie
                                data={shortagePieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={(e) => `${e.name}: ${e.value}`}
                              >
                                {shortagePieData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{translate('reportsShortageChartTrend')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {shortageMonthChart.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{translate('noDataWithFilters')}</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={shortageMonthChart}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="unidades"
                                stroke="#d97706"
                                strokeWidth={2}
                                name={translate('reportsShortageKpiUnits')}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{translate('reportsShortageChartProducts')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {shortageProductChart.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{translate('noDataWithFilters')}</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={Math.max(280, shortageProductChart.length * 36)}>
                            <BarChart data={shortageProductChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" allowDecimals={false} />
                              <YAxis dataKey="label" type="category" width={148} tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey="unidades" fill="#ea580c" name={translate('reportsShortageColMissing')} radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{translate('reportsShortageChartStores')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {shortageStoreChart.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{translate('noDataWithFilters')}</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={Math.max(300, shortageStoreChart.length * 44)}>
                            <BarChart data={shortageStoreChart} layout="vertical" margin={{ left: 4, right: 16 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" allowDecimals={false} />
                              <YAxis
                                dataKey="label"
                                type="category"
                                width={Math.min(340, Math.max(200, ...shortageStoreChart.map((r) => String(r.label).length * 7)))}
                                tick={{ fontSize: 11 }}
                                interval={0}
                              />
                              <Tooltip />
                              <Bar dataKey="unidades" fill="#ca8a04" name={translate('reportsShortageColMissing')} radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{translate('reportsShortageDetailTable')}</CardTitle>
                      <CardDescription>
                        {(() => {
                          const total = shortageAnalytics.detailSample.length;
                          const shown = Math.min(30, total);
                          return translate('reportsShortageRowsNote')
                            .replace('{shown}', String(shown))
                            .replace('{total}', String(total));
                        })()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{translate('poNumber')}</TableHead>
                            <TableHead>{translate('storeHeader')}</TableHead>
                            <TableHead>{translate('productLabel')}</TableHead>
                            <TableHead className="text-right">{translate('reportsShortageColOrdered')}</TableHead>
                            <TableHead className="text-right">{translate('reportsShortageColInvoiced')}</TableHead>
                            <TableHead className="text-right">{translate('reportsShortageColMissing')}</TableHead>
                            <TableHead>{translate('dateCol')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shortageAnalytics.detailSample.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                {translate('noDataWithFilters')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            shortageAnalytics.detailSample.slice(0, 30).map((row, idx) => (
                              <TableRow key={`${row.orderId}-${row.sku}-${idx}`}>
                                <TableCell className="font-medium whitespace-nowrap">{row.po}</TableCell>
                                <TableCell className="min-w-[160px] max-w-[280px]">
                                  <p className="font-medium leading-snug break-words">
                                    {resolveStoreLabelFromList(stores, row.storeId, row.storeName)}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{row.productName}</p>
                                    <p className="text-xs text-muted-foreground">{row.sku}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{row.ordered}</TableCell>
                                <TableCell className="text-right">{row.delivered}</TableCell>
                                <TableCell className="text-right font-semibold text-amber-700">{row.diff}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {new Date(row.orderDateIso).toLocaleDateString(locale, {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Productos */}
        <TabsContent value="products" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Top Productos */}
            <Card>
              <CardHeader>
                <CardTitle>{translate('top10ProductsBySales')}</CardTitle>
                <CardDescription>{translate('productsWithHighestRevenue')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData.products} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Bar dataKey="ventas" fill="#4f46e5" name={translate('salesEuro')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabla de Top Productos */}
            <Card>
              <CardHeader>
                <CardTitle>{translate('productRanking')}</CardTitle>
                <CardDescription>{translate('top10ByRevenue')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {salesMetrics.topProducts.map((product, index) => {
                    const fullProduct = products.find((p) => String(p.id) === String(product.productId));
                    const imgUrl = getProductImageUrl(fullProduct);
                    return (
                    <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                          #{index + 1}
                        </Badge>
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Package className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                        <div>
                          <p className="font-medium text-gray-900">{product.productName}</p>
                          <p className="text-sm text-gray-500">{product.productSku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                          <p className="font-bold text-gray-900">${product.totalSales.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{product.totalQuantity} {translate('totalQuantityUnits')}</p>
                      </div>
                    </div>
                    );
                  })}
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
                <CardTitle>{translate('top10StoresBySales')}</CardTitle>
                <CardDescription>{translate('storesBestResults')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData.stores}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Bar dataKey="ventas" fill="#10b981" name={translate('salesEuro')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabla de Top Tiendas */}
            <Card>
              <CardHeader>
                <CardTitle>{translate('storeRanking')}</CardTitle>
                <CardDescription>{translate('top10SalesPerformance')}</CardDescription>
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
                        <p className="font-bold text-gray-900">${store.totalSales.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{store.totalQuantity} {translate('totalQuantityUnits')}</p>
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
                <CardTitle>{translate('top10SellersBySales')}</CardTitle>
                <CardDescription>{translate('salesTeamPerformance')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData.sellers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Bar dataKey="ventas" fill="#7c3aed" name={translate('salesEuro')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabla de Top Vendedores */}
            <Card>
              <CardHeader>
                <CardTitle>{translate('sellerRanking')}</CardTitle>
                <CardDescription>{translate('top10CommercialPerformance')}</CardDescription>
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
                        <p className="font-bold text-gray-900">${seller.totalSales.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{seller.totalQuantity} {translate('totalQuantityUnits')}</p>
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

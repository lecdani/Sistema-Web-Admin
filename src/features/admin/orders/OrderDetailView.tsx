import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Badge } from '@/shared/components/base/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Label } from '@/shared/components/base/Label';
import {
  ShoppingCart,
  FileText,
  Package,
  CheckCircle,
  AlertCircle,
  Download,
  Layout,
  Printer,
  ImagePlus,
  X,
  Save,
} from 'lucide-react';
import { useLanguage } from '@/shared/hooks/useLanguage';
import {
  ordersApi,
  OrderForUI,
  computeOrderInvoiceShortfall,
  applyInvoiceQtyToOrderItems,
  type OrderDiscrepancyItem,
} from '@/shared/services/orders-api';
import { getBackendAssetUrl } from '@/shared/config/api';
import { uploadImage } from '@/shared/services/images-api';
import { toast } from '@/shared/components/base/Toast';
import { histpricesApi } from '@/shared/services/histprices-api';
import { productsApi } from '@/shared/services/products-api';
import { categoriesApi } from '@/shared/services/categories-api';
import { storesApi } from '@/shared/services/stores-api';
import { citiesApi } from '@/shared/services/cities-api';
import { usersApi } from '@/shared/services/users-api';
import { salesRoutesApi } from '@/shared/services/sales-routes-api';
import { Invoice } from './components/Invoice';
import { OrderPlanogramView } from './components/OrderPlanogramView';
import { OrderCatalogGridView } from './components/OrderCatalogGridView';
import type { Order } from '@/shared/types';
import { sameFamilyId } from '@/shared/utils/family-display';

interface OrderDetailViewProps {
  orderId: string;
  onClose?: () => void;
  onOrderUpdated?: () => void;
}

function looksLikeId(name: string): boolean {
  if (!name || !name.trim()) return true;
  return /^[0-9a-f-]{36}$/i.test(name.trim()) || /^\d+$/.test(name.trim());
}

export function OrderDetailView({ orderId, onClose, onOrderUpdated }: OrderDetailViewProps) {
  const { translate, locale } = useLanguage();
  const [order, setOrder] = useState<OrderForUI | null>(null);
  const [invoiceDisplay, setInvoiceDisplay] = useState<{
    invoiceNumber: string;
    date: string;
    total: number;
    subtotal: number;
    invoiceId?: string;
    storeId?: string;
    pod?: string;
    items: Array<{ qty: number; code: string; description: string; price: number; amount: number }>;
  } | null>(null);
  const [podImageError, setPodImageError] = useState(false);
  const [storeNameDisplay, setStoreNameDisplay] = useState<string>('');
  const [storeAddressDisplay, setStoreAddressDisplay] = useState<string>('');
  const [storeCityDisplay, setStoreCityDisplay] = useState<string>('');
  const [sellerPersonName, setSellerPersonName] = useState<string>('');
  const [sellerRouteCode, setSellerRouteCode] = useState<string>('');
  const [detailReload, setDetailReload] = useState(0);
  const [emergencyPodFile, setEmergencyPodFile] = useState<File | null>(null);
  const [emergencyPodPreview, setEmergencyPodPreview] = useState<string | null>(null);
  const [emergencyPodUploading, setEmergencyPodUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [invoiceViewMode, setInvoiceViewMode] = useState<'product' | 'family'>('product');
  const [invoicePrintLayout, setInvoicePrintLayout] = useState<'normal' | 'ticket'>('normal');
  const [storeHasPlanogram, setStoreHasPlanogram] = useState<boolean | null>(null);
  /** Id de factura resuelto al cargar (pedido + factura + lista), para POD aunque el pedido no traiga invoiceId. */
  const [podInvoiceIdForUpload, setPodInvoiceIdForUpload] = useState('');
  const emergencyPodInputRef = useRef<HTMLInputElement>(null);
  const [discrepancies, setDiscrepancies] = useState<OrderDiscrepancyItem[]>([]);
  const [discrepanciesLoaded, setDiscrepanciesLoaded] = useState(false);
  const [allCategories, setAllCategories] = useState<
    Array<{
      id: string;
      name: string;
      sku?: string;
      code?: string;
      shortName?: string;
      volume?: number;
      unit?: string;
    }>
  >([]);

  useEffect(() => {
    const load = async () => {
      setPodInvoiceIdForUpload('');
      const ord = await ordersApi.getOrderById(orderId);
      if (!ord) {
        setOrder(null);
        setInvoiceDisplay(null);
        setPodInvoiceIdForUpload('');
        return;
      }
      const categoriesList = await categoriesApi.fetchAll();
      setAllCategories(
        categoriesList.map((c) => ({
          id: c.id,
          name: c.name,
          sku: c.sku,
          code: String(c.code || c.familyCode || '').trim() || undefined,
          shortName: (c.shortName || '').trim() || undefined,
          volume: c.volume != null && Number.isFinite(Number(c.volume)) ? Number(c.volume) : undefined,
          unit: (c.unit || '').trim() || undefined,
        }))
      );
      const categoryById = new Map<string, string>();
      categoriesList.forEach((c) => {
        categoryById.set(c.id, c.name);
        categoryById.set(String(Number(c.id)), c.name);
      });

      // Enriquecer items con precio desde histprices cuando falte (igual que PWA)
      const needsPrice = ord.items.some((i: any) => i.productId && !Number(i.price));
      const needsProductName = ord.items.some(
        (i: any) => i.productId && !(i.productName || i.sku || '').trim()
      );
      const needsCategory = ord.items.some(
        (i: any) => i.productId && (i.category == null || i.category === '')
      );
      let orderToSet = ord;
      if (needsPrice || needsProductName || needsCategory) {
        const enrichedItems = await Promise.all(
          ord.items.map(async (item: any) => {
            let productName = (item.productName || item.sku || '').trim();
            let price = Number(item.price) || 0;
            let category = (item.category ?? '').trim();
            let familyId = String(
              item.familyId ?? item.FamilyId ?? item.categoryId ?? item.CategoryId ?? ''
            ).trim();
            if (item.productId) {
              const product = await productsApi.getById(item.productId);
              if (product) {
                if (!productName) productName = product.name || product.code || product.sku || '';
                if (!familyId) {
                  familyId = String((product as any).familyId ?? product.categoryId ?? '').trim();
                }
                if (!category && product.category) category = product.category.trim();
                if (!category && product.categoryId != null) {
                  const id = String(product.categoryId);
                  category = categoryById.get(id) ?? categoryById.get(String(Number(id))) ?? '';
                }
                if (!price) {
                  if (familyId) {
                    const latest = await histpricesApi.getLatest(familyId);
                    price = latest?.price ?? 0;
                  }
                }
              }
            }
            return {
              ...item,
              productName: productName || item.productName,
              price,
              category: category || item.category,
              familyId: familyId || item.familyId,
              categoryId: familyId || item.categoryId,
            };
          })
        );
        const computedSubtotal = enrichedItems.reduce(
          (s: number, i: any) => s + (i.quantity ?? i.toOrder ?? 0) * (i.price || 0),
          0
        );
        orderToSet = {
          ...ord,
          items: enrichedItems,
          subtotal: ord.subtotal || computedSubtotal,
          total: ord.total || computedSubtotal + (ord.tax || 0),
        };
      }
      setOrder(orderToSet);

      // Nombre de tienda: resolver desde API si falta o parece ID (y tenemos storeId)
      const storeIdToResolve = (orderToSet.storeId || '').trim();
      const name = (orderToSet.storeName || '').trim();
      let resolvedStoreName = '';
      let resolvedStoreAddress = '';
      const shouldResolveStore = storeIdToResolve && (looksLikeId(name) || !name || name === '—');
      if (shouldResolveStore) {
        try {
          const store = await storesApi.getById(storeIdToResolve);
          if (store) {
            setStoreHasPlanogram(store.hasPlanogram !== false);
            resolvedStoreName = store.name;
            resolvedStoreAddress = store.address || '';
            setStoreNameDisplay(store.name);
            setStoreAddressDisplay(store.address || '');
            if (store.cityId) {
              try {
                const city = await citiesApi.getById(store.cityId);
                setStoreCityDisplay(city?.name ?? '');
              } catch {
                setStoreCityDisplay('');
              }
            } else {
              setStoreCityDisplay('');
            }
          } else {
            setStoreHasPlanogram(null);
            resolvedStoreName = name || orderToSet.storeName || '—';
            setStoreNameDisplay(resolvedStoreName);
            setStoreAddressDisplay(orderToSet.storeAddress || '');
            setStoreCityDisplay('');
          }
        } catch {
          setStoreHasPlanogram(null);
          setStoreNameDisplay(name || orderToSet.storeName || '—');
          setStoreAddressDisplay(orderToSet.storeAddress || '');
          setStoreCityDisplay('');
        }
      } else {
        if (storeIdToResolve) {
          try {
            const store = await storesApi.getById(storeIdToResolve);
            setStoreHasPlanogram(store ? store.hasPlanogram !== false : null);
          } catch {
            setStoreHasPlanogram(
              String((orderToSet as any).planogramId ?? '').trim() ? true : null
            );
          }
        } else {
          setStoreHasPlanogram(
            String((orderToSet as any).planogramId ?? '').trim() ? true : null
          );
        }
        resolvedStoreName = name || orderToSet.storeName || '—';
        resolvedStoreAddress = orderToSet.storeAddress || '';
        setStoreNameDisplay(resolvedStoreName);
        setStoreAddressDisplay(resolvedStoreAddress);
        setStoreCityDisplay('');
      }

      // Vendedor y código de ruta (UI: código resaltado, nombre entre paréntesis)
      if (orderToSet.salespersonId) {
        try {
          const user = await usersApi.getById(orderToSet.salespersonId);
          if (user) {
            let person = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            if (!person) person = user.email || '—';
            let routeCode = '';
            const routeId = String(user.salesRouteId || '').trim();
            if (routeId) {
              try {
                const route = await salesRoutesApi.getById(routeId);
                routeCode = (route?.code || '').trim();
              } catch {
                /* sin catálogo de ruta */
              }
            }
            setSellerPersonName(person);
            setSellerRouteCode(routeCode);
          } else {
            setSellerPersonName(orderToSet.salespersonId);
            setSellerRouteCode('');
          }
        } catch {
          setSellerPersonName(orderToSet.salespersonId);
          setSellerRouteCode('');
        }
      } else {
        setSellerPersonName('—');
        setSellerRouteCode('');
      }

      const inv = await ordersApi.getInvoiceDisplayForOrder(orderId, orderToSet.invoiceId, orderToSet);
      setInvoiceDisplay(inv);
      {
        let pid = String(orderToSet.invoiceId ?? (orderToSet as any).InvoiceId ?? '').trim();
        if (inv?.invoiceId) pid = String(inv.invoiceId).trim();
        if (!pid) {
          const a = await ordersApi.getInvoiceIdForOrder(orderId);
          if (a != null) pid = String(a).trim();
          else if (orderToSet.backendOrderId != null && String(orderToSet.backendOrderId).trim() !== '') {
            const b = await ordersApi.getInvoiceIdForOrder(String(orderToSet.backendOrderId));
            if (b != null) pid = String(b).trim();
          }
        }
        setPodInvoiceIdForUpload(pid);
      }
      // Si la tienda seguía vacía pero la factura tiene storeId, resolver nombre de tienda
      const invStoreId = (inv?.storeId != null && inv?.storeId !== '') ? String(inv.storeId).trim() : '';
      if (!resolvedStoreName && invStoreId) {
        try {
          const store = await storesApi.getById(invStoreId);
          if (store) {
            setStoreNameDisplay(store.name);
            setStoreAddressDisplay(store.address || '');
          }
        } catch {
          // ignorar
        }
      }
    };
    load();
  }, [orderId, detailReload]);

  useEffect(() => {
    setPodImageError(false);
  }, [order?.podImageUrl, order?.podFileName, invoiceDisplay?.pod]);

  /** Discrepancias pedido vs factura (GET …/dicrepancies/{id}) — solo pedidos facturados */
  useEffect(() => {
    if (!order) {
      setDiscrepancies([]);
      setDiscrepanciesLoaded(false);
      return;
    }
    const s = String(order.status || '').toLowerCase().trim();
    const isInvoiced =
      s === 'invoiced' ||
      s === 'delivered' ||
      s === '2' ||
      s === 'completed' ||
      s === 'confirmed' ||
      s === 'confirmado';
    if (!isInvoiced) {
      setDiscrepancies([]);
      setDiscrepanciesLoaded(false);
      return;
    }
    let cancelled = false;
    setDiscrepanciesLoaded(false);
    (async () => {
      const rows = await ordersApi.getOrderDiscrepancies(orderId, (order as any).backendOrderId);
      if (!cancelled) {
        setDiscrepancies(rows);
        setDiscrepanciesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, order?.status, order?.backendOrderId]);

  const detailLifecycle = useMemo(() => {
    const s = String(order?.status || '').toLowerCase().trim();
    if (s === 'cancelled' || s === 'canceled' || s === 'cancelado' || s === '3') return 'cancelled' as const;
    if (
      s === 'invoiced' ||
      s === 'delivered' ||
      s === '2' ||
      s === 'completed' ||
      s === 'confirmed' ||
      s === 'confirmado'
    ) {
      return 'invoiced' as const;
    }
    return 'initial' as const;
  }, [order?.status]);

  const showInvoicedTabs = detailLifecycle === 'invoiced';

  const displayPo = String((order as any)?.po ?? '').trim();
  const displayInvoiceNumber = String(invoiceDisplay?.invoiceNumber ?? '').trim();
  const headerMainNumber =
    displayInvoiceNumber ||
    (detailLifecycle !== 'invoiced' ? displayPo : '') ||
    `${translate('orderNumber')} #${order?.id ?? (order as any)?.backendOrderId ?? '—'}`;
  const headerStatusClass =
    detailLifecycle === 'cancelled'
      ? 'bg-slate-100 text-slate-700'
      : detailLifecycle === 'invoiced'
      ? 'bg-green-100 text-green-700'
      : 'bg-amber-100 text-amber-700';

  useEffect(() => {
    setActiveTab('summary');
  }, [orderId]);

  useEffect(() => {
    setEmergencyPodFile(null);
    setEmergencyPodPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [orderId]);

  /**
   * Pedido faltante: comparar siempre pedido inicial (líneas del pedido) vs factura cuando haya líneas de factura.
   * Si no hay factura en pantalla, usar filas cortas del endpoint de discrepancias.
   * SKU se rellena desde ítems del pedido si la API no lo trae.
   */
  const shortRows = useMemo(() => {
    const orderItems = order?.items ?? [];
    let rows: OrderDiscrepancyItem[] = [];

    if (orderItems.length && invoiceDisplay?.items?.length) {
      rows = computeOrderInvoiceShortfall(orderItems as any[], invoiceDisplay.items);
    }

    if (rows.length === 0) {
      rows = discrepancies.filter((r) => {
        const diff = Number.isFinite(r.difference) ? r.difference : r.orderedQty - r.deliveredQty;
        if (diff > 0) return true;
        return r.orderedQty > 0 && r.deliveredQty < r.orderedQty;
      });
    }

    return rows.map((r) => {
      if (r.sku && String(r.sku).trim()) return r;
      const pid = String(r.productId ?? '').trim();
      const oi = orderItems.find((x: any) => String(x.productId ?? x.ProductId ?? '') === pid) as any;
      if (!oi) return r;
      const s = String(
        oi.sku ?? oi.Sku ?? oi.code ?? oi.Code ?? oi.productCode ?? oi.ProductCode ?? ''
      ).trim();
      return s ? { ...r, sku: s } : r;
    });
  }, [discrepancies, order?.items, invoiceDisplay?.items]);

  const hasInvoiceLines = !!(invoiceDisplay?.items && invoiceDisplay.items.length > 0);
  /** Pedido creado desde planograma (PWA): factura y vista planograma solo en este caso. */
  const orderFromPlanogram = !!(String((order as any)?.planogramId ?? '').trim());
  const isCatalogStore = storeHasPlanogram === false;
  const catalogInvoicedItems = useMemo(() => {
    if (!order?.items?.length || !invoiceDisplay?.items?.length) return null;
    return applyInvoiceQtyToOrderItems(order.items as any[], invoiceDisplay.items);
  }, [order?.items, invoiceDisplay?.items]);

  useEffect(() => {
    if (activeTab !== 'invoice-doc') return;
    if (!showInvoicedTabs || isCatalogStore || !orderFromPlanogram) {
      setActiveTab('planogram-invoice');
    }
  }, [activeTab, showInvoicedTabs, isCatalogStore, orderFromPlanogram]);

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">{translate('loadingOrder')}</p>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    const map: Record<string, string> = {
      pending: translate('initialStatus'),
      initial: translate('initialStatus'),
      completed: translate('statusInvoiced'),
      confirmed: translate('statusInvoiced'),
      invoiced: translate('statusInvoiced'),
      delivered: translate('statusDelivered'),
      cancelled: translate('statusCancelled'),
      canceled: translate('statusCancelled'),
      cancelado: translate('statusCancelled'),
      '3': translate('statusCancelled'),
    };
    return map[s] || status || '—';
  };
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    const statusConfig: Record<string, { label: string; color: string }> = {
      pending: { label: translate('initialStatus'), color: 'bg-yellow-100 text-yellow-800' },
      initial: { label: translate('initialStatus'), color: 'bg-yellow-100 text-yellow-800' },
      completed: { label: translate('statusInvoiced'), color: 'bg-green-100 text-green-800' },
      confirmed: { label: translate('statusInvoiced'), color: 'bg-green-100 text-green-800' },
      invoiced: { label: translate('statusInvoiced'), color: 'bg-green-100 text-green-800' },
      delivered: { label: translate('statusDelivered'), color: 'bg-green-100 text-green-800' },
      cancelled: { label: translate('statusCancelled'), color: 'bg-slate-200 text-slate-800' },
      canceled: { label: translate('statusCancelled'), color: 'bg-slate-200 text-slate-800' },
      cancelado: { label: translate('statusCancelled'), color: 'bg-slate-200 text-slate-800' },
      '3': { label: translate('statusCancelled'), color: 'bg-slate-200 text-slate-800' },
    };
    const config = statusConfig[s] || { label: status || '—', color: 'bg-gray-100 text-gray-800' };
    return <Badge variant="secondary" className={config.color}>{config.label}</Badge>;
  };

  // Total y subtotal: factura → pedido → calculado desde items (siempre mostrar algo)
  const items = order.items || [];
  const computedFromItems = items.reduce(
    (sum, i) => sum + (i.quantity ?? i.toOrder ?? 0) * (i.price ?? 0),
    0
  );
  const displaySubtotal =
    (invoiceDisplay?.subtotal ?? order.subtotal ?? 0) > 0
      ? (invoiceDisplay?.subtotal ?? order.subtotal ?? 0)
      : computedFromItems;
  const displayTotal =
    (invoiceDisplay?.total ?? order.total ?? 0) > 0
      ? (invoiceDisplay?.total ?? order.total ?? 0)
      : computedFromItems;

  // POD: igual que PWA — orden, factura o vacío. Imagen desde S3 vía images/url (mismo que productos).
  const displayPod = (order.podImageUrl || order.podFileName || (invoiceDisplay?.pod ?? '') || '').trim();
  const buildPodImageUrl = (podPath: string): string => {
    const raw = (podPath || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return getBackendAssetUrl('images/url/' + raw.replace(/^\/+/, ''));
  };
  const podImageUrl = displayPod ? buildPodImageUrl(displayPod) : '';
  const isPodPath = displayPod && !displayPod.startsWith('data:') && !displayPod.startsWith('http');
  /** Solo si hay ruta de imagen; `podUploaded` sin ruta no bloquea la carga de emergencia. */
  const hasPodEvidence = !!displayPod;

  // Fecha factura como en PWA (en-US)
  const formatInvoiceDate = (d: string) => {
    if (!d) return '—';
    return d.includes(',') ? d : new Date(d).toLocaleDateString(locale);
  };

  const rawInvoiceIdForPod =
    String(podInvoiceIdForUpload || '').trim() ||
    (order.invoiceId ??
      (order as any)?.InvoiceId ??
      invoiceDisplay?.invoiceId);
  const invoiceIdForPod =
    rawInvoiceIdForPod != null && String(rawInvoiceIdForPod).trim() !== ''
      ? String(rawInvoiceIdForPod).trim()
      : '';

  const canShowEmergencyPodUpload = showInvoicedTabs && !hasPodEvidence && !!invoiceIdForPod;

  const clearEmergencyPodSelection = () => {
    setEmergencyPodPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setEmergencyPodFile(null);
    if (emergencyPodInputRef.current) emergencyPodInputRef.current.value = '';
  };

  const handleEmergencyPodFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEmergencyPodPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setEmergencyPodFile(file);
    e.target.value = '';
  };

  const handleEmergencyPodSubmit = async () => {
    if (!emergencyPodFile || !invoiceIdForPod) {
      toast.error(translate('selectPODImage'));
      return;
    }
    setEmergencyPodUploading(true);
    try {
      const { fileName } = await uploadImage(emergencyPodFile);
      const fn = (fileName || '').trim();
      if (!fn) {
        toast.error(translate('podUploadFailed'));
        return;
      }
      const patched = await ordersApi.uploadPODForInvoice({
        invoiceId: invoiceIdForPod,
        fileName: fn,
      });
      if (!patched) {
        toast.error(translate('podUploadFailed'));
        return;
      }
      const backendOrderId = String((order as any)?.backendOrderId ?? order?.id ?? orderId);
      const statusOk = await ordersApi.updateOrderStatus(backendOrderId, true);
      if (!statusOk) {
        toast.warning(translate('podSavedStatusNotUpdated'));
      } else {
        toast.success(translate('podUploadedSuccess'));
      }
      clearEmergencyPodSelection();
      setDetailReload((n) => n + 1);
      onOrderUpdated?.();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message || '')
          : '';
      toast.error(msg ? `${translate('podUploadFailed')}: ${msg}` : translate('podUploadFailed'));
    } finally {
      setEmergencyPodUploading(false);
    }
  };

  return (
    <div className="space-y-0">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-t-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {headerMainNumber}
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                {translate('createdOn')} {new Date(order.date || (order as any).createdAt).toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-3 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="text-3xl font-bold">${displayTotal.toFixed(2)}</span>
            </div>
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${headerStatusClass}`}>
              {getStatusLabel(order.status)}
            </div>
            {detailLifecycle === 'invoiced' ? (
              <div className="mt-2 flex justify-end">
                <Badge
                  variant="secondary"
                  className={
                    hasPodEvidence
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }
                >
                  {hasPodEvidence ? translate('invoicedWithPodBadge') : translate('invoicedMissingPodBadge')}
                </Badge>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-auto p-0 bg-gray-50 border-b rounded-none flex-wrap">
          <TabsTrigger value="summary" className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
            <Package className="h-4 w-4" />
            {translate('orderTabSummary')}
          </TabsTrigger>
          {showInvoicedTabs ? (
            <>
              {!isCatalogStore && orderFromPlanogram ? (
                <TabsTrigger value="invoice-doc" className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
                  <FileText className="h-4 w-4" />
                  {translate('invoiceLabel')}
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="planogram-invoice" className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
                <Layout className="h-4 w-4" />
                {!isCatalogStore
                  ? translate('orderTabPlanogramInvoiced')
                  : translate('orderTabCatalogInvoiced')}
              </TabsTrigger>
              <TabsTrigger value="pod-only" className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
                <Package className="h-4 w-4" />
                {translate('orderTabPod')}
              </TabsTrigger>
            </>
          ) : null}
          <TabsTrigger value="initial" className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-white data-[state=active]:text-indigo-600">
            <Layout className="h-4 w-4" />
            {translate('orderTabInitial')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="p-6 space-y-0 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">{translate('orderDetails')}</h3>
              </div>
              <div className="space-y-3">
                {/* 1. Factura (InvoiceNumber) o PO — solo lectura */}
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-600 text-sm pt-0.5">
                    {detailLifecycle === 'invoiced' ? translate('invoiceNumberCol') : translate('poNumber')}
                    :
                  </span>
                  <div className="flex-1 min-w-0 text-right">
                    <span className="font-medium text-gray-900">
                      {detailLifecycle === 'invoiced'
                        ? (displayInvoiceNumber || '—')
                        : (displayPo || '—')}
                    </span>
                  </div>
                </div>
                {/* 2. Estado */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">{translate('statusLabel')}:</span>
                  {getStatusBadge(order.status)}
                </div>
                {/* 3. Tienda con ciudad */}
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-600 text-sm pt-0.5">{translate('storeLabel')}:</span>
                  <div className="flex-1 min-w-0 text-right">
                    <div>
                      <span className="font-medium text-gray-900 block">{storeNameDisplay || order.storeName || '—'}</span>
                      {storeCityDisplay ? (
                        <span className="text-xs text-gray-500">{storeCityDisplay}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {/* 4. Vendedor */}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-gray-600 text-sm shrink-0">{translate('sellerLabel')}:</span>
                  <span className="font-medium text-gray-900 text-right min-w-0">
                    {sellerRouteCode ? (
                      <>
                        <span className="font-bold text-indigo-700 tracking-wide">{sellerRouteCode}</span>
                        {sellerPersonName && sellerPersonName !== '—' ? (
                          <span className="text-gray-900 font-normal"> ({sellerPersonName})</span>
                        ) : null}
                      </>
                    ) : (
                      sellerPersonName || '—'
                    )}
                  </span>
                </div>
                {((order as any).deliveredAt || order.deliveryDate) && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-gray-600 text-sm">{translate('deliveryDateLabel')}:</span>
                    <span className="font-medium text-green-600 text-sm">
                      {new Date((order as any).deliveredAt || order.deliveryDate || '').toLocaleDateString(locale)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-5 border border-green-100">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">{translate('financialSummary')}</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">{translate('productsLabel')}:</span>
                  <span className="font-medium text-gray-900">{(order.items || []).length} {translate('itemsCount')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">{translate('subtotal')}:</span>
                  <span className="font-medium text-gray-900">${displaySubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-green-200">
                  <span className="text-gray-900 font-semibold">{translate('totalLabel')}:</span>
                  <span className="text-xl font-bold text-green-600">${displayTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          {(order as any).notes && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 mt-4">
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">{translate('orderNotes')}</h4>
              <p className="text-sm text-gray-700">{(order as any).notes}</p>
            </div>
          )}

          {showInvoicedTabs && discrepanciesLoaded ? (
            <div className="mt-6">
              <div className="rounded-lg border border-amber-200 overflow-hidden bg-white">
                <h4 className="bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 border-b border-amber-100">
                  {translate('orderShortSection')}
                </h4>
                <div className="overflow-x-auto">
                  {!hasInvoiceLines && discrepancies.length === 0 ? (
                    <p className="text-sm text-gray-500 p-4">{translate('discrepancyNoData')}</p>
                  ) : shortRows.length === 0 ? (
                    <p className="text-sm text-gray-600 p-4">{translate('orderShortNone')}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 text-left">
                          <th className="py-2 px-3 font-semibold">{translate('discrepancyColProduct')}</th>
                          <th className="py-2 px-3 font-semibold w-16 text-right">{translate('discrepancyColOrdered')}</th>
                          <th className="py-2 px-3 font-semibold w-16 text-right">{translate('discrepancyColDelivered')}</th>
                          <th className="py-2 px-3 font-semibold w-16 text-right">{translate('discrepancyColDiff')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shortRows.map((r, idx) => (
                          <tr key={`s-${r.productId}-${r.sku}-${idx}`} className="border-t border-slate-100">
                            <td className="py-2 px-3 text-gray-900">
                              <span className="font-bold text-gray-900 font-mono text-xs mr-2">
                                {r.sku?.trim() || '—'}
                              </span>
                              <span className="text-gray-800">{r.productName?.trim() || '—'}</span>
                            </td>
                            <td className="py-2 px-3 text-right">{r.orderedQty}</td>
                            <td className="py-2 px-3 text-right">{r.deliveredQty}</td>
                            <td className="py-2 px-3 text-right font-semibold text-amber-800">
                              {Number.isFinite(r.difference) ? r.difference : r.orderedQty - r.deliveredQty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="initial" className="p-6 mt-0 space-y-4">
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab('initial');
                setTimeout(() => window.print(), 200);
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              {translate('printOrderTab')}
            </Button>
          </div>
          {!!displayPo && (
            <div className="print:hidden">
              <Alert className="border-slate-200 bg-white">
                <AlertDescription className="text-slate-700">
                  <span className="font-semibold">{translate('poNumber')}:</span> {displayPo}
                </AlertDescription>
              </Alert>
            </div>
          )}
          <div id="admin-order-initial-print-root">
          {!isCatalogStore ? (
            <OrderPlanogramView
              quantitySource="order"
              order={
                {
                  id: order.id,
                  backendOrderId: (order as any).backendOrderId,
                  salespersonId: (order as any).salespersonId ?? '',
                  storeId: (order as any).storeId ?? '',
                  createdAt: order.date ? new Date(order.date) : new Date(),
                  // En pedido inicial/cancelado, se sigue mostrando PO.
                  po: displayPo || undefined,
                  status: showInvoicedTabs ? 'completed' : 'pending',
                  storeName: order.storeName,
                  planogramId: (order as any).planogramId,
                  subtotal: displaySubtotal,
                  total: displayTotal,
                  items: (order.items || []).map((it: any) => ({
                    id: it.id ?? '',
                    orderId: order.id,
                    productId: it.productId ?? it.sku ?? '',
                    quantity: it.quantity ?? it.toOrder ?? 0,
                    productName: it.productName,
                    unitPrice: Number(it.price) || 0,
                    subtotal: (it.quantity ?? it.toOrder ?? 0) * (Number(it.price) || 0),
                    status: 'pending',
                  })),
                  updatedAt: new Date(),
                } as Order
              }
            />
          ) : (
            <OrderCatalogGridView
              useAllActiveProducts
              order={
                {
                  id: order.id,
                  items: (order.items || []).map((it: any) => ({
                    id: it.id ?? '',
                    orderId: order.id,
                    productId: it.productId ?? it.sku ?? '',
                    quantity: it.quantity ?? it.toOrder ?? 0,
                    productName: it.productName,
                    price: Number(it.price) || 0,
                    sku: it.sku,
                  })),
                } as any
              }
            />
          )}
          </div>
        </TabsContent>

        {showInvoicedTabs ? (
        <>
        {!isCatalogStore && orderFromPlanogram ? (
        <TabsContent value="invoice-doc" className="p-6 mt-0 space-y-6" id="order-detail-billing-print">
          {(() => {
            const invFromApi = invoiceDisplay?.items?.length ? invoiceDisplay : null;
            const invFromOrder =
              order.items?.length && !invFromApi
                ? {
                    invoiceNumber: String((invoiceDisplay as any)?.invoiceNumber ?? '—'),
                    date: order.date,
                    total: displayTotal,
                    subtotal: displaySubtotal,
                    items: order.items.map((it: any) => {
                      const q = it.quantity ?? it.toOrder ?? 0;
                      const p = Number(it.price) || 0;
                      const sku = String(it.sku ?? it.Sku ?? '').trim();
                      return {
                        qty: q,
                        code: sku || '—',
                        description: it.productName || '—',
                        price: p,
                        amount: q * p,
                      };
                    }),
                  }
                : null;
            const inv = invFromApi ?? invFromOrder;
            if (!inv || !inv.items.length) {
              return (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 ml-2">{translate('noInvoiceOrLines')}</AlertDescription>
                </Alert>
              );
            }
            const invoiceDateStr = typeof inv.date === 'string' ? inv.date : inv.date ? String(inv.date) : new Date().toISOString();
            const toInvoiceRows = (inv.items || []).map((line: any, idx: number) => {
              const code = String(line.code || '').trim();
              const normCode = code.replace(/-/g, '').toLowerCase();
              const oi =
                order.items.find((x: any) => String(x.sku || '').trim() === code) ||
                order.items.find((x: any) => String(x.productId) === code) ||
                (code.length >= 8
                  ? order.items.find((x: any) => {
                      const pid = String(x.productId || '').replace(/-/g, '').toLowerCase();
                      return pid && (pid === normCode || String(x.productId) === code);
                    })
                  : undefined);
              return {
                key: `line-${idx}`,
                productId: String(oi?.productId || line?.productId || ''),
                productName: String(line.description || oi?.productName || '—'),
                sku: String(line.code || '').trim(),
                qty: Number(line.qty) || 0,
                price: Number(line.price) || 0,
                lineTotal: Number(line.amount) || (Number(line.qty) || 0) * (Number(line.price) || 0),
              };
            });
            const invoiceRowMatchesOrderItem = (row: (typeof toInvoiceRows)[0], item: any) => {
              const code = String(row.sku || '').trim();
              const norm = code.replace(/-/g, '').toLowerCase();
              const pid = String(item.productId || '').replace(/-/g, '').toLowerCase();
              if (String(item.sku || '').trim() === code) return true;
              if (String(item.productId) === code) return true;
              if (row.productId && String(item.productId) === row.productId) return true;
              if (code.length >= 8 && pid && pid === norm) return true;
              return false;
            };
            const invoiceItems = toInvoiceRows.map((row) => {
              const matched = order.items.find((item: any) => invoiceRowMatchesOrderItem(row, item)) as any;
              const familyId = String(
                matched?.familyId ?? matched?.FamilyId ?? matched?.categoryId ?? matched?.CategoryId ?? ''
              ).trim();
              const categoryName = String(matched?.category ?? '').trim().toLowerCase();
              const fam = familyId
                ? allCategories.find((c) => sameFamilyId(String(c.id), familyId))
                : allCategories.find((c) => String(c.name || '').trim().toLowerCase() === categoryName) || null;
              const familyName = String(fam?.name || matched?.category || '').trim() || undefined;
              const familyCode = String(fam?.code || '').trim() || undefined;
              const familySku = String(fam?.sku || '').trim() || undefined;
              const familyShortName = String(fam?.shortName || '').trim() || undefined;
              const familyVolume =
                fam?.volume != null && Number.isFinite(Number(fam.volume)) ? Number(fam.volume) : undefined;
              const familyUnit = fam?.unit?.trim() || undefined;
              return {
                qty: row.qty,
                code: row.sku,
                description: row.productName,
                price: row.price,
                amount: row.lineTotal,
                familyName,
                familyCode,
                familySku,
                familyShortName,
                familyVolume,
                familyUnit,
              };
            });
            return (
              <Card className="border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
                <CardHeader className="px-4 pt-4 pb-2 print:hidden">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{translate('invoiceLabel')}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs font-medium ${
                            invoiceViewMode === 'product' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700'
                          }`}
                          onClick={() => setInvoiceViewMode('product')}
                        >
                          {translate('invoiceTabProducts')}
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs font-medium border-l border-slate-200 ${
                            invoiceViewMode === 'family' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700'
                          }`}
                          onClick={() => setInvoiceViewMode('family')}
                        >
                          {translate('invoiceTabFamilies')}
                        </button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInvoicePrintLayout('normal');
                          window.print();
                        }}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {translate('printDownload')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const prev = invoiceViewMode;
                          setInvoiceViewMode('family');
                          setInvoicePrintLayout('ticket');
                          setTimeout(() => {
                            window.print();
                            setTimeout(() => {
                              setInvoicePrintLayout('normal');
                              setInvoiceViewMode(prev);
                            }, 200);
                          }, 60);
                        }}
                        className="gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        {translate('printTicket')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Invoice
                    invoiceNumber={String(inv.invoiceNumber)}
                    date={formatInvoiceDate(invoiceDateStr)}
                    vendorName={sellerPersonName}
                    vendorRouteCode={sellerRouteCode}
                    vendorPersonName={sellerPersonName}
                    storeName={storeNameDisplay || order.storeName || '—'}
                    storeAddress={storeAddressDisplay || order.storeAddress || ''}
                    items={invoiceItems}
                    comments={order.comments}
                    viewMode={invoiceViewMode}
                    printLayout={invoicePrintLayout}
                  />
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>
        ) : null}

        <TabsContent value="planogram-invoice" className="p-6 mt-0 space-y-6">
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab('planogram-invoice');
                setTimeout(() => window.print(), 200);
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              {translate('printOrderTab')}
            </Button>
          </div>
          {!hasInvoiceLines ? (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 ml-2">{translate('noInvoiceYetAdmin')}</AlertDescription>
            </Alert>
          ) : null}
          {hasInvoiceLines && !isCatalogStore ? (
            <div id="admin-planogram-print-root" className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 print:hidden">{translate('planogram')}</h3>
              <OrderPlanogramView
                quantitySource="invoice"
                order={
                  {
                    id: order.id,
                    backendOrderId: (order as any).backendOrderId,
                    salespersonId: (order as any).salespersonId ?? '',
                    storeId: (order as any).storeId ?? '',
                    createdAt: order.date ? new Date(order.date) : new Date(),
                    po: undefined,
                    status: showInvoicedTabs ? 'completed' : 'pending',
                    storeName: order.storeName,
                    planogramId: (order as any).planogramId,
                    invoiceId: order.invoiceId,
                    subtotal: displaySubtotal,
                    total: displayTotal,
                    items: (order.items || []).map((it: any) => ({
                      id: it.id ?? '',
                      orderId: order.id,
                      productId: it.productId ?? it.sku ?? '',
                      quantity: it.quantity ?? it.toOrder ?? 0,
                      productName: it.productName,
                      unitPrice: Number(it.price) || 0,
                      subtotal: (it.quantity ?? it.toOrder ?? 0) * (Number(it.price) || 0),
                      status: 'pending',
                    })),
                    updatedAt: new Date(),
                  } as Order
                }
              />
            </div>
          ) : hasInvoiceLines && catalogInvoicedItems?.length ? (
            <div id="admin-planogram-print-root" className="space-y-2">
              <OrderCatalogGridView
                useAllActiveProducts
                order={
                  {
                    id: order.id,
                    items: catalogInvoicedItems.map((it: any) => ({
                      id: it.id ?? '',
                      orderId: order.id,
                      productId: it.productId ?? it.sku ?? '',
                      quantity: it.quantity ?? it.toOrder ?? 0,
                      productName: it.productName,
                      price: Number(it.price) || 0,
                      sku: it.sku,
                    })),
                  } as any
                }
              />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="pod-only" className="p-6 mt-0">
          <Card>
            <CardHeader className="border-b border-gray-100 bg-gray-50/90 py-4">
              <CardTitle className="text-base">{translate('podTitle')}</CardTitle>
              <CardDescription>
                {displayPod
                  ? translate('receiptRegistered')
                  : canShowEmergencyPodUpload
                    ? translate('productImageHint')
                    : !invoiceIdForPod
                      ? translate('podEmergencyInvoiceMissing')
                      : translate('noPODRegistered')}
              </CardDescription>
            </CardHeader>
            <CardContent
              className="pt-6 space-y-6"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {displayPod ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <p className="text-sm text-green-900">{translate('receiptRegistered')}</p>
                  </div>
                  {isPodPath ? (
                    <p className="text-xs text-gray-500 font-mono break-all">{displayPod}</p>
                  ) : null}
                  {podImageUrl ? (
                    <div className="relative w-full max-w-2xl rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden min-h-[240px] flex items-center justify-center p-3">
                      {podImageError ? (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                          <p className="text-sm text-amber-800 mb-1">{translate('imageLoadError')}</p>
                          <p className="text-xs text-gray-500 mb-2">{translate('pathLabel')}: {displayPod}</p>
                          <a
                            href={podImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-600 hover:text-indigo-800 underline break-all"
                          >
                            {translate('openLink')}
                          </a>
                        </div>
                      ) : (
                        <img
                          key={podImageUrl}
                          src={podImageUrl}
                          alt={translate('podTitle')}
                          className="w-full max-w-full max-h-[480px] object-contain"
                          style={{ minHeight: '240px' }}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          onLoad={() => setPodImageError(false)}
                          onError={() => setPodImageError(true)}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              ) : canShowEmergencyPodUpload ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-gray-900">{translate('podEmergencySelectImage')}</Label>
                    <input
                      ref={emergencyPodInputRef}
                      type="file"
                      accept="image/*,.heic,.heif"
                      className="hidden"
                      onChange={handleEmergencyPodFileChange}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="shrink-0 w-full sm:w-40 aspect-square max-w-[11rem] mx-auto sm:mx-0 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden">
                        {emergencyPodPreview ? (
                          <div className="relative size-full min-h-[10rem]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={emergencyPodPreview}
                              alt=""
                              className="absolute inset-0 size-full object-cover"
                            />
                            {emergencyPodUploading ? (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="text-white text-sm font-medium">{translate('uploading')}</span>
                              </div>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="absolute top-1.5 right-1.5 h-8 w-8 rounded-full bg-white shadow border-gray-300 hover:bg-gray-100"
                              onClick={clearEmergencyPodSelection}
                              disabled={emergencyPodUploading}
                              title={translate('cancel')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-4 h-full min-h-[10rem] text-gray-400">
                            <ImagePlus className="h-10 w-10 mb-2 opacity-60" />
                            <span className="text-xs">{translate('noImageSelected')}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 flex-1 min-w-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          onClick={() => emergencyPodInputRef.current?.click()}
                          disabled={emergencyPodUploading}
                        >
                          <ImagePlus className="h-4 w-4 mr-2" />
                          {emergencyPodFile ? translate('changeImage') : translate('selectImage')}
                        </Button>
                        <p className="text-xs text-gray-500">{translate('productImageHint')}</p>
                        {emergencyPodFile && !emergencyPodUploading ? (
                          <p className="text-xs text-green-700 font-medium truncate" title={emergencyPodFile.name}>
                            {emergencyPodFile.name}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          className="w-fit bg-indigo-600 hover:bg-indigo-700"
                          disabled={!emergencyPodFile || emergencyPodUploading}
                          onClick={() => void handleEmergencyPodSubmit()}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {emergencyPodUploading ? translate('uploading') : translate('podEmergencySubmit')}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                    <AlertDescription className="text-amber-950 ml-2 space-y-1.5 [&_p]:text-sm">
                      <p className="font-semibold text-amber-950">{translate('podEmergencyUploadTitle')}</p>
                      <p className="text-amber-900/95">{translate('podAdminWarning')}</p>
                      <p className="text-amber-900/90 text-xs">{translate('podEmergencyUploadDesc')}</p>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : !invoiceIdForPod ? (
                <p className="text-sm text-gray-600">{translate('podEmergencyInvoiceMissing')}</p>
              ) : (
                <p className="text-sm text-gray-600">{translate('noPODRegistered')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </>
        ) : null}
      </Tabs>
    </div>
  );
}
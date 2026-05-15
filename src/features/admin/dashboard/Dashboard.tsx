'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Store as StoreIcon,
  Users,
  Package,
  BarChart3,
  Layout,
  Calendar,
  MapPin,
  Workflow,
  ShoppingCart,
  Receipt,
  Route,
  ClipboardList,
} from 'lucide-react';
import { Card } from '@/shared/components/base/Card';
import { Button } from '@/shared/components/base/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/shared/components/base/Dialog';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { CalendarView } from './components/CalendarView';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { DashboardStats } from '@/shared/types';
import {
  fetchDashboardVolumeCounts,
  volumeCountsToStatsPartial,
  fetchSalesRoutesSnapshot,
  enrichPendingOrdersForDashboard,
} from '@/shared/services/dashboard-metrics-api';
import { ordersApi, type OrderForUI } from '@/shared/services/orders-api';
import { useRouter } from 'next/navigation';

interface DashboardModule {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  onClick: () => void;
}

interface DashboardProps {
  onNavigateToUsers?: () => void;
  onNavigateToStores?: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToPlanograms?: () => void;
  onNavigateToCities?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToUnifiedFlow?: () => void;
  isVisible?: boolean;
}

const emptyStats: DashboardStats = {
  ordersToday: 0,
  invoicesToday: 0,
  ordersYesterday: 0,
  invoicesYesterday: 0,
  ordersThisMonth: 0,
  invoicesThisMonth: 0,
  salesRoutesTotal: 0,
  salesRoutesActive: 0,
};

function pctVsPrevious(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function VariationHint({
  current,
  previous,
  suffix,
}: {
  current: number;
  previous: number;
  suffix: string;
}) {
  const pct = pctVsPrevious(current, previous);
  if (pct === null) {
    if (current <= 0) return null;
    return <p className="text-xs font-medium text-emerald-600 mt-1.5">+{current} · {suffix}</p>;
  }
  const up = pct >= 0;
  return (
    <p className={`text-xs font-medium tabular-nums mt-1.5 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% · {suffix}
    </p>
  );
}

function KpiCard({
  label,
  value,
  footer,
  icon: Icon,
  iconBg,
  iconClass,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconClass: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2 flex-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 leading-snug">{label}</p>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">{value}</div>
          {footer}
        </div>
        <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconClass}`} />
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <Card className="shadow-sm border-gray-200 hover:border-indigo-300 transition-colors min-w-0 h-full">
        <button
          type="button"
          onClick={onClick}
          className="w-full text-left p-3 sm:p-4 h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        >
          {inner}
        </button>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-gray-200 hover:border-gray-300 transition-colors min-w-0 h-full">
      <div className="p-3 sm:p-4 h-full flex flex-col">{inner}</div>
    </Card>
  );
}

function formatOrderNumber(o: OrderForUI): string {
  const po = o.po?.trim();
  if (po) return po;
  return String(o.backendOrderId ?? o.id);
}

function formatRouteLabel(o: OrderForUI): string {
  const n = o.salesRouteName?.trim();
  if (n) return n;
  if (o.salesRouteId) return `#${o.salesRouteId}`;
  return '—';
}

function formatSellerPerson(o: OrderForUI): string {
  const n = o.salespersonName?.trim();
  if (n) return n;
  if (o.salespersonId) return `#${o.salespersonId}`;
  return '—';
}

/** Código de ruta (catálogo) + nombre del vendedor, como en `OrderDetailView`. */
function sellerRouteAndName(o: OrderForUI, routeCodeById: Record<string, string>): { routeCode: string; person: string } {
  const rid = String(o.salesRouteId ?? '').trim();
  const routeCode = rid ? String(routeCodeById[rid] ?? '').trim() : '';
  const person = formatSellerPerson(o);
  return { routeCode, person };
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToUsers,
  onNavigateToStores,
  onNavigateToProducts,
  onNavigateToPlanograms,
  onNavigateToCities,
  onNavigateToReports,
  onNavigateToUnifiedFlow,
  isVisible = true,
}) => {
  const router = useRouter();
  const { translate, language } = useLanguage();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [pendingToInvoice, setPendingToInvoice] = useState<OrderForUI[]>([]);
  const [routeCodeById, setRouteCodeById] = useState<Record<string, string>>({});
  const [pendingBlockLoading, setPendingBlockLoading] = useState(true);
  const [showPendingDialog, setShowPendingDialog] = useState(false);

  const locale = language === 'es' ? 'es-ES' : 'en-US';
  const fmt = (n: number) => n.toLocaleString(locale);

  const mergeVolumePreservingRoutes = useCallback((volumePartial: ReturnType<typeof volumeCountsToStatsPartial>) => {
    setStats((s) => ({
      ...emptyStats,
      ...volumePartial,
      salesRoutesTotal: s.salesRoutesTotal,
      salesRoutesActive: s.salesRoutesActive,
    }));
  }, []);

  const refreshVolumeOnly = useCallback(async () => {
    try {
      const volume = await fetchDashboardVolumeCounts(new Date());
      mergeVolumePreservingRoutes(volumeCountsToStatsPartial(volume));
    } catch (e) {
      console.error('Error refrescando volumen del dashboard:', e);
    }
  }, [mergeVolumePreservingRoutes]);

  const loadDashboardData = useCallback(async () => {
    try {
      const volume = await fetchDashboardVolumeCounts(new Date());
      const volumePartial = volumeCountsToStatsPartial(volume);
      mergeVolumePreservingRoutes(volumePartial);
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
      setStats(emptyStats);
    } finally {
      setIsLoading(false);
    }

    setPendingBlockLoading(true);
    void (async () => {
      try {
        const [routesSnap, pendingRaw] = await Promise.all([
          fetchSalesRoutesSnapshot(),
          ordersApi.getOrdersPendingInvoicing(),
        ]);
        const { routeNameById, routeCodeById: codesByRoute } = routesSnap;
        setRouteCodeById(codesByRoute);
        const pending = await enrichPendingOrdersForDashboard(pendingRaw, routeNameById);
        setStats((s) => ({
          ...s,
          salesRoutesTotal: routesSnap.salesRoutesTotal,
          salesRoutesActive: routesSnap.salesRoutesActive,
        }));
        setPendingToInvoice(pending);
      } catch (e) {
        console.error('Error rutas / pedidos pendientes:', e);
        setPendingToInvoice([]);
      } finally {
        setPendingBlockLoading(false);
      }
    })();
  }, [mergeVolumePreservingRoutes]);

  useEffect(() => {
    if (isVisible) {
      setIsLoading(true);
      void loadDashboardData();
    }
  }, [isVisible, loadDashboardData]);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      void refreshVolumeOnly();
    }, 60000);
    return () => clearInterval(interval);
  }, [isVisible, refreshVolumeOnly]);

  const modules: DashboardModule[] = [
    {
      id: 'cities',
      titleKey: 'cityManagement',
      descKey: 'moduleCitiesDesc',
      icon: MapPin,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100',
      onClick: () => {
        if (onNavigateToCities) onNavigateToCities();
        else router.push('/cities');
      },
    },
    {
      id: 'stores',
      titleKey: 'storeManagement',
      descKey: 'moduleStoresDesc',
      icon: StoreIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      onClick: () => {
        if (onNavigateToStores) onNavigateToStores();
        else router.push('/stores');
      },
    },
    {
      id: 'users',
      titleKey: 'userManagement',
      descKey: 'moduleUsersDesc',
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      onClick: () => {
        if (onNavigateToUsers) onNavigateToUsers();
        else router.push('/users');
      },
    },
    {
      id: 'products',
      titleKey: 'productManagement',
      descKey: 'moduleProductsDesc',
      icon: Package,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100',
      onClick: () => {
        if (onNavigateToProducts) onNavigateToProducts();
        else router.push('/products');
      },
    },
    {
      id: 'planograms',
      titleKey: 'planogramManagement',
      descKey: 'modulePlanogramsDesc',
      icon: Layout,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 hover:bg-cyan-100',
      onClick: () => {
        if (onNavigateToPlanograms) onNavigateToPlanograms();
        else router.push('/planograms');
      },
    },
    {
      id: 'sales-flow',
      titleKey: 'orderManagement',
      descKey: 'moduleOrdersDesc',
      icon: Workflow,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      onClick: () => {
        if (onNavigateToUnifiedFlow) onNavigateToUnifiedFlow();
        else router.push('/unified-flow');
      },
    },
    {
      id: 'reports',
      titleKey: 'navReports',
      descKey: 'moduleReportsDesc',
      icon: BarChart3,
      color: 'text-red-600',
      bgColor: 'bg-red-50 hover:bg-red-100',
      onClick: () => {
        if (onNavigateToReports) onNavigateToReports();
        else router.push('/reports');
      },
    },
  ];

  const pendingCount = pendingToInvoice.length;
  const pendingValueNode = pendingBlockLoading ? (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" />
  ) : (
    fmt(pendingCount)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {translate('welcomeUser').replace('{name}', user?.firstName || '')}
            </h1>
            {user?.role === 'admin' ? (
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                {translate('roleAdminBadge')}
              </span>
            ) : null}
          </div>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            {translate('dashboardSubtitle')} —{' '}
            {new Date().toLocaleDateString(locale, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCalendar(true)} className="shrink-0">
          <Calendar className="h-4 w-4 mr-2" />
          {translate('viewCalendar')}
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">{translate('dashboardSectionVolume')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <KpiCard
            label={translate('kpiOrdersToday')}
            value={fmt(stats.ordersToday)}
            icon={ShoppingCart}
            iconBg="bg-blue-50"
            iconClass="text-blue-600"
            footer={
              <VariationHint
                current={stats.ordersToday}
                previous={stats.ordersYesterday}
                suffix={translate('kpiVsYesterdayOrders')}
              />
            }
          />
          <KpiCard
            label={translate('kpiInvoicesToday')}
            value={fmt(stats.invoicesToday)}
            icon={Receipt}
            iconBg="bg-emerald-50"
            iconClass="text-emerald-600"
            footer={
              <VariationHint
                current={stats.invoicesToday}
                previous={stats.invoicesYesterday}
                suffix={translate('kpiVsYesterdayInvoices')}
              />
            }
          />
          <KpiCard
            label={translate('kpiOrdersMonth')}
            value={fmt(stats.ordersThisMonth)}
            icon={ShoppingCart}
            iconBg="bg-indigo-50"
            iconClass="text-indigo-600"
          />
          <KpiCard
            label={translate('kpiInvoicesMonth')}
            value={fmt(stats.invoicesThisMonth)}
            icon={Receipt}
            iconBg="bg-teal-50"
            iconClass="text-teal-600"
          />
          <KpiCard
            label={translate('kpiPendingToInvoice')}
            value={pendingValueNode}
            icon={ClipboardList}
            iconBg="bg-orange-50"
            iconClass="text-orange-700"
            footer={
              <p className="text-xs text-gray-400 mt-1.5 leading-snug">{translate('kpiPendingToInvoiceHint')}</p>
            }
            onClick={() => {
              if (!pendingBlockLoading) setShowPendingDialog(true);
            }}
          />
          <KpiCard
            label={translate('dashCatalogRoutes')}
            value={`${fmt(stats.salesRoutesActive)} / ${fmt(stats.salesRoutesTotal)}`}
            icon={Route}
            iconBg="bg-purple-50"
            iconClass="text-purple-600"
          />
        </div>
      </section>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">{translate('managementModules')}</h2>
          <p className="text-xs sm:text-sm text-gray-500">{translate('managementModulesDesc')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.id}
                className="hover:shadow-md hover:border-blue-200 cursor-pointer group transition-all duration-200 shadow-sm"
                onClick={module.onClick}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-lg ${module.bgColor} transition-all duration-200 group-hover:scale-105 flex-shrink-0`}
                    >
                      <Icon className={`h-5 w-5 ${module.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                        {translate(module.titleKey)}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {translate(module.descKey)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent
          className="flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl"
          showClose={true}
          closeAriaLabel={translate('close')}
        >
          <div className="shrink-0 border-b border-gray-100 bg-gradient-to-r from-indigo-50/90 via-white to-white px-6 pb-4 pt-5">
            <DialogHeader className="space-y-2 p-0 text-left">
              <DialogTitle className="text-lg font-semibold tracking-tight text-gray-900">
                {translate('dashboardPendingInvoiceTitle')}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-gray-600">
                {translate('dashboardPendingInvoiceDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 px-4 py-3 sm:px-5 sm:py-4">
            {pendingToInvoice.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
                <p className="text-sm text-gray-500">{translate('dashboardPendingEmpty')}</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/95 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      <th className="px-4 py-3 sm:px-5">{translate('dashboardPendingColOrder')}</th>
                      <th className="px-4 py-3 sm:px-5">{translate('dashboardPendingColRoute')}</th>
                      <th className="px-4 py-3 sm:px-5">{translate('dashboardPendingColSeller')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingToInvoice.map((o) => {
                      const { routeCode, person } = sellerRouteAndName(o, routeCodeById);
                      return (
                        <tr key={o.id} className="transition-colors hover:bg-indigo-50/40">
                          <td className="px-4 py-3 align-middle sm:px-5">
                            <button
                              type="button"
                              className="font-mono text-sm font-semibold text-indigo-600 underline-offset-2 hover:text-indigo-800 hover:underline"
                              onClick={() => {
                                setShowPendingDialog(false);
                                router.push(`/orders?open=${encodeURIComponent(o.id)}`);
                              }}
                            >
                              {formatOrderNumber(o)}
                            </button>
                          </td>
                          <td className="px-4 py-3 align-middle text-gray-800 sm:px-5">{formatRouteLabel(o)}</td>
                          <td className="px-4 py-3 align-middle text-gray-900 sm:px-5">
                            {routeCode ? (
                              <span className="inline-flex flex-wrap items-baseline gap-x-1">
                                <span className="font-semibold tracking-wide text-indigo-700">{routeCode}</span>
                                {person && person !== '—' ? (
                                  <span className="font-normal text-gray-800">({person})</span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-gray-800">{person}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="min-w-[88px]">
                {translate('close')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="max-w-md" showClose={true} closeAriaLabel={translate('close')}>
          <DialogHeader>
            <DialogTitle>{translate('calendarTitle')}</DialogTitle>
          </DialogHeader>
          <CalendarView />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                {translate('close')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

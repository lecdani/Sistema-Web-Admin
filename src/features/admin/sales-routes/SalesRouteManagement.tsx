'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Waypoints,
  Plus,
  Search,
  ArrowLeft,
  Trash2,
  Power,
  PowerOff,
  Store as StoreIcon,
  Filter,
  MapPin,
  Building2,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/shared/components/base/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/base/Select';
import { Badge } from '@/shared/components/base/Badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/base/AlertDialog';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { toast } from '@/shared/components/base/Toast';
import { salesRoutesApi } from '@/shared/services/sales-routes-api';
import { usersApi } from '@/shared/services/users-api';
import { citiesApi } from '@/shared/services/cities-api';
import { storesApi } from '@/shared/services/stores-api';
import { assignmentsApi } from '@/shared/services/assignments-api';
import type { Assignment, City, SalesRoute, Store, User } from '@/shared/types';
import { assignmentsForRoute, storeAssignedToOtherRoute } from '@/shared/utils/assignment-match';

interface SalesRouteManagementProps {
  onBack?: () => void;
}

export function SalesRouteManagement({ onBack }: SalesRouteManagementProps) {
  const router = useRouter();
  const { translate } = useLanguage();

  const [routes, setRoutes] = useState<SalesRoute[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<SalesRoute[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [loading, setLoading] = useState(true);

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCityId, setFormCityId] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const [showStoresDialog, setShowStoresDialog] = useState(false);
  const [storesRoute, setStoresRoute] = useState<SalesRoute | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [selectedStoreToAdd, setSelectedStoreToAdd] = useState('');

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    let list = routes;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((r) => {
        const city = cities.find((c) => String(c.id) === String(r.cityId));
        const cityName = (city?.name || '').toLowerCase();
        const codeQ = (r.code || '').toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          cityName.includes(q) ||
          codeQ.includes(q)
        );
      });
    }
    if (statusFilter !== 'all') {
      list = list.filter((r) => (statusFilter === 'active' ? r.isActive : !r.isActive));
    }
    if (cityFilter !== 'all') {
      list = list.filter((r) => String(r.cityId) === String(cityFilter));
    }
    setFilteredRoutes(list);
    setCurrentPage(1);
  }, [routes, cities, searchTerm, statusFilter, cityFilter]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [rList, cList, uList] = await Promise.all([
        salesRoutesApi.fetchAll(),
        citiesApi.fetchAll(),
        usersApi.fetchAll(),
      ]);
      setRoutes(rList);
      setCities(cList);
      setAllUsers(uList);
    } catch (e) {
      console.error(e);
      toast.error(translate('errorLoadSalesRoutes'));
      setRoutes([]);
      setCities([]);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const routeIdNorm = (id: string | undefined) => String(id ?? '').trim().toLowerCase();

  const sellersAssignedToRoute = (routeId: string) => {
    const rid = routeIdNorm(routeId);
    if (!rid) return [];
    return allUsers.filter(
      (u) => u.role === 'user' && routeIdNorm(u.salesRouteId) === rid
    );
  };

  const formatAssignedSellersCell = (routeId: string) => {
    const sellers = sellersAssignedToRoute(routeId);
    if (sellers.length === 0) return '—';
    const names = sellers.map((s) => `${s.firstName} ${s.lastName}`.trim()).filter(Boolean);
    const shown = names.slice(0, 3).join(', ');
    const extra = names.length > 3 ? ` +${names.length - 3}` : '';
    return `${shown}${extra}`;
  };

  const cityLabel = (cityId: string) => {
    const c = cities.find((x) => String(x.id) === String(cityId));
    return c?.name || cityId || '—';
  };

  const getStatusBadgeColor = (isActive: boolean) =>
    isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

  const openCreate = () => {
    setFormName('');
    setFormCityId('');
    setShowFormDialog(true);
  };

  const handleSaveForm = async () => {
    const name = formName.trim();
    if (!name) {
      toast.error(translate('salesRouteNameRequired'));
      return;
    }
    const cityIdCreate = String(formCityId || '').trim();
    if (!cityIdCreate) {
      toast.error(translate('salesRouteCityRequired'));
      return;
    }
    setFormSaving(true);
    try {
      await salesRoutesApi.create({ name, cityId: cityIdCreate });
      toast.success(translate('salesRouteCreated'));
      setShowFormDialog(false);
      await loadInitial();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.data?.message ?? e?.message ?? translate('errorSaveSalesRoute'));
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggle = async (r: SalesRoute) => {
    try {
      await salesRoutesApi.toggleStatus(r.id);
      toast.success(translate('salesRouteSaved'));
      await loadInitial();
    } catch (e: any) {
      console.error(e);
      toast.error(translate('errorToggleSalesRoute'));
    }
  };

  const handleDelete = async (r: SalesRoute) => {
    try {
      await salesRoutesApi.remove(r.id);
      toast.success(translate('salesRouteDeleted'));
      await loadInitial();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.data?.message ?? translate('errorDeleteSalesRoute'));
    }
  };

  const loadStoresContext = async () => {
    setStoresLoading(true);
    try {
      const [storesData, allAssignments] = await Promise.all([
        storesApi.fetchAll(),
        assignmentsApi.fetchAll(),
      ]);
      setStores(storesData.filter((s) => s.isActive));
      setAssignments(allAssignments);
    } catch (e) {
      console.error(e);
      toast.error(translate('errorLoadAssignments'));
      setStores([]);
      setAssignments([]);
    } finally {
      setStoresLoading(false);
    }
  };

  const openStoresDialog = async (r: SalesRoute) => {
    setStoresRoute(r);
    setSelectedStoreToAdd('');
    setShowStoresDialog(true);
    await loadStoresContext();
  };

  const routeAssignments = storesRoute ? assignmentsForRoute(assignments, storesRoute.id) : [];

  const handleAddStore = async () => {
    if (!storesRoute) return;
    const storeId = String(selectedStoreToAdd || '').trim();
    if (!storeId) return;
    if (storeAssignedToOtherRoute(assignments, storeId, storesRoute.id)) {
      toast.error(translate('storeAlreadyAssigned'));
      return;
    }
    try {
      setStoresLoading(true);
      await assignmentsApi.create({ storeId, salesRouteId: storesRoute.id });
      toast.success(translate('routeSaved'));
      await loadStoresContext();
      setSelectedStoreToAdd('');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.data?.message ?? translate('errorSaveAssignment'));
    } finally {
      setStoresLoading(false);
    }
  };

  const handleRemoveAssignment = async (a: Assignment) => {
    if (!storesRoute) return;
    try {
      setStoresLoading(true);
      const ok = await assignmentsApi.remove({
        id: a.id,
        userId: a.userId,
        storeId: a.storeId,
        salesRouteId: a.salesRouteId ?? storesRoute.id,
      });
      if (!ok) throw new Error('remove failed');
      toast.success(translate('routeSaved'));
      await loadStoresContext();
    } catch (e) {
      console.error(e);
      toast.error(translate('errorRemoveAssignment'));
    } finally {
      setStoresLoading(false);
    }
  };

  const handleBack = () => {
    if (onBack) onBack();
    else router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(filteredRoutes.length / itemsPerPage));
  const pagedRoutes = filteredRoutes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-indigo-100 rounded-lg">
            <Waypoints className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('routesTitle')}</h1>
            <p className="text-gray-500">{translate('routesSubtitleAll')}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 w-full lg:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {translate('addRoute')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalRoutes')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{routes.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-50">
                <Waypoints className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('statActiveRoutes')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {routes.filter((r) => r.isActive).length}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-50">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('statCities')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{cities.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-10"
                  placeholder={translate('searchRoutesPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={translate('filterByStatus')}>
                    {statusFilter === 'all' && translate('allStatuses')}
                    {statusFilter === 'active' && translate('activeStores')}
                    {statusFilter === 'inactive' && translate('inactiveStores')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allStatuses')}</SelectItem>
                  <SelectItem value="active">{translate('activeStores')}</SelectItem>
                  <SelectItem value="inactive">{translate('inactiveStores')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={translate('filterByCity')}>
                    {cityFilter === 'all'
                      ? translate('allCities')
                      : cities.find((c) => String(c.id) === String(cityFilter))?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allCities')}</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={String(city.id)}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{translate('routesList')}</CardTitle>
          <CardDescription>{translate('routesListDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('salesRouteCodeHeader')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('salesRouteNameLabel')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('city')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('salesRouteAssignedSellers')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('status')}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagedRoutes.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <Waypoints className="h-5 w-5 text-indigo-600" />
                        </div>
                        <span
                          className="inline-block font-mono text-sm font-semibold text-indigo-900 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md max-w-[10rem] truncate align-middle"
                          title={r.code?.trim() ? r.code.trim() : translate('salesRouteNoCode')}
                        >
                          {r.code?.trim() ? r.code.trim() : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900 truncate min-w-0" title={r.name}>
                        {r.name}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cityLabel(r.cityId)}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-700 max-w-[16rem]"
                      title={formatAssignedSellersCell(r.id)}
                    >
                      <span className="line-clamp-2">{formatAssignedSellersCell(r.id)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusBadgeColor(r.isActive)}>
                        {r.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => void openStoresDialog(r)} title={translate('manageRouteStores')}>
                          <StoreIcon className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleToggle(r)} title={translate('status')}>
                          {r.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" title={translate('delete')}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{translate('confirmDeleteSalesRoute')}</AlertDialogTitle>
                              <AlertDialogDescription>{translate('confirmDeleteSalesRouteDesc')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => void handleDelete(r)}
                              >
                                {translate('delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRoutes.length === 0 && (
            <div className="text-center py-12 text-gray-600 px-4">{translate('noRoutesSearch')}</div>
          )}

          {filteredRoutes.length > itemsPerPage && (
            <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                {translate('previous')}
              </Button>
              <span className="text-sm text-gray-600">
                {translate('page')} {currentPage} {translate('pageOf')} {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
              >
                {translate('next')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) {
            setFormName('');
            setFormCityId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{translate('createSalesRouteTitle')}</DialogTitle>
            <DialogDescription>{translate('salesRouteFormDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <div className="space-y-2">
              <Label>{translate('salesRouteNameLabel')}</Label>
              <Input
                className="h-10"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{translate('salesRouteCityLabel')} *</Label>
              <Select value={formCityId || undefined} onValueChange={setFormCityId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={translate('selectCity')}>
                    {(() => {
                      const c = cities.find((x) => String(x.id) === String(formCityId));
                      return c
                        ? `${c.name}${c.country ? ` - ${c.country}` : ''}`
                        : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={String(c.id)} value={String(c.id)}>
                      {c.name}
                      {c.country ? ` - ${c.country}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">
                <X className="h-4 w-4 mr-2" />
                {translate('cancel')}
              </Button>
            </DialogClose>
            <Button onClick={() => void handleSaveForm()} disabled={formSaving} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4 mr-2" />
              {translate('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showStoresDialog}
        onOpenChange={(open) => {
          setShowStoresDialog(open);
          if (!open) {
            setStoresRoute(null);
            setSelectedStoreToAdd('');
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{translate('manageRouteStoresTitle')}</DialogTitle>
            <DialogDescription>
              {storesRoute ? `${storesRoute.name} — ${cityLabel(storesRoute.cityId)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-sm font-semibold mb-2">{translate('addStoreToRoute')}</p>
              <div className="flex gap-2 flex-col sm:flex-row">
                <Select value={selectedStoreToAdd || undefined} onValueChange={setSelectedStoreToAdd}>
                  <SelectTrigger className="flex-1 bg-white">
                    <SelectValue placeholder={translate('selectStore')}>
                      {(() => {
                        const s = stores.find((x) => String(x.id) === String(selectedStoreToAdd));
                        return s?.name ?? undefined;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {storesRoute &&
                      stores
                        .filter((s) => {
                          const mine = new Set(routeAssignments.map((a) => String(a.storeId)));
                          const sameCity =
                            !storesRoute.cityId || String(s.cityId) === String(storesRoute.cityId);
                          return (
                            sameCity &&
                            !mine.has(String(s.id)) &&
                            !storeAssignedToOtherRoute(assignments, String(s.id), storesRoute.id)
                          );
                        })
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((s) => (
                          <SelectItem key={String(s.id)} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => void handleAddStore()}
                  disabled={!storesRoute || !selectedStoreToAdd || storesLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {translate('add')}
                </Button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{translate('assignedStores')}</p>
                {storesLoading && <span className="text-xs text-gray-500">{translate('loading')}…</span>}
              </div>
              <div className="divide-y max-h-[320px] overflow-y-auto bg-white">
                {storesRoute && routeAssignments.length === 0 && (
                  <div className="px-4 py-6 text-sm text-gray-500">{translate('noAssignedStores')}</div>
                )}
                {routeAssignments
                  .map((a) => ({
                    a,
                    store: stores.find((s) => String(s.id) === String(a.storeId)),
                  }))
                  .sort((x, y) => (x.store?.name || '').localeCompare(y.store?.name || ''))
                  .map(({ a, store }) => (
                    <div key={a.id} className="px-4 py-3 flex justify-between gap-2 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{store?.name ?? a.storeId}</p>
                        {store?.address && <p className="text-xs text-gray-500 truncate">{store.address}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        disabled={storesLoading}
                        onClick={() => void handleRemoveAssignment(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{translate('close')}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

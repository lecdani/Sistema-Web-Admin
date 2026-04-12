import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store as StoreIcon,
  Plus,
  Search,
  Edit3,
  Power,
  PowerOff,
  Filter,
  Eye,
  MapPin,
  Save,
  X,
  ArrowLeft,
  Building2,
  LayoutGrid,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Badge } from '@/shared/components/base/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/shared/components/base/Dialog';
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
import { Label } from '@/shared/components/base/Label';
import { SearchableSelect } from '@/shared/components/base/Select';
import { Textarea } from '@/shared/components/base/Textarea';
import { Store, City, Area, Region, District } from '@/shared/types';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { storesApi } from '@/shared/services/stores-api';
import { citiesApi } from '@/shared/services/cities-api';
import { areasApi } from '@/shared/services/areas-api';
import { regionsApi } from '@/shared/services/regions-api';
import { districtsApi } from '@/shared/services/districts-api';
import { toast } from '@/shared/components/base/Toast';

interface StoreManagementProps {
  onBack?: () => void;
}

interface StoreFormData {
  storeNumber: string;
  zoneNumber: string;
  zipCode: string;
  name: string;
  street: string;
  cityId: string;
  areaId: string;
  regionId: string;
  districtId: string;
  hasPlanogram: boolean;
}

export const StoreManagement: React.FC<StoreManagementProps> = ({ onBack }) => {
  const router = useRouter();
  const { translate } = useLanguage();
  const [stores, setStores] = useState<Store[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [planogramFilter, setPlanogramFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const [formData, setFormData] = useState<StoreFormData>({
    storeNumber: '',
    zoneNumber: '',
    zipCode: '',
    name: '',
    street: '',
    cityId: '',
    areaId: '',
    regionId: '',
    districtId: '',
    hasPlanogram: true,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof StoreFormData, string>>>({});

  useEffect(() => {
    loadStores();
    void loadGeoCatalogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [stores, searchTerm, statusFilter, cityFilter, planogramFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, cityFilter, planogramFilter]);

  const loadStores = async () => {
    try {
      setIsLoading(true);
      const data = await storesApi.fetchAll();
      setStores(data);
    } catch (error) {
      console.error('Error cargando tiendas:', error);
      toast.error(translate('errorLoadStores'));
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGeoCatalogs = async () => {
    try {
      const [citiesData, areasData, regionsData, districtsData] = await Promise.all([
        citiesApi.fetchAll(),
        areasApi.fetchAll(),
        regionsApi.fetchAll(),
        districtsApi.fetchAll(),
      ]);
      setCities(citiesData);
      setAreas(areasData);
      setRegions(regionsData);
      setDistricts(districtsData);
    } catch (error) {
      console.error('Error cargando catálogos geográficos:', error);
      toast.error(translate('errorLoadCitiesShort'));
    }
  };

  const applyFilters = () => {
    let filtered = stores;

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(store => {
        const city = cities.find(c => c.id === store.cityId);
        const cityName = city ? city.name : '';

        return (
          store.name.toLowerCase().includes(searchLower) ||
          String(store.street ?? store.address ?? '').toLowerCase().includes(searchLower) ||
          String(store.storeNumber ?? '').toLowerCase().includes(searchLower) ||
          cityName.toLowerCase().includes(searchLower)
        );
      });
    }

    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(store =>
        statusFilter === 'active' ? store.isActive : !store.isActive
      );
    }

    // Filtro por ciudad
    if (cityFilter !== 'all') {
      filtered = filtered.filter(store => store.cityId === cityFilter);
    }

    if (planogramFilter !== 'all') {
      filtered = filtered.filter((store) =>
        planogramFilter === 'yes' ? !!store.hasPlanogram : !store.hasPlanogram
      );
    }

    setFilteredStores(filtered);
  };

  const resetForm = () => {
    setFormData({
      storeNumber: '',
      zoneNumber: '',
      zipCode: '',
      name: '',
      street: '',
      cityId: '',
      areaId: '',
      regionId: '',
      districtId: '',
      hasPlanogram: true,
    });
    setFormErrors({});
    setEditingStore(null);
  };

  const validateStoreForm = (): boolean => {
    const err: Partial<Record<keyof StoreFormData, string>> = {};
    if (!formData.storeNumber.trim()) err.storeNumber = translate('nameRequired');
    if (!formData.zoneNumber.trim()) err.zoneNumber = translate('nameRequired');
    if (!formData.zipCode.trim()) err.zipCode = translate('nameRequired');
    if (!formData.street.trim()) err.street = translate('addressRequired');
    if (!formData.cityId.trim()) err.cityId = translate('cityRequired');
    if (!formData.areaId.trim()) err.areaId = translate('nameRequired');
    if (!formData.regionId.trim()) err.regionId = translate('nameRequired');
    if (!formData.districtId.trim()) err.districtId = translate('nameRequired');

    const resolvedName = (formData.name.trim() || formData.storeNumber.trim()).toLowerCase();
    if (resolvedName) {
      const duplicate = stores.find(
        (s) =>
          s.name.trim().toLowerCase() === resolvedName &&
          s.cityId === formData.cityId &&
          String(s.districtId ?? '') === String(formData.districtId) &&
          (!editingStore || s.id !== editingStore.id)
      );
      if (duplicate) err.name = translate('duplicateStore');
    }

    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSaveStore = async () => {
    if (!validateStoreForm()) return;

    const cityExists = cities.find(c => c.id === formData.cityId);
    const districtExists = districts.find((d) => String(d.id) === String(formData.districtId));
    if (!cityExists || !districtExists) {
      setFormErrors(prev => ({
        ...prev,
        cityId: !cityExists ? translate('invalidCity') : prev.cityId,
        districtId: !districtExists ? translate('nameRequired') : prev.districtId,
      }));
      return;
    }

    try {
      const num = formData.storeNumber.trim();
      const displayName = formData.name.trim() || num;
      const storeData: any = {
        name: displayName,
        storeNumber: num,
        zoneNumber: formData.zoneNumber.trim(),
        zipCode: formData.zipCode.trim(),
        street: formData.street.trim(),
        address: formData.street.trim(),
        cityId: formData.cityId,
        districtId: formData.districtId,
        hasPlanogram: !!formData.hasPlanogram,
      };

      if (editingStore) {
        await storesApi.update(editingStore.id, storeData);
        toast.success(translate('storeSaved'));
      } else {
        const created = await storesApi.create(storeData);
        toast.success(translate('storeCreated'));
        setSearchTerm(created.name);
        setCurrentPage(1);
      }

      loadStores();
      resetForm();
      setShowAddDialog(false);
    } catch (error) {
      console.error('Error guardando tienda:', error);
      toast.error(translate('errorSaveStore'));
    }
  };

  const handleEditStore = (store: Store) => {
    const districtId = String(store.districtId ?? '');
    const regionId = districtId
      ? String(districts.find((d) => String(d.id) === districtId)?.regionId ?? '')
      : '';
    const areaId = regionId
      ? String(regions.find((r) => String(r.id) === regionId)?.areaId ?? '')
      : '';
    setFormData({
      storeNumber: String(store.storeNumber ?? ''),
      zoneNumber: String(store.zoneNumber ?? ''),
      zipCode: String(store.zipCode ?? ''),
      name: store.name,
      street: String(store.street ?? store.address ?? ''),
      cityId: store.cityId,
      areaId,
      regionId,
      districtId,
      hasPlanogram: !!store.hasPlanogram,
    });
    setFormErrors({});
    setEditingStore(store);
    setShowAddDialog(true);
  };

  const handleToggleStatus = async (store: Store) => {
    try {
      // El endpoint de desactivar funciona como toggle (activar/desactivar)
      await storesApi.deactivate(store.id);

      await loadStores();
      toast.success(!store.isActive ? translate('storeActivatedSuccess') : translate('storeDeactivatedSuccess'));
    } catch (error) {
      console.error('Error cambiando estado de la tienda:', error);
      toast.error(translate('errorToggleStore'));
    }
  };

  const handleViewDetail = (store: Store) => {
    setSelectedStore(store);
    setShowDetailDialog(true);
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getCityName = (cityId: string) => {
    const city = cities.find(c => c.id === cityId);
    return city ? city.name : translate('notSpecified');
  };

  const getTerritoryChain = (districtId?: string) => {
    const d = districts.find((x) => String(x.id) === String(districtId ?? ''));
    if (!d) {
      return { area: translate('notSpecified'), region: translate('notSpecified'), district: translate('notSpecified') };
    }
    const r = regions.find((x) => String(x.id) === String(d.regionId ?? ''));
    const a = r ? areas.find((x) => String(x.id) === String(r.areaId ?? '')) : undefined;
    return {
      area: a?.name ?? translate('notSpecified'),
      region: r?.name ?? translate('notSpecified'),
      district: d.name,
    };
  };

  const regionsByArea = regions.filter((r) => String(r.areaId) === String(formData.areaId));
  const districtsByRegion = districts.filter((d) => String(d.regionId) === String(formData.regionId));

  const getUniqueCities = () => {
    return cities;
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-blue-100 rounded-lg">
            <StoreIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('storesTitle')}</h1>
            <p className="text-gray-500">{translate('storesSubtitleAll')}</p>
          </div>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => {
                resetForm();
                setShowAddDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {translate('addStore')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingStore ? translate('editStoreTitle') : translate('addNewStore')}
              </DialogTitle>
              <DialogDescription>
                {editingStore ? translate('editStoreDesc') : translate('newStoreDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-6 py-4">
              {getUniqueCities().length === 0 && !editingStore && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-yellow-600" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">{translate('noCitiesAvailable')}</h4>
                      <p className="text-xs text-yellow-700 mt-0.5">
                        {translate('needCityFirst')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="storeNumber">Store #</Label>
                <Input
                  id="storeNumber"
                  value={formData.storeNumber}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, storeNumber: e.target.value }));
                    if (formErrors.storeNumber) setFormErrors(prev => ({ ...prev, storeNumber: undefined }));
                  }}
                  className={`h-10 ${formErrors.storeNumber ? 'border-red-500' : ''}`}
                />
                {formErrors.storeNumber && <p className="text-sm text-red-600">{formErrors.storeNumber}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{translate('storeNameLabel')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, name: e.target.value }));
                    if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  placeholder={translate('storeNamePlaceholder')}
                  className={`h-10 ${formErrors.name ? 'border-red-500' : ''}`}
                />
                <p className="text-xs text-gray-500">{translate('storeNameOptionalHint')}</p>
                {formErrors.name && <p className="text-sm text-red-600">{formErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="street">{translate('addressLabel')}</Label>
                <Textarea
                  id="street"
                  value={formData.street}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, street: e.target.value }));
                    if (formErrors.street) setFormErrors(prev => ({ ...prev, street: undefined }));
                  }}
                  placeholder={translate('addressPlaceholder')}
                  rows={3}
                  className={`resize-none min-h-[80px] ${formErrors.street ? 'border-red-500' : ''}`}
                />
                {formErrors.street && <p className="text-sm text-red-600">{formErrors.street}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="zoneNumber">Zone #</Label>
                <Input
                  id="zoneNumber"
                  value={formData.zoneNumber}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, zoneNumber: e.target.value }));
                    if (formErrors.zoneNumber) setFormErrors(prev => ({ ...prev, zoneNumber: undefined }));
                  }}
                  className={`h-10 ${formErrors.zoneNumber ? 'border-red-500' : ''}`}
                />
                {formErrors.zoneNumber && <p className="text-sm text-red-600">{formErrors.zoneNumber}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, zipCode: e.target.value }));
                    if (formErrors.zipCode) setFormErrors(prev => ({ ...prev, zipCode: undefined }));
                  }}
                  className={`h-10 ${formErrors.zipCode ? 'border-red-500' : ''}`}
                />
                {formErrors.zipCode && <p className="text-sm text-red-600">{formErrors.zipCode}</p>}
              </div>

              <div className="space-y-2">
                <Label>{translate('city')} *</Label>
                <SearchableSelect
                  value={formData.cityId}
                  placeholder={translate('selectCity')}
                  disabled={getUniqueCities().length === 0}
                  options={getUniqueCities().map((city) => ({ value: city.id, label: city.name }))}
                  emptyMessage={translate('noCitiesAvailable')}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, cityId: value }));
                    if (formErrors.cityId) setFormErrors((prev) => ({ ...prev, cityId: undefined }));
                  }}
                  aria-invalid={!!formErrors.cityId}
                  inputClassName={`h-10 ${formErrors.cityId ? 'border-red-500' : ''}`}
                  zIndex={10000}
                  maxListHeight="min(24rem, 72vh)"
                />
                {formErrors.cityId && <p className="text-sm text-red-600">{formErrors.cityId}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Area *</Label>
                  <SearchableSelect
                    value={formData.areaId}
                    placeholder="Selecciona área"
                    disabled={!areas.length}
                    options={areas.map((a) => ({ value: String(a.id), label: a.name }))}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, areaId: value, regionId: '', districtId: '' }));
                      if (formErrors.areaId) setFormErrors((prev) => ({ ...prev, areaId: undefined }));
                    }}
                    aria-invalid={!!formErrors.areaId}
                    inputClassName={`h-10 ${formErrors.areaId ? 'border-red-500' : ''}`}
                    zIndex={10000}
                    maxListHeight="min(24rem, 72vh)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Region *</Label>
                  <SearchableSelect
                    value={formData.regionId}
                    placeholder="Selecciona región"
                    disabled={!regionsByArea.length}
                    options={regionsByArea.map((r) => ({ value: String(r.id), label: r.name }))}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, regionId: value, districtId: '' }));
                      if (formErrors.regionId) setFormErrors((prev) => ({ ...prev, regionId: undefined }));
                    }}
                    aria-invalid={!!formErrors.regionId}
                    inputClassName={`h-10 ${formErrors.regionId ? 'border-red-500' : ''}`}
                    zIndex={10000}
                    maxListHeight="min(24rem, 72vh)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>District *</Label>
                  <SearchableSelect
                    value={formData.districtId}
                    placeholder="Selecciona distrito"
                    disabled={!districtsByRegion.length}
                    options={districtsByRegion.map((d) => ({ value: String(d.id), label: d.name }))}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, districtId: value }));
                      if (formErrors.districtId) setFormErrors((prev) => ({ ...prev, districtId: undefined }));
                    }}
                    aria-invalid={!!formErrors.districtId}
                    inputClassName={`h-10 ${formErrors.districtId ? 'border-red-500' : ''}`}
                    zIndex={10000}
                    maxListHeight="min(24rem, 72vh)"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  id="hasPlanogram"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={formData.hasPlanogram}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, hasPlanogram: e.target.checked }))
                  }
                />
                <div>
                  <Label htmlFor="hasPlanogram" className="text-sm font-medium text-gray-700">
                    {translate('hasPlanogramLabel')}
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {translate('hasPlanogramHelp')}
                  </p>
                </div>
              </div>

            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  {translate('cancel')}
                </Button>
              </DialogClose>
              <Button onClick={handleSaveStore} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-2" />
                {editingStore ? translate('update') : translate('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalStores')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stores.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50">
                <StoreIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('statActiveStores')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stores.filter(s => s.isActive).length}
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
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {getUniqueCities().length}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <Input
                  placeholder={translate('searchStoresPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 w-full sm:w-48 min-w-0">
                <Filter className="h-4 w-4 shrink-0 text-gray-500" />
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={statusFilter}
                  placeholder={translate('filterByStatus')}
                  clearable
                  clearToValue="all"
                  options={[
                    { value: 'all', label: translate('allStatuses') },
                    { value: 'active', label: translate('activeStores') },
                    { value: 'inactive', label: translate('inactiveStores') },
                  ]}
                  onValueChange={setStatusFilter}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-48 min-w-0">
                <MapPin className="h-4 w-4 shrink-0 text-gray-500" />
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={cityFilter}
                  placeholder={translate('filterByCity')}
                  clearable
                  clearToValue="all"
                  options={[
                    { value: 'all', label: translate('allCities') },
                    ...getUniqueCities().map((city) => ({ value: city.id, label: city.name })),
                  ]}
                  onValueChange={setCityFilter}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-48 min-w-0">
                <LayoutGrid className="h-4 w-4 shrink-0 text-gray-500" />
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={planogramFilter}
                  placeholder={translate('filterByPlanogram')}
                  clearable
                  clearToValue="all"
                  options={[
                    { value: 'all', label: translate('storesPlanogramFilterAll') },
                    { value: 'yes', label: translate('storesPlanogramFilterYes') },
                    { value: 'no', label: translate('storesPlanogramFilterNo') },
                  ]}
                  onValueChange={setPlanogramFilter}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stores Table */}
      <Card>
        <CardHeader>
          <CardTitle>{translate('storesList')}</CardTitle>
          <CardDescription>
            {translate('storesSubtitleAll')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            const pageCount = Math.max(1, Math.ceil(filteredStores.length / itemsPerPage));
            const pagedStores = filteredStores.slice(
              (currentPage - 1) * itemsPerPage,
              currentPage * itemsPerPage
            );
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {translate('storeHeader')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {translate('city')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[9rem]">
                          {translate('address')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {translate('storesColPlanogram')}
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {translate('status')}
                        </th>
                        <th className="px-6 py-3.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {translate('actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pagedStores.map((store) => {
                        const addr = String(store.street ?? store.address ?? '').trim() || '—';
                        return (
                          <tr key={store.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 align-top">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <StoreIcon className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div className="min-w-0 pt-0.5">
                                  <p className="text-sm font-semibold text-gray-900 truncate" title={store.name}>
                                    {store.name}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 align-top text-sm text-gray-900">
                              <span className="line-clamp-2" title={getCityName(store.cityId)}>
                                {getCityName(store.cityId)}
                              </span>
                            </td>
                            <td className="px-6 py-4 align-top min-w-0 max-w-[14rem]">
                              <p className="text-sm text-gray-700 line-clamp-2" title={addr}>
                                {addr}
                              </p>
                            </td>
                            <td className="px-6 py-4 align-top whitespace-nowrap">
                              {store.hasPlanogram ? (
                                <Badge className="bg-indigo-50 text-indigo-800 border-0 font-medium">
                                  {translate('yesLabel')}
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-600 border-0 font-medium">
                                  {translate('noLabel')}
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 align-top whitespace-nowrap">
                              <Badge className={getStatusBadgeColor(store.isActive)}>
                                {store.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 align-top whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewDetail(store)}
                                  title={translate('storeDetails')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditStore(store)}
                                  title={translate('edit')}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={
                                        store.isActive
                                          ? 'text-red-600 hover:text-red-700'
                                          : 'text-green-600 hover:text-green-700'
                                      }
                                      title={store.isActive ? translate('deactivate') : translate('activate')}
                                    >
                                      {store.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {store.isActive
                                          ? translate('deactivateStoreTitle')
                                          : translate('activateStoreTitle')}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        <span className="block mb-2">
                                          {translate('confirmActivateDeactivate')
                                            .replace(
                                              '{action}',
                                              store.isActive ? translate('deactivate') : translate('activate')
                                            )
                                            .replace('{name}', store.name)}
                                        </span>
                                        {store.isActive && (
                                          <span className="block text-red-600">
                                            {translate('storeInactiveWarning')}
                                          </span>
                                        )}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleToggleStatus(store)}
                                        className={
                                          store.isActive
                                            ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-green-600 hover:bg-green-700'
                                        }
                                      >
                                        {store.isActive ? translate('deactivate') : translate('activate')}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredStores.length === 0 && (
                  <div className="text-center py-14 px-6 border-t border-gray-100">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 mb-4">
                      <StoreIcon className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{translate('noStoresSearch')}</h3>
                    <p className="text-sm text-gray-600 max-w-md mx-auto">
                      {searchTerm || statusFilter !== 'all' || cityFilter !== 'all' || planogramFilter !== 'all'
                        ? translate('tryOtherSearchStores')
                        : translate('addStoresHint')}
                    </p>
                  </div>
                )}

                {filteredStores.length > itemsPerPage && (
                  <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100 bg-gray-50/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      {translate('previous')}
                    </Button>
                    <span className="text-sm text-gray-600 tabular-nums">
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
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Store Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <DialogTitle className="flex items-start gap-3 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <StoreIcon className="h-5 w-5" />
              </span>
              <span className="space-y-1 min-w-0">
                <span className="block text-lg font-semibold text-gray-900 leading-tight">
                  {selectedStore?.name ?? translate('storeDetails')}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-500 font-normal">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">
                    {selectedStore ? getCityName(selectedStore.cityId) : ''}
                  </span>
                </span>
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">{translate('storeInfoDescription')}</DialogDescription>
          </DialogHeader>

          {selectedStore && (
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge className={getStatusBadgeColor(selectedStore.isActive)}>
                  {selectedStore.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                </Badge>
                {selectedStore.hasPlanogram ? (
                  <Badge className="bg-indigo-50 text-indigo-800 border-0 font-medium">
                    {translate('hasPlanogramLabel')}
                  </Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-600 border-0 font-medium">{translate('noPlanogram')}</Badge>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-gradient-to-b from-gray-50 to-white shadow-sm">
                <p className="border-b border-gray-100 bg-gray-50/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {translate('storeDetailSectionIds')}
                </p>
                <div className="grid grid-cols-3 divide-x divide-gray-100 bg-white text-xs">
                  <div className="px-3 py-2.5">
                    <p className="text-gray-500">{translate('storeFieldNumber')}</p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-gray-900">
                      {selectedStore.storeNumber?.toString().trim() || '—'}
                    </p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-gray-500">{translate('storeFieldZone')}</p>
                    <p className="mt-1 font-mono text-sm tabular-nums text-gray-900">
                      {selectedStore.zoneNumber?.toString().trim() || '—'}
                    </p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-gray-500">{translate('storeFieldZip')}</p>
                    <p className="mt-1 font-mono text-sm tabular-nums text-gray-900">
                      {selectedStore.zipCode?.toString().trim() || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-slate-50/80 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <LayoutGrid className="h-3.5 w-3.5 text-gray-400" />
                  {translate('storeDetailSectionLocation')}
                </div>
                {(() => {
                  const geo = getTerritoryChain(selectedStore.districtId);
                  return (
                    <dl className="grid grid-cols-1 gap-3 text-sm">
                      <div className="flex justify-between gap-4 border-b border-gray-200/80 pb-2">
                        <dt className="text-gray-500 shrink-0">{translate('city')}</dt>
                        <dd className="font-medium text-gray-900 text-right">{getCityName(selectedStore.cityId)}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-200/80 pb-2">
                        <dt className="text-gray-500 shrink-0">{translate('geoAreaLabel')}</dt>
                        <dd className="font-medium text-gray-900 text-right min-w-0 break-words">{geo.area}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-200/80 pb-2">
                        <dt className="text-gray-500 shrink-0">{translate('geoRegionLabel')}</dt>
                        <dd className="font-medium text-gray-900 text-right min-w-0 break-words">{geo.region}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-gray-200/80 pb-2">
                        <dt className="text-gray-500 shrink-0">{translate('geoDistrictLabel')}</dt>
                        <dd className="font-medium text-gray-900 text-right min-w-0 break-words">{geo.district}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 mb-1">{translate('address')}</dt>
                        <dd className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {String(selectedStore.street ?? selectedStore.address ?? '').trim() || '—'}
                        </dd>
                      </div>
                    </dl>
                  );
                })()}
              </div>

              <div className="rounded-xl border border-gray-200 bg-slate-50/80 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <ClipboardList className="h-3.5 w-3.5 text-gray-400" />
                  {translate('storeDetailSectionOperations')}
                </div>
                <p className="text-sm text-gray-700">
                  <span className="text-gray-500">{translate('hasPlanogramLabel')}: </span>
                  <span className="font-medium">
                    {selectedStore.hasPlanogram ? translate('yesLabel') : translate('noLabel')}
                  </span>
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 shrink-0 gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button variant="outline">{translate('close')}</Button>
            </DialogClose>
            {selectedStore && (
              <Button
                onClick={() => {
                  handleEditStore(selectedStore);
                  setShowDetailDialog(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {translate('edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};
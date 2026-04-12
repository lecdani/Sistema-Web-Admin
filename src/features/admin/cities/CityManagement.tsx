import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/base/Dialog';
import { SearchableSelect } from '@/shared/components/base/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';

import {
  Search,
  Plus,
  Edit,
  MapPin,
  ArrowLeft,
  Building2,
  Eye,
} from 'lucide-react';
import { Area, City, CityStateOption, District, Region, Store } from '@/shared/types';
import { toast } from '@/shared/components/base/Toast';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { citiesApi, resolveStateForCityPayload } from '@/shared/services/cities-api';
import { storesApi } from '@/shared/services/stores-api';
import { areasApi } from '@/shared/services/areas-api';
import { regionsApi } from '@/shared/services/regions-api';
import { districtsApi } from '@/shared/services/districts-api';
import { GeoAreasPanel, GeoDistrictsPanel, GeoRegionsPanel } from './components/GeoCatalogTabs';

interface CityFormData {
  name: string;
  /** Valor del enum `state` (string para el Select). */
  state: string;
}

interface CityManagementProps {
  onBack?: () => void;
}

export function CityManagement({ onBack }: CityManagementProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const [cities, setCities] = useState<City[]>([]);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Estados para el diálogo de ciudad
  const [showCityDialog, setShowCityDialog] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [cityFormData, setCityFormData] = useState<CityFormData>({
    name: '',
    state: '',
  });
  const [stateOptions, setStateOptions] = useState<CityStateOption[]>([]);
  const [cityFormErrors, setCityFormErrors] = useState<Partial<Record<keyof CityFormData, string>>>({});
  const [cityFormLoading, setCityFormLoading] = useState(false);

  // Estado para el diálogo de información
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [storeCounts, setStoreCounts] = useState<Record<string, number>>({});
  const [storesList, setStoresList] = useState<Store[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [geoTab, setGeoTab] = useState('cities');

  // Cargar ciudades al montar
  useEffect(() => {
    loadCities();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Filtrar ciudades cuando cambien los filtros
  useEffect(() => {
    filterCities();
  }, [cities, searchTerm, stateOptions]);

  const loadCities = async () => {
    setIsLoading(true);
    try {
      const [list, stores, states, areasList, regionsList, districtsList] = await Promise.all([
        citiesApi.fetchAll(),
        storesApi.fetchAll().catch(() => [] as Store[]),
        citiesApi.fetchStates().catch(() => [] as CityStateOption[]),
        areasApi.fetchAll().catch(() => [] as Area[]),
        regionsApi.fetchAll().catch(() => [] as Region[]),
        districtsApi.fetchAll().catch(() => [] as District[]),
      ]);

      setCities(list);
      setStateOptions(states);
      if (!states.length) {
        toast.warning(translate('warningCityStatesEmpty'));
      }
      setStoresList(stores as Store[]);
      setAreas(areasList);
      setRegions(regionsList);
      setDistricts(districtsList);

      const counts: Record<string, number> = {};
      (stores as Store[]).forEach((store) => {
        const key = store.cityId;
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      setStoreCounts(counts);
    } catch (error) {
      console.error('Error cargando ciudades:', error);
      toast.error(translate('errorLoadCities'));
      setCities([]);
      setStoreCounts({});
      setStateOptions([]);
      setStoresList([]);
      setAreas([]);
      setRegions([]);
      setDistricts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterCities = () => {
    let filtered = cities;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((city) => {
        if (city.name.toLowerCase().includes(q)) return true;
        const blob = [
          city.statePrefix,
          city.stateFullName,
          city.country,
          String(city.state ?? ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (blob.includes(q)) return true;
        const sid = String(city.state ?? '').trim();
        const opt = stateOptions.find((x) => String(x.value).toUpperCase() === sid.toUpperCase());
        if (opt) {
          const legacy = `${opt.code ?? ''} ${opt.label}`.toLowerCase();
          if (legacy.includes(q)) return true;
        }
        return false;
      });
    }

    setFilteredCities(filtered);
  };

  const handleCreateCity = () => {
    setEditingCity(null);
    setCityFormData({ name: '', state: '' });
    setCityFormErrors({});
    setShowCityDialog(true);
  };

  const handleEditCity = (city: City) => {
    setEditingCity(city);
    setCityFormData({
      name: city.name,
      state: city.state != null ? String(city.state).trim().toUpperCase() : '',
    });
    setCityFormErrors({});
    setShowCityDialog(true);
  };

  const handleViewCity = (city: City) => {
    setSelectedCity(city);
    setShowInfoDialog(true);
  };

  const validateCityForm = (): boolean => {
    const err: Partial<Record<keyof CityFormData, string>> = {};
    if (!cityFormData.name.trim()) err.name = translate('cityNameRequired');
    if (!stateOptions.length) err.state = translate('cityStatesSelectEmpty');
    else if (!cityFormData.state.trim()) err.state = translate('stateRequired');

    const nameNorm = cityFormData.name.trim().toLowerCase();
    const stateVal = cityFormData.state.trim();
    const duplicate = cities.some(
      (c) =>
        c.name.trim().toLowerCase() === nameNorm &&
        String(c.state ?? '').trim().toUpperCase() === stateVal.toUpperCase() &&
        (!editingCity || c.id !== editingCity.id)
    );
    if (duplicate) err.name = translate('duplicateCity');

    setCityFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSaveCity = async () => {
    if (!validateCityForm()) return;

    setCityFormLoading(true);
    try {
      const rawSt = cityFormData.state.trim();
      const selectedState = stateOptions.find(
        (o) =>
          String(o.value).toUpperCase() === rawSt.toUpperCase() ||
          String(o.code ?? '').toUpperCase() === rawSt.toUpperCase()
      );
      const statePayload = resolveStateForCityPayload(rawSt, selectedState);
      const payload = {
        name: cityFormData.name.trim(),
        state: statePayload,
      };

      if (editingCity) {
        await citiesApi.update(editingCity.id, payload);
        toast.success(translate('citySaved'));
      } else {
        const created = await citiesApi.create(payload);
        toast.success(translate('cityCreated'));
        setSearchTerm(created.name);
        setCurrentPage(1);
      }

      setShowCityDialog(false);
      setCityFormErrors({});
      await loadCities();
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? translate('errorSaveCity');
      toast.error(msg);
    } finally {
      setCityFormLoading(false);
    }
  };



  const getStoreCount = (cityId: string) => {
    return storeCounts[cityId] ?? 0;
  };

  const formatCityLocation = (city: City) => {
    const p = city.statePrefix?.trim();
    const fn = city.stateFullName?.trim();
    const c = city.country?.trim();
    if (p || fn || c) return [p, fn, c].filter(Boolean).join(' · ');
    if (city.state != null) {
      const opt = stateOptions.find(
        (x) => String(x.value).toUpperCase() === String(city.state).trim().toUpperCase()
      );
      if (opt) {
        return `${opt.code ? `${opt.code} · ` : ''}${opt.label}`;
      }
      return typeof city.state === 'string' ? city.state : `#${city.state}`;
    }
    return translate('notSpecified');
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  const totalPages = Math.ceil(filteredCities.length / itemsPerPage);
  const currentCities = filteredCities.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-green-100 rounded-lg">
            <MapPin className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('citiesTitle')}</h1>
            <p className="text-gray-500">{translate('citiesGeoSubtitle')}</p>
          </div>
        </div>
      </div>

      <Tabs value={geoTab} onValueChange={setGeoTab} defaultValue="cities" className="space-y-4">
        <TabsList className="flex h-auto min-h-12 w-full flex-wrap justify-start gap-1 p-1.5">
          <TabsTrigger value="cities">{translate('tabCities')}</TabsTrigger>
          <TabsTrigger value="areas">{translate('tabAreas')}</TabsTrigger>
          <TabsTrigger value="regions">{translate('tabRegions')}</TabsTrigger>
          <TabsTrigger value="districts">{translate('tabDistricts')}</TabsTrigger>
        </TabsList>

        <TabsContent value="cities" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={handleCreateCity} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              {translate('createCity')}
            </Button>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={translate('searchCitiesPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de ciudades */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentCities.map((city) => (
              <Card key={city.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-indigo-600" />
                      <CardTitle className="text-lg">{city.name}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {formatCityLocation(city)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      <span>{getStoreCount(city.id)} {translate('storesCount')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewCity(city)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {translate('view')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCity(city)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      {translate('edit')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredCities.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? translate('noCitiesSearch') : translate('noCities')}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm ? translate('tryOtherSearch') : translate('createFirstCity')}
                </p>
                {!searchTerm && (
                  <Button onClick={handleCreateCity} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4 mr-2" />
                    {translate('createFirstCityBtn')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                {translate('previous')}
              </Button>
              <span className="mx-2 text-gray-500">
                {translate('page')} {currentPage} {translate('pageOf')} {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                {translate('next')}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="areas">
          <GeoAreasPanel areas={areas} regions={regions} translate={translate} onRefresh={loadCities} />
        </TabsContent>

        <TabsContent value="regions">
          <GeoRegionsPanel
            areas={areas}
            regions={regions}
            districts={districts}
            translate={translate}
            onRefresh={loadCities}
          />
        </TabsContent>

        <TabsContent value="districts">
          <GeoDistrictsPanel
            areas={areas}
            regions={regions}
            districts={districts}
            stores={storesList}
            translate={translate}
            onRefresh={loadCities}
          />
        </TabsContent>
      </Tabs>

      {/* Diálogo para crear/editar ciudad */}
      <Dialog open={showCityDialog} onOpenChange={setShowCityDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCity ? translate('editCity') : translate('newCity')}
            </DialogTitle>
            <DialogDescription>
              {editingCity ? translate('editCityDesc') : translate('newCityDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-4">
            <div>
              <Label htmlFor="cityName">{translate('cityNameLabel')}</Label>
              <Input
                id="cityName"
                value={cityFormData.name}
                onChange={(e) => {
                  setCityFormData(prev => ({ ...prev, name: e.target.value }));
                  if (cityFormErrors.name) setCityFormErrors(prev => ({ ...prev, name: undefined }));
                }}
                placeholder="New York, Los Angeles, Chicago..."
                className={cityFormErrors.name ? 'border-red-500' : ''}
              />
              {cityFormErrors.name && (
                <p className="text-sm text-red-600 mt-1">{cityFormErrors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="cityStateSelect">{translate('stateLabel')}</Label>
              <SearchableSelect
                id="cityStateSelect"
                value={cityFormData.state}
                placeholder={translate('stateLabel')}
                disabled={!stateOptions.length}
                options={stateOptions.map((st) => ({
                  value: String(st.value).toUpperCase(),
                  label:
                    st.code && String(st.code).toUpperCase() !== String(st.label).trim()
                      ? `${st.code} — ${st.label}`
                      : st.label,
                }))}
                onValueChange={(value) => {
                  setCityFormData((prev) => ({ ...prev, state: value }));
                  setCityFormErrors((prev) => ({ ...prev, state: undefined, name: undefined }));
                }}
                aria-invalid={!!cityFormErrors.state}
                inputClassName={`w-full ${cityFormErrors.state ? 'border-red-500' : ''}`}
                zIndex={60}
              />
              {!stateOptions.length && (
                <p className="text-sm text-amber-700 mt-1">{translate('cityStatesSelectEmpty')}</p>
              )}
              {cityFormErrors.state && (
                <p className="text-sm text-red-600 mt-1">{cityFormErrors.state}</p>
              )}
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCityDialog(false)}>
              {translate('cancel')}
            </Button>
            <Button
              onClick={handleSaveCity}
              disabled={cityFormLoading || !stateOptions.length}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {cityFormLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  {translate('saving')}
                </>
              ) : (
                editingCity ? translate('update') : translate('create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de información de ciudad */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              {translate('cityInfo')}
            </DialogTitle>
          </DialogHeader>

          {selectedCity && (
            <div className="space-y-6 px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-gray-500">{translate('name')}</Label>
                  <p className="font-medium">{selectedCity.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">{translate('state')}</Label>
                  <p className="font-medium">{formatCityLocation(selectedCity)}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">{translate('stores')}</Label>
                  <p className="font-medium">{getStoreCount(selectedCity.id)} {translate('storesCount')}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInfoDialog(false)}>
              {translate('close')}
            </Button>
            {selectedCity && (
              <Button onClick={() => {
                setShowInfoDialog(false);
                handleEditCity(selectedCity);
              }} className="bg-indigo-600 hover:bg-indigo-700">
                <Edit className="h-4 w-4 mr-2" />
                {translate('edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
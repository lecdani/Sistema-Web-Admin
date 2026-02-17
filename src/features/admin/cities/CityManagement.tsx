import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/base/Dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/shared/components/base/Select';

import {
  Search,
  Plus,
  Edit,
  MapPin,
  ArrowLeft,
  Building2,
  Eye,
  Globe
} from 'lucide-react';
import { City, Store } from '@/shared/types';
import { toast } from '@/shared/components/base/Toast';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { citiesApi } from '@/shared/services/cities-api';
import { storesApi } from '@/shared/services/stores-api';

interface CityFormData {
  name: string;
  state: string;
  country: string;
}

const COUNTRIES = [
  'USA',
  'México',
  'España',
  'Colombia',
  'Argentina',
  'Chile',
  'Perú',
  'Ecuador',
  'Venezuela',
  'Guatemala',
  'Cuba',
  'Bolivia',
  'República Dominicana',
  'Honduras',
  'Paraguay',
  'El Salvador',
  'Nicaragua',
  'Costa Rica',
  'Panamá',
  'Uruguay',
  'Puerto Rico',
  'Canadá',
  'Brasil',
  'Otro'
];

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
  const itemsPerPage = 6;

  // Estados para el diálogo de ciudad
  const [showCityDialog, setShowCityDialog] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [cityFormData, setCityFormData] = useState<CityFormData>({
    name: '',
    state: '',
    country: 'USA'
  });
  const [cityFormErrors, setCityFormErrors] = useState<Partial<Record<keyof CityFormData, string>>>({});
  const [cityFormLoading, setCityFormLoading] = useState(false);

  // Estado para el diálogo de información
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [storeCounts, setStoreCounts] = useState<Record<string, number>>({});

  // Cargar ciudades al montar
  useEffect(() => {
    loadCities();
  }, []);

  // Filtrar ciudades cuando cambien los filtros
  useEffect(() => {
    filterCities();
  }, [cities, searchTerm]);

  const loadCities = async () => {
    setIsLoading(true);
    try {
      const [list, stores] = await Promise.all([
        citiesApi.fetchAll(),
        storesApi.fetchAll().catch(() => [] as Store[])
      ]);

      setCities(list);

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
    } finally {
      setIsLoading(false);
    }
  };

  const filterCities = () => {
    let filtered = cities;

    // Filtrar por término de búsqueda
    if (searchTerm.trim()) {
      filtered = filtered.filter(city =>
        city.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        city.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        city.country.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCities(filtered);
  };

  const handleCreateCity = () => {
    setEditingCity(null);
    setCityFormData({ name: '', state: '', country: 'USA' });
    setCityFormErrors({});
    setShowCityDialog(true);
  };

  const handleEditCity = (city: City) => {
    setEditingCity(city);
    setCityFormData({
      name: city.name,
      state: city.state || '',
      country: city.country
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
    if (!cityFormData.state.trim()) err.state = translate('stateRequired');
    if (!cityFormData.country.trim()) err.country = translate('countryRequired');

    const nameNorm = cityFormData.name.trim().toLowerCase();
    const stateNorm = cityFormData.state.trim().toLowerCase();
    const countryNorm = cityFormData.country.trim().toLowerCase();
    const duplicate = cities.find(
      c =>
        c.name.trim().toLowerCase() === nameNorm &&
        (c.state || '').trim().toLowerCase() === stateNorm &&
        c.country.trim().toLowerCase() === countryNorm &&
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
      const payload = {
        name: cityFormData.name.trim(),
        state: cityFormData.state.trim(),
        country: cityFormData.country.trim()
      };

      if (editingCity) {
        await citiesApi.update(editingCity.id, payload);
        toast.success(translate('citySaved'));
      } else {
        await citiesApi.create(payload);
        toast.success(translate('cityCreated'));
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
            <p className="text-gray-500">{translate('citiesSubtitle')}</p>
          </div>
        </div>

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
                <Globe className="h-4 w-4 text-gray-400" />
              </div>
              <CardDescription>
                {city.state && `${city.state}, `}{city.country}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  <span>{getStoreCount(city.id)} {translate('storesCount')}</span>
                </div>
              </div>

              {/* Acciones */}
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

      {/* Mensaje cuando no hay ciudades */}
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

      {/* Paginación */}
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
              <Label htmlFor="cityState">{translate('stateLabel')}</Label>
              <Input
                id="cityState"
                value={cityFormData.state}
                onChange={(e) => {
                  setCityFormData(prev => ({ ...prev, state: e.target.value }));
                  setCityFormErrors(prev => ({ ...prev, state: undefined, name: undefined }));
                }}
                placeholder="New York, California, Texas..."
                className={cityFormErrors.state ? 'border-red-500' : ''}
              />
              {cityFormErrors.state && (
                <p className="text-sm text-red-600 mt-1">{cityFormErrors.state}</p>
              )}
            </div>

            <div className="relative">
              <Label htmlFor="cityCountry">{translate('countryLabel')}</Label>
              <Select
                value={cityFormData.country}
                onValueChange={(value) => {
                  setCityFormData(prev => ({ ...prev, country: value }));
                  setCityFormErrors(prev => ({ ...prev, country: undefined, name: undefined }));
                }}
              >
                <SelectTrigger id="cityCountry" className={`w-full ${cityFormErrors.country ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder={translate('selectCountry')} />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cityFormErrors.country && (
                <p className="text-sm text-red-600 mt-1">{cityFormErrors.country}</p>
              )}
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCityDialog(false)}>
              {translate('cancel')}
            </Button>
            <Button
              onClick={handleSaveCity}
              disabled={cityFormLoading}
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
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-gray-500">{translate('name')}</Label>
                  <p className="font-medium">{selectedCity.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">{translate('state')}</Label>
                  <p className="font-medium">{selectedCity.state || translate('notSpecified')}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">{translate('country')}</Label>
                  <p className="font-medium">{selectedCity.country}</p>
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
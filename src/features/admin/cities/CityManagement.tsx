import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/base/Dialog';

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
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';
import { City } from '@/shared/types';
import { toast } from '@/shared/components/base/Toast';

interface CityFormData {
  name: string;
  state: string;
  country: string;
  code: string;
}

interface CityManagementProps {
  onBack: () => void;
}

export function CityManagement({ onBack }: CityManagementProps) {
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
    country: 'España',
    code: ''
  });
  const [cityFormLoading, setCityFormLoading] = useState(false);
  
  // Estado para el diálogo de información
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  // Cargar ciudades al montar
  useEffect(() => {
    loadCities();
  }, []);

  // Filtrar ciudades cuando cambien los filtros
  useEffect(() => {
    filterCities();
  }, [cities, searchTerm]);

  const loadCities = () => {
    setIsLoading(true);
    try {
      const savedCities: City[] = getFromLocalStorage('app-cities') || [];
      setCities(savedCities);
    } catch (error) {
      console.error('Error cargando ciudades:', error);
      toast.error('Error al cargar las ciudades');
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
        city.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        city.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCities(filtered);
  };

  const saveCities = (updatedCities: City[]) => {
    setToLocalStorage('app-cities', updatedCities);
    setCities(updatedCities);
  };

  const handleCreateCity = () => {
    setEditingCity(null);
    setCityFormData({
      name: '',
      state: '',
      country: 'España',
      code: ''
    });
    setShowCityDialog(true);
  };

  const handleEditCity = (city: City) => {
    setEditingCity(city);
    setCityFormData({
      name: city.name,
      state: city.state || '',
      country: city.country,
      code: city.code || ''
    });
    setShowCityDialog(true);
  };

  const handleViewCity = (city: City) => {
    setSelectedCity(city);
    setShowInfoDialog(true);
  };

  const handleSaveCity = async () => {
    setCityFormLoading(true);
    
    try {
      // Validaciones
      if (!cityFormData.name.trim()) {
        toast.error('El nombre de la ciudad es obligatorio');
        return;
      }

      if (!cityFormData.country.trim()) {
        toast.error('El país es obligatorio');
        return;
      }

      // Verificar si ya existe una ciudad con el mismo nombre en el mismo país/estado
      const existingCity = cities.find(city => 
        city.name.toLowerCase() === cityFormData.name.toLowerCase() &&
        city.country.toLowerCase() === cityFormData.country.toLowerCase() &&
        (city.state || '').toLowerCase() === (cityFormData.state || '').toLowerCase() &&
        city.id !== editingCity?.id
      );

      if (existingCity) {
        toast.error('Ya existe una ciudad con ese nombre en la misma ubicación');
        return;
      }

      const now = new Date();
      let updatedCities: City[];

      if (editingCity) {
        // Actualizar ciudad existente
        updatedCities = cities.map(city =>
          city.id === editingCity.id
            ? {
                ...city,
                name: cityFormData.name.trim(),
                state: cityFormData.state.trim() || undefined,
                country: cityFormData.country.trim(),
                code: cityFormData.code.trim() || undefined,
                updatedAt: now
              }
            : city
        );
        toast.success('Ciudad actualizada correctamente');
      } else {
        // Crear nueva ciudad
        const newCity: City = {
          id: `city_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: cityFormData.name.trim(),
          state: cityFormData.state.trim() || undefined,
          country: cityFormData.country.trim(),
          code: cityFormData.code.trim() || undefined,
          createdAt: now,
          updatedAt: now
        };
        updatedCities = [...cities, newCity];
        toast.success('Ciudad creada correctamente');
      }

      saveCities(updatedCities);
      setShowCityDialog(false);
      
    } catch (error) {
      console.error('Error guardando ciudad:', error);
      toast.error('Error al guardar la ciudad');
    } finally {
      setCityFormLoading(false);
    }
  };



  const getStoreCount = (cityId: string) => {
    const stores = getFromLocalStorage('app-stores') || [];
    return stores.filter((store: any) => store.cityId === cityId).length;
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
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-green-100 rounded-lg">
            <MapPin className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Ciudades</h1>
            <p className="text-gray-500">Administra las ciudades del sistema</p>
          </div>
        </div>
        
        <Button onClick={handleCreateCity} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Ciudad
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
                  placeholder="Buscar ciudades por nombre, estado, país o código..."
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
                {city.code && ` - ${city.code}`}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Estadísticas */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  <span>{getStoreCount(city.id)} tiendas</span>
                </div>
              </div>
              
              {/* Información adicional */}
              <div className="text-xs text-gray-500">
                <p>Creada: {new Date(city.createdAt).toLocaleDateString('es-ES')}</p>
                <p>Actualizada: {new Date(city.updatedAt).toLocaleDateString('es-ES')}</p>
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
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditCity(city)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
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
              {searchTerm ? 'No se encontraron ciudades' : 'No hay ciudades registradas'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda'
                : 'Comienza creando tu primera ciudad'
              }
            </p>
            {!searchTerm && (
              <Button onClick={handleCreateCity} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                Crear primera ciudad
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
            Anterior
          </Button>
          <span className="mx-2 text-gray-500">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Diálogo para crear/editar ciudad */}
      <Dialog open={showCityDialog} onOpenChange={setShowCityDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCity ? 'Editar Ciudad' : 'Nueva Ciudad'}
            </DialogTitle>
            <DialogDescription>
              {editingCity 
                ? 'Modifica los datos de la ciudad'
                : 'Completa la información para crear una nueva ciudad'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 px-6 py-4">
            <div>
              <Label htmlFor="cityName">Nombre de la Ciudad *</Label>
              <Input
                id="cityName"
                value={cityFormData.name}
                onChange={(e) => setCityFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Madrid, Barcelona, Valencia..."
              />
            </div>
            
            <div>
              <Label htmlFor="cityState">Estado/Provincia</Label>
              <Input
                id="cityState"
                value={cityFormData.state}
                onChange={(e) => setCityFormData(prev => ({ ...prev, state: e.target.value }))}
                placeholder="Comunidad de Madrid, Cataluña..."
              />
            </div>
            
            <div>
              <Label htmlFor="cityCountry">País *</Label>
              <Input
                id="cityCountry"
                value={cityFormData.country}
                onChange={(e) => setCityFormData(prev => ({ ...prev, country: e.target.value }))}
                placeholder="España"
              />
            </div>
            
            <div>
              <Label htmlFor="cityCode">Código Postal</Label>
              <Input
                id="cityCode"
                value={cityFormData.code}
                onChange={(e) => setCityFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="28001, 08001..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCityDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveCity}
              disabled={cityFormLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {cityFormLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Guardando...
                </>
              ) : (
                editingCity ? 'Actualizar' : 'Crear'
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
              Información de la Ciudad
            </DialogTitle>
          </DialogHeader>
          
          {selectedCity && (
            <div className="space-y-6 px-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-gray-500">Nombre</Label>
                  <p className="font-medium">{selectedCity.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Estado</Label>
                  <p className="font-medium">{selectedCity.state || 'No especificado'}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">País</Label>
                  <p className="font-medium">{selectedCity.country}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Código</Label>
                  <p className="font-medium">{selectedCity.code || 'No especificado'}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Tiendas</Label>
                  <p className="font-medium">{getStoreCount(selectedCity.id)} tiendas</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                  <div>
                    <Label className="text-xs text-gray-400">Fecha de Creación</Label>
                    <p>{new Date(selectedCity.createdAt).toLocaleString('es-ES')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">Última Actualización</Label>
                    <p>{new Date(selectedCity.updatedAt).toLocaleString('es-ES')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInfoDialog(false)}>
              Cerrar
            </Button>
            {selectedCity && (
              <Button onClick={() => {
                setShowInfoDialog(false);
                handleEditCity(selectedCity);
              }} className="bg-indigo-600 hover:bg-indigo-700">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
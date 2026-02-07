import React, { useState, useEffect } from 'react';
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
  Building2
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/base/Select';
import { Textarea } from '@/shared/components/base/Textarea';
import { Store, City } from '@/shared/types';
import { storesApi } from '@/shared/services/stores-api';
import { citiesApi } from '@/shared/services/cities-api';
import { toast } from '@/shared/components/base/Toast';

interface StoreManagementProps {
  onBack: () => void;
}

interface StoreFormData {
  name: string;
  address: string;
  cityId: string;
}

export const StoreManagement: React.FC<StoreManagementProps> = ({ onBack }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isLoading, setIsLoading] = useState(true);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const [formData, setFormData] = useState<StoreFormData>({
    name: '',
    address: '',
    cityId: '',
  });

  useEffect(() => {
    loadStores();
    loadCities();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [stores, searchTerm, statusFilter, cityFilter]);

  const loadStores = async () => {
    try {
      setIsLoading(true);
      const data = await storesApi.fetchAll();
      setStores(data);
    } catch (error) {
      console.error('Error cargando tiendas:', error);
      toast.error('Error al cargar las tiendas');
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCities = async () => {
    try {
      const data = await citiesApi.fetchAll();
      setCities(data);
    } catch (error) {
      console.error('Error cargando ciudades:', error);
      toast.error('Error al cargar ciudades');
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
          store.address.toLowerCase().includes(searchLower) ||
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

    setFilteredStores(filtered);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      cityId: '',
    });
    setEditingStore(null);
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error('El nombre de la tienda es requerido');
      return false;
    }
    if (!formData.address.trim()) {
      toast.error('La dirección es requerida');
      return false;
    }
    if (!formData.cityId.trim()) {
      toast.error('La ciudad es requerida');
      return false;
    }
    return true;
  };

  const handleSaveStore = async () => {
    if (!validateForm()) return;

    try {
      // Validar que la ciudad sigue existiendo
      const cityExists = cities.find(c => c.id === formData.cityId);
      if (!cityExists) {
        toast.error('La ciudad seleccionada no es válida');
        return;
      }

      const storeData: any = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        cityId: formData.cityId
      };

      if (editingStore) {
        await storesApi.update(editingStore.id, storeData);
        toast.success('Tienda actualizada correctamente');
      } else {
        await storesApi.create(storeData);
        toast.success('Tienda creada correctamente');
      }

      loadStores(); // Recargar lista

      // Limpiar formulario y cerrar diálogo
      resetForm();
      setShowAddDialog(false);

    } catch (error) {
      console.error('Error guardando tienda:', error);
      toast.error('Error al guardar la tienda');
    }
  };

  const handleEditStore = (store: Store) => {
    setFormData({
      name: store.name,
      address: store.address,
      cityId: store.cityId
    });
    setEditingStore(store);
    setShowAddDialog(true);
  };

  const handleToggleStatus = async (store: Store) => {
    try {
      // El endpoint de desactivar funciona como toggle (activar/desactivar)
      await storesApi.deactivate(store.id);

      await loadStores();
      toast.success(`Tienda ${!store.isActive ? 'activada' : 'desactivada'} correctamente`);
    } catch (error) {
      console.error('Error cambiando estado de la tienda:', error);
      toast.error('Error al cambiar el estado de la tienda');
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
    return city ? city.name : 'Sin ciudad';
  };

  const getUniqueCities = () => {
    return cities;
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
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-blue-100 rounded-lg">
            <StoreIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Tiendas</h1>
            <p className="text-gray-500">Administra todas las tiendas del sistema</p>
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
              Agregar Tienda
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingStore ? 'Editar Tienda' : 'Agregar Nueva Tienda'}
              </DialogTitle>
              <DialogDescription>
                {editingStore
                  ? 'Modifica la información de la tienda.'
                  : 'Completa la información para crear una nueva tienda.'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-6 py-4">
              {/* Mensaje de aviso si no hay ciudades disponibles */}
              {getUniqueCities().length === 0 && !editingStore && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-yellow-600" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">No hay ciudades disponibles</h4>
                      <p className="text-xs text-yellow-700 mt-0.5">
                        Necesitas crear al menos una ciudad antes de poder agregar tiendas.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Tienda *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Tienda Centro"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Ej: Av. Principal 123"
                  rows={3}
                  className="resize-none min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cityId">Ciudad *</Label>
                <Select
                  value={formData.cityId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cityId: value }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Seleccionar ciudad" />
                  </SelectTrigger>
                  <SelectContent>
                    {getUniqueCities().length > 0 ? (
                      getUniqueCities().map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name} - {city.country}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No hay ciudades disponibles
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </DialogClose>
              <Button onClick={handleSaveStore} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-2" />
                {editingStore ? 'Actualizar' : 'Crear'}
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
                <p className="text-xs font-medium text-gray-500">Total Tiendas</p>
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
                <p className="text-xs font-medium text-gray-500">Tiendas Activas</p>
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
                <p className="text-xs font-medium text-gray-500">Ciudades</p>
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
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar tiendas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="inactive">Inactivas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-48">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por ciudad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ciudades</SelectItem>
                  {getUniqueCities().map((city) => (
                    <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stores Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Tiendas</CardTitle>
          <CardDescription>
            Gestiona todas las tiendas del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tienda
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Registro
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStores.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <StoreIcon className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {store.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getCityName(store.cityId)}</div>
                      <div className="text-sm text-gray-500">{store.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusBadgeColor(store.isActive)}>
                        {store.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(store.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetail(store)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditStore(store)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className={store.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                            >
                              {store.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {store.isActive ? 'Desactivar' : 'Activar'} Tienda
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                <span className="block mb-2">
                                  ¿Estás seguro que deseas {store.isActive ? 'desactivar' : 'activar'} la tienda <strong>{store.name}</strong>?
                                </span>
                                {store.isActive && (
                                  <span className="block text-red-600">
                                    La tienda no estará disponible para operaciones.
                                  </span>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleToggleStatus(store)}
                                className={store.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                              >
                                {store.isActive ? 'Desactivar' : 'Activar'}
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

          {filteredStores.length === 0 && (
            <div className="text-center py-12">
              <StoreIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron tiendas
              </h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' || cityFilter !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda.'
                  : 'Comienza agregando tiendas al sistema.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {
        filteredStores.length > itemsPerPage && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-gray-600">
              Página {currentPage} de {Math.ceil(filteredStores.length / itemsPerPage)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredStores.length / itemsPerPage)))}
              disabled={currentPage === Math.ceil(filteredStores.length / itemsPerPage)}
            >
              Siguiente
            </Button>
          </div>
        )
      }

      {/* Store Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StoreIcon className="h-5 w-5 text-indigo-600" />
              Detalles de la Tienda
            </DialogTitle>
            <DialogDescription>
              Información completa de la tienda seleccionada
            </DialogDescription>
          </DialogHeader>

          {selectedStore && (
            <div className="space-y-6 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedStore.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{getCityName(selectedStore.cityId)}</span>
                  </div>
                </div>
                <Badge className={getStatusBadgeColor(selectedStore.isActive)}>
                  {selectedStore.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                  Dirección
                </Label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedStore.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-2">
                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1 block">Registrada el</Label>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedStore.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1 block">Actualizada el</Label>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedStore.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
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
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};
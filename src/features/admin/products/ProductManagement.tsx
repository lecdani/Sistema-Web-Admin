import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit3,
  Power,
  PowerOff,
  Filter,
  Eye,
  Save,
  X,
  ArrowLeft,
  Hash,
  Tag,
  Archive,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  History,
  Calendar
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/base/Tooltip';
import { Product } from '@/shared/types';
import { productsApi } from '@/shared/services/products-api';
import { histpricesApi, type HistPrice } from '@/shared/services/histprices-api';
import { toast } from '@/shared/components/base/Toast';

interface ProductManagementProps {
  onBack: () => void;
}

interface ProductFormData {
  sku: string;
  name: string;
  category: string;
  isActive: boolean;
  initialPrice?: number;
}

interface PriceUpdateData {
  price: number;
}

export const ProductManagement: React.FC<ProductManagementProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isLoading, setIsLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showPriceHistoryDialog, setShowPriceHistoryDialog] = useState(false);
  const [showUpdatePriceDialog, setShowUpdatePriceDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceHistoryList, setPriceHistoryList] = useState<HistPrice[]>([]);
  const [queryDate, setQueryDate] = useState<string>('');
  const [queryResult, setQueryResult] = useState<HistPrice | null>(null);

  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    name: '',
    category: '',
    isActive: true
  });

  const [priceUpdateData, setPriceUpdateData] = useState<PriceUpdateData>({
    price: 0
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<'sku' | 'name' | 'category' | 'initialPrice', string>>>({});

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchTerm, statusFilter, categoryFilter]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const list = await productsApi.fetchAll();
      const withPrices = await Promise.all(
        list.map(async (p) => {
          try {
            const latest = await histpricesApi.getLatest(p.id);
            return { ...p, currentPrice: latest?.price ?? 0 };
          } catch {
            return { ...p, currentPrice: 0 };
          }
        })
      );
      setProducts(withPrices);
    } catch (error: any) {
      console.error('Error cargando productos:', error);
      const msg = error?.data?.message ?? error?.message ?? '';
      const isNotImplemented = msg.includes('NotImplemented') || error?.status === 500;
      setLoadError(
        isNotImplemented
          ? 'El servicio de productos no está disponible en este momento.'
          : msg || 'Error al cargar los productos.'
      );
      toast.error('No se pudieron cargar los productos');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = products;

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower) ||
        (product.description && product.description.toLowerCase().includes(searchLower))
      );
    }

    // Filtro de estado
    if (statusFilter !== 'all' && statusFilter !== 'all-status') {
      filtered = filtered.filter(product => 
        statusFilter === 'active' ? product.isActive : !product.isActive
      );
    }

    // Filtro de categoría
    if (categoryFilter !== 'all' && categoryFilter !== 'all-categories') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    setFilteredProducts(filtered);
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      category: '',
      isActive: true
    });
    setFormErrors({});
    setEditingProduct(null);
  };

  const resetPriceForm = () => {
    setPriceUpdateData({ price: 0 });
  };

  const validateForm = (): boolean => {
    const err: Partial<Record<'sku' | 'name' | 'category' | 'initialPrice', string>> = {};
    if (!formData.sku.trim()) err.sku = 'El SKU es obligatorio';
    if (!formData.name.trim()) err.name = 'El nombre es obligatorio';
    if (!formData.category.trim()) err.category = 'El código de categoría es obligatorio';
    if (!editingProduct) {
      const price = formData.initialPrice ?? 0;
      if (price <= 0) err.initialPrice = 'El precio inicial es obligatorio y debe ser mayor a 0';
    }
    const existing = products.find(
      p => p.sku.trim().toLowerCase() === formData.sku.trim().toLowerCase() && (!editingProduct || p.id !== editingProduct.id)
    );
    if (existing) err.sku = 'Ya existe un producto con ese SKU';
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSaveProduct = async () => {
    if (!validateForm()) return;
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        sku: formData.sku.trim(),
        isActive: editingProduct ? editingProduct.isActive : true
      };
      if (editingProduct) {
        await productsApi.update(editingProduct.id, payload);
        toast.success('Producto actualizado correctamente');
      } else {
        const created = await productsApi.create(payload);
        const initialPrice = Number(formData.initialPrice) || 0;
        if (initialPrice > 0) {
          const now = new Date();
          await histpricesApi.create({
            productId: created.id,
            price: initialPrice,
            startDate: now,
            endDate: now
          });
        }
        toast.success('Producto creado correctamente');
      }
      resetForm();
      setShowAddDialog(false);
      await loadProducts();
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? 'Error al guardar el producto';
      toast.error(msg);
    }
  };

  const handleUpdatePrice = async () => {
    if (!selectedProduct) return;
    if (priceUpdateData.price <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }
    try {
      const now = new Date();
      await histpricesApi.create({
        productId: selectedProduct.id,
        price: priceUpdateData.price,
        startDate: now,
        endDate: now
      });
      toast.success('Precio actualizado correctamente');
      resetPriceForm();
      setShowUpdatePriceDialog(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? 'Error al actualizar el precio';
      toast.error(msg);
    }
  };

  const loadPriceHistoryForDialog = async (productId: string) => {
    try {
      const list = await histpricesApi.getByProduct(productId);
      setPriceHistoryList(list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    } catch {
      setPriceHistoryList([]);
    }
  };

  useEffect(() => {
    if (queryDate && selectedProduct) {
      histpricesApi.getByDate(selectedProduct.id, queryDate).then(setQueryResult).catch(() => setQueryResult(null));
    } else {
      setQueryResult(null);
    }
  }, [queryDate, selectedProduct?.id]);

  const resetQueryForm = () => {
    setQueryDate('');
    setQueryResult(null);
  };

  const handleEditProduct = (product: Product) => {
    setFormData({
      sku: product.sku,
      name: product.name,
      category: product.category,
      isActive: product.isActive
    });
    setFormErrors({});
    setEditingProduct(product);
    setShowAddDialog(true);
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      await productsApi.delete(product.id);
      toast.success(`Producto ${!product.isActive ? 'activado' : 'desactivado'} correctamente`);
      await loadProducts();
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? 'Error al cambiar el estado';
      toast.error(msg);
    }
  };

  const handleViewDetail = (product: Product) => {
    setSelectedProduct(product);
    setShowDetailDialog(true);
  };

  const getStatusBadgeColor = (isActive: boolean): string => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getUniqueCategories = (): string[] => {
    const categories = products.map(p => p.category);
    return Array.from(new Set(categories)).sort();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-indigo-100 rounded-lg">
            <Package className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Productos</h1>
            <p className="text-gray-500">Administra el catálogo de productos del sistema</p>
          </div>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                resetForm();
                setShowAddDialog(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
              <DialogDescription>
                {editingProduct ? 'Modifica los datos del producto' : 'Completa la información del nuevo producto'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-5 px-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => {
                    setFormData({ ...formData, sku: e.target.value });
                    if (formErrors.sku) setFormErrors(prev => ({ ...prev, sku: undefined }));
                  }}
                  className={formErrors.sku ? 'border-red-500' : ''}
                />
                {formErrors.sku && <p className="text-sm text-red-600">{formErrors.sku}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && <p className="text-sm text-red-600">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Código de categoría *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => {
                    setFormData({ ...formData, category: e.target.value });
                    if (formErrors.category) setFormErrors(prev => ({ ...prev, category: undefined }));
                  }}
                  className={formErrors.category ? 'border-red-500' : ''}
                />
                {formErrors.category && <p className="text-sm text-red-600">{formErrors.category}</p>}
              </div>
              {!editingProduct && (
                <div className="space-y-2">
                  <Label htmlFor="initialPrice">Precio inicial *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="initialPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.initialPrice ?? ''}
                      onChange={(e) => {
                        setFormData({ ...formData, initialPrice: e.target.value ? parseFloat(e.target.value) : undefined });
                        if (formErrors.initialPrice) setFormErrors(prev => ({ ...prev, initialPrice: undefined }));
                      }}
                      className={`pl-10 ${formErrors.initialPrice ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {formErrors.initialPrice && <p className="text-sm text-red-600">{formErrors.initialPrice}</p>}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button onClick={handleSaveProduct} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-2" />
                {editingProduct ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Total Productos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{products.length}</p>
              </div>
              <div className="p-2.5 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Productos Activos</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {products.filter(p => p.isActive).length}
                </p>
              </div>
              <div className="p-2.5 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Productos Inactivos</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {products.filter(p => !p.isActive).length}
                </p>
              </div>
              <div className="p-2.5 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Categorías</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {getUniqueCategories().length}
                </p>
              </div>
              <div className="p-2.5 bg-blue-100 rounded-lg flex items-center justify-center">
                <Tag className="h-5 w-5 text-blue-600" />
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
                  placeholder="Buscar productos por nombre, SKU, categoría..."
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
                  <SelectItem value="all-status">Todos los estados</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <Tag className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-categories">Todas las categorías</SelectItem>
                  {getUniqueCategories().map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto / SKU
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Package className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {product.name}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {product.sku}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline" className="text-sm">
                        {product.category}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-green-600 mr-1" />
                          <span className="text-sm font-medium text-green-600">
                            {(product.currentPrice || 0).toLocaleString('es-ES', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })}
                          </span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setPriceUpdateData({ price: product.currentPrice || 0 });
                                setShowUpdatePriceDialog(true);
                              }}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            >
                              <TrendingUp className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Actualizar precio</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                resetQueryForm();
                                loadPriceHistoryForDialog(product.id);
                                setShowPriceHistoryDialog(true);
                              }}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ver historial de precios y consultar por fecha</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusBadgeColor(product.isActive)}>
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewDetail(product)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEditProduct(product)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className={product.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                            >
                              {product.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {product.isActive ? 'Desactivar' : 'Activar'} producto
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Estás seguro de que deseas {product.isActive ? 'desactivar' : 'activar'} "{product.name}"?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleToggleStatus(product)}
                                className={product.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                              >
                                {product.isActive ? 'Desactivar' : 'Activar'}
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
          
          {loadError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mx-4 mt-4">
              <p className="text-sm text-amber-800">{loadError}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => loadProducts()}>
                Reintentar
              </Button>
            </div>
          )}
          {filteredProducts.length === 0 && !loadError && (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron productos</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Comienza creando tu primer producto'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && (
                <Button 
                  onClick={() => setShowAddDialog(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Producto
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {filteredProducts.length > itemsPerPage && (
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
            Página {currentPage} de {Math.ceil(filteredProducts.length / itemsPerPage)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredProducts.length / itemsPerPage)))}
            disabled={currentPage === Math.ceil(filteredProducts.length / itemsPerPage)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Product Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalles del Producto</DialogTitle>
            <DialogDescription>
              Información completa del producto seleccionado
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-6 px-6 py-4">
              <div className="flex items-start gap-6">
                <div className="h-20 w-20 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="h-10 w-10 text-indigo-600" />
                </div>
                
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {selectedProduct.name}
                      </h3>
                      <Badge className={getStatusBadgeColor(selectedProduct.isActive)}>
                        {selectedProduct.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        SKU: {selectedProduct.sku}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-600">
                          {(selectedProduct.currentPrice || 0).toLocaleString('es-ES', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Categoría</Label>
                    <p className="flex items-center gap-1">
                      <Tag className="h-4 w-4 text-gray-400" />
                      {selectedProduct.category}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">ID</Label>
                    <p className="text-sm text-gray-700 font-mono">{selectedProduct.id}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Fecha de Registro</Label>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(selectedProduct.createdAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Última Actualización</Label>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(selectedProduct.updatedAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
              
            </div>
          )}
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
            {selectedProduct && (
              <Button 
                onClick={() => {
                  handleEditProduct(selectedProduct);
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

      {/* Update Price Dialog */}
      <Dialog open={showUpdatePriceDialog} onOpenChange={setShowUpdatePriceDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Actualizar Precio</DialogTitle>
            <DialogDescription>
              {selectedProduct && `Actualizar el precio de "${selectedProduct.name}"`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 px-6 py-4">
            {selectedProduct && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Precio actual:</p>
                <p className="text-lg font-semibold text-green-600">
                  ${(selectedProduct.currentPrice || 0).toLocaleString('es-ES', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="newPrice">Nuevo Precio *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="newPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceUpdateData.price}
                  onChange={(e) => setPriceUpdateData({ price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={resetPriceForm}>
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleUpdatePrice} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              Actualizar Precio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={showPriceHistoryDialog} onOpenChange={setShowPriceHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de Precios</DialogTitle>
            <DialogDescription>
              {selectedProduct && `${selectedProduct.name} • SKU: ${selectedProduct.sku}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4">
              {/* Barra de filtros style */}
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Precio actual:</span>
                    <span className="text-lg font-bold text-green-600">
                      ${(selectedProduct.currentPrice || 0).toLocaleString('es-ES', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                  
                  <div className="flex-1"></div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Consultar fecha:</span>
                    <Input
                      type="date"
                      value={queryDate}
                      onChange={(e) => setQueryDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-auto"
                    />
                  </div>
                </div>

                {queryResult && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                    <span className="text-sm text-blue-700">Precio en {queryDate}:</span>
                    <span className="ml-2 font-bold text-blue-900">
                      ${queryResult.price.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="ml-2 text-xs text-blue-600">
                      (vigente desde {new Date(queryResult.startDate).toLocaleDateString('es-ES')})
                    </span>
                  </div>
                )}

                {queryDate && !queryResult && (
                  <div className="mt-3 p-3 bg-amber-50 rounded border-l-4 border-amber-400">
                    <span className="text-sm text-amber-700">
                      No hay precio registrado para la fecha seleccionada
                    </span>
                  </div>
                )}
              </div>
              
              {/* Historial */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Historial completo</span>
                    <Badge variant="outline" className="text-xs">
                      {priceHistoryList.length} registros
                    </Badge>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {priceHistoryList.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Sin historial de precios</p>
                    </div>
                  ) : (
                    <div>
                      {priceHistoryList.map((history, index) => (
                        <div key={history.id} className="px-4 py-3 border-b last:border-b-0 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-gray-900">
                                ${history.price.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {index === 0 && (
                                <Badge className="bg-green-100 text-green-800 text-xs">Actual</Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(history.startDate).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                              {' – '}
                              {new Date(history.endDate).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                resetQueryForm();
                setShowPriceHistoryDialog(false);
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
};
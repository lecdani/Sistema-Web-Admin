import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Calendar,
  Award,
  FolderTree
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Product, Brand, Category } from '@/shared/types';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { productsApi } from '@/shared/services/products-api';
import { brandsApi } from '@/shared/services/brands-api';
import { categoriesApi } from '@/shared/services/categories-api';
import { histpricesApi, type HistPrice } from '@/shared/services/histprices-api';
import { toast } from '@/shared/components/base/Toast';

interface ProductManagementProps {
  onBack?: () => void;
}

interface ProductFormData {
  sku: string;
  name: string;
  category: string;
  brandId: string;
  categoryId: string;
  isActive: boolean;
  initialPrice?: number;
}

interface PriceUpdateData {
  price: number;
}

export const ProductManagement: React.FC<ProductManagementProps> = ({ onBack }) => {
  const router = useRouter();
  const { translate, locale } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandName, setBrandName] = useState('');
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [brandSearchTerm, setBrandSearchTerm] = useState('');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    name: '',
    category: '',
    brandId: '',
    categoryId: '',
    isActive: true
  });

  const [priceUpdateData, setPriceUpdateData] = useState<PriceUpdateData>({
    price: 0
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<'sku' | 'name' | 'category' | 'brandId' | 'categoryId' | 'initialPrice', string>>>({});

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchTerm, statusFilter, categoryFilter]);

  const loadProducts = async () => {
    setIsLoading(true);
    setLoadError(null);

    const [productsResult, brandsResult, categoriesResult] = await Promise.allSettled([
      productsApi.fetchAll(),
      brandsApi.fetchAll(),
      categoriesApi.fetchAll()
    ]);

    if (brandsResult.status === 'fulfilled') {
      setBrands(brandsResult.value);
    } else {
      console.warn('Error cargando marcas:', brandsResult.reason);
      setBrands([]);
    }
    if (categoriesResult.status === 'fulfilled') {
      setCategories(categoriesResult.value);
    } else {
      console.warn('Error cargando categorías:', categoriesResult.reason);
      setCategories([]);
    }

    if (productsResult.status === 'rejected') {
      const error = productsResult.reason;
      console.error('Error cargando productos:', error);
      const msg = error?.data?.message ?? error?.message ?? '';
      const isNotImplemented = msg.includes('NotImplemented') || error?.status === 500;
      setLoadError(
        isNotImplemented
          ? translate('productServiceUnavailable')
          : msg || translate('errorLoadProducts')
      );
      toast.error(translate('errorLoadProducts'));
      setProducts([]);
      setIsLoading(false);
      return;
    }

    const list = productsResult.value;
    try {
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
    } catch {
      setProducts(list.map((p) => ({ ...p, currentPrice: 0 })));
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = products;

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((product) => {
        const categoryName = getCategoryName(product).toLowerCase();
        return (
          product.name.toLowerCase().includes(searchLower) ||
          product.sku.toLowerCase().includes(searchLower) ||
          categoryName.includes(searchLower) ||
          (product.description && product.description.toLowerCase().includes(searchLower))
        );
      });
    }

    // Filtro de estado
    if (statusFilter !== 'all' && statusFilter !== 'all-status') {
      filtered = filtered.filter(product => 
        statusFilter === 'active' ? product.isActive : !product.isActive
      );
    }

    // Filtro de categoría
    if (categoryFilter !== 'all' && categoryFilter !== 'all-categories') {
      filtered = filtered.filter((product) => getCategoryName(product) === categoryFilter);
    }

    setFilteredProducts(filtered);
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      category: '',
      brandId: '',
      categoryId: '',
      isActive: true
    });
    setFormErrors({});
    setEditingProduct(null);
  };

  const resetPriceForm = () => {
    setPriceUpdateData({ price: 0 });
  };

  const validateForm = (): boolean => {
    const err: Partial<Record<'sku' | 'name' | 'category' | 'brandId' | 'categoryId' | 'initialPrice', string>> = {};
    if (!formData.sku.trim()) err.sku = translate('skuRequired');
    if (!formData.name.trim()) err.name = translate('nameRequired');
    if (!formData.brandId) err.brandId = translate('brandRequired');
    if (!formData.categoryId) err.categoryId = translate('categoryRequired');
    if (!editingProduct) {
      const price = formData.initialPrice ?? 0;
      if (price <= 0) err.initialPrice = translate('initialPriceRequired');
    }
    const existing = products.find(
      p => p.sku.trim().toLowerCase() === formData.sku.trim().toLowerCase() && (!editingProduct || p.id !== editingProduct.id)
    );
    if (existing) err.sku = translate('duplicateSku');
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSaveProduct = async () => {
    if (!validateForm()) return;
    try {
      const cat = categories.find(c => c.id === formData.categoryId);
      const payload = {
        name: formData.name.trim(),
        category: cat?.name ?? formData.category.trim(),
        sku: formData.sku.trim(),
        brandId: formData.brandId || undefined,
        categoryId: formData.categoryId || undefined,
        isActive: editingProduct ? editingProduct.isActive : true
      };
      if (editingProduct) {
        await productsApi.update(editingProduct.id, payload);
        toast.success(translate('productSaved'));
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
        toast.success(translate('productCreated'));
        setSearchTerm(created.name);
        setCurrentPage(1);
      }
      resetForm();
      setShowAddDialog(false);
      await loadProducts();
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? translate('errorSaveProduct');
      toast.error(msg);
    }
  };

  const handleUpdatePrice = async () => {
    if (!selectedProduct) return;
    if (priceUpdateData.price <= 0) {
      toast.error(translate('priceMustBePositive'));
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
      toast.success(translate('priceUpdatedSuccess'));
      resetPriceForm();
      setShowUpdatePriceDialog(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? translate('errorUpdatePrice');
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
    const categoryId = product.categoryId ?? categories.find(c => c.name === product.category)?.id ?? '';
    setFormData({
      sku: product.sku,
      name: product.name,
      category: product.category,
      brandId: product.brandId ?? '',
      categoryId,
      isActive: product.isActive
    });
    setFormErrors({});
    setEditingProduct(product);
    setShowAddDialog(true);
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      await productsApi.delete(product.id);
      toast.success(!product.isActive ? translate('productActivatedSuccess') : translate('productDeactivatedSuccess'));
      await loadProducts();
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? translate('errorToggleProduct');
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
    const fromProducts = products.map((p) => getCategoryName(p)).filter(Boolean);
    const fromList = categories.map((c) => c.name);
    return Array.from(new Set([...fromList, ...fromProducts])).sort();
  };

  const activeBrands = brands.filter(b => b.isActive);
  const activeCategories = categories.filter(c => c.isActive);

  const getCategoryName = (product: Product): string => {
    const byId = product.categoryId ? categories.find(c => c.id === product.categoryId)?.name : undefined;
    return byId || product.category || '-';
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/dashboard');
    }
  };

  const handleSaveBrand = async () => {
    const name = brandName.trim();
    if (!name) {
      toast.error(translate('brandNameRequired'));
      return;
    }
    try {
      if (editingBrand) {
        const updated = await brandsApi.update(editingBrand.id, { name });
        setBrands((prev) => prev.map((b) => (b.id === editingBrand.id ? updated : b)));
        toast.success(translate('brandUpdated'));
      } else {
        const created = await brandsApi.create({ name });
        setBrands((prev) => [...prev, created]);
        toast.success(translate('brandCreated'));
        setBrandSearchTerm(created.name);
      }
      setBrandName('');
      setEditingBrand(null);
      setShowBrandDialog(false);
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorSaveBrand'));
    }
  };

  const handleSaveCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      toast.error(translate('categoryNameRequired'));
      return;
    }
    try {
      if (editingCategory) {
        const updated = await categoriesApi.update(editingCategory.id, { name });
        setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? updated : c)));
        toast.success(translate('categoryUpdated'));
      } else {
        const created = await categoriesApi.create({ name });
        setCategories((prev) => [...prev, created]);
        toast.success(translate('categoryCreated'));
        setCategorySearchTerm(created.name);
      }
      setCategoryName('');
      setEditingCategory(null);
      setShowCategoryDialog(false);
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorSaveCategory'));
    }
  };

  const handleToggleBrand = async (brand: Brand) => {
    try {
      await brandsApi.toggleActive(brand.id);
      setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, isActive: !b.isActive } : b)));
      toast.success(brand.isActive ? translate('brandDeactivated') : translate('brandActivated'));
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorToggleStatusGeneric'));
    }
  };

  const handleToggleCategory = async (category: Category) => {
    try {
      await categoriesApi.toggleActive(category.id);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, isActive: !c.isActive } : c)));
      toast.success(category.isActive ? translate('categoryDeactivated') : translate('categoryActivated'));
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorToggleStatusGeneric'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-600">{translate('loadingProducts')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-indigo-100 rounded-lg">
            <Package className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('productsTitle')}</h1>
            <p className="text-gray-500">{translate('productsSubtitleCatalog')}</p>
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
              {translate('createProduct')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? translate('editProduct') : translate('createProduct')}
              </DialogTitle>
              <DialogDescription>
                {editingProduct ? translate('editProductDesc') : translate('newProductDesc')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-5 px-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="sku">{translate('sku')} *</Label>
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
                <Label htmlFor="name">{translate('name')} *</Label>
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
                <Label>{translate('brands')} *</Label>
                <Select
                  value={formData.brandId || undefined}
                  onValueChange={(v) => {
                    setFormData({ ...formData, brandId: v });
                    if (formErrors.brandId) setFormErrors(prev => ({ ...prev, brandId: undefined }));
                  }}
                >
                  <SelectTrigger className={formErrors.brandId ? 'border-red-500' : ''}>
                    <SelectValue placeholder={translate('selectBrand')}>
                      {activeBrands.find((b) => b.id === formData.brandId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {activeBrands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.brandId && <p className="text-sm text-red-600">{formErrors.brandId}</p>}
                {activeBrands.length === 0 && (
                  <p className="text-xs text-amber-600">{translate('addBrandsFirst')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{translate('categories')} *</Label>
                <Select
                  value={formData.categoryId || undefined}
                  onValueChange={(v) => {
                    const cat = categories.find(c => c.id === v);
                    setFormData({ ...formData, categoryId: v, category: cat?.name ?? '' });
                    if (formErrors.categoryId) setFormErrors(prev => ({ ...prev, categoryId: undefined }));
                  }}
                >
                  <SelectTrigger className={formErrors.categoryId ? 'border-red-500' : ''}>
                    <SelectValue placeholder={translate('selectCategory')}>
                      {activeCategories.find((c) => c.id === formData.categoryId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.categoryId && <p className="text-sm text-red-600">{formErrors.categoryId}</p>}
                {activeCategories.length === 0 && (
                  <p className="text-xs text-amber-600">{translate('addCategoriesFirst')}</p>
                )}
              </div>
              {!editingProduct && (
                <div className="space-y-2">
                  <Label htmlFor="initialPrice">{translate('initialPriceLabel')}</Label>
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
                  {translate('cancel')}
                </Button>
              </DialogClose>
              <Button onClick={handleSaveProduct} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-2" />
                {editingProduct ? translate('update') : translate('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {translate('tabProducts')}
          </TabsTrigger>
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            {translate('tabBrandsCategories')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6 mt-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalProducts')}</p>
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
                <p className="text-xs font-medium text-gray-500">{translate('activeProducts')}</p>
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
                <p className="text-xs font-medium text-gray-500">{translate('inactiveProducts')}</p>
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
                <p className="text-xs font-medium text-gray-500">{translate('categories')}</p>
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
                  placeholder={translate('searchProductsPlaceholder')}
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
                  <SelectValue placeholder={translate('filterByStatus')}>
                    {statusFilter === 'all-status' && translate('allStatuses')}
                    {statusFilter === 'active' && translate('active')}
                    {statusFilter === 'inactive' && translate('inactive')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-status">{translate('allStatuses')}</SelectItem>
                  <SelectItem value="active">{translate('active')}</SelectItem>
                  <SelectItem value="inactive">{translate('inactive')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <Tag className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={translate('filterByCategory')}>
                    {categoryFilter === 'all-categories' ? translate('allCategories') : categoryFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-categories">{translate('allCategories')}</SelectItem>
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
                    {translate('productSkuHeader')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('brandHeader')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('categoryHeader')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('priceHeader')}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {brands.find(b => b.id === product.brandId)?.name ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline" className="text-sm">
                        {getCategoryName(product)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-green-600 mr-1" />
                          <span className="text-sm font-medium text-green-600">
                            {(product.currentPrice || 0).toLocaleString(locale, { 
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
                            <p>{translate('updatePrice')}</p>
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
                            <p>{translate('priceHistoryTooltip')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusBadgeColor(product.isActive)}>
                        {product.isActive ? translate('active') : translate('inactive')}
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
                                {product.isActive ? translate('deactivate') : translate('activate')} {translate('product')}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {translate('confirmDeactivateProduct').replace('{action}', product.isActive ? translate('deactivate') : translate('activate')).replace('{name}', product.name)}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleToggleStatus(product)}
                                className={product.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                              >
                                {product.isActive ? translate('deactivate') : translate('activate')}
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
                {translate('retry')}
              </Button>
            </div>
          )}
          {filteredProducts.length === 0 && !loadError && (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{translate('noProductsSearch')}</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                  ? translate('tryOtherSearchProducts')
                  : translate('createFirstProductHint')
                }
              </p>
              {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && (
                <Button 
                  onClick={() => setShowAddDialog(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {translate('createFirstProduct')}
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
            {translate('previous')}
          </Button>
          <span className="text-sm text-gray-600">
            {translate('page')} {currentPage} {translate('pageOf')} {Math.ceil(filteredProducts.length / itemsPerPage)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredProducts.length / itemsPerPage)))}
            disabled={currentPage === Math.ceil(filteredProducts.length / itemsPerPage)}
          >
            {translate('next')}
          </Button>
        </div>
      )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3.5 border-b-2 border-indigo-200 bg-indigo-50/80 rounded-t-lg">
                  <span className="text-base font-bold text-indigo-900">{translate('brands')}</span>
                  <button
                    type="button"
                    onClick={() => { setEditingBrand(null); setBrandName(''); setShowBrandDialog(true); }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {translate('addBrand')}
                  </button>
                </div>
                <div className="px-3 py-1.5 border-b border-gray-200 bg-white">
                  <div className="flex items-center gap-2 w-[90px] h-6 rounded-md border border-gray-200 bg-gray-50 px-2 transition-colors focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 focus-within:bg-white">
                    <Search className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={translate('search')}
                      value={brandSearchTerm}
                      onChange={(e) => setBrandSearchTerm(e.target.value)}
                      className="flex-1 min-w-0 h-full border-0 bg-transparent p-0 text-[10px] text-gray-700 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="divide-y divide-gray-200 bg-white">
                  {(brandSearchTerm.trim() ? brands.filter(b => b.name.toLowerCase().includes(brandSearchTerm.trim().toLowerCase())) : brands).length === 0 ? (
                    <p className="px-4 py-8 text-sm text-gray-500 text-center">{brandSearchTerm.trim() ? translate('noResults') : translate('noBrands')}</p>
                  ) : (
                    (brandSearchTerm.trim() ? brands.filter(b => b.name.toLowerCase().includes(brandSearchTerm.trim().toLowerCase())) : brands).map((b) => (
                      <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 group">
                        <span className="text-sm font-medium text-gray-900">{b.name}</span>
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${b.isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                            {b.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                          </span>
                          <button type="button" onClick={() => { setEditingBrand(b); setBrandName(b.name); setShowBrandDialog(true); }} className="p-1.5 rounded-md text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50" aria-label={translate('edit')}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button type="button" className="p-1.5 rounded-md hover:bg-gray-100" aria-label="Activar/Desactivar">
                                {b.isActive ? <PowerOff className="h-3.5 w-3.5 text-red-500 hover:text-red-600" /> : <Power className="h-3.5 w-3.5 text-green-600 hover:text-green-700" />}
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{b.isActive ? translate('deactivate') : translate('activate')} {translate('brands').toLowerCase()}</AlertDialogTitle>
                                <AlertDialogDescription>{translate('confirmDeactivateBrand').replace('{name}', b.name)}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleToggleBrand(b)}>{translate('confirm')}</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3.5 border-b-2 border-indigo-200 bg-indigo-50/80 rounded-t-lg">
                  <span className="text-base font-bold text-indigo-900">{translate('categories')}</span>
                  <button
                    type="button"
                    onClick={() => { setEditingCategory(null); setCategoryName(''); setShowCategoryDialog(true); }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {translate('addCategory')}
                  </button>
                </div>
                <div className="px-3 py-1.5 border-b border-gray-200 bg-white">
                  <div className="flex items-center gap-2 w-[90px] h-6 rounded-md border border-gray-200 bg-gray-50 px-2 transition-colors focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 focus-within:bg-white">
                    <Search className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={translate('search')}
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      className="flex-1 min-w-0 h-full border-0 bg-transparent p-0 text-[10px] text-gray-700 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="divide-y divide-gray-200 bg-white">
                  {(categorySearchTerm.trim() ? categories.filter(c => c.name.toLowerCase().includes(categorySearchTerm.trim().toLowerCase())) : categories).length === 0 ? (
                    <p className="px-4 py-8 text-sm text-gray-500 text-center">{categorySearchTerm.trim() ? translate('noResults') : translate('noCategories')}</p>
                  ) : (
                    (categorySearchTerm.trim() ? categories.filter(c => c.name.toLowerCase().includes(categorySearchTerm.trim().toLowerCase())) : categories).map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 group">
                        <span className="text-sm font-medium text-gray-900">{c.name}</span>
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${c.isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                            {c.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                          </span>
                          <button type="button" onClick={() => { setEditingCategory(c); setCategoryName(c.name); setShowCategoryDialog(true); }} className="p-1.5 rounded-md text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50" aria-label={translate('edit')}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button type="button" className="p-1.5 rounded-md hover:bg-gray-100" aria-label="Activar/Desactivar">
                                {c.isActive ? <PowerOff className="h-3.5 w-3.5 text-red-500 hover:text-red-600" /> : <Power className="h-3.5 w-3.5 text-green-600 hover:text-green-700" />}
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{c.isActive ? translate('deactivate') : translate('activate')} {translate('categories').toLowerCase()}</AlertDialogTitle>
                                <AlertDialogDescription>{translate('confirmDeactivateCategory').replace('{name}', c.name)}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleToggleCategory(c)}>{translate('confirm')}</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Product Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{translate('productDetails')}</DialogTitle>
            <DialogDescription>
              {translate('productInfoDescription')}
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
                        {selectedProduct.isActive ? translate('active') : translate('inactive')}
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
                          {(selectedProduct.currentPrice || 0).toLocaleString(locale, { 
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
                    <Label className="text-sm font-medium text-gray-500">{translate('categoryHeader')}</Label>
                    <p className="flex items-center gap-1">
                      <Tag className="h-4 w-4 text-gray-400" />
                      {getCategoryName(selectedProduct)}
                    </p>
                  </div>
                  {selectedProduct.brandId && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{translate('brandHeader')}</Label>
                      <p className="flex items-center gap-1">
                        {brands.find(b => b.id === selectedProduct.brandId)?.name ?? '-'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          )}
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{translate('close')}</Button>
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
                {translate('edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Price Dialog */}
      <Dialog open={showUpdatePriceDialog} onOpenChange={setShowUpdatePriceDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{translate('updatePriceTitle')}</DialogTitle>
            <DialogDescription>
              {selectedProduct && translate('updatePriceDesc').replace('{name}', selectedProduct.name)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 px-6 py-4">
            {selectedProduct && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{translate('currentPrice')}:</p>
                <p className="text-lg font-semibold text-green-600">
                  ${(selectedProduct.currentPrice || 0).toLocaleString(locale, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="newPrice">{translate('newPriceLabel')}</Label>
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
                {translate('cancel')}
              </Button>
            </DialogClose>
            <Button onClick={handleUpdatePrice} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              {translate('updatePrice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={showPriceHistoryDialog} onOpenChange={setShowPriceHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{translate('priceHistoryTitle')}</DialogTitle>
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
                    <span className="text-sm font-medium">{translate('currentPrice')}:</span>
                    <span className="text-lg font-bold text-green-600">
                      ${(selectedProduct.currentPrice || 0).toLocaleString(locale, { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                  
                  <div className="flex-1"></div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{translate('queryDateLabel')}</span>
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
                    <span className="text-sm text-blue-700">{translate('priceOnDate').replace('{date}', queryDate)}</span>
                    <span className="ml-2 font-bold text-blue-900">
                      ${queryResult.price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="ml-2 text-xs text-blue-600">
                      (vigente desde {new Date(queryResult.startDate).toLocaleDateString(locale)})
                    </span>
                  </div>
                )}

                {queryDate && !queryResult && (
                  <div className="mt-3 p-3 bg-amber-50 rounded border-l-4 border-amber-400">
                    <span className="text-sm text-amber-700">
                      {translate('noPriceForDate')}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Historial */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{translate('fullHistory')}</span>
                    <Badge variant="outline" className="text-xs">
                      {priceHistoryList.length} {translate('records')}
                    </Badge>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {priceHistoryList.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">{translate('noPriceHistory')}</p>
                    </div>
                  ) : (
                    <div>
                      {priceHistoryList.map((history, index) => (
                        <div key={history.id} className="px-4 py-3 border-b last:border-b-0 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-gray-900">
                                ${history.price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {index === 0 && (
                                <Badge className="bg-green-100 text-green-800 text-xs">{translate('currentBadge')}</Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(history.startDate).toLocaleDateString(locale, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                              {' – '}
                              {new Date(history.endDate).toLocaleDateString(locale, {
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
              {translate('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brand dialog */}
      <Dialog open={showBrandDialog} onOpenChange={setShowBrandDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBrand ? translate('editBrand') : translate('newBrand')}</DialogTitle>
            <DialogDescription>{editingBrand ? translate('editBrandDesc') : translate('newBrandDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <Label htmlFor="brandName">{translate('name')} *</Label>
            <Input
              id="brandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Ej. Acme"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBrandDialog(false); setBrandName(''); setEditingBrand(null); }}>{translate('cancel')}</Button>
            <Button onClick={handleSaveBrand} className="bg-indigo-600 hover:bg-indigo-700">{translate('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? translate('editCategory') : translate('newCategory')}</DialogTitle>
            <DialogDescription>{editingCategory ? translate('editCategoryDesc') : translate('newCategoryDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <Label htmlFor="categoryName">{translate('name')} *</Label>
            <Input
              id="categoryName"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Ej. Bebidas"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCategoryDialog(false); setCategoryName(''); setEditingCategory(null); }}>{translate('cancel')}</Button>
            <Button onClick={handleSaveCategory} className="bg-indigo-600 hover:bg-indigo-700">{translate('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
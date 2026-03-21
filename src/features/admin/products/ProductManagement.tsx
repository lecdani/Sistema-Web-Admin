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
  Award,
  FolderTree,
  ImagePlus
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
import { uploadImage } from '@/shared/services/images-api';
import { getBackendAssetUrl } from '@/shared/config/api';
import { toast } from '@/shared/components/base/Toast';

interface ProductManagementProps {
  onBack?: () => void;
}

interface ProductFormData {
  /** Código del producto (obligatorio). */
  code: string;
  name: string;
  category: string;
  brandId: string;
  categoryId: string;
  isActive: boolean;
  /** Nombre del archivo en S3 (tras subir). Se envía en create/update. */
  imageFileName?: string;
  /** URL para mostrar preview (object URL del archivo seleccionado o product.image al editar) */
  imagePreviewUrl?: string;
}

interface PriceUpdateData {
  price: number;
}

interface FamilyFormData {
  name: string;
  code: string;
  sku: string;
  volume: string;
  unit: string;
}
interface FamilyFormErrors {
  name?: string;
  code?: string;
  sku?: string;
  volume?: string;
  unit?: string;
}

/** Clave estable para mapa precio↔familia (evita fallos string vs number en ids). */
function familyPriceKey(id: string | number | undefined | null): string {
  return String(id ?? '').trim();
}

/** Código comercial del producto (prioriza `code`, luego `sku`). */
function getProductCodeDisplay(p: Product): string {
  const s = String(p.code || p.sku || '').trim();
  return s || '—';
}

/** Texto de volumen/unidad de familia; `null` si no hay nada que mostrar. */
function formatFamilyVolumeLine(category: Category): string | null {
  const rawVol = (category as any).volume;
  const unit = String((category as any).unit ?? '').trim();
  let volPart: string | null = null;
  if (rawVol != null && String(rawVol).trim() !== '') {
    const n = Number(rawVol);
    volPart = Number.isFinite(n) ? String(n) : String(rawVol).trim();
  }
  if (!unit && !volPart) return null;
  if (volPart && unit) return `Vol: ${volPart} ${unit}`.trim();
  if (volPart) return `Vol: ${volPart}`;
  if (unit) return unit;
  return null;
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
  const [familyForm, setFamilyForm] = useState<FamilyFormData>({
    name: '',
    code: '',
    sku: '',
    volume: '',
    unit: ''
  });
  const [familyFormErrors, setFamilyFormErrors] = useState<FamilyFormErrors>({});
  const [brandSearchTerm, setBrandSearchTerm] = useState('');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  /** Precio vigente por id de familia (histprices latest). */
  const [familyLatestPrices, setFamilyLatestPrices] = useState<Record<string, number>>({});
  /** Familia seleccionada para diálogos de precio / historial. */
  const [selectedFamilyForPrice, setSelectedFamilyForPrice] = useState<Category | null>(null);

  const [formData, setFormData] = useState<ProductFormData>({
    code: '',
    name: '',
    category: '',
    brandId: '',
    categoryId: '',
    isActive: true
  });
  const PENDING_IMAGE_KEY = 'product-create-pending-imageFileName';
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastUploadedFileNameRef = React.useRef<string | undefined>(undefined);
  const isUploadingRef = React.useRef(false);
  const getPendingImageFileName = (): string | undefined => {
    const fromRef = lastUploadedFileNameRef.current?.trim();
    if (fromRef) return fromRef;
    const fromStorage = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PENDING_IMAGE_KEY) : null;
    return fromStorage ? String(fromStorage).trim() || undefined : undefined;
  };
  const clearPendingImageFileName = () => {
    lastUploadedFileNameRef.current = undefined;
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(PENDING_IMAGE_KEY);
  };
  const setPendingImageFileName = (fileName: string) => {
    lastUploadedFileNameRef.current = fileName;
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(PENDING_IMAGE_KEY, fileName);
  };

  const [priceUpdateData, setPriceUpdateData] = useState<PriceUpdateData>({
    price: 0
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<'code' | 'name' | 'brandId' | 'categoryId', string>>>({});

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchTerm, statusFilter, categoryFilter]);

  const loadProducts = async (opts?: {
    /** Sin pantalla de carga completa (p. ej. tras actualizar precio). */
    quiet?: boolean;
    /** Forzar precio mostrado tras crear histórico (getLatest a veces llega tarde). */
    forceFamilyPrice?: { familyId: string; price: number };
  }) => {
    const quiet = opts?.quiet === true;
    if (!quiet) {
      setIsLoading(true);
      setLoadError(null);
    }

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
      if (!quiet) setIsLoading(false);
      return;
    }

    const list = productsResult.value;
    const catList = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
    try {
      const familyIdsToFetch = new Set<string>();
      catList.forEach((c) => familyIdsToFetch.add(familyPriceKey(c.id)));
      list.forEach((p) => {
        const fid = familyPriceKey((p as any).familyId ?? p.categoryId);
        if (fid) familyIdsToFetch.add(fid);
      });
      const familyPriceMap: Record<string, number> = {};
      await Promise.all(
        [...familyIdsToFetch].map(async (id) => {
          try {
            const latest = await histpricesApi.getLatest(id);
            familyPriceMap[id] = latest?.price ?? 0;
          } catch {
            familyPriceMap[id] = 0;
          }
        })
      );
      const forced = opts?.forceFamilyPrice;
      const forcedKey = forced ? familyPriceKey(forced.familyId) : '';
      if (forcedKey && Number.isFinite(Number(forced!.price)) && Number(forced!.price) > 0) {
        familyPriceMap[forcedKey] = Number(forced!.price);
      }
      setFamilyLatestPrices(familyPriceMap);
      const withPrices = list.map((p) => {
        const familyId = familyPriceKey((p as any).familyId ?? p.categoryId);
        return { ...p, currentPrice: familyId ? familyPriceMap[familyId] ?? 0 : 0 };
      });
      setProducts(withPrices);
    } catch {
      setFamilyLatestPrices({});
      setProducts(list.map((p) => ({ ...p, currentPrice: 0 })));
    } finally {
      if (!quiet) setIsLoading(false);
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
          (product.code ?? '').toLowerCase().includes(searchLower) ||
          (product.sku ?? '').toLowerCase().includes(searchLower) ||
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
    if (formData.imagePreviewUrl && formData.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(formData.imagePreviewUrl);
    }
    clearPendingImageFileName();
    setFormData({
      code: '',
      name: '',
      category: '',
      brandId: '',
      categoryId: '',
      isActive: true
    });
    setFormErrors({});
    setEditingProduct(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const resetPriceForm = () => {
    setPriceUpdateData({ price: 0 });
  };

  const validateForm = (): boolean => {
    const err: Partial<Record<'code' | 'name' | 'brandId' | 'categoryId', string>> = {};
    if (!formData.code.trim()) err.code = translate('productCodeRequired');
    if (!formData.name.trim()) err.name = translate('nameRequired');
    if (!formData.brandId) err.brandId = translate('brandRequired');
    if (!formData.categoryId) err.categoryId = translate('familyRequired');
    const codeNorm = formData.code.trim().toLowerCase();
    if (codeNorm) {
      const dup = products.find(
        (p) =>
          String(p.code ?? '').trim().toLowerCase() === codeNorm &&
          (!editingProduct || p.id !== editingProduct.id)
      );
      if (dup) err.code = translate('duplicateProductCode');
    }
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSaveProduct = async () => {
    if (!validateForm()) {
      let firstError = '';
      const codeTrim = formData.code.trim();
      const codeNorm = codeTrim.toLowerCase();
      if (!codeTrim) firstError = translate('productCodeRequired');
      else if (
        products.some(
          (p) =>
            String(p.code ?? '').trim().toLowerCase() === codeNorm &&
            (!editingProduct || p.id !== editingProduct.id)
        )
      ) {
        firstError = translate('duplicateProductCode');
      } else if (!formData.name.trim()) firstError = translate('nameRequired');
      else if (!formData.brandId) firstError = translate('brandRequired');
      else if (!formData.categoryId) firstError = translate('familyRequired');
      if (!firstError) firstError = translate('completeRequiredFields');
      toast.error(firstError);
      return;
    }
    try {
      const familyId = formData.categoryId || undefined;
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        brandId: formData.brandId || undefined,
        familyId,
        categoryId: familyId,
        isActive: editingProduct ? editingProduct.isActive : true,
      };
      if (editingProduct) {
        const imageForUpdate = formData.imageFileName?.trim() || lastUploadedFileNameRef.current?.trim() || undefined;
        const currentFamilyId = String((editingProduct as any).familyId ?? editingProduct.categoryId ?? '').trim();
        const nextFamilyId = String(familyId ?? '').trim();
        const currentBrandId = String(editingProduct.brandId ?? '').trim();
        const nextBrandId = String(formData.brandId ?? '').trim();
        const currentName = String(editingProduct.name ?? '').trim();
        const nextName = String(formData.name ?? '').trim();
        const currentCode = String(editingProduct.code ?? '').trim();
        const nextCode = String(formData.code ?? '').trim();
        const hasChanges =
          currentName !== nextName ||
          currentCode !== nextCode ||
          currentBrandId !== nextBrandId ||
          currentFamilyId !== nextFamilyId ||
          !!imageForUpdate;
        if (!hasChanges) {
          toast.error(translate('noChangesToSave'));
          return;
        }
        if (imageForUpdate) payload.imageFileName = imageForUpdate;
        await productsApi.update(editingProduct.id, payload as any);
        toast.success(translate('productSaved'));
      } else {
        const imageFileNameForCreate = getPendingImageFileName() || formData.imageFileName?.trim() || undefined;
        if (imageFileNameForCreate) {
          payload.imageFileName = imageFileNameForCreate;
          payload.ImageFileName = imageFileNameForCreate;
        }
        const created = await productsApi.create(
          { ...payload } as any,
          imageFileNameForCreate
        );
        clearPendingImageFileName();
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

  const refreshOneFamilyPrice = async (familyId: string) => {
    const id = familyPriceKey(familyId);
    if (!id) return;
    try {
      const latest = await histpricesApi.getLatest(id);
      setFamilyLatestPrices((prev) => ({ ...prev, [id]: latest?.price ?? 0 }));
    } catch {
      setFamilyLatestPrices((prev) => ({ ...prev, [id]: 0 }));
    }
  };

  const handleUpdatePrice = async () => {
    const family = selectedFamilyForPrice;
    if (!family?.id) return;
    if (priceUpdateData.price <= 0) {
      toast.error(translate('priceMustBePositive'));
      return;
    }
    try {
      const now = new Date();
      const fid = familyPriceKey(family.id);
      const created = await histpricesApi.create({
        familyId: fid,
        price: priceUpdateData.price,
        startDate: now,
        endDate: now
      });
      const fromApi = Number(created?.price);
      const finalPrice =
        Number.isFinite(fromApi) && fromApi > 0 ? fromApi : priceUpdateData.price;

      setFamilyLatestPrices((prev) => ({ ...prev, [fid]: finalPrice }));
      setProducts((prev) =>
        prev.map((p) => {
          const pid = familyPriceKey((p as any).familyId ?? p.categoryId);
          return pid === fid ? { ...p, currentPrice: finalPrice } : p;
        })
      );

      toast.success(translate('priceUpdatedSuccess'));
      resetPriceForm();
      setShowUpdatePriceDialog(false);
      setSelectedFamilyForPrice(null);

      await loadProducts({
        quiet: true,
        forceFamilyPrice: { familyId: fid, price: finalPrice },
      });
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? translate('errorUpdatePrice');
      toast.error(msg);
    }
  };

  const loadPriceHistoryForDialog = async (familyId: string) => {
    try {
      const list = await histpricesApi.getByFamily(familyId);
      setPriceHistoryList(list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    } catch {
      setPriceHistoryList([]);
    }
  };

  useEffect(() => {
    if (queryDate && selectedFamilyForPrice?.id) {
      histpricesApi
        .getByDate(selectedFamilyForPrice.id, queryDate)
        .then(setQueryResult)
        .catch(() => setQueryResult(null));
    } else {
      setQueryResult(null);
    }
  }, [queryDate, selectedFamilyForPrice?.id]);

  const resetQueryForm = () => {
    setQueryDate('');
    setQueryResult(null);
  };

  const handleEditProduct = (product: Product) => {
    const categoryId =
      product.categoryId ??
      product.familyId ??
      categories.find((c) => c.name === product.category)?.id ??
      '';
    setFormData({
      code: product.code ?? '',
      name: product.name,
      category: product.category ?? '',
      brandId: product.brandId ?? '',
      categoryId,
      isActive: product.isActive,
      imageFileName: undefined,
      imagePreviewUrl: product.image ? getBackendAssetUrl(product.image) : undefined
    });
    setFormErrors({});
    setEditingProduct(product);
    setShowAddDialog(true);
    if (imageInputRef.current) imageInputRef.current.value = '';
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
    const id = product.categoryId ?? product.familyId;
    if (id != null && String(id).trim() !== '') {
      const sid = String(id).trim();
      const match = categories.find((c) => String(c.id).trim() === sid);
      if (match?.name) return match.name;
    }
    return (product.category && product.category.trim()) || '-';
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
    const errors: FamilyFormErrors = {};
    const name = familyForm.name.trim();
    if (!name) {
      errors.name = translate('familyNameRequired');
    }
    if (!familyForm.code.trim()) {
      errors.code = translate('familyCodeRequired');
    }
    if (!familyForm.sku.trim()) {
      errors.sku = translate('familySkuRequired');
    }
    if (Object.keys(errors).length > 0) {
      setFamilyFormErrors(errors);
      toast.error(Object.values(errors)[0] || translate('completeRequiredFields'));
      return;
    }
    const volumeNumber = familyForm.volume.trim() ? Number(familyForm.volume) : 0;
    if (familyForm.volume.trim() && (!Number.isFinite(volumeNumber) || volumeNumber <= 0)) {
      setFamilyFormErrors((prev) => ({ ...prev, volume: translate('familyVolumeInvalid') }));
      toast.error(translate('familyVolumeInvalid'));
      return;
    }
    const payload = {
      name,
      code: familyForm.code.trim(),
      sku: familyForm.sku.trim(),
      volume: volumeNumber,
      unit: familyForm.unit.trim(),
    };
    const sku = payload.sku;
    const code = payload.code;
    if (!/^\d{6}$/.test(sku)) {
      setFamilyFormErrors((prev) => ({ ...prev, sku: translate('familySkuMustBe6Digits') }));
      toast.error(translate('familySkuMustBe6Digits'));
      return;
    }
    if (!/^\d{4}$/.test(code)) {
      setFamilyFormErrors((prev) => ({ ...prev, code: translate('familyCodeMustBe4Digits') }));
      toast.error(translate('familyCodeMustBe4Digits'));
      return;
    }
    const normalizedSku = sku.trim();
    const normalizedCode = code.trim();
    const isDuplicateSku = categories.some(
      (c) => String((c as any).sku ?? '').trim() === normalizedSku && (!editingCategory || c.id !== editingCategory.id)
    );
    if (isDuplicateSku) {
      setFamilyFormErrors((prev) => ({ ...prev, sku: translate('duplicateFamilySku') }));
      toast.error(translate('duplicateFamilySku'));
      return;
    }
    const isDuplicateCode = categories.some(
      (c) => String((c as any).code ?? '').trim() === normalizedCode && (!editingCategory || c.id !== editingCategory.id)
    );
    if (isDuplicateCode) {
      setFamilyFormErrors((prev) => ({ ...prev, code: translate('duplicateFamilyCode') }));
      toast.error(translate('duplicateFamilyCode'));
      return;
    }
    setFamilyFormErrors({});
    try {
      if (editingCategory) {
        const currentName = String(editingCategory.name ?? '').trim();
        const currentCode = String((editingCategory as any).code ?? '').trim();
        const currentSku = String((editingCategory as any).sku ?? '').trim();
        const currentVolumeRaw = Number((editingCategory as any).volume ?? 0);
        const currentVolume = Number.isFinite(currentVolumeRaw) ? currentVolumeRaw : 0;
        const currentUnit = String((editingCategory as any).unit ?? '').trim();
        const hasChanges =
          currentName !== payload.name ||
          currentCode !== payload.code ||
          currentSku !== payload.sku ||
          currentVolume !== payload.volume ||
          currentUnit !== payload.unit;
        if (!hasChanges) {
          toast.error(translate('noChangesToSave'));
          return;
        }
        const updated = await categoriesApi.update(editingCategory.id, payload as any);
        setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? updated : c)));
        await refreshOneFamilyPrice(editingCategory.id);
        toast.success(translate('familyUpdated'));
      } else {
        const created = await categoriesApi.create(payload as any);
        setCategories((prev) => [...prev, created]);
        await refreshOneFamilyPrice(created.id);
        toast.success(translate('familyCreated'));
        setCategorySearchTerm(created.name);
      }
      setFamilyForm({ name: '', code: '', sku: '', volume: '', unit: '' });
      setFamilyFormErrors({});
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
      toast.success(category.isActive ? translate('familyDeactivated') : translate('familyActivated'));
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
                <Label htmlFor="productCode">{translate('productCode')} *</Label>
                <Input
                  id="productCode"
                  value={formData.code}
                  onChange={(e) => {
                    setFormData({ ...formData, code: e.target.value });
                    if (formErrors.code) setFormErrors(prev => ({ ...prev, code: undefined }));
                  }}
                  className={formErrors.code ? 'border-red-500' : ''}
                  placeholder={translate('productCodePlaceholder')}
                />
                {formErrors.code && <p className="text-sm text-red-600">{formErrors.code}</p>}
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
                <Label>{translate('family')} *</Label>
                <Select
                  value={formData.categoryId || undefined}
                  onValueChange={(v) => {
                    setFormData({ ...formData, categoryId: v });
                    if (formErrors.categoryId) setFormErrors(prev => ({ ...prev, categoryId: undefined }));
                  }}
                >
                  <SelectTrigger className={formErrors.categoryId ? 'border-red-500' : ''}>
                    <SelectValue placeholder={translate('selectFamily')}>
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
                  <p className="text-xs text-amber-600">{translate('addFamiliesFirst')}</p>
                )}
                {formData.categoryId && (
                  <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    {(() => {
                      const selectedFamily = categories.find((c) => c.id === formData.categoryId);
                      if (!selectedFamily) return null;
                      return (
                        <div className="text-sm text-indigo-900 font-medium space-y-1">
                          <div>
                            {[
                              `SKU: ${(selectedFamily as any).sku || '—'}`,
                              `${translate('familyCodeLabel')}: ${(selectedFamily as any).code || '—'}`,
                              selectedFamily.name || '—',
                              formatFamilyVolumeLine(selectedFamily),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          <div className="flex items-center gap-1 text-green-700">
                            <DollarSign className="h-4 w-4 shrink-0" />
                            <span>
                              {translate('currentPrice')}:{' '}
                              {(familyLatestPrices[familyPriceKey(selectedFamily.id)] ?? 0).toLocaleString(locale, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <p className="text-xs font-normal text-indigo-700/90">{translate('productPriceFamilyHint')}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>{translate('productImage')}</Label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (isUploadingRef.current) return;
                    isUploadingRef.current = true;
                    setUploadingImage(true);
                    const objectUrl = URL.createObjectURL(file);
                    setFormData(prev => ({ ...prev, imagePreviewUrl: objectUrl }));
                    try {
                      const { fileName } = await uploadImage(file);
                      setPendingImageFileName(fileName);
                      setFormData(prev => ({
                        ...prev,
                        imageFileName: fileName,
                        imagePreviewUrl: objectUrl
                      }));
                      toast.success(translate('imageUploaded'));
                    } catch (err: any) {
                      clearPendingImageFileName();
                      setFormData(prev => ({ ...prev, imageFileName: undefined }));
                      const msg = err?.data?.message ?? err?.message ?? translate('errorUploadImage');
                      toast.error(msg);
                    } finally {
                      isUploadingRef.current = false;
                      setUploadingImage(false);
                    }
                  }}
                />
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 size-28 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden">
                    {(formData.imagePreviewUrl || formData.imageFileName) ? (
                      <div className="relative size-full">
                        <img
                          src={formData.imagePreviewUrl ?? (editingProduct?.image ? getBackendAssetUrl(editingProduct.image) : '')}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                        />
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">{translate('uploading')}</span>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="absolute top-1 right-1 h-7 w-7 rounded-full bg-white shadow border-gray-300 hover:bg-gray-100"
                          onClick={() => {
                            if (formData.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(formData.imagePreviewUrl);
                            clearPendingImageFileName();
                            setFormData(prev => ({ ...prev, imageFileName: undefined, imagePreviewUrl: undefined }));
                            if (imageInputRef.current) imageInputRef.current.value = '';
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center p-2 text-gray-400">
                        <ImagePlus className="h-10 w-10 mx-auto mb-1 opacity-60" />
                        <span className="text-xs block">{translate('noImageSelected')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      <ImagePlus className="h-4 w-4 mr-2" />
                      {uploadingImage ? translate('uploading') : (formData.imagePreviewUrl || formData.imageFileName) ? translate('changeImage') : translate('selectImage')}
                    </Button>
                    <p className="text-xs text-gray-500">{translate('productImageHint')}</p>
                    {(formData.imageFileName && !uploadingImage) && (
                      <p className="text-xs text-green-600 font-medium">{translate('imageReadyToSave')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={resetForm}>
                  {translate('cancel')}
                </Button>
              </DialogClose>
              <Button
                onClick={handleSaveProduct}
                disabled={uploadingImage}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {uploadingImage ? translate('uploading') : (editingProduct ? translate('update') : translate('create'))}
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
                <p className="text-xs font-medium text-gray-500">{translate('families')}</p>
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
                    {translate('productNameCodeHeader')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('brandHeader')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('family')}
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
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                          {product.image ? (
                            <img src={getBackendAssetUrl(product.image)} alt="" className="w-12 h-12 object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-indigo-600" />
                          )}
                        </div>
                        <div className="ml-4 min-w-0">
                          <div className="text-base font-bold text-indigo-950 flex items-center gap-1.5 tracking-tight">
                            <Hash className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span className="truncate font-mono tabular-nums">{getProductCodeDisplay(product)}</span>
                          </div>
                          <div className="text-sm text-gray-500 truncate mt-0.5" title={product.name}>
                            {product.name}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center cursor-default max-w-[140px]">
                            <DollarSign className="h-4 w-4 text-green-600 mr-1 shrink-0" />
                            <span className="text-sm font-medium text-green-600 truncate">
                              {(product.currentPrice || 0).toLocaleString(locale, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{translate('productPriceFamilyHint')}</p>
                        </TooltipContent>
                      </Tooltip>
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
                  <span className="text-base font-bold text-indigo-900">{translate('families')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setFamilyForm({ name: '', code: '', sku: '', volume: '', unit: '' });
                      setFamilyFormErrors({});
                      setShowCategoryDialog(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {translate('addFamily')}
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
                    <p className="px-4 py-8 text-sm text-gray-500 text-center">{categorySearchTerm.trim() ? translate('noResults') : translate('noFamilies')}</p>
                  ) : (
                    (categorySearchTerm.trim() ? categories.filter(c => c.name.toLowerCase().includes(categorySearchTerm.trim().toLowerCase())) : categories).map((c) => {
                      const familyVolLine = formatFamilyVolumeLine(c);
                      return (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 group gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-sm font-semibold text-gray-900">{`SKU: ${(c as any).sku || '—'}`}</span>
                            <span className="text-sm font-semibold text-gray-900">{`${translate('familyCodeLabel')}: ${(c as any).code || '—'}`}</span>
                            <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                          </div>
                          {familyVolLine ? (
                            <span className="text-xs text-gray-500 block truncate">{familyVolLine}</span>
                          ) : null}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs font-medium text-green-700 flex items-center gap-0.5">
                              <DollarSign className="h-3 w-3" />
                              {(familyLatestPrices[familyPriceKey(c.id)] ?? 0).toLocaleString(locale, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFamilyForPrice(c);
                                    setPriceUpdateData({ price: familyLatestPrices[familyPriceKey(c.id)] ?? 0 });
                                    setShowUpdatePriceDialog(true);
                                  }}
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                  aria-label={translate('updatePrice')}
                                >
                                  <TrendingUp className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{translate('updatePrice')}</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFamilyForPrice(c);
                                    resetQueryForm();
                                    loadPriceHistoryForDialog(c.id);
                                    setShowPriceHistoryDialog(true);
                                  }}
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                                  aria-label={translate('priceHistoryTooltip')}
                                >
                                  <History className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{translate('priceHistoryTooltip')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 shrink-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${c.isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                            {c.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                          </span>
                          <button type="button" onClick={() => {
                            setEditingCategory(c);
                            setFamilyForm({
                              name: c.name ?? '',
                              code: String((c as any).code ?? ''),
                              sku: String((c as any).sku ?? ''),
                              volume: (c as any).volume != null ? String((c as any).volume) : '',
                              unit: String((c as any).unit ?? '')
                            });
                            setFamilyFormErrors({});
                            setShowCategoryDialog(true);
                          }} className="p-1.5 rounded-md text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50" aria-label={translate('edit')}>
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
                                <AlertDialogTitle>{c.isActive ? translate('deactivate') : translate('activate')} {translate('family').toLowerCase()}</AlertDialogTitle>
                                <AlertDialogDescription>{translate('confirmToggleFamily').replace('{action}', c.isActive ? translate('deactivate') : translate('activate')).replace('{name}', c.name)}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleToggleCategory(c)}>{translate('confirm')}</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Product Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-md rounded-xl overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{translate('productDetails')}</DialogTitle>
            <DialogDescription>
              {translate('productInfoDescription')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="px-6 pb-6 space-y-5">
              <div className="flex gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                  {selectedProduct.image ? (
                    <img
                      src={getBackendAssetUrl(selectedProduct.image)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-9 w-9 text-indigo-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-1.5 min-w-0">
                      <Hash className="h-5 w-5 text-indigo-600 shrink-0" />
                      <span className="truncate font-mono tabular-nums">{getProductCodeDisplay(selectedProduct)}</span>
                    </h3>
                    <Badge className={getStatusBadgeColor(selectedProduct.isActive)}>
                      {selectedProduct.isActive ? translate('active') : translate('inactive')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 truncate" title={selectedProduct.name}>
                    {selectedProduct.name}
                  </p>
                  <div className="flex items-center gap-1 text-green-600 font-semibold text-base pt-0.5">
                    <DollarSign className="h-4 w-4 shrink-0" />
                    {(selectedProduct.currentPrice || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 rounded-xl bg-gray-50/80 border border-gray-100 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{translate('family')}</p>
                  <p className="flex items-center gap-1.5 mt-1 text-sm font-medium text-gray-900 truncate">
                    <Tag className="h-4 w-4 text-gray-400 shrink-0" />
                    {getCategoryName(selectedProduct)}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{translate('brandHeader')}</p>
                  <p className="flex items-center gap-1.5 mt-1 text-sm font-medium text-gray-900 truncate">
                    <Award className="h-4 w-4 text-gray-400 shrink-0" />
                    {brands.find(b => b.id === selectedProduct.brandId)?.name ?? '-'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="border-t border-gray-200 bg-gray-50/50 px-6 py-4 mt-0 rounded-b-xl">
            <div className="flex justify-between items-center w-full gap-3">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Price Dialog (por familia) */}
      <Dialog
        open={showUpdatePriceDialog}
        onOpenChange={(open) => {
          setShowUpdatePriceDialog(open);
          if (!open) {
            resetPriceForm();
            setSelectedFamilyForPrice(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{translate('updatePriceTitle')}</DialogTitle>
            <DialogDescription>
              {selectedFamilyForPrice &&
                translate('updatePriceDescFamily').replace('{name}', selectedFamilyForPrice.name)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 px-6 py-4">
            {selectedFamilyForPrice && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{translate('currentPrice')}:</p>
                <p className="text-lg font-semibold text-green-600">
                  ${(familyLatestPrices[familyPriceKey(selectedFamilyForPrice.id)] ?? 0).toLocaleString(locale, { 
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

      {/* Price History Dialog (por familia) */}
      <Dialog
        open={showPriceHistoryDialog}
        onOpenChange={(open) => {
          setShowPriceHistoryDialog(open);
          if (!open) {
            resetQueryForm();
            setSelectedFamilyForPrice(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{translate('priceHistoryTitle')}</DialogTitle>
            <DialogDescription>
              {selectedFamilyForPrice &&
                translate('priceHistoryDescFamily').replace('{name}', selectedFamilyForPrice.name)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedFamilyForPrice && (
            <div className="space-y-4">
              {/* Barra de filtros style */}
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{translate('currentPrice')}:</span>
                    <span className="text-lg font-bold text-green-600">
                      ${(familyLatestPrices[familyPriceKey(selectedFamilyForPrice.id)] ?? 0).toLocaleString(locale, { 
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
                setSelectedFamilyForPrice(null);
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

      {/* Family dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? translate('editFamily') : translate('newFamily')}</DialogTitle>
            <DialogDescription>{editingCategory ? translate('editFamilyDesc') : translate('newFamilyDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <Label htmlFor="familyName">{translate('name')} *</Label>
            <Input
              id="familyName"
              value={familyForm.name}
              onChange={(e) => {
                setFamilyForm((prev) => ({ ...prev, name: e.target.value }));
                if (familyFormErrors.name) setFamilyFormErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="Ej. Bebidas"
              className={familyFormErrors.name ? 'border-red-500' : ''}
            />
            {familyFormErrors.name && <p className="text-sm text-red-600">{familyFormErrors.name}</p>}
            <Label htmlFor="familyCode">{translate('familyCodeLabel')} *</Label>
            <Input
              id="familyCode"
              value={familyForm.code}
              onChange={(e) => {
                setFamilyForm((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, '').slice(0, 4) }));
                if (familyFormErrors.code) setFamilyFormErrors((prev) => ({ ...prev, code: undefined }));
              }}
              placeholder="Ej. 1234"
              inputMode="numeric"
              maxLength={4}
              required
              className={familyFormErrors.code ? 'border-red-500' : ''}
            />
            {familyFormErrors.code && <p className="text-sm text-red-600">{familyFormErrors.code}</p>}
            <Label htmlFor="familySku">{translate('familySkuLabel')} *</Label>
            <Input
              id="familySku"
              value={familyForm.sku}
              onChange={(e) => {
                setFamilyForm((prev) => ({ ...prev, sku: e.target.value.replace(/\D/g, '').slice(0, 6) }));
                if (familyFormErrors.sku) setFamilyFormErrors((prev) => ({ ...prev, sku: undefined }));
              }}
              placeholder="Ej. 123456"
              inputMode="numeric"
              maxLength={6}
              required
              className={familyFormErrors.sku ? 'border-red-500' : ''}
            />
            {familyFormErrors.sku && <p className="text-sm text-red-600">{familyFormErrors.sku}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
            <Label htmlFor="familyVolume">{translate('familyVolumeLabel')}</Label>
                <Input
                  id="familyVolume"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={familyForm.volume}
                  onChange={(e) => {
                    setFamilyForm((prev) => ({ ...prev, volume: e.target.value }));
                    if (familyFormErrors.volume) setFamilyFormErrors((prev) => ({ ...prev, volume: undefined }));
                  }}
                  placeholder="Ej. 1.5"
                  className={familyFormErrors.volume ? 'border-red-500' : ''}
                />
                {familyFormErrors.volume && <p className="text-sm text-red-600 mt-1">{familyFormErrors.volume}</p>}
              </div>
              <div>
                <Label htmlFor="familyUnit">{translate('familyUnitLabel')}</Label>
                <Input
                  id="familyUnit"
                  value={familyForm.unit}
                  onChange={(e) => {
                    setFamilyForm((prev) => ({ ...prev, unit: e.target.value }));
                    if (familyFormErrors.unit) setFamilyFormErrors((prev) => ({ ...prev, unit: undefined }));
                  }}
                  placeholder="Ej. L"
                  className={familyFormErrors.unit ? 'border-red-500' : ''}
                />
                {familyFormErrors.unit && <p className="text-sm text-red-600 mt-1">{familyFormErrors.unit}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCategoryDialog(false);
              setFamilyForm({ name: '', code: '', sku: '', volume: '', unit: '' });
              setFamilyFormErrors({});
              setEditingCategory(null);
            }}>{translate('cancel')}</Button>
            <Button onClick={handleSaveCategory} className="bg-indigo-600 hover:bg-indigo-700">{translate('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
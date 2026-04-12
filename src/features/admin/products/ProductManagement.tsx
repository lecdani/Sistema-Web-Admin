import React, { useState, useEffect, useMemo } from 'react';
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
  ImagePlus,
  Layers,
  Trash2
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/base/Tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Product, Brand, Category, ProductClass } from '@/shared/types';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { productsApi, type ProductWritePayload } from '@/shared/services/products-api';
import { brandsApi } from '@/shared/services/brands-api';
import { categoriesApi } from '@/shared/services/categories-api';
import { classesApi } from '@/shared/services/classes-api';
import { presentationsApi, type Presentation } from '@/shared/services/presentations-api';
import { planogramsApi } from '@/shared/services/planograms-api';
import { distributionsApi } from '@/shared/services/distributions-api';
import { histpricesApi, type HistPrice } from '@/shared/services/histprices-api';
import { isProductUsedInAnyOrder } from '@/shared/services/orders-api';
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

/** Formulario familia = columnas FAMILY en BD (precio va en presentación / histprices por presentationId). */
interface FamilyFormData {
  name: string;
  brandId: string;
  classId: string;
  familyCode: string;
}
interface FamilyFormErrors {
  name?: string;
  brandId?: string;
  classId?: string;
  familyCode?: string;
}

function categoryFamilyCode(c: Category): string {
  return String(c.familyCode ?? c.code ?? '').trim();
}

/** Clave estable para mapa precio↔presentación. */
function presentationPriceKey(id: string | number | undefined | null): string {
  return String(id ?? '').trim();
}

/** Código del producto (tabla Product); no mezcla con SKU de presentación. */
function getProductCodeOnly(p: Product): string {
  return String(p.code ?? '').trim() || '—';
}

/** SKU del producto (tabla Product). */
function getProductSkuForDisplay(p: Product): string {
  return String(p.sku ?? '').trim() || '—';
}

function resolvePresentationIdForProduct(p: Product, presentationsList: Presentation[]): string {
  const fromNested = String(p.presentation?.id ?? '').trim();
  if (fromNested) return fromNested;
  const direct = String((p as any).presentationId ?? '').trim();
  if (direct) return direct;
  const fid = String((p as any).familyId ?? p.categoryId ?? '').trim();
  if (!fid) return '';
  const pr = presentationsList.find((x) => String(x.familyId ?? '').trim() === fid);
  return pr ? String(pr.id).trim() : '';
}

/** Texto de volumen/unidad de familia; `null` si no hay nada que mostrar. */
function formatFamilyVolumeLine(category: Category): string | null {
  const rawVol = category.volume;
  const unit = String(category.unit ?? '').trim();
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

function formatPresentationVolumeLine(p: Pick<Presentation, 'volume' | 'unit'>): string | null {
  const rawVol = p.volume;
  const unit = String(p.unit ?? '').trim();
  let volPart: string | null = null;
  if (rawVol != null && String(rawVol).trim() !== '') {
    const n = Number(rawVol);
    if (Number.isFinite(n) && n !== 0) volPart = String(n);
  }
  if (!unit && !volPart) return null;
  if (volPart && unit) return `Vol: ${volPart} ${unit}`.trim();
  if (volPart) return `Vol: ${volPart}`;
  if (unit) return unit;
  return null;
}

/** Etiqueta de familia: código + nombre (tabla FAMILY). */
function familySelectLabel(c: Category): string {
  const code = categoryFamilyCode(c);
  const n = String(c.name ?? '').trim();
  if (code && n) return `${code} · ${n}`;
  return n || code || '—';
}

/** Nombre visible de la familia. */
function familyNameDashShort(c: Category): string {
  return String(c.name ?? '').trim() || '—';
}

function normId(v: string | undefined | null): string {
  return String(v ?? '').trim().toLowerCase();
}

function findBrandById(list: Brand[], id: string): Brand | undefined {
  const n = normId(id);
  if (!n) return undefined;
  return list.find((b) => normId(b.id) === n);
}

function findClassById(list: ProductClass[], id: string): ProductClass | undefined {
  const n = normId(id);
  if (!n) return undefined;
  return list.find((c) => normId(c.id) === n);
}

function findFamilyById(list: Category[], id: string): Category | undefined {
  const n = normId(id);
  if (!n) return undefined;
  return list.find((c) => normId(c.id) === n);
}

function getProductDisplayName(p: Product): string {
  const short = String(p.shortName ?? '').trim();
  if (short) return short;
  const full = String(p.name ?? '').trim();
  return full || '—';
}

function extractImageFileNameFromPath(path?: string): string {
  const raw = String(path ?? '').trim();
  if (!raw) return '';
  const noQuery = raw.split('?')[0] ?? raw;
  const normalized = noQuery.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  const last = parts[parts.length - 1] ?? '';
  return last.trim();
}

function isAbsoluteHttpUrl(value?: string): boolean {
  const text = String(value ?? '').trim();
  return /^https?:\/\//i.test(text);
}

function normalizeImageFileName(value?: string): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (isAbsoluteHttpUrl(text)) return extractImageFileNameFromPath(text);
  return text;
}

function buildProductImageSrc(
  previewUrl?: string,
  imageFileName?: string,
  editingImagePath?: string
): string | null {
  const preview = String(previewUrl ?? '').trim();
  if (preview) return preview;
  // No resolvemos images/url/{fileName} en frontend para visualización de productos.
  // El backend ya entrega el link final en getProducts cuando existe imagen.
  const fileNameRaw = String(imageFileName ?? '').trim();
  if (isAbsoluteHttpUrl(fileNameRaw)) return fileNameRaw;
  const fileName = normalizeImageFileName(fileNameRaw);
  if (fileName) return getBackendAssetUrl(`images/url/${encodeURIComponent(fileName)}`);
  const editPath = String(editingImagePath ?? '').trim();
  if (isAbsoluteHttpUrl(editPath)) return editPath;
  if (editPath) return getBackendAssetUrl(editPath);
  return null;
}

function getProductImageSrc(product?: Product | null): string | null {
  if (!product) return null;
  return buildProductImageSrc(undefined, product.imageFileName, product.image);
}

function buildProductWritePayload(p: Product, presentationsList: Presentation[]): ProductWritePayload {
  return {
    name: String(p.name ?? '').trim(),
    code: getProductCodeOnly(p),
    presentationId: resolvePresentationIdForProduct(p, presentationsList),
    shortName: String(p.name ?? '').trim(),
    brandId: String(p.brandId ?? '').trim(),
    familyId: String(p.familyId ?? p.categoryId ?? '').trim(),
    isActive: p.isActive,
    imageFileName: String(p.imageFileName ?? '').trim(),
  };
}

export const ProductManagement: React.FC<ProductManagementProps> = ({ onBack }) => {
  const router = useRouter();
  const { translate, locale } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [classes, setClasses] = useState<ProductClass[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
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
    brandId: '',
    classId: '',
    familyCode: '',
  });
  const [familyFormErrors, setFamilyFormErrors] = useState<FamilyFormErrors>({});
  const [brandSearchTerm, setBrandSearchTerm] = useState('');
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [presentationSearchTerm, setPresentationSearchTerm] = useState('');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [showClassDialog, setShowClassDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<ProductClass | null>(null);
  const [classFormName, setClassFormName] = useState('');
  const [showPresentationDialog, setShowPresentationDialog] = useState(false);
  const [editingPresentation, setEditingPresentation] = useState<Presentation | null>(null);
  const [presentationForm, setPresentationForm] = useState({
    familyId: '',
    genericCode: '',
    volume: '',
    unit: '',
    /** Solo al crear presentación: primer precio en histórico. */
    initialPrice: '',
  });
  /** Precio vigente por id de presentación (histprices latest). */
  const [presentationLatestPrices, setPresentationLatestPrices] = useState<Record<string, number>>({});
  /** Presentación seleccionada para actualizar precio / historial. */
  const [selectedPresentationForPrice, setSelectedPresentationForPrice] = useState<Presentation | null>(null);

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
  }, [products, searchTerm, statusFilter, categoryFilter, presentations]);

  const filteredFamiliesForList = useMemo(() => {
    const q = categorySearchTerm.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      const brandName = findBrandById(brands, String(c.brandId ?? ''))?.name ?? '';
      const className = findClassById(classes, String(c.classId ?? ''))?.name ?? '';
      return [c.name, categoryFamilyCode(c), brandName, className].some((s) =>
        String(s ?? '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [categories, categorySearchTerm, brands, classes]);

  const filteredClassesForList = useMemo(() => {
    const q = classSearchTerm.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, classSearchTerm]);

  const filteredPresentationsForList = useMemo(() => {
    const q = presentationSearchTerm.trim().toLowerCase();
    if (!q) return presentations;
    return presentations.filter((p) => {
      const fam = findFamilyById(categories, String(p.familyId ?? ''));
      const famLine = fam ? familySelectLabel(fam) : '';
      return [p.genericCode, p.unit, String(p.volume ?? ''), famLine].some((s) =>
        String(s ?? '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [presentations, presentationSearchTerm, categories]);

  const filteredBrandsForList = useMemo(() => {
    const q = brandSearchTerm.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, brandSearchTerm]);

  const catalogPageSize = 8;
  const [catalogBrandPage, setCatalogBrandPage] = useState(1);
  const [catalogClassPage, setCatalogClassPage] = useState(1);
  const [catalogFamilyPage, setCatalogFamilyPage] = useState(1);
  const [catalogPresentationPage, setCatalogPresentationPage] = useState(1);

  useEffect(() => {
    setCatalogBrandPage(1);
  }, [brandSearchTerm]);
  useEffect(() => {
    setCatalogClassPage(1);
  }, [classSearchTerm]);
  useEffect(() => {
    setCatalogFamilyPage(1);
  }, [categorySearchTerm]);
  useEffect(() => {
    setCatalogPresentationPage(1);
  }, [presentationSearchTerm]);

  const pagedBrandsForList = useMemo(() => {
    const start = (catalogBrandPage - 1) * catalogPageSize;
    return filteredBrandsForList.slice(start, start + catalogPageSize);
  }, [filteredBrandsForList, catalogBrandPage, catalogPageSize]);

  const pagedClassesForList = useMemo(() => {
    const start = (catalogClassPage - 1) * catalogPageSize;
    return filteredClassesForList.slice(start, start + catalogPageSize);
  }, [filteredClassesForList, catalogClassPage, catalogPageSize]);

  const pagedFamiliesForList = useMemo(() => {
    const start = (catalogFamilyPage - 1) * catalogPageSize;
    return filteredFamiliesForList.slice(start, start + catalogPageSize);
  }, [filteredFamiliesForList, catalogFamilyPage, catalogPageSize]);

  const pagedPresentationsForList = useMemo(() => {
    const start = (catalogPresentationPage - 1) * catalogPageSize;
    return filteredPresentationsForList.slice(start, start + catalogPageSize);
  }, [filteredPresentationsForList, catalogPresentationPage, catalogPageSize]);

  const loadProducts = async (opts?: {
    /** Sin pantalla de carga completa (p. ej. tras actualizar precio). */
    quiet?: boolean;
    /** Forzar precio mostrado tras crear histórico (getLatest a veces llega tarde). */
    forcePresentationPrice?: { presentationId: string; price: number };
  }) => {
    const quiet = opts?.quiet === true;
    if (!quiet) {
      setIsLoading(true);
      setLoadError(null);
    }

    const [productsResult, brandsResult, categoriesResult, classesResult, presentationsResult] =
      await Promise.allSettled([
        productsApi.fetchAll(),
        brandsApi.fetchAll(),
        categoriesApi.fetchAll(),
        classesApi.fetchAll(),
        presentationsApi.fetchAll(),
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
    if (classesResult.status === 'fulfilled') {
      setClasses(classesResult.value);
    } else {
      console.warn('Error cargando clases:', classesResult.reason);
      setClasses([]);
    }
    if (presentationsResult.status === 'fulfilled') {
      setPresentations(presentationsResult.value);
    } else {
      console.warn('Error cargando presentaciones:', presentationsResult.reason);
      setPresentations([]);
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
    const presList = presentationsResult.status === 'fulfilled' ? presentationsResult.value : [];
    try {
      const presentationIdsToFetch = new Set<string>();
      presList.forEach((pr) => {
        const id = presentationPriceKey(pr.id);
        if (id) presentationIdsToFetch.add(id);
      });
      list.forEach((p) => {
        const pid = resolvePresentationIdForProduct(p, presList);
        if (pid) presentationIdsToFetch.add(pid);
      });
      const priceMap: Record<string, number> = {};
      await Promise.all(
        [...presentationIdsToFetch].map(async (id) => {
          try {
            const latest = await histpricesApi.getLatest(id);
            priceMap[id] = latest?.price ?? 0;
          } catch {
            priceMap[id] = 0;
          }
        })
      );
      const forced = opts?.forcePresentationPrice;
      const forcedKey = forced ? presentationPriceKey(forced.presentationId) : '';
      if (forcedKey && Number.isFinite(Number(forced!.price)) && Number(forced!.price) > 0) {
        priceMap[forcedKey] = Number(forced!.price);
      }
      setPresentationLatestPrices(priceMap);
      const withPrices = list.map((p) => {
        const presId = resolvePresentationIdForProduct(p, presList);
        return { ...p, currentPrice: presId ? priceMap[presId] ?? 0 : 0 };
      });
      setProducts(withPrices);
    } catch {
      setPresentationLatestPrices({});
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
        const presSku = getProductSkuForDisplay(product).toLowerCase();
        return (
          product.name.toLowerCase().includes(searchLower) ||
          (product.code ?? '').toLowerCase().includes(searchLower) ||
          (product.sku ?? '').toLowerCase().includes(searchLower) ||
          (presSku && presSku !== '—' && presSku.includes(searchLower)) ||
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
    if (!formData.categoryId) err.categoryId = translate('presentationRequired');
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
      else if (!formData.categoryId) firstError = translate('presentationRequired');
      if (!firstError) firstError = translate('completeRequiredFields');
      toast.error(firstError);
      return;
    }
    try {
      const presentationId = String(formData.categoryId || '').trim();
      const pres = presentations.find((p) => String(p.id).trim() === presentationId);
      const familyId = String(pres?.familyId ?? '').trim();
      if (!pres || !familyId) {
        toast.error(translate('presentationRequired'));
        return;
      }
      const brandId = String(formData.brandId || '').trim();
      const imageForCreate =
        normalizeImageFileName(getPendingImageFileName()?.trim()) ||
        normalizeImageFileName(formData.imageFileName?.trim()) ||
        '';
      const imageForUpdate =
        normalizeImageFileName(formData.imageFileName?.trim()) ||
        normalizeImageFileName(lastUploadedFileNameRef.current?.trim()) ||
        normalizeImageFileName(String(editingProduct?.imageFileName ?? '').trim()) ||
        extractImageFileNameFromPath(editingProduct?.image);

      const apiBody = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        shortName: formData.name.trim(),
        presentationId,
        brandId,
        familyId,
        isActive: editingProduct ? editingProduct.isActive : true,
        imageFileName: editingProduct ? imageForUpdate : imageForCreate,
      };

      if (editingProduct) {
        const currentPresentationId = String(
          editingProduct.presentationId ?? editingProduct.familyId ?? editingProduct.categoryId ?? ''
        ).trim();
        const currentBrandId = String(editingProduct.brandId ?? '').trim();
        const currentName = String(editingProduct.name ?? '').trim();
        const currentCode = String(editingProduct.code ?? '').trim();
        const currentImage = String(editingProduct.imageFileName ?? '').trim();
        const hasChanges =
          currentName !== apiBody.name ||
          currentCode !== apiBody.code ||
          currentBrandId !== apiBody.brandId ||
          currentPresentationId !== apiBody.presentationId ||
          currentImage !== apiBody.imageFileName;
        if (!hasChanges) {
          toast.error(translate('noChangesToSave'));
          return;
        }
        await productsApi.update(editingProduct.id, apiBody);
        toast.success(translate('productSaved'));
      } else {
        const created = await productsApi.create(apiBody);
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

  const handleUpdatePrice = async () => {
    const pres = selectedPresentationForPrice;
    if (!pres?.id) return;
    if (priceUpdateData.price <= 0) {
      toast.error(translate('priceMustBePositive'));
      return;
    }
    try {
      const now = new Date();
      const pid = presentationPriceKey(pres.id);
      const created = await histpricesApi.create({
        presentationId: pid,
        price: priceUpdateData.price,
        startDate: now,
        endDate: now,
      });
      const fromApi = Number(created?.price);
      const finalPrice =
        Number.isFinite(fromApi) && fromApi > 0 ? fromApi : priceUpdateData.price;

      setPresentationLatestPrices((prev) => ({ ...prev, [pid]: finalPrice }));
      setProducts((prev) =>
        prev.map((p) => {
          const pPres = resolvePresentationIdForProduct(p, presentations);
          return pPres === pid ? { ...p, currentPrice: finalPrice } : p;
        })
      );

      toast.success(translate('priceUpdatedSuccess'));
      resetPriceForm();
      setShowUpdatePriceDialog(false);
      setSelectedPresentationForPrice(null);

      await loadProducts({
        quiet: true,
        forcePresentationPrice: { presentationId: pid, price: finalPrice },
      });
    } catch (error: any) {
      const msg = error?.data?.message ?? error?.message ?? translate('errorUpdatePrice');
      toast.error(msg);
    }
  };

  const loadPriceHistoryForDialog = async (presentationId: string) => {
    try {
      const list = await histpricesApi.getByPresentation(presentationId);
      setPriceHistoryList(list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    } catch {
      setPriceHistoryList([]);
    }
  };

  useEffect(() => {
    if (queryDate && selectedPresentationForPrice?.id) {
      histpricesApi
        .getByDate(selectedPresentationForPrice.id, queryDate)
        .then(setQueryResult)
        .catch(() => setQueryResult(null));
    } else {
      setQueryResult(null);
    }
  }, [queryDate, selectedPresentationForPrice?.id]);

  const resetQueryForm = () => {
    setQueryDate('');
    setQueryResult(null);
  };

  const handleEditProduct = (product: Product) => {
    let presentationId = String(product.presentationId ?? '').trim();
    if (!presentationId) {
      const fid = String(product.familyId ?? product.categoryId ?? '').trim();
      if (fid) {
        const pr = presentations.find((p) => String(p.familyId ?? '').trim() === fid);
        if (pr) presentationId = String(pr.id).trim();
      }
    }
    const categoryId = presentationId;
    setFormData({
      code: product.code ?? '',
      name: product.name,
      category: product.category ?? '',
      brandId: product.brandId ?? '',
      categoryId,
      isActive: product.isActive,
      imageFileName:
        normalizeImageFileName(String(product.imageFileName ?? '').trim()) ||
        extractImageFileNameFromPath(product.image) ||
        undefined,
      imagePreviewUrl: getProductImageSrc(product) ?? undefined
    });
    setFormErrors({});
    setEditingProduct(product);
    setShowAddDialog(true);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      if (product.isActive) {
        const blocked = await resolveImpactedProductsBlockedByActivePlanograms([product]);
        if (blocked.length > 0) {
          toast.error(
            `${translate('cannotDeactivateUsedInActivePlanogram')} ${formatProductsForToast(blocked)}`
          );
          return;
        }
        await productsApi.deactivate(product.id);
        toast.success(translate('productDeactivatedSuccess'));
      } else {
        if (!canActivateProduct(product)) {
          const issues = getProductActivationIssues(product);
          toast.error(
            `${translate('cannotActivateProductDependencies')}${issues.length ? ` (${issues.join(', ')})` : ''}`
          );
          return;
        }
        await productsApi.deactivate(product.id);
        toast.success(translate('productActivatedSuccess'));
      }
      await loadProducts();
    } catch (error: any) {
      const rawMsg = error?.data?.message ?? error?.message;
      const msg = typeof rawMsg === 'string' && rawMsg.trim() ? rawMsg : translate('errorToggleProduct');
      toast.error(msg);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const blocked = await resolveImpactedProductsBlockedByActivePlanograms([product]);
    if (blocked.length > 0) {
      toast.error(`${translate('cannotDeleteProductInActivePlanogram')} ${formatProductsForToast(blocked)}`);
      return;
    }
    const usedInOrders = await isProductUsedInAnyOrder(product.id);
    if (usedInOrders) {
      toast.error(translate('cannotDeleteProductHasOrders'));
      return;
    }
    try {
      await productsApi.delete(product.id);
      toast.success(translate('productDeleted'));
      await loadProducts();
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? translate('errorDeleteProduct'));
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
  const activeClasses = classes.filter((c) => c.isActive);
  const activeCategories = categories.filter(c => c.isActive);

  const brandsForFamilyForm = useMemo(() => {
    const byId = new Map<string, Brand>();
    for (const b of activeBrands) byId.set(normId(b.id), b);
    if (editingCategory?.brandId) {
      const b = findBrandById(brands, String(editingCategory.brandId));
      if (b) byId.set(normId(b.id), b);
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeBrands, brands, editingCategory]);

  const classesForFamilyForm = useMemo(() => {
    const byId = new Map<string, ProductClass>();
    for (const c of activeClasses) byId.set(normId(c.id), c);
    if (editingCategory?.classId) {
      const cl = findClassById(classes, String(editingCategory.classId));
      if (cl) byId.set(normId(cl.id), cl);
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeClasses, classes, editingCategory]);

  /** En el producto se elige presentación; se filtran por marca de la familia. */
  const presentationsForProductForm = useMemo(() => {
    const bid = formData.brandId.trim();
    return presentations.filter((p) => {
      if (!String(p.familyId ?? '').trim()) return false;
      if (!p.isActive) return false;
      if (!bid) return true;
      const fam = categories.find((c) => String(c.id).trim() === String(p.familyId ?? '').trim());
      return !!fam && String(fam.brandId ?? '').trim() === bid;
    });
  }, [presentations, categories, formData.brandId]);
  const hasProductsInFamily = (familyId: string): boolean => {
    const sid = String(familyId ?? '').trim();
    if (!sid) return false;
    return products.some((p) => {
      const pid = String((p as any).familyId ?? p.categoryId ?? '').trim();
      return pid === sid;
    });
  };

  const isProductAssociatedWithFamily = (p: Product, familyNormId: string): boolean => {
    const famId = normId(p.familyId ?? p.categoryId ?? '');
    if (famId === familyNormId) return true;
    const presId = normId(resolvePresentationIdForProduct(p, presentations));
    const presRow = presentations.find((x) => normId(x.id) === presId);
    return !!presRow && normId(presRow.familyId) === familyNormId;
  };

  /** DELETE familia solo si no hay presentaciones ni productos ligados (directo o vía presentación). */
  const canDeleteFamily = (familyId: string): boolean => {
    const fid = normId(familyId);
    if (!fid) return false;
    if (presentations.some((pr) => normId(pr.familyId) === fid)) return false;
    return !products.some((p) => isProductAssociatedWithFamily(p, fid));
  };
  const hasProductsInClass = (classId: string): boolean => {
    const sid = normId(classId);
    if (!sid) return false;
    const familyIds = categories
      .filter((c) => normId(c.classId) === sid)
      .map((c) => normId(c.id))
      .filter(Boolean);
    if (familyIds.length === 0) return false;
    return products.some((p) => {
      const pid = normId((p as any).familyId ?? p.categoryId ?? '');
      return familyIds.includes(pid);
    });
  };
  const hasProductsInPresentation = (presentationId: string): boolean => {
    const sid = normId(presentationId);
    if (!sid) return false;
    return products.some((p) => normId(resolvePresentationIdForProduct(p, presentations)) === sid);
  };

  const isClassUsedInAnyFamily = (classId: string): boolean =>
    categories.some((c) => normId(c.classId) === normId(classId));

  const getCategoryName = (product: Product): string => {
    const id = product.categoryId ?? product.familyId;
    if (id != null && String(id).trim() !== '') {
      const sid = String(id).trim();
      const match = categories.find((c) => String(c.id).trim() === sid);
      if (match?.name) return String(match.name).trim();
      const short = String(match?.shortName ?? '').trim();
      if (short) return short;
    }
    const presId = String(product.presentationId ?? '').trim();
    if (presId) {
      const pr = presentations.find((p) => String(p.id).trim() === presId);
      if (pr?.familyId) {
        const fam = categories.find((c) => String(c.id).trim() === String(pr.familyId).trim());
        if (fam) return String(fam.name ?? '').trim() || familySelectLabel(fam);
      }
      if (pr?.genericCode) return pr.genericCode;
    }
    return (product.category && product.category.trim()) || '-';
  };

  const resolveImpactedProductsBlockedByActivePlanograms = async (
    impactedProducts: Product[]
  ): Promise<Product[]> => {
    if (impactedProducts.length === 0) return [];
    const activePlanograms = (await planogramsApi.fetchAll()).filter((p) => p.isActive);
    if (activePlanograms.length === 0) return [];
    const activeDistributions = await Promise.all(
      activePlanograms.map((p) => distributionsApi.getByPlanogram(p.id))
    );
    const productIdsInActivePlanograms = new Set<string>();
    for (const list of activeDistributions) {
      for (const d of list) {
        const pid = normId(d.productId);
        if (pid) productIdsInActivePlanograms.add(pid);
      }
    }
    return impactedProducts.filter((p) => productIdsInActivePlanograms.has(normId(p.id)));
  };

  const formatProductsForToast = (list: Product[]): string =>
    list
      .slice(0, 3)
      .map((p) => String(p.shortName ?? p.name ?? '').trim() || getProductCodeOnly(p))
      .join(', ');

  const getFamilyByPresentation = (presentationId: string): Category | undefined => {
    const p = presentations.find((x) => normId(x.id) === normId(presentationId));
    if (!p) return undefined;
    return categories.find((c) => normId(c.id) === normId(p.familyId));
  };

  const getFamilyForProduct = (product: Product): Category | undefined => {
    const familyId = String(product.familyId ?? product.categoryId ?? '').trim();
    if (familyId) {
      const byDirect = categories.find((c) => normId(c.id) === normId(familyId));
      if (byDirect) return byDirect;
    }
    const presentationId = resolvePresentationIdForProduct(product, presentations);
    return presentationId ? getFamilyByPresentation(presentationId) : undefined;
  };

  const canActivateFamily = (family: Category): boolean => {
    const brandActive = !!brands.find((b) => normId(b.id) === normId(family.brandId) && b.isActive);
    const classActive = !!classes.find((c) => normId(c.id) === normId(family.classId) && c.isActive);
    return brandActive && classActive;
  };

  const canActivatePresentation = (p: Presentation): boolean => {
    const family = categories.find((c) => normId(c.id) === normId(p.familyId));
    if (!family || !family.isActive) return false;
    return canActivateFamily(family);
  };

  const canActivateProduct = (product: Product): boolean => {
    const presentationId = resolvePresentationIdForProduct(product, presentations);
    const family = getFamilyForProduct(product);
    if (!family || !family.isActive) return false;
    if (!canActivateFamily(family)) return false;
    const presentation = presentations.find((p) => normId(p.id) === normId(presentationId));
    if (presentation) return presentation.isActive;
    // Fallback para datos legacy sin presentationId directo:
    // se permite activar si la familia tiene al menos una presentación activa.
    return presentations.some(
      (p) => normId(p.familyId) === normId(family.id) && p.isActive
    );
  };

  const getFamilyActivationIssues = (family: Category): string[] => {
    const issues: string[] = [];
    const brand = brands.find((b) => normId(b.id) === normId(family.brandId));
    const cls = classes.find((c) => normId(c.id) === normId(family.classId));
    if (!brand || !brand.isActive) issues.push(translate('brandHeader'));
    if (!cls || !cls.isActive) issues.push(translate('classLabel'));
    return issues;
  };

  const getPresentationActivationIssues = (p: Presentation): string[] => {
    const issues: string[] = [];
    const family = categories.find((c) => normId(c.id) === normId(p.familyId));
    if (!family || !family.isActive) issues.push(translate('family'));
    if (family) issues.push(...getFamilyActivationIssues(family));
    return Array.from(new Set(issues));
  };

  const getProductActivationIssues = (product: Product): string[] => {
    const issues: string[] = [];
    const presentationId = resolvePresentationIdForProduct(product, presentations);
    const presentation = presentations.find((p) => normId(p.id) === normId(presentationId));
    if (!presentation || !presentation.isActive) issues.push(translate('catalogTabPresentations'));
    const family = getFamilyForProduct(product);
    if (!family || !family.isActive) issues.push(translate('family'));
    if (family) issues.push(...getFamilyActivationIssues(family));
    return Array.from(new Set(issues));
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
        await brandsApi.update(editingBrand.id, { name });
        await loadProducts({ quiet: true });
        toast.success(translate('brandUpdated'));
      } else {
        const created = await brandsApi.create({ name });
        await loadProducts({ quiet: true });
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
    const familyBrandId = familyForm.brandId.trim();
    const familyClassId = familyForm.classId.trim();
    const familyCode = familyForm.familyCode.trim();

    if (!name) errors.name = translate('familyNameRequired');
    else if (name.length > 25) errors.name = translate('familyNameMaxLength');
    if (!familyBrandId) errors.brandId = translate('brandRequired');
    if (!familyClassId) errors.classId = translate('classRequired');
    if (!familyCode) errors.familyCode = translate('familyCodeRequired');
    else if (familyCode.length !== 4) errors.familyCode = translate('familyCodeLength4');

    if (Object.keys(errors).length > 0) {
      setFamilyFormErrors(errors);
      toast.error(Object.values(errors)[0] || translate('completeRequiredFields'));
      return;
    }

    const payload = {
      name,
      brandId: familyBrandId,
      classId: familyClassId,
      familyCode,
    };

    const normalizedFamilyCode = familyCode;
    const isDuplicateCode = categories.some(
      (c) => categoryFamilyCode(c) === normalizedFamilyCode && (!editingCategory || c.id !== editingCategory.id)
    );
    if (isDuplicateCode) {
      setFamilyFormErrors((prev) => ({ ...prev, familyCode: translate('duplicateFamilyCode') }));
      toast.error(translate('duplicateFamilyCode'));
      return;
    }

    setFamilyFormErrors({});
    try {
      if (editingCategory) {
        const currentName = String(editingCategory.name ?? '').trim();
        const currentBrandId = String(editingCategory.brandId ?? '').trim();
        const currentClassId = String(editingCategory.classId ?? '').trim();
        const currentFamCode = categoryFamilyCode(editingCategory);
        const hasChanges =
          currentName !== payload.name ||
          currentBrandId !== payload.brandId ||
          currentClassId !== payload.classId ||
          currentFamCode !== payload.familyCode;
        if (!hasChanges) {
          toast.error(translate('noChangesToSave'));
          return;
        }
        const updated = await categoriesApi.update(editingCategory.id, payload);
        setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? updated : c)));
        await loadProducts({ quiet: true });
        toast.success(translate('familyUpdated'));
      } else {
        const created = await categoriesApi.create(payload);
        setCategories((prev) => [...prev, created]);
        await loadProducts({ quiet: true });
        toast.success(translate('familyCreated'));
        setCategorySearchTerm(created.name);
      }
      setFamilyForm({
        name: '',
        brandId: '',
        classId: '',
        familyCode: '',
      });
      setFamilyFormErrors({});
      setEditingCategory(null);
      setShowCategoryDialog(false);
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorSaveCategory'));
    }
  };

  const handleSaveClass = async () => {
    const name = classFormName.trim();
    if (!name) {
      toast.error(translate('classNameRequired'));
      return;
    }
    try {
      if (editingClass) {
        await classesApi.update(editingClass.id, { name });
        await loadProducts({ quiet: true });
        toast.success(translate('classUpdated'));
      } else {
        const created = await classesApi.create({ name });
        await loadProducts({ quiet: true });
        toast.success(translate('classCreated'));
        setClassSearchTerm(created.name);
      }
      setClassFormName('');
      setEditingClass(null);
      setShowClassDialog(false);
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorSaveClass'));
    }
  };

  const handleToggleClass = async (cls: ProductClass) => {
    try {
      const wasActive = cls.isActive;
      if (wasActive) {
        const cid = normId(cls.id);
        const familiesHit = categories.filter((c) => c.isActive && normId(c.classId) === cid);
        const familyIdsHit = new Set(familiesHit.map((f) => normId(f.id)));
        const presHit = presentations.filter(
          (pr) => pr.isActive && familyIdsHit.has(normId(pr.familyId))
        );
        const presIdsHit = new Set(presHit.map((p) => normId(p.id)));
        const productsHit = products.filter((prod) => {
          if (!prod.isActive) return false;
          const famId = normId(prod.familyId ?? prod.categoryId ?? '');
          const presId = normId(resolvePresentationIdForProduct(prod, presentations));
          return familyIdsHit.has(famId) || presIdsHit.has(presId);
        });
        const blockedProducts = await resolveImpactedProductsBlockedByActivePlanograms(productsHit);
        if (blockedProducts.length > 0) {
          toast.error(
            `${translate('cannotDeactivateUsedInActivePlanogram')} ${formatProductsForToast(blockedProducts)}`
          );
          return;
        }
        await classesApi.toggleActive(cls.id);
        for (const fam of familiesHit) await categoriesApi.toggleActive(fam.id);
        for (const pr of presHit) await presentationsApi.toggleActive(pr.id);
        for (const prod of productsHit) {
          await productsApi.deactivate(prod.id);
        }
      } else {
        await classesApi.toggleActive(cls.id);
      }
      toast.success(wasActive ? translate('classDeactivated') : translate('classActivated'));
      await loadProducts({ quiet: true });
    } catch (e: any) {
      const rawMsg = e?.data?.message ?? e?.message;
      toast.error(typeof rawMsg === 'string' && rawMsg.trim() ? rawMsg : translate('errorToggleStatusGeneric'));
    }
  };

  const handleDeleteClass = async (cls: ProductClass) => {
    if (hasProductsInClass(cls.id)) {
      toast.error(translate('cannotDeleteWithProducts'));
      return;
    }
    try {
      await classesApi.delete(cls.id);
      await loadProducts({ quiet: true });
      toast.success(translate('classDeleted'));
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorDeleteClass'));
    }
  };

  const handleDeleteFamily = async (c: Category) => {
    if (!canDeleteFamily(c.id)) {
      toast.error(translate('cannotDeleteFamilyHasLinks'));
      return;
    }
    try {
      await categoriesApi.delete(c.id);
      await loadProducts({ quiet: true });
      toast.success(translate('familyDeleted'));
      if (editingCategory && normId(editingCategory.id) === normId(c.id)) {
        setShowCategoryDialog(false);
        setEditingCategory(null);
      }
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorDeleteFamily'));
    }
  };

  const handleSavePresentation = async () => {
    const familyId = presentationForm.familyId.trim();
    const genericCode = presentationForm.genericCode.trim();
    if (!familyId) {
      toast.error(translate('presentationFamilyRequired'));
      return;
    }
    if (!genericCode) {
      toast.error(translate('presentationGenericCodeRequired'));
      return;
    }
    if (genericCode.length > 20) {
      toast.error(translate('presentationGenericCodeMaxLength'));
      return;
    }
    const volRaw = presentationForm.volume.trim();
    const volNum = volRaw ? Number(volRaw.replace(',', '.')) : 0;
    if (volRaw && (!Number.isFinite(volNum) || volNum < 0)) {
      toast.error(translate('presentationVolumeInvalid'));
      return;
    }
    const payload = {
      familyId,
      genericCode,
      volume: volNum,
      unit: presentationForm.unit.trim(),
    };
    let initialPriceNum = 0;
    if (!editingPresentation) {
      const prRaw = presentationForm.initialPrice.trim().replace(',', '.');
      if (!presentationForm.initialPrice.trim()) {
        toast.error(translate('presentationInitialPriceRequired'));
        return;
      }
      initialPriceNum = Number(prRaw);
      if (!Number.isFinite(initialPriceNum) || initialPriceNum <= 0) {
        toast.error(translate('priceMustBePositive'));
        return;
      }
    }
    try {
      if (editingPresentation) {
        await presentationsApi.update(editingPresentation.id, payload);
        await loadProducts({ quiet: true });
        toast.success(translate('presentationUpdated'));
      } else {
        const created = await presentationsApi.create(payload);
        try {
          await histpricesApi.create({
            presentationId: String(created.id),
            price: initialPriceNum,
            startDate: new Date(),
          });
          setPresentationLatestPrices((prev) => ({
            ...prev,
            [presentationPriceKey(created.id)]: initialPriceNum,
          }));
        } catch (hpErr: any) {
          console.error('[ProductManagement] histprice tras crear presentación:', hpErr);
          toast.error(
            hpErr?.data?.message ?? hpErr?.message ?? translate('presentationCreatedPriceFailed')
          );
        }
        await loadProducts({
          quiet: true,
          forcePresentationPrice: {
            presentationId: String(created.id),
            price: initialPriceNum,
          },
        });
        toast.success(translate('presentationCreated'));
        setPresentationSearchTerm(created.genericCode || '');
      }
      setPresentationForm({
        familyId: '',
        genericCode: '',
        volume: '',
        unit: '',
        initialPrice: '',
      });
      setEditingPresentation(null);
      setShowPresentationDialog(false);
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorSavePresentation'));
    }
  };

  const handleDeletePresentation = async (p: Presentation) => {
    if (hasProductsInPresentation(p.id)) {
      toast.error(translate('cannotDeleteWithProducts'));
      return;
    }
    try {
      await presentationsApi.delete(p.id);
      await loadProducts({ quiet: true });
      toast.success(translate('presentationDeleted'));
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorDeletePresentation'));
    }
  };

  const handleTogglePresentation = async (p: Presentation) => {
    try {
      const wasActive = p.isActive;
      if (wasActive) {
        const pid = normId(p.id);
        const productsHit = products.filter(
          (prod) => prod.isActive && normId(resolvePresentationIdForProduct(prod, presentations)) === pid
        );
        const blockedProducts = await resolveImpactedProductsBlockedByActivePlanograms(productsHit);
        if (blockedProducts.length > 0) {
          toast.error(
            `${translate('cannotDeactivateUsedInActivePlanogram')} ${formatProductsForToast(blockedProducts)}`
          );
          return;
        }
        await presentationsApi.toggleActive(p.id);
        for (const prod of productsHit) {
          await productsApi.deactivate(prod.id);
        }
      } else {
        if (!canActivatePresentation(p)) {
          const issues = getPresentationActivationIssues(p);
          toast.error(
            `${translate('cannotActivatePresentationDependencies')}${issues.length ? ` (${issues.join(', ')})` : ''}`
          );
          return;
        }
        await presentationsApi.toggleActive(p.id);
      }
      toast.success(
        wasActive ? translate('presentationDeactivated') : translate('presentationActivated')
      );
      await loadProducts({ quiet: true });
    } catch (e: any) {
      const rawMsg = e?.data?.message ?? e?.message;
      toast.error(typeof rawMsg === 'string' && rawMsg.trim() ? rawMsg : translate('errorToggleStatusGeneric'));
    }
  };

  const handleToggleBrand = async (brand: Brand) => {
    try {
      const wasActive = brand.isActive;
      if (wasActive) {
        const bid = normId(brand.id);
        const familiesHit = categories.filter((c) => c.isActive && normId(c.brandId) === bid);
        const familyIdsHit = new Set(familiesHit.map((f) => normId(f.id)));
        const presHit = presentations.filter(
          (pr) => pr.isActive && familyIdsHit.has(normId(pr.familyId))
        );
        const presIdsHit = new Set(presHit.map((p) => normId(p.id)));
        const productsHit = products.filter((prod) => {
          if (!prod.isActive) return false;
          const famId = normId(prod.familyId ?? prod.categoryId ?? '');
          const presId = normId(resolvePresentationIdForProduct(prod, presentations));
          return familyIdsHit.has(famId) || presIdsHit.has(presId);
        });
        const blockedProducts = await resolveImpactedProductsBlockedByActivePlanograms(productsHit);
        if (blockedProducts.length > 0) {
          toast.error(
            `${translate('cannotDeactivateUsedInActivePlanogram')} ${formatProductsForToast(blockedProducts)}`
          );
          return;
        }
        await brandsApi.toggleActive(brand.id);
        for (const fam of familiesHit) await categoriesApi.toggleActive(fam.id);
        for (const pr of presHit) await presentationsApi.toggleActive(pr.id);
        for (const prod of productsHit) {
          await productsApi.deactivate(prod.id);
        }
      } else {
        await brandsApi.toggleActive(brand.id);
      }
      toast.success(wasActive ? translate('brandDeactivated') : translate('brandActivated'));
      await loadProducts({ quiet: true });
    } catch (e: any) {
      toast.error(e?.message ?? translate('errorToggleStatusGeneric'));
    }
  };

  const handleToggleCategory = async (category: Category) => {
    try {
      const wasActive = category.isActive;
      if (wasActive) {
        const fid = normId(category.id);
        const presHit = presentations.filter((pr) => pr.isActive && normId(pr.familyId) === fid);
        const presIdsHit = new Set(presHit.map((p) => normId(p.id)));
        const productsHit = products.filter((prod) => {
          if (!prod.isActive) return false;
          const famId = normId(prod.familyId ?? prod.categoryId ?? '');
          const presId = normId(resolvePresentationIdForProduct(prod, presentations));
          const presRow = presentations.find((x) => normId(x.id) === presId);
          const viaFam = famId === fid;
          const viaPres = !!presRow && normId(presRow.familyId) === fid;
          return viaFam || viaPres || presIdsHit.has(presId);
        });
        const blockedProducts = await resolveImpactedProductsBlockedByActivePlanograms(productsHit);
        if (blockedProducts.length > 0) {
          toast.error(
            `${translate('cannotDeactivateUsedInActivePlanogram')} ${formatProductsForToast(blockedProducts)}`
          );
          return;
        }
        await categoriesApi.toggleActive(category.id);
        for (const pr of presHit) await presentationsApi.toggleActive(pr.id);
        for (const prod of productsHit) {
          await productsApi.deactivate(prod.id);
        }
      } else {
        if (!canActivateFamily(category)) {
          const issues = getFamilyActivationIssues(category);
          toast.error(
            `${translate('cannotActivateFamilyDependencies')}${issues.length ? ` (${issues.join(', ')})` : ''}`
          );
          return;
        }
        await categoriesApi.toggleActive(category.id);
      }
      toast.success(wasActive ? translate('familyDeactivated') : translate('familyActivated'));
      await loadProducts({ quiet: true });
    } catch (e: any) {
      const rawMsg = e?.data?.message ?? e?.message;
      toast.error(typeof rawMsg === 'string' && rawMsg.trim() ? rawMsg : translate('errorToggleStatusGeneric'));
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
                <SearchableSelect
                  value={formData.brandId}
                  placeholder={translate('selectBrand')}
                  disabled={!activeBrands.length}
                  options={activeBrands.map((b) => ({ value: b.id, label: b.name }))}
                  onValueChange={(v) => {
                    setFormData((prev) => {
                      const next = { ...prev, brandId: v };
                      const stillValid = presentations.some(
                        (p) =>
                          normId(p.id) === normId(prev.categoryId) &&
                          p.isActive &&
                          (() => {
                            const fam = findFamilyById(categories, String(p.familyId ?? ''));
                            return fam && normId(fam.brandId) === normId(v);
                          })()
                      );
                      if (!stillValid) next.categoryId = '';
                      return next;
                    });
                    if (formErrors.brandId) setFormErrors((prev) => ({ ...prev, brandId: undefined }));
                    if (formErrors.categoryId) setFormErrors((prev) => ({ ...prev, categoryId: undefined }));
                  }}
                  aria-invalid={!!formErrors.brandId}
                  inputClassName={formErrors.brandId ? 'border-red-500' : ''}
                  zIndex={60}
                />
                {formErrors.brandId && <p className="text-sm text-red-600">{formErrors.brandId}</p>}
                {activeBrands.length === 0 && (
                  <p className="text-xs text-amber-600">{translate('addBrandsFirst')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{translate('catalogTabPresentations')} *</Label>
                <SearchableSelect
                  value={formData.categoryId}
                  placeholder={translate('selectPresentation')}
                  disabled={!formData.brandId || presentationsForProductForm.length === 0}
                  options={presentationsForProductForm.map((p) => {
                    const fam = findFamilyById(categories, String(p.familyId ?? ''));
                    const presCode = String(p.genericCode ?? '').trim() || '—';
                    const label = fam ? `${presCode} · ${familySelectLabel(fam)}` : presCode;
                    return { value: p.id, label };
                  })}
                  onValueChange={(v) => {
                    setFormData({ ...formData, categoryId: v });
                    if (formErrors.categoryId) setFormErrors((prev) => ({ ...prev, categoryId: undefined }));
                  }}
                  aria-invalid={!!formErrors.categoryId}
                  inputClassName={formErrors.categoryId ? 'border-red-500' : ''}
                  zIndex={60}
                />
                {formErrors.categoryId && <p className="text-sm text-red-600">{formErrors.categoryId}</p>}
                {!formData.brandId && (
                  <p className="text-xs text-amber-600">{translate('selectBrandBeforePresentation')}</p>
                )}
                {formData.brandId && presentationsForProductForm.length === 0 && (
                  <p className="text-xs text-amber-600">{translate('addPresentationsForBrand')}</p>
                )}
                {formData.categoryId && (
                  <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    {(() => {
                      const selectedPres = presentations.find(
                        (p) => normId(p.id) === normId(formData.categoryId)
                      );
                      if (!selectedPres) return null;
                      const selectedFamily = findFamilyById(
                        categories,
                        String(selectedPres.familyId ?? '')
                      );
                      return (
                        <div className="text-sm text-indigo-900 font-medium space-y-1">
                          <div className="font-semibold text-indigo-950">
                            {selectedFamily
                              ? familyNameDashShort(selectedFamily)
                              : (selectedPres.genericCode || '—')}
                          </div>
                          <div>
                            {[
                              `${translate('familyGenericCodeLabel')}: ${selectedPres.genericCode || '—'}`,
                              selectedFamily
                                ? `${translate('familyCodeLabel')}: ${categoryFamilyCode(selectedFamily) || '—'}`
                                : '',
                              formatPresentationVolumeLine(selectedPres),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          <div className="flex items-center gap-1 text-green-700">
                            <DollarSign className="h-4 w-4 shrink-0" />
                            <span>
                              {translate('currentPrice')}:{' '}
                              {(presentationLatestPrices[presentationPriceKey(selectedPres.id)] ?? 0).toLocaleString(
                                locale,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>
                          </div>
                          <p className="text-xs font-normal text-indigo-700/90">{translate('productPricePresentationHint')}</p>
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
                    {(formData.imagePreviewUrl || formData.imageFileName || editingProduct?.image) ? (
                      <div className="relative size-full">
                        {(() => {
                          const imageSrc = buildProductImageSrc(
                            formData.imagePreviewUrl,
                            formData.imageFileName,
                            editingProduct?.image
                          );
                          if (!imageSrc) return null;
                          return (
                            <img
                              src={imageSrc}
                              alt=""
                              className="absolute inset-0 size-full object-cover"
                            />
                          );
                        })()}
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
              <div className="flex items-center gap-2 w-48 min-w-0">
                <Filter className="h-4 w-4 shrink-0 text-gray-500" />
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={statusFilter}
                  placeholder={translate('filterByStatus')}
                  clearable
                  clearToValue="all-status"
                  options={[
                    { value: 'all-status', label: translate('allStatuses') },
                    { value: 'active', label: translate('active') },
                    { value: 'inactive', label: translate('inactive') },
                  ]}
                  onValueChange={setStatusFilter}
                />
              </div>

              <div className="flex items-center gap-2 w-48 min-w-0">
                <Tag className="h-4 w-4 shrink-0 text-gray-500" />
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={categoryFilter}
                  placeholder={translate('filterByCategory')}
                  clearable
                  clearToValue="all-categories"
                  options={[
                    { value: 'all-categories', label: translate('allCategories') },
                    ...getUniqueCategories().map((category) => ({ value: category, label: category })),
                  ]}
                  onValueChange={setCategoryFilter}
                />
              </div>
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
                    {translate('productCode')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('sku')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('name')}
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
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                          {getProductImageSrc(product) ? (
                            <img src={getProductImageSrc(product) ?? undefined} alt="" className="w-12 h-12 object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-indigo-600" />
                          )}
                        </div>
                        <span className="font-mono tabular-nums text-sm font-semibold text-gray-900">
                          {getProductCodeOnly(product)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono tabular-nums text-sm text-gray-800">
                        {getProductSkuForDisplay(product)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 max-w-[220px]">
                      <span className="truncate block" title={String(product.name ?? '').trim() || getProductDisplayName(product)}>
                        {getProductDisplayName(product)}
                      </span>
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
                          <p>{translate('productPricePresentationHint')}</p>
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{translate('delete')} {translate('product')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {translate('confirmDeleteProduct').replace('{name}', getProductDisplayName(product))}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => void handleDeleteProduct(product)}
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
          <Tabs defaultValue="brands" className="w-full">
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-indigo-100 bg-indigo-50/60 p-1">
              <TabsTrigger value="brands" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Award className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                {translate('catalogTabBrands')}
              </TabsTrigger>
              <TabsTrigger value="classes" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Layers className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                {translate('catalogTabClasses')}
              </TabsTrigger>
              <TabsTrigger value="families" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <FolderTree className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                {translate('catalogTabFamilies')}
              </TabsTrigger>
              <TabsTrigger value="presentations" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Package className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                {translate('catalogTabPresentations')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brands" className="mt-0 focus-visible:outline-none">
              <div className="mx-auto max-w-3xl">
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
                  <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xs h-7 rounded-md border border-gray-200 bg-gray-50 px-2 transition-colors focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 focus-within:bg-white">
                    <Search className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={translate('search')}
                      value={brandSearchTerm}
                      onChange={(e) => setBrandSearchTerm(e.target.value)}
                      className="flex-1 min-w-0 h-full border-0 bg-transparent p-0 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="divide-y divide-gray-200 bg-white">
                  {filteredBrandsForList.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-gray-500 text-center">{brandSearchTerm.trim() ? translate('noResults') : translate('noBrands')}</p>
                  ) : (
                    pagedBrandsForList.map((b) => (
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
                              <button type="button" className="p-1.5 rounded-md hover:bg-gray-100" aria-label={translate('activateDeactivate')}>
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
                {filteredBrandsForList.length > catalogPageSize && (
                  <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-100 px-4 bg-white rounded-b-lg">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCatalogBrandPage((p) => Math.max(1, p - 1))}
                      disabled={catalogBrandPage === 1}
                    >
                      {translate('previous')}
                    </Button>
                    <span className="text-sm text-gray-600">
                      {translate('page')} {catalogBrandPage} {translate('pageOf')}{' '}
                      {Math.ceil(filteredBrandsForList.length / catalogPageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCatalogBrandPage((p) =>
                          Math.min(Math.ceil(filteredBrandsForList.length / catalogPageSize), p + 1)
                        )
                      }
                      disabled={
                        catalogBrandPage >= Math.ceil(filteredBrandsForList.length / catalogPageSize)
                      }
                    >
                      {translate('next')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
              </div>
            </TabsContent>

            <TabsContent value="classes" className="mt-0 focus-visible:outline-none">
              <div className="mx-auto max-w-3xl">
                <Card>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 py-3.5 border-b-2 border-indigo-200 bg-indigo-50/80 rounded-t-lg">
                      <span className="text-base font-bold text-indigo-900">{translate('catalogTabClasses')}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClass(null);
                          setClassFormName('');
                          setShowClassDialog(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {translate('addClass')}
                      </button>
                    </div>
                    <div className="px-3 py-1.5 border-b border-gray-200 bg-white">
                      <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xs h-7 rounded-md border border-gray-200 bg-gray-50 px-2 transition-colors focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 focus-within:bg-white">
                        <Search className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <input
                          type="text"
                          placeholder={translate('search')}
                          value={classSearchTerm}
                          onChange={(e) => setClassSearchTerm(e.target.value)}
                          className="flex-1 min-w-0 h-full border-0 bg-transparent p-0 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200 bg-white">
                      {filteredClassesForList.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-gray-500 text-center">
                          {classSearchTerm.trim() ? translate('noResults') : translate('noClasses')}
                        </p>
                      ) : (
                        pagedClassesForList.map((cl) => (
                          <div key={cl.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 group gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate min-w-0">{cl.name}</span>
                            <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${cl.isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                                {cl.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClass(cl);
                                  setClassFormName(cl.name);
                                  setShowClassDialog(true);
                                }}
                                className="p-1.5 rounded-md text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50"
                                aria-label={translate('edit')}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button type="button" className="p-1.5 rounded-md hover:bg-gray-100" aria-label={translate('activateDeactivate')}>
                                    {cl.isActive ? (
                                      <PowerOff className="h-3.5 w-3.5 text-red-500 hover:text-red-600" />
                                    ) : (
                                      <Power className="h-3.5 w-3.5 text-green-600 hover:text-green-700" />
                                    )}
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {cl.isActive ? translate('deactivate') : translate('activate')}{' '}
                                      {translate('catalogTabClasses').toLowerCase()}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {translate('confirmDeactivateBrand').replace('{name}', cl.name)}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleToggleClass(cl)}>{translate('confirm')}</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              {!isClassUsedInAnyFamily(cl.id) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button type="button" className="p-1.5 rounded-md text-red-500 hover:bg-red-50" aria-label={translate('delete')}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{translate('delete')}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {translate('confirmDeleteClass').replace('{name}', cl.name)}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => handleDeleteClass(cl)}
                                      >
                                        {translate('delete')}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {filteredClassesForList.length > catalogPageSize && (
                      <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-100 px-4 bg-white rounded-b-lg">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCatalogClassPage((p) => Math.max(1, p - 1))}
                          disabled={catalogClassPage === 1}
                        >
                          {translate('previous')}
                        </Button>
                        <span className="text-sm text-gray-600">
                          {translate('page')} {catalogClassPage} {translate('pageOf')}{' '}
                          {Math.ceil(filteredClassesForList.length / catalogPageSize)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCatalogClassPage((p) =>
                              Math.min(Math.ceil(filteredClassesForList.length / catalogPageSize), p + 1)
                            )
                          }
                          disabled={
                            catalogClassPage >= Math.ceil(filteredClassesForList.length / catalogPageSize)
                          }
                        >
                          {translate('next')}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="families" className="mt-0 focus-visible:outline-none">
              <div className="mx-auto max-w-3xl">
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3.5 border-b-2 border-indigo-200 bg-indigo-50/80 rounded-t-lg">
                  <span className="text-base font-bold text-indigo-900">{translate('families')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setFamilyForm({
                        name: '',
                        brandId: '',
                        classId: '',
                        familyCode: '',
                      });
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
                  <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xs h-7 rounded-md border border-gray-200 bg-gray-50 px-2 transition-colors focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 focus-within:bg-white">
                    <Search className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={translate('search')}
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      className="flex-1 min-w-0 h-full border-0 bg-transparent p-0 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="divide-y divide-gray-200 bg-white">
                  {filteredFamiliesForList.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-gray-500 text-center">{categorySearchTerm.trim() ? translate('noResults') : translate('noFamilies')}</p>
                  ) : (
                    pagedFamiliesForList.map((c) => {
                      const brandName = findBrandById(brands, String(c.brandId ?? ''))?.name ?? '—';
                      const className = findClassById(classes, String(c.classId ?? ''))?.name ?? '—';
                      return (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 group gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-sm font-semibold text-gray-900">{`Cód. ${categoryFamilyCode(c) || '—'}`}</span>
                            <span className="text-sm font-semibold text-gray-900">{c.name || '—'}</span>
                          </div>
                          <span className="text-xs text-gray-600 block truncate mt-0.5">
                            {`${translate('brand')}: ${brandName} · ${translate('classLabel')}: ${className}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 shrink-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${c.isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                            {c.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                          </span>
                          <button type="button" onClick={() => {
                            setEditingCategory(c);
                            setFamilyForm({
                              name: c.name ?? '',
                              brandId: String(c.brandId ?? ''),
                              classId: String(c.classId ?? ''),
                              familyCode: categoryFamilyCode(c),
                            });
                            setFamilyFormErrors({});
                            setShowCategoryDialog(true);
                          }} className="p-1.5 rounded-md text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50" aria-label={translate('edit')}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button type="button" className="p-1.5 rounded-md hover:bg-gray-100" aria-label={translate('activateDeactivate')}>
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
                          {canDeleteFamily(c.id) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                                  aria-label={translate('delete')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{translate('delete')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {translate('confirmDeleteFamily').replace('{name}', c.name)}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => void handleDeleteFamily(c)}
                                  >
                                    {translate('delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
                {filteredFamiliesForList.length > catalogPageSize && (
                  <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-100 px-4 bg-white rounded-b-lg">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCatalogFamilyPage((p) => Math.max(1, p - 1))}
                      disabled={catalogFamilyPage === 1}
                    >
                      {translate('previous')}
                    </Button>
                    <span className="text-sm text-gray-600">
                      {translate('page')} {catalogFamilyPage} {translate('pageOf')}{' '}
                      {Math.ceil(filteredFamiliesForList.length / catalogPageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCatalogFamilyPage((p) =>
                          Math.min(Math.ceil(filteredFamiliesForList.length / catalogPageSize), p + 1)
                        )
                      }
                      disabled={
                        catalogFamilyPage >= Math.ceil(filteredFamiliesForList.length / catalogPageSize)
                      }
                    >
                      {translate('next')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
              </div>
            </TabsContent>

            <TabsContent value="presentations" className="mt-0 focus-visible:outline-none">
              <div className="mx-auto max-w-3xl">
              <Card>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3.5 border-b-2 border-indigo-200 bg-indigo-50/80 rounded-t-lg">
                    <span className="text-base font-bold text-indigo-900">{translate('catalogTabPresentations')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPresentation(null);
                        setPresentationForm({
                          familyId: '',
                          genericCode: '',
                          volume: '',
                          unit: '',
                          initialPrice: '',
                        });
                        setShowPresentationDialog(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {translate('addPresentation')}
                    </button>
                  </div>
                  <div className="px-3 py-1.5 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xs h-7 rounded-md border border-gray-200 bg-gray-50 px-2 transition-colors focus-within:ring-1 focus-within:ring-indigo-400 focus-within:border-indigo-400 focus-within:bg-white">
                      <Search className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <input
                        type="text"
                        placeholder={translate('search')}
                        value={presentationSearchTerm}
                        onChange={(e) => setPresentationSearchTerm(e.target.value)}
                        className="flex-1 min-w-0 h-full border-0 bg-transparent p-0 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200 bg-white">
                    {filteredPresentationsForList.length === 0 ? (
                      <p className="px-4 py-8 text-sm text-gray-500 text-center">
                        {presentationSearchTerm.trim() ? translate('noResults') : translate('noPresentations')}
                      </p>
                    ) : (
                      pagedPresentationsForList.map((p) => {
                        const fam = findFamilyById(categories, String(p.familyId ?? ''));
                        const familyName = fam ? familyNameDashShort(fam) : '—';
                        const familyCode = fam ? categoryFamilyCode(fam) : '';
                        const volLine = formatPresentationVolumeLine(p);
                        const priceVal = presentationLatestPrices[presentationPriceKey(p.id)] ?? 0;
                        return (
                          <div key={p.id} className="flex flex-col px-4 py-3 hover:bg-gray-50 group gap-0.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900 font-mono tabular-nums">
                                    {`${translate('genericCodeAbbr')} ${p.genericCode?.trim() || '—'}`}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900 truncate min-w-0 max-w-full">
                                    {familyName}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100">
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${p.isActive ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}
                                >
                                  {p.isActive ? translate('activeBadge') : translate('inactiveBadge')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPresentation(p);
                                    setPresentationForm({
                                      familyId: p.familyId ?? '',
                                      genericCode: p.genericCode ?? '',
                                      volume:
                                        p.volume != null && Number.isFinite(Number(p.volume))
                                          ? String(p.volume)
                                          : '',
                                      unit: p.unit ?? '',
                                      initialPrice: '',
                                    });
                                    setShowPresentationDialog(true);
                                  }}
                                  className="p-1.5 rounded-md text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50"
                                  aria-label={translate('edit')}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button
                                      type="button"
                                      className="p-1.5 rounded-md hover:bg-gray-100"
                                      aria-label={translate('activateDeactivate')}
                                    >
                                      {p.isActive ? (
                                        <PowerOff className="h-3.5 w-3.5 text-red-500 hover:text-red-600" />
                                      ) : (
                                        <Power className="h-3.5 w-3.5 text-green-600 hover:text-green-700" />
                                      )}
                                    </button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {p.isActive ? translate('deactivate') : translate('activate')}{' '}
                                        {translate('catalogTabPresentations').toLowerCase()}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {translate('confirmDeactivateBrand').replace('{name}', p.genericCode || '—')}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleTogglePresentation(p)}>
                                        {translate('confirm')}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                {!hasProductsInPresentation(p.id) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <button
                                        type="button"
                                        className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                                        aria-label={translate('delete')}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>{translate('delete')}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {translate('confirmDeletePresentation').replace('{sku}', p.genericCode || '—')}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-red-600 hover:bg-red-700"
                                          onClick={() => handleDeletePresentation(p)}
                                        >
                                          {translate('delete')}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-600 block truncate sm:text-sm">
                              {`${translate('familyCodeLabel')}: ${familyCode || '—'}`}
                              {volLine ? ` · ${volLine}` : ''}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
                              <span className="flex items-center gap-1 text-sm font-semibold text-green-700 tabular-nums sm:text-base">
                                <DollarSign className="h-3.5 w-3.5 shrink-0 text-green-600 sm:h-4 sm:w-4" aria-hidden />
                                {priceVal.toLocaleString(locale, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              <div className="flex items-center gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPresentationForPrice(p);
                                        setPriceUpdateData({
                                          price: presentationLatestPrices[presentationPriceKey(p.id)] ?? 0,
                                        });
                                        setShowUpdatePriceDialog(true);
                                      }}
                                      className="p-1.5 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
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
                                        setSelectedPresentationForPrice(p);
                                        resetQueryForm();
                                        loadPriceHistoryForDialog(p.id);
                                        setShowPriceHistoryDialog(true);
                                      }}
                                      className="p-1.5 rounded-md text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
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
                          </div>
                        );
                      })
                    )}
                  </div>
                  {filteredPresentationsForList.length > catalogPageSize && (
                    <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-100 px-4 bg-white rounded-b-lg">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCatalogPresentationPage((pg) => Math.max(1, pg - 1))}
                        disabled={catalogPresentationPage === 1}
                      >
                        {translate('previous')}
                      </Button>
                      <span className="text-sm text-gray-600">
                        {translate('page')} {catalogPresentationPage} {translate('pageOf')}{' '}
                        {Math.ceil(filteredPresentationsForList.length / catalogPageSize)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCatalogPresentationPage((pg) =>
                            Math.min(
                              Math.ceil(filteredPresentationsForList.length / catalogPageSize),
                              pg + 1
                            )
                          )
                        }
                        disabled={
                          catalogPresentationPage >=
                          Math.ceil(filteredPresentationsForList.length / catalogPageSize)
                        }
                      >
                        {translate('next')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </TabsContent>
          </Tabs>
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
                  {getProductImageSrc(selectedProduct) ? (
                    <img
                      src={getProductImageSrc(selectedProduct) ?? undefined}
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
                      <span className="truncate font-mono tabular-nums">{getProductCodeOnly(selectedProduct)}</span>
                    </h3>
                    <Badge className={getStatusBadgeColor(selectedProduct.isActive)}>
                      {selectedProduct.isActive ? translate('active') : translate('inactive')}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 font-mono tabular-nums">
                    {translate('sku')}: {getProductSkuForDisplay(selectedProduct)}
                    {' · '}
                    {translate('familyGenericCodeLabel')}:{' '}
                    {String(
                      selectedProduct.genericCode ??
                      presentations.find(
                        (p) => normId(String(p.id)) === normId(resolvePresentationIdForProduct(selectedProduct, presentations))
                      )?.genericCode ?? selectedProduct.presentation?.genericCode ?? ''
                    ).trim() || '—'}
                  </p>
                  <p className="text-sm text-gray-600 truncate" title={selectedProduct.name}>
                    {selectedProduct.name}
                  </p>
                  <div className="flex items-center gap-1 text-green-600 font-semibold text-base pt-0.5">
                    <DollarSign className="h-4 w-4 shrink-0" />
                    {(selectedProduct.currentPrice || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl bg-gray-50/80 border border-gray-100 p-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{translate('family')}</p>
                  {(() => {
                    const familyId = String(selectedProduct.categoryId ?? selectedProduct.familyId ?? '').trim();
                    const selectedFamily = familyId
                      ? categories.find((c) => String(c.id).trim() === familyId)
                      : undefined;
                    const familyNames = selectedFamily
                      ? familyNameDashShort(selectedFamily)
                      : getCategoryName(selectedProduct);
                    const familyCode = selectedFamily ? categoryFamilyCode(selectedFamily) : '';
                    return (
                      <>
                        <p className="flex items-center gap-1.5 mt-1 text-sm font-medium text-gray-900 truncate">
                          <Tag className="h-4 w-4 text-gray-400 shrink-0" />
                          {familyNames}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {`Cód. ${familyCode || '—'}`}
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{translate('brandHeader')}</p>
                  <p className="flex items-center gap-1.5 mt-1 text-sm font-medium text-gray-900 truncate">
                    <Award className="h-4 w-4 text-gray-400 shrink-0" />
                    {brands.find(b => b.id === selectedProduct.brandId)?.name ?? '-'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{translate('classLabel')}</p>
                  <p className="flex items-center gap-1.5 mt-1 text-sm font-medium text-gray-900 truncate">
                    <Layers className="h-4 w-4 text-gray-400 shrink-0" />
                    {(() => {
                      const familyId = String(selectedProduct.categoryId ?? selectedProduct.familyId ?? '').trim();
                      const fam = familyId ? categories.find((c) => String(c.id).trim() === familyId) : undefined;
                      return fam?.classId ? findClassById(classes, String(fam.classId))?.name ?? '—' : '—';
                    })()}
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

      {/* Update Price Dialog (por presentación) */}
      <Dialog
        open={showUpdatePriceDialog}
        onOpenChange={(open) => {
          setShowUpdatePriceDialog(open);
          if (!open) {
            resetPriceForm();
            setSelectedPresentationForPrice(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{translate('updatePriceTitle')}</DialogTitle>
            <DialogDescription>
              {selectedPresentationForPrice &&
                translate('updatePriceDescPresentation')
                  .replace('{sku}', selectedPresentationForPrice.genericCode || '—')
                  .replace(
                    '{family}',
                    (() => {
                      const fam = categories.find(
                        (c) =>
                          String(c.id).trim() === String(selectedPresentationForPrice.familyId ?? '').trim()
                      );
                      return fam ? familyNameDashShort(fam) : '—';
                    })()
                  )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 px-6 py-4">
            {selectedPresentationForPrice && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">{translate('currentPrice')}:</p>
                <p className="text-lg font-semibold text-green-600">
                  ${(presentationLatestPrices[presentationPriceKey(selectedPresentationForPrice.id)] ?? 0).toLocaleString(locale, { 
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

      {/* Price History Dialog (por presentación) */}
      <Dialog
        open={showPriceHistoryDialog}
        onOpenChange={(open) => {
          setShowPriceHistoryDialog(open);
          if (!open) {
            resetQueryForm();
            setSelectedPresentationForPrice(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{translate('priceHistoryTitle')}</DialogTitle>
            <DialogDescription>
              {selectedPresentationForPrice &&
                translate('priceHistoryDescPresentation')
                  .replace('{sku}', selectedPresentationForPrice.genericCode || '—')
                  .replace(
                    '{family}',
                    (() => {
                      const fam = categories.find(
                        (c) =>
                          String(c.id).trim() === String(selectedPresentationForPrice.familyId ?? '').trim()
                      );
                      return fam ? familyNameDashShort(fam) : '—';
                    })()
                  )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPresentationForPrice && (
            <div className="space-y-4">
              {/* Barra de filtros style */}
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{translate('currentPrice')}:</span>
                    <span className="text-lg font-bold text-green-600">
                      ${(presentationLatestPrices[presentationPriceKey(selectedPresentationForPrice.id)] ?? 0).toLocaleString(locale, { 
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
                setSelectedPresentationForPrice(null);
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

      {/* Class dialog */}
      <Dialog
        open={showClassDialog}
        onOpenChange={(open) => {
          setShowClassDialog(open);
          if (!open) {
            setClassFormName('');
            setEditingClass(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClass ? translate('editClass') : translate('newClass')}</DialogTitle>
            <DialogDescription>
              {editingClass ? translate('editClassDesc') : translate('newClassDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <Label htmlFor="classNameField">{translate('name')} *</Label>
            <Input
              id="classNameField"
              value={classFormName}
              onChange={(e) => setClassFormName(e.target.value)}
              placeholder={translate('name')}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowClassDialog(false);
                setClassFormName('');
                setEditingClass(null);
              }}
            >
              {translate('cancel')}
            </Button>
            <Button onClick={handleSaveClass} className="bg-indigo-600 hover:bg-indigo-700">
              {translate('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Presentation dialog */}
      <Dialog
        open={showPresentationDialog}
        onOpenChange={(open) => {
          setShowPresentationDialog(open);
          if (!open) {
            setPresentationForm({
              familyId: '',
              genericCode: '',
              volume: '',
              unit: '',
              initialPrice: '',
            });
            setEditingPresentation(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPresentation ? translate('editPresentation') : translate('newPresentation')}
            </DialogTitle>
            <DialogDescription>
              {editingPresentation ? translate('editPresentationDesc') : translate('newPresentationDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div>
              <Label>{translate('family')} *</Label>
              <SearchableSelect
                value={presentationForm.familyId}
                placeholder={translate('selectFamily')}
                disabled={!!editingPresentation || !activeCategories.length}
                options={activeCategories.map((c) => ({
                  value: c.id,
                  label: familySelectLabel(c),
                }))}
                onValueChange={(v) => setPresentationForm((prev) => ({ ...prev, familyId: v }))}
                zIndex={60}
              />
              {editingPresentation ? (
                <p className="text-xs text-gray-500 mt-1">{translate('presentationFamilyLockedHint')}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="presGeneric">{translate('familyGenericCodeLabel')} *</Label>
              <Input
                id="presGeneric"
                value={presentationForm.genericCode}
                maxLength={20}
                onChange={(e) => setPresentationForm((prev) => ({ ...prev, genericCode: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="presVolume">{translate('familyVolumeLabel')}</Label>
                <Input
                  id="presVolume"
                  type="text"
                  inputMode="decimal"
                  value={presentationForm.volume}
                  onChange={(e) => setPresentationForm((prev) => ({ ...prev, volume: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="presUnit">{translate('familyUnitLabel')}</Label>
                <Input
                  id="presUnit"
                  value={presentationForm.unit}
                  onChange={(e) => setPresentationForm((prev) => ({ ...prev, unit: e.target.value }))}
                />
              </div>
            </div>
            {!editingPresentation ? (
              <div>
                <Label htmlFor="presInitialPrice">
                  {translate('presentationInitialPriceLabel')} *
                </Label>
                <Input
                  id="presInitialPrice"
                  type="text"
                  inputMode="decimal"
                  value={presentationForm.initialPrice}
                  onChange={(e) => setPresentationForm((prev) => ({ ...prev, initialPrice: e.target.value }))}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">{translate('presentationInitialPriceHint')}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPresentationDialog(false);
                setPresentationForm({
                  familyId: '',
                  genericCode: '',
                  volume: '',
                  unit: '',
                  initialPrice: '',
                });
                setEditingPresentation(null);
              }}
            >
              {translate('cancel')}
            </Button>
            <Button onClick={handleSavePresentation} className="bg-indigo-600 hover:bg-indigo-700">
              {translate('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Family dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCategory ? translate('editFamily') : translate('newFamily')}</DialogTitle>
            <DialogDescription>
              {editingCategory ? translate('editFamilyDesc') : translate('newFamilyDesc')}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-gray-500 px-6 -mt-1 pb-2">{translate('familyFormSchemaHint')}</p>
          <div className="space-y-4 px-6 py-4">
            <div>
              <Label htmlFor="familyName">{translate('name')} *</Label>
              <Input
                id="familyName"
                value={familyForm.name}
                maxLength={25}
                onChange={(e) => {
                  setFamilyForm((prev) => ({ ...prev, name: e.target.value }));
                  if (familyFormErrors.name) setFamilyFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Ej. Bebidas"
                className={familyFormErrors.name ? 'border-red-500' : ''}
              />
              <p className="text-xs text-gray-500 mt-1">{translate('familyNameMaxHint')}</p>
              {familyFormErrors.name && <p className="text-sm text-red-600 mt-1">{familyFormErrors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{translate('brand')} *</Label>
                <SearchableSelect
                  value={familyForm.brandId}
                  placeholder={translate('selectBrand')}
                  disabled={!brandsForFamilyForm.length}
                  options={brandsForFamilyForm.map((b) => ({ value: b.id, label: b.name }))}
                  onValueChange={(v) => {
                    setFamilyForm((prev) => ({ ...prev, brandId: v }));
                    if (familyFormErrors.brandId) setFamilyFormErrors((prev) => ({ ...prev, brandId: undefined }));
                  }}
                  aria-invalid={!!familyFormErrors.brandId}
                  inputClassName={familyFormErrors.brandId ? 'border-red-500' : ''}
                  zIndex={60}
                />
                {familyFormErrors.brandId && <p className="text-sm text-red-600 mt-1">{familyFormErrors.brandId}</p>}
              </div>
              <div>
                <Label>{translate('classLabel')} *</Label>
                <SearchableSelect
                  value={familyForm.classId}
                  placeholder={translate('selectClass')}
                  disabled={!classesForFamilyForm.length}
                  options={classesForFamilyForm.map((c) => ({ value: c.id, label: c.name }))}
                  onValueChange={(v) => {
                    setFamilyForm((prev) => ({ ...prev, classId: v }));
                    if (familyFormErrors.classId) setFamilyFormErrors((prev) => ({ ...prev, classId: undefined }));
                  }}
                  aria-invalid={!!familyFormErrors.classId}
                  inputClassName={familyFormErrors.classId ? 'border-red-500' : ''}
                  zIndex={60}
                />
                {familyFormErrors.classId && <p className="text-sm text-red-600 mt-1">{familyFormErrors.classId}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="familyCodeField">{translate('familyCodeLabel')} *</Label>
              <Input
                id="familyCodeField"
                value={familyForm.familyCode}
                maxLength={4}
                onChange={(e) => {
                  setFamilyForm((prev) => ({ ...prev, familyCode: e.target.value.toUpperCase() }));
                  if (familyFormErrors.familyCode) setFamilyFormErrors((prev) => ({ ...prev, familyCode: undefined }));
                }}
                placeholder="AB12"
                className={`font-mono uppercase ${familyFormErrors.familyCode ? 'border-red-500' : ''}`}
              />
              {familyFormErrors.familyCode && <p className="text-sm text-red-600 mt-1">{familyFormErrors.familyCode}</p>}
              <p className="text-xs text-gray-500 mt-1">{translate('familyCodeLengthHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCategoryDialog(false);
              setFamilyForm({
                name: '',
                brandId: '',
                classId: '',
                familyCode: '',
              });
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
import React, { useState, useEffect } from 'react';
import {
  Layout,
  Plus,
  Search,
  Eye,
  Power,
  ArrowLeft,
  Calendar,
  Grid3x3,
  CheckCircle,
  XCircle,
  History,
  Zap,
  Edit
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
  DialogTrigger
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
import { Planogram, Product, Distribution, PlanogramWithDistribution } from '@/shared/types';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { getFromLocalStorage } from '@/shared/services/database';
import { toast } from '@/shared/components/base/Toast';
import { planogramsApi } from '@/shared/services/planograms-api';
import { distributionsApi } from '@/shared/services/distributions-api';
import { productsApi } from '@/shared/services/products-api';
import { PlanogramEditor } from './components/PlanogramEditor';
import { PlanogramViewer } from './components/PlanogramViewer';

interface PlanogramManagementProps {
  onBack: () => void;
}

export const PlanogramManagement: React.FC<PlanogramManagementProps> = ({ onBack }) => {
  const { translate } = useLanguage();
  const [planograms, setPlanograms] = useState<Planogram[]>([]);
  const [filteredPlanograms, setFilteredPlanograms] = useState<Planogram[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPlanogram, setSelectedPlanogram] = useState<PlanogramWithDistribution | null>(null);
  const [editingPlanogram, setEditingPlanogram] = useState<Planogram | null>(null);
  const [orders, setOrders] = useState<{ planogramId?: string }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [planograms, searchTerm]);



  const loadData = async () => {
    try {
      const [planogramData, productData] = await Promise.all([
        planogramsApi.fetchAll(),
        productsApi.fetchAll()
      ]);
      setPlanograms(planogramData);
      setProducts(productData);
      setOrders(getFromLocalStorage('app-orders') || []);
      const distArrays = await Promise.all(planogramData.map((p) => distributionsApi.getByPlanogram(p.id)));
      setDistributions(distArrays.flat());
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error(translate('errorLoadPlanogramData'));
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = planograms;

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(planogram =>
        planogram.name.toLowerCase().includes(searchLower) ||
        planogram.id.toLowerCase().includes(searchLower) ||
        (planogram.description && planogram.description.toLowerCase().includes(searchLower))
      );
    }

    setFilteredPlanograms(filtered);
  };

  const handleActivatePlanogram = async (planogram: Planogram) => {
    try {
      const activePlanogram = planograms.find((p) => p.isActive);
      if (activePlanogram && activePlanogram.id !== planogram.id) {
        await planogramsApi.setActive(activePlanogram.id, false);
      }
      await planogramsApi.setActive(planogram.id, true);
      await loadData();
      toast.success(translate('planogramActivatedSuccess'));
    } catch (error) {
      console.error('Error activando planograma:', error);
      toast.error(translate('errorActivatePlanogram'));
    }
  };

  const handleDeactivatePlanogram = async (planogram: Planogram) => {
    try {
      await planogramsApi.setActive(planogram.id, false);
      await loadData();
      toast.success(translate('planogramDeactivatedSuccess'));
    } catch (error) {
      console.error('Error desactivando planograma:', error);
      toast.error(translate('errorDeactivatePlanogram'));
    }
  };

  const handleViewPlanogram = (planogram: Planogram) => {
    // Obtener distribuciones para este planograma
    const planogramDistributions = distributions.filter(d => d.planogramId === planogram.id);
    
    // Obtener productos asociados
    const associatedProductIds = planogramDistributions.map(d => d.productId);
    const associatedProducts = products.filter(p => associatedProductIds.includes(p.id));

    const planogramWithDistribution: PlanogramWithDistribution = {
      ...planogram,
      distributions: planogramDistributions,
      products: associatedProducts
    };

    setSelectedPlanogram(planogramWithDistribution);
    setShowViewDialog(true);
  };

  const handlePlanogramCreated = () => {
    // Recargar datos después de crear un planograma
    loadData();
    setShowCreateDialog(false);
  };

  const handlePlanogramUpdated = () => {
    // Recargar datos después de editar un planograma
    loadData();
    setShowEditDialog(false);
    setEditingPlanogram(null);
  };

  /** Editable si no tiene venta asociada (app-orders con planogramId). Sin pedidos o sin coincidencia = editable. */
  const canEditPlanogram = (planogram: Planogram): boolean => {
    const list = Array.isArray(orders) ? orders : [];
    if (list.length === 0) return true;
    const pid = String(planogram?.id ?? '').trim();
    const hasSale = list.some((o: any) => String(o?.planogramId ?? o?.planogram_id ?? '').trim() === pid);
    return !hasSale;
  };

  const handleEditPlanogram = (planogram: Planogram) => {
    setEditingPlanogram(planogram);
    setShowEditDialog(true);
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getActivePlanogram = () => {
    return planograms.find(p => p.isActive);
  };

  const getTotalDistributions = (planogramId: string) => {
    return distributions.filter(d => d.planogramId === planogramId).length;
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
          <div className="p-2.5 bg-purple-100 rounded-lg">
            <Layout className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('planogramsTitle')}</h1>
            <p className="text-gray-500">{translate('planogramsSubtitleStore')}</p>
          </div>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {translate('createPlanogram')}
            </Button>
          </DialogTrigger>
          <DialogContent 
            className="!max-w-[98vw] !w-[98vw] !h-[98vh] !max-h-[98vh] p-0 flex flex-col overflow-hidden"
            showClose={true}
          >
            <DialogHeader className="px-8 py-5 border-b border-gray-200 flex-shrink-0 bg-white">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <Layout className="h-6 w-6 text-indigo-600" />
                {translate('createNewPlanogram')}
              </DialogTitle>
              <DialogDescription className="text-base mt-1">
                {translate('designGridDesc')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <PlanogramEditor 
                products={products.filter(p => p.isActive)}
                onSave={handlePlanogramCreated}
                onCancel={() => setShowCreateDialog(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalPlanograms')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{planograms.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50">
                <Layout className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('activePlanogramStat')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {getActivePlanogram() ? '1' : '0'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-50">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('activeProducts')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {products.filter(p => p.isActive).length}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50">
                <Grid3x3 className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('versions')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {planograms.reduce((sum, p) => sum + p.version, 0)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-orange-50">
                <History className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Planogram Alert */}
      {getActivePlanogram() && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-green-900">
                  {translate('activePlanogramStat')}: {getActivePlanogram()!.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-green-700">
                    {translate('activatedOn')} {new Date(getActivePlanogram()!.activatedAt || getActivePlanogram()!.updatedAt).toLocaleDateString('es-ES')}
                  </p>
                  {canEditPlanogram(getActivePlanogram()!) && (
                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                      {translate('editableNoSales')}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEditPlanogram(getActivePlanogram()!) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 hover:text-blue-700"
                    onClick={() => handleEditPlanogram(getActivePlanogram()!)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {translate('edit')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewPlanogram(getActivePlanogram()!)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {translate('viewDistribution')}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-amber-700 hover:bg-amber-50">
                      <Power className="h-4 w-4 mr-2" />
                      Desactivar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{translate('deactivatePlanogramTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {translate('deactivatePlanogramConfirm').replace('{name}', getActivePlanogram()!.name)}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeactivatePlanogram(getActivePlanogram()!)}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {translate('deactivate')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={translate('searchPlanogramsPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planograms Table */}
      <Card>
        <CardHeader>
          <CardTitle>{translate('planogramsList')}</CardTitle>
          <CardDescription>
            {translate('managePlanogramsVersions')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('planogramHeader')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('versionHeader')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('status')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('productsLabel')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('creationDate')}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPlanograms.map((planogram) => (
                  <tr key={planogram.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            planogram.isActive ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            <Layout className={`h-5 w-5 ${
                              planogram.isActive ? 'text-green-600' : 'text-gray-600'
                            }`} />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {planogram.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {planogram.description || translate('noDescription')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline" className="text-sm">
                        v{planogram.version}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusBadgeColor(planogram.isActive)}>
                          {planogram.isActive ? translate('active') : translate('inactive')}
                        </Badge>
                        {canEditPlanogram(planogram) && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs" title={translate('editableNoSales')}>
                            {translate('editable')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getTotalDistributions(planogram.id)} {translate('productsCount')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(planogram.createdAt).toLocaleDateString('es-ES')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewPlanogram(planogram)}
                          title={translate('viewPlanogram')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {/* Botón de editar - solo si no tiene ventas asociadas */}
                        {canEditPlanogram(planogram) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditPlanogram(planogram)}
                            className="text-blue-600 hover:text-blue-700"
                            title={translate('editPlanogramOnlyIfNoSales')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {!planogram.isActive && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700"
                                title="Activar planograma"
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{translate('activatePlanogramTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {translate('activatePlanogramConfirm').replace('{name}', planogram.name)}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleActivatePlanogram(planogram)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {translate('activate')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredPlanograms.length === 0 && (
            <div className="text-center py-12">
              <Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {translate('noPlanogramsSearch')}
              </h3>
              <p className="text-gray-600">
                {searchTerm
                  ? translate('tryOtherSearchPlanograms')
                  : translate('createFirstPlanogramHint')
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planogram Viewer Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] !h-[95vh] !max-h-[95vh] p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5 text-indigo-600" />
              {translate('viewPlanogram')}: {selectedPlanogram?.name}
            </DialogTitle>
            <DialogDescription>
              {translate('distributionGrid')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlanogram && (
            <div className="flex-1 overflow-hidden p-4">
              <PlanogramViewer planogram={selectedPlanogram} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Planogram Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] !h-[95vh] !max-h-[95vh] p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              {translate('editPlanogram')}: {editingPlanogram?.name}
            </DialogTitle>
            <div className="space-y-2">
              <DialogDescription>
                {translate('editPlanogramTitleDesc')}
              </DialogDescription>
              <Badge className="bg-blue-100 text-blue-800">
                {translate('onlyEditableNoSales')}
              </Badge>
            </div>
          </DialogHeader>
          
          {editingPlanogram && (
            <div className="flex-1 overflow-hidden p-4">
              <PlanogramEditor 
                products={products.filter(p => p.isActive)}
                planogram={editingPlanogram}
                existingDistributions={distributions.filter((d) => d.planogramId === editingPlanogram.id)}
                onSave={handlePlanogramUpdated}
                onCancel={() => {
                  setShowEditDialog(false);
                  setEditingPlanogram(null);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
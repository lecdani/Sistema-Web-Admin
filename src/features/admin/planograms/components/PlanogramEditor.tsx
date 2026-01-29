import React, { useState, useCallback } from 'react';
import {
  Save,
  X,
  Grid3x3,
  Package,
  Trash2,
  RotateCcw,
  Info,
  Building
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Textarea } from '@/shared/components/base/Textarea';
import { Badge } from '@/shared/components/base/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/base/Select';
import { ScrollArea } from '@/shared/components/base/ScrollArea';
import { Product, Planogram, Distribution } from '@/shared/types';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';
import { toast } from '@/shared/components/base/Toast';

interface PlanogramEditorProps {
  products: Product[];
  planogram?: Planogram;
  onSave: () => void;
  onCancel: () => void;
}

interface GridCell {
  x: number;
  y: number;
  product: Product | null;
}

interface PlanogramFormData {
  name: string;
  description: string;
}

const GRID_SIZE = 10;

export const PlanogramEditor: React.FC<PlanogramEditorProps> = ({
  products,
  planogram,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<PlanogramFormData>({
    name: planogram?.name || '',
    description: planogram?.description || ''
  });

  const [grid, setGrid] = useState<GridCell[][]>(() => {
    // Inicializar grilla vacía
    const initialGrid: GridCell[][] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      initialGrid[x] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        initialGrid[x][y] = { x, y, product: null };
      }
    }

    // Si estamos editando, cargar distribución existente
    if (planogram) {
      const distributions = getFromLocalStorage('app-distributions') || [];
      const planogramDistributions = distributions.filter((d: Distribution) => d.planogramId === planogram.id);
      
      planogramDistributions.forEach((dist: Distribution) => {
        const product = products.find(p => p.id === dist.productId);
        if (product && dist.xPosition < GRID_SIZE && dist.yPosition < GRID_SIZE) {
          initialGrid[dist.xPosition][dist.yPosition].product = product;
        }
      });
    }

    return initialGrid;
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [draggedProduct, setDraggedProduct] = useState<Product | null>(null);

  // Obtener categorías únicas
  const getUniqueCategories = () => {
    const categories = products.map(p => p.category).filter(Boolean);
    return [...new Set(categories)].sort();
  };

  // Filtrar productos por categoría
  const filteredProducts = categoryFilter === 'all' 
    ? products 
    : products.filter(p => p.category === categoryFilter);

  // Validar formulario
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error('El nombre del planograma es requerido');
      return false;
    }
    return true;
  };

  // Generar ID único
  const generateId = (): string => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // Obtener productos únicos en la grilla
  const getProductsInGrid = (): Set<string> => {
    const productIds = new Set<string>();
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell.product) {
          productIds.add(cell.product.id);
        }
      });
    });
    return productIds;
  };

  // Verificar si un producto ya está en la grilla
  const isProductInGrid = (productId: string): boolean => {
    return getProductsInGrid().has(productId);
  };

  // Manejar drop en celda
  const handleCellDrop = useCallback((x: number, y: number, product: Product) => {
    // Verificar si el producto ya está en la grilla
    if (isProductInGrid(product.id)) {
      toast.error('Este producto ya está asignado en el planograma');
      return;
    }

    // Verificar si la celda ya está ocupada
    if (grid[x][y].product) {
      toast.error('Esta celda ya está ocupada');
      return;
    }

    // Asignar producto a la celda
    const newGrid = grid.map((row, rowIndex) =>
      row.map((cell, colIndex) =>
        rowIndex === x && colIndex === y
          ? { ...cell, product }
          : cell
      )
    );

    setGrid(newGrid);
    toast.success(`${product.name} asignado a posición (${x + 1}, ${y + 1})`);
  }, [grid]);

  // Remover producto de celda
  const handleRemoveProduct = (x: number, y: number) => {
    const newGrid = grid.map((row, rowIndex) =>
      row.map((cell, colIndex) =>
        rowIndex === x && colIndex === y
          ? { ...cell, product: null }
          : cell
      )
    );

    setGrid(newGrid);
    toast.success('Producto removido de la grilla');
  };

  // Limpiar grilla
  const handleClearGrid = () => {
    const emptyGrid: GridCell[][] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      emptyGrid[x] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        emptyGrid[x][y] = { x, y, product: null };
      }
    }
    setGrid(emptyGrid);
    toast.success('Grilla limpiada');
  };

  // Verificar si un planograma puede ser editado directamente (mismo día)
  const canEditDirectly = (planogram: Planogram): boolean => {
    if (!planogram || !planogram.isActive) return false;
    
    const today = new Date();
    const createdDate = new Date(planogram.createdAt);
    
    return (
      today.getFullYear() === createdDate.getFullYear() &&
      today.getMonth() === createdDate.getMonth() &&
      today.getDate() === createdDate.getDate()
    );
  };

  // Guardar planograma
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const now = new Date();
      const planogramId = planogram?.id || generateId();

      // Crear nuevo planograma o actualizar existente
      const planograms = getFromLocalStorage('app-planograms') || [];
      
      let newPlanogram: Planogram;
      
      if (planogram) {
        // Si el planograma es activo y fue creado hoy, editarlo directamente
        if (canEditDirectly(planogram)) {
          const existingIndex = planograms.findIndex((p: Planogram) => p.id === planogram.id);
          
          newPlanogram = {
            ...planogram,
            name: formData.name.trim(),
            description: formData.description.trim(),
            updatedAt: now
          };
          
          if (existingIndex !== -1) {
            planograms[existingIndex] = newPlanogram;
          }
        } else {
          // Editando planograma existente - crear nueva versión
          const maxVersion = Math.max(...planograms.filter((p: Planogram) => p.name === formData.name).map((p: Planogram) => p.version), 0);
          
          newPlanogram = {
            id: generateId(), // Nuevo ID para nueva versión
            name: formData.name.trim(),
            description: formData.description.trim(),
            version: maxVersion + 1,
            isActive: false, // Las nuevas versiones empiezan inactivas
            createdAt: now,
            updatedAt: now
          };
          
          planograms.push(newPlanogram);
        }
      } else {
        // Creando nuevo planograma
        newPlanogram = {
          id: planogramId,
          name: formData.name.trim(),
          description: formData.description.trim(),
          version: 1,
          isActive: false, // Empezar inactivo
          createdAt: now,
          updatedAt: now
        };
        
        planograms.push(newPlanogram);
      }

      // Guardar planograma
      setToLocalStorage('app-planograms', planograms);

      // Crear distribuciones
      const distributions = getFromLocalStorage('app-distributions') || [];
      
      // Remover distribuciones existentes del planograma que estamos editando
      if (planogram) {
        const filteredDistributions = distributions.filter((d: Distribution) => d.planogramId !== planogram.id);
        setToLocalStorage('app-distributions', filteredDistributions);
      }

      // Agregar nuevas distribuciones
      const newDistributions: Distribution[] = [];
      grid.forEach((row, x) => {
        row.forEach((cell, y) => {
          if (cell.product) {
            newDistributions.push({
              id: generateId(),
              planogramId: newPlanogram.id,
              productId: cell.product.id,
              xPosition: x,
              yPosition: y,
              createdAt: now
            });
          }
        });
      });

      // Guardar distribuciones
      const currentDistributions = getFromLocalStorage('app-distributions') || [];
      const updatedDistributions = [...currentDistributions, ...newDistributions];
      setToLocalStorage('app-distributions', updatedDistributions);

      // Activar automáticamente si es el primer planograma, si no hay ninguno activo, 
      // o si estamos editando directamente un planograma activo del mismo día
      const shouldActivate = planograms.length === 1 || 
                           !planograms.some((p: Planogram) => p.isActive) ||
                           (planogram && canEditDirectly(planogram));

      if (shouldActivate) {
        const updatedPlanograms = planograms.map((p: Planogram) => 
          p.id === newPlanogram.id 
            ? { ...p, isActive: true, activatedAt: planogram && canEditDirectly(planogram) ? p.activatedAt : now }
            : { ...p, isActive: false }
        );
        setToLocalStorage('app-planograms', updatedPlanograms);
      }

      const successMessage = planogram && canEditDirectly(planogram) 
        ? 'Planograma actualizado correctamente' 
        : planogram 
          ? 'Nueva versión del planograma creada' 
          : 'Planograma creado correctamente';
      
      toast.success(successMessage);
      onSave();
    } catch (error) {
      console.error('Error guardando planograma:', error);
      toast.error('Error al guardar el planograma');
    }
  };

  // Eventos de drag and drop
  const handleDragStart = (e: React.DragEvent, product: Product) => {
    setDraggedProduct(product);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    if (draggedProduct) {
      handleCellDrop(x, y, draggedProduct);
      setDraggedProduct(null);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header Amplio con Info del Planograma */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 shadow-sm border border-indigo-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {planogram && (
              <Badge className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5">
                Editando v{planogram.version}
              </Badge>
            )}
            {planogram && canEditDirectly(planogram) && (
              <Badge className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5">Mismo día</Badge>
            )}
          </div>
        </div>

        {/* Fila única con inputs y estadísticas */}
        <div className="flex items-center gap-3">
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre del planograma *"
            className="h-9 flex-1"
          />
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Descripción"
            className="h-9 flex-1"
          />
          
          {/* Estadísticas en la misma línea */}
          <div className="flex items-center gap-4 px-3 py-1.5 bg-white rounded-lg border border-indigo-200 shadow-sm">
            <div className="text-center">
              <div className="text-base font-bold text-blue-600">{getProductsInGrid().size}</div>
              <div className="text-[10px] text-gray-600">Productos</div>
            </div>
            <div className="h-7 w-px bg-indigo-200"></div>
            <div className="text-center">
              <div className="text-base font-bold text-green-600">{((getProductsInGrid().size / (GRID_SIZE * GRID_SIZE)) * 100).toFixed(1)}%</div>
              <div className="text-[10px] text-gray-600">Ocupación</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal - Grilla + Panel Lateral */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* GRILLA PRINCIPAL - MÁXIMO ESPACIO */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 shadow-inner">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-900">Editor de Grilla</span>
              <span className="text-sm text-gray-500">Arrastra productos desde el panel derecho</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearGrid}
                className="text-red-600 hover:text-red-700 h-9 px-4"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-blue-200 border border-blue-600 rounded"></div>
                  <span>Ocupada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 bg-white border border-gray-600 border-dashed rounded"></div>
                  <span>Libre</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center min-h-full">
            {/* GRILLA MÁS AMPLIA */}
            <div className="inline-block border-4 border-gray-800 bg-white shadow-2xl rounded-xl overflow-hidden">
              {/* Header con letras (A-J) */}
              <div className="flex">
                <div className="w-16 h-12 bg-gray-400 border-r-4 border-b-4 border-gray-800 flex items-center justify-center font-bold text-gray-900">
                  
                </div>
                {[...Array(GRID_SIZE)].map((_, i) => (
                  <div key={i} className="w-24 h-12 bg-gray-400 border-r-2 border-b-4 border-gray-800 flex items-center justify-center font-bold text-gray-900 text-lg">
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              
              {/* Filas de la grilla */}
              {grid.map((row, x) => (
                <div key={x} className="flex">
                  {/* Número de fila */}
                  <div className="w-16 h-20 bg-gray-400 border-r-4 border-b-2 border-gray-800 flex items-center justify-center font-bold text-gray-900 text-lg">
                    {x + 1}
                  </div>
                  
                  {/* Celdas MÁS AMPLIAS */}
                  {row.map((cell, y) => {
                    const cellRef = `${String.fromCharCode(65 + y)}${x + 1}`;
                    return (
                      <div
                        key={`${x}-${y}`}
                        className={`w-24 h-20 border-r-2 border-b-2 border-gray-600 flex flex-col items-center justify-center relative group transition-all ${
                          cell.product
                            ? 'bg-blue-200 hover:bg-blue-300 border-blue-600'
                            : 'bg-white hover:bg-blue-50 border-gray-600 border-dashed'
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, x, y)}
                        title={cell.product ? `${cell.product.name} (${cell.product.sku}) - Celda ${cellRef}` : `Celda ${cellRef} - Arrastra un producto aquí`}
                      >
                        {cell.product ? (
                          <div className="text-center w-full h-full flex flex-col justify-center p-2 relative">
                            <div className="font-bold text-blue-800 truncate text-sm leading-tight mb-1">
                              {cell.product.sku}
                            </div>
                            <div className="text-xs text-blue-700 truncate leading-tight">
                              {cell.product.name.split(' ').slice(0, 2).join(' ')}
                            </div>
                            <button
                              onClick={() => handleRemoveProduct(x, y)}
                              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <div className="absolute top-1 left-1 w-3 h-3 bg-blue-600 rounded-full shadow-md"></div>
                          </div>
                        ) : (
                          <div className="text-gray-400 text-xs font-medium">
                            {cellRef}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel Lateral COMPACTO - Productos */}
        <div className="w-56 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0 p-2">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Productos ({filteredProducts.filter(p => !isProductInGrid(p.id)).length})
              </CardTitle>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full mt-1.5 h-7 text-[10px]">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {getUniqueCategories().map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1.5">
                  {filteredProducts.map((product) => {
                    const isInGrid = isProductInGrid(product.id);
                    return (
                      <div
                        key={product.id}
                        draggable={!isInGrid}
                        onDragStart={(e) => !isInGrid && handleDragStart(e, product)}
                        className={`p-1.5 border rounded cursor-pointer transition-all text-[10px] ${
                          isInGrid 
                            ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md hover:bg-blue-50'
                        } ${selectedProduct?.id === product.id ? 'border-blue-500 bg-blue-50 shadow-md' : ''}`}
                        onClick={() => !isInGrid && setSelectedProduct(product)}
                      >
                        <div className="space-y-0.5">
                          <p className="font-medium truncate text-gray-900 text-xs leading-tight">{product.name}</p>
                          <p className="text-gray-500 leading-tight">{product.sku}</p>
                          <div className="flex items-center justify-between gap-1">
                            <Badge variant="outline" className="text-[9px] py-0 px-1">
                              {product.category}
                            </Badge>
                            {isInGrid && (
                              <Badge className="bg-gray-500 text-white text-[9px] py-0 px-1">
                                EN USO
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer compacto con botones */}
      <div className="flex-shrink-0 bg-white border rounded-lg p-2 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-gray-600">
            {planogram && canEditDirectly(planogram) 
              ? '✏️ Los cambios se aplicarán directamente' 
              : planogram 
                ? '📋 Se creará una nueva versión' 
                : '✨ Creando nuevo planograma'
            }
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 h-7 text-xs">
              <Save className="h-3 w-3 mr-1" />
              {planogram && canEditDirectly(planogram) 
                ? 'Actualizar' 
                : planogram 
                  ? 'Nueva Versión' 
                  : 'Guardar'
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
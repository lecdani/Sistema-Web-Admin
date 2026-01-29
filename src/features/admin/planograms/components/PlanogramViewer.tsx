import React from 'react';
import {
  Grid3x3,
  Package,
  Hash,
  Tag,
  MapPin,
  Calendar,
  Zap,
  Info,
  FileText,
  Building,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Badge } from '@/shared/components/base/Badge';
import { Label } from '@/shared/components/base/Label';
import { ScrollArea } from '@/shared/components/base/ScrollArea';
import { PlanogramWithDistribution, Product } from '@/shared/types';

interface PlanogramViewerProps {
  planogram: PlanogramWithDistribution;
}

const GRID_SIZE = 10;

export const PlanogramViewer: React.FC<PlanogramViewerProps> = ({ planogram }) => {
  // Crear grilla visual
  const createGrid = () => {
    const grid: (Product | null)[][] = [];
    
    // Inicializar grilla vacía
    for (let x = 0; x < GRID_SIZE; x++) {
      grid[x] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        grid[x][y] = null;
      }
    }

    // Llenar grilla con productos
    planogram.distributions.forEach(distribution => {
      const product = planogram.products?.find(p => p.id === distribution.productId);
      if (product && distribution.xPosition < GRID_SIZE && distribution.yPosition < GRID_SIZE) {
        grid[distribution.xPosition][distribution.yPosition] = product;
      }
    });

    return grid;
  };

  const grid = createGrid();

  // Obtener estadísticas
  const getStatistics = () => {
    const totalCells = GRID_SIZE * GRID_SIZE;
    const occupiedCells = planogram.distributions.length;
    const occupancyPercentage = ((occupiedCells / totalCells) * 100).toFixed(1);
    
    const categoryCounts = planogram.products?.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return {
      totalCells,
      occupiedCells,
      occupancyPercentage,
      categoryCounts
    };
  };

  const stats = getStatistics();

  // Obtener color por categoría
  const getCategoryColor = (category: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-yellow-100 text-yellow-800',
      'bg-indigo-100 text-indigo-800',
      'bg-red-100 text-red-800',
      'bg-teal-100 text-teal-800',
      'bg-gray-100 text-gray-800'
    ];
    
    const categories = Object.keys(stats.categoryCounts).sort();
    const index = categories.indexOf(category) % colors.length;
    return colors[index];
  };

  return (
    <div className="w-full h-full flex flex-col gap-2 overflow-hidden">
      {/* Header Superior Mejorado - Compacto pero limpio */}
      <div className="flex-shrink-0 bg-gradient-to-r from-green-50 to-white border rounded-lg p-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Grid3x3 className="h-4 w-4 text-green-600" />
              <span className="font-bold text-gray-900">Visualizador de Planograma</span>
            </div>
            <Badge variant="outline" className="text-xs">10×10</Badge>
            {planogram.isActive && (
              <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Activo
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-sm font-bold text-blue-600">{planogram.products?.length || 0}</div>
              <div className="text-[10px] text-gray-600">Productos</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-green-600">{((planogram.products?.length || 0 / (GRID_SIZE * GRID_SIZE)) * 100).toFixed(1)}%</div>
              <div className="text-[10px] text-gray-600">Ocupación</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-purple-600">v{planogram.version}</div>
              <div className="text-[10px] text-gray-600">Versión</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor Principal - Grilla + Panel Lateral */}
      <div className="flex-1 flex gap-2 overflow-hidden">
        {/* GRILLA PRINCIPAL - MÁXIMO ESPACIO */}
        <div className="flex-1 overflow-auto bg-gray-50 rounded-lg p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-900">Distribución de Productos</span>
              <span className="text-[10px] text-gray-500">Vista de solo lectura</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-0.5">
                <div className="w-2.5 h-2.5 bg-green-200 border border-green-600 rounded"></div>
                <span>Ocupada</span>
              </div>
              <div className="flex items-center gap-0.5">
                <div className="w-2.5 h-2.5 bg-white border border-gray-600 rounded"></div>
                <span>Vacía</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center min-h-full">
            {/* GRILLA COMPLETA Y VISIBLE */}
            <div className="inline-block border-4 border-gray-800 bg-white shadow-2xl rounded-lg overflow-hidden">
              {/* Header con letras (A-J) */}
              <div className="flex">
                <div className="w-12 h-10 bg-gray-400 border-r-4 border-b-4 border-gray-800 flex items-center justify-center font-bold text-gray-900">
                  
                </div>
                {[...Array(GRID_SIZE)].map((_, i) => (
                  <div key={i} className="w-20 h-10 bg-gray-400 border-r-2 border-b-4 border-gray-800 flex items-center justify-center font-bold text-gray-900">
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              
              {/* Filas de la grilla */}
              {grid.map((row, x) => (
                <div key={x} className="flex">
                  {/* Número de fila */}
                  <div className="w-12 h-16 bg-gray-400 border-r-4 border-b-2 border-gray-800 flex items-center justify-center font-bold text-gray-900">
                    {x + 1}
                  </div>
                  
                  {/* Celdas OPTIMIZADAS */}
                  {row.map((product, y) => {
                    const isOccupied = !!product;
                    const cellRef = `${String.fromCharCode(65 + y)}${x + 1}`;
                    
                    return (
                      <div
                        key={`${x}-${y}`}
                        className={`w-20 h-16 border-r-2 border-b-2 border-gray-600 flex flex-col items-center justify-center relative group transition-all cursor-default ${ 
                          isOccupied 
                            ? 'bg-green-200 hover:bg-green-300 border-green-600' 
                            : 'bg-white hover:bg-blue-50'
                        }`}
                        title={
                          product 
                            ? `${product.name} (${product.sku}) - Celda ${cellRef}` 
                            : `Celda ${cellRef} - Vacía`
                        }
                      >
                        {product ? (
                          <div className="text-center w-full h-full flex flex-col justify-center p-1">
                            <div className="font-bold text-green-800 truncate text-xs leading-tight mb-0.5">
                              {product.sku}
                            </div>
                            <div className="text-[10px] text-green-700 truncate leading-tight">
                              {product.name.split(' ').slice(0, 2).join(' ')}
                            </div>
                            <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-green-600 rounded-full shadow-md"></div>
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

        {/* Panel Lateral COMPACTO - Solo Productos */}
        <div className="w-56 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0 p-2">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Productos ({planogram.products?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1.5">
                  {planogram.products && planogram.products.length > 0 ? (
                    planogram.products.map((product) => {
                      const distribution = planogram.distributions.find(d => d.productId === product.id);
                      const position = distribution 
                        ? `${String.fromCharCode(65 + distribution.yPosition)}${distribution.xPosition + 1}`
                        : '';

                      return (
                        <div key={product.id} className="p-1.5 border rounded text-[10px] hover:bg-gray-50 transition-colors">
                          <div className="space-y-0.5">
                            <div className="font-medium truncate text-gray-900 text-xs leading-tight">{product.name}</div>
                            <div className="text-gray-500 leading-tight">{product.sku}</div>
                            <div className="flex items-center justify-between gap-1">
                              <Badge className={`${getCategoryColor(product.category)} text-[9px] py-0 px-1`}>
                                {product.category}
                              </Badge>
                              {position && (
                                <Badge variant="outline" className="text-[9px] font-bold py-0 px-1">
                                  {position}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs">Sin productos</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
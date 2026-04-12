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
import { useLanguage } from '@/shared/hooks/useLanguage';
import { PlanogramWithDistribution, Product } from '@/shared/types';
import { getBackendAssetUrl } from '@/shared/config/api';

interface PlanogramViewerProps {
  planogram: PlanogramWithDistribution;
}

const GRID_SIZE = 10;

export const PlanogramViewer: React.FC<PlanogramViewerProps> = ({ planogram }) => {
  const { translate } = useLanguage();

  const getProductShortDisplayName = (product: Product): string => {
    const short = String(product.shortName ?? '').trim();
    if (short) return short;
    return String(product.name ?? '').trim() || '—';
  };

  const getProductCodeLine = (product: Product): string => {
    const code = String(product.code ?? '').trim();
    return code || '—';
  };
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

    // Llenar grilla con productos (xPosition = fila, yPosition = columna, igual que en el editor)
    planogram.distributions.forEach(distribution => {
      const product = planogram.products?.find(p => p.id === distribution.productId);
      if (!product) return;
      const row = Math.min(GRID_SIZE - 1, Math.max(0, distribution.xPosition));
      const col = Math.min(GRID_SIZE - 1, Math.max(0, distribution.yPosition));
      grid[row][col] = product;
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
              <span className="font-bold text-gray-900">{translate('planogramViewerTitle')}</span>
            </div>
            <Badge variant="outline" className="text-xs">10×10</Badge>
            {planogram.isActive && (
              <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {translate('active')}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-sm font-bold text-blue-600">{planogram.products?.length || 0}</div>
              <div className="text-[10px] text-gray-600">{translate('productsLabel')}</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-green-600">{((planogram.products?.length || 0 / (GRID_SIZE * GRID_SIZE)) * 100).toFixed(1)}%</div>
              <div className="text-[10px] text-gray-600">{translate('occupancy')}</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-purple-600">v{planogram.version}</div>
              <div className="text-[10px] text-gray-600">{translate('versions')}</div>
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
              <span className="text-xs font-semibold text-gray-900">{translate('distributionGrid')}</span>
              <span className="text-[10px] text-gray-500">{translate('readOnlyView')}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-0.5">
                <div className="w-2.5 h-2.5 bg-green-200 border border-green-600 rounded"></div>
                <span>{translate('occupied')}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <div className="w-2.5 h-2.5 bg-white border border-gray-600 rounded"></div>
                <span>{translate('empty')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center min-h-full">
            {/* GRILLA COMPLETA Y VISIBLE */}
            <div className="inline-block border-4 border-gray-800 bg-white shadow-2xl rounded-lg overflow-hidden">
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
                  
                  {/* Celdas OPTIMIZADAS */}
                  {row.map((product, y) => {
                    const isOccupied = !!product;
                    const cellRef = `${String.fromCharCode(65 + y)}${x + 1}`;
                    
                    return (
                      <div
                        key={`${x}-${y}`}
                        className={`w-24 h-20 border-r-2 border-b-2 border-gray-600 flex flex-col items-center justify-center relative group transition-all cursor-default ${ 
                          isOccupied 
                            ? 'bg-gray-300 hover:bg-gray-400 border-gray-600'
                            : 'bg-white hover:bg-blue-50'
                        }`}
                        title={
                          product 
                            ? `${getProductShortDisplayName(product)} (${getProductCodeLine(product)}) - Celda ${cellRef}` 
                            : translate('cellEmpty').replace('{ref}', cellRef)
                        }
                      >
                        {product ? (
                          <div className="text-center w-full h-full flex flex-col justify-center p-1 relative">
                            {product.image ? (
                              <img
                                src={getBackendAssetUrl(product.image)}
                                alt=""
                                className="w-8 h-8 mx-auto rounded object-cover flex-shrink-0 mb-0.5"
                              />
                            ) : (
                              <div className="w-8 h-8 mx-auto rounded bg-gray-200 flex items-center justify-center flex-shrink-0 mb-0.5">
                                <Package className="h-4 w-4 text-gray-600" />
                              </div>
                            )}
                            <div className="font-bold text-blue-800 truncate text-[10px] leading-tight">
                              {getProductCodeLine(product)}
                            </div>
                            <div
                              className="block w-full max-w-full px-0.5 text-blue-700/90 normal-case font-bold overflow-hidden"
                              style={{
                                fontSize: '7px',
                                lineHeight: 1.1,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                              title={getProductShortDisplayName(product)}
                            >
                              {getProductShortDisplayName(product)}
                            </div>
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

        {/* Panel Lateral COMPACTO - Solo Productos */}
        <div className="w-[24rem] min-w-[24rem] max-w-[24rem] flex-none">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0 p-2">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {translate('productsLabel')} ({planogram.products?.length || 0})
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
                        <div key={product.id} className="p-1.5 border rounded text-[10px] bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                          <div className="flex gap-2 items-start">
                            <div className="flex-shrink-0 w-9 h-9 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                              {product.image ? (
                                <img src={getBackendAssetUrl(product.image)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="font-medium truncate text-gray-900 text-xs leading-tight">
                                {getProductShortDisplayName(product)}
                              </div>
                              <div className="text-gray-500 leading-tight text-[10px] font-mono tabular-nums">
                                {getProductCodeLine(product)}
                              </div>
                              <div className="flex items-center justify-between gap-1">
                              <Badge variant="outline" className="text-[9px] py-0 px-1">
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
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs">{translate('noProductsShort')}</p>
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
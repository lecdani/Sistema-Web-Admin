import React, { useState, useEffect } from 'react';
import { X, Package, Grid3x3, Info } from 'lucide-react';
import { Badge } from '@/shared/components/base/Badge';
import { Order, Planogram, Distribution, Product } from '@/shared/types';
import { getFromLocalStorage } from '@/shared/services/database';

interface OrderPlanogramViewProps {
  order: Order;
}

interface GridCell {
  x: number;
  y: number;
  product: Product | null;
  quantity: number; // Cantidad pedida de este producto
}

const GRID_SIZE = 10;

export const OrderPlanogramView: React.FC<OrderPlanogramViewProps> = ({ order }) => {
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [planogram, setPlanogram] = useState<Planogram | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlanogramData();
  }, [order]);

  const loadPlanogramData = () => {
    try {
      setLoading(true);

      // Cargar el planograma
      const planograms = getFromLocalStorage('app-planograms') || [];
      const orderPlanogram = planograms.find((p: Planogram) => p.id === order.planogramId);
      
      if (!orderPlanogram) {
        setLoading(false);
        return;
      }

      setPlanogram(orderPlanogram);

      // Cargar distribuciones del planograma
      const distributions = getFromLocalStorage('app-distributions') || [];
      const planogramDistributions = distributions.filter(
        (d: Distribution) => d.planogramId === orderPlanogram.id
      );

      // Cargar productos
      const products = getFromLocalStorage('app-products') || [];

      // Inicializar grilla vacía
      const initialGrid: GridCell[][] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        initialGrid[x] = [];
        for (let y = 0; y < GRID_SIZE; y++) {
          initialGrid[x][y] = { x, y, product: null, quantity: 0 };
        }
      }

      // Cargar productos del planograma y sus cantidades pedidas
      planogramDistributions.forEach((dist: Distribution) => {
        const product = products.find((p: Product) => p.id === dist.productId);
        if (product && dist.xPosition < GRID_SIZE && dist.yPosition < GRID_SIZE) {
          // Buscar la cantidad pedida de este producto
          const orderItem = order.items?.find(item => item.productId === product.id);
          
          initialGrid[dist.xPosition][dist.yPosition] = {
            x: dist.xPosition,
            y: dist.yPosition,
            product: product,
            quantity: orderItem?.quantity || 0
          };
        }
      });

      setGrid(initialGrid);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando planograma:', error);
      setLoading(false);
    }
  };

  const getTotalItems = () => {
    return order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  };

  const getProductsInGrid = (): Set<string> => {
    const productIds = new Set<string>();
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell.product && cell.quantity > 0) {
          productIds.add(cell.product.id);
        }
      });
    });
    return productIds;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando planograma...</p>
        </div>
      </div>
    );
  }

  if (!planogram) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="text-center">
          <Grid3x3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Planograma no encontrado
          </h3>
          <p className="text-gray-500">
            El planograma asociado a este pedido no está disponible
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header con información del planograma y pedido */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 mb-4 shadow-sm border border-indigo-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5">
              {planogram.name} - v{planogram.version}
            </Badge>
            {planogram.description && (
              <span className="text-sm text-gray-600">{planogram.description}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Info del pedido */}
          <div className="flex items-center gap-4 px-3 py-1.5 bg-white rounded-lg border border-indigo-200 shadow-sm flex-1">
            <div className="text-center">
              <div className="text-base font-bold text-blue-600">{order.po}</div>
              <div className="text-[10px] text-gray-600">PO Number</div>
            </div>
            <div className="h-7 w-px bg-indigo-200"></div>
            <div className="text-center">
              <div className="text-base font-bold text-purple-600">
                {new Date(order.createdAt).toLocaleDateString('es-ES')}
              </div>
              <div className="text-[10px] text-gray-600">Fecha Pedido</div>
            </div>
          </div>

          {/* Estadísticas del pedido */}
          <div className="flex items-center gap-4 px-3 py-1.5 bg-white rounded-lg border border-indigo-200 shadow-sm">
            <div className="text-center">
              <div className="text-base font-bold text-green-600">{getProductsInGrid().size}</div>
              <div className="text-[10px] text-gray-600">Productos Pedidos</div>
            </div>
            <div className="h-7 w-px bg-indigo-200"></div>
            <div className="text-center">
              <div className="text-base font-bold text-orange-600">{getTotalItems()}</div>
              <div className="text-[10px] text-gray-600">Unidades Totales</div>
            </div>
            <div className="h-7 w-px bg-indigo-200"></div>
            <div className="text-center">
              <div className="text-base font-bold text-blue-600">€{order.total.toFixed(2)}</div>
              <div className="text-[10px] text-gray-600">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grilla del planograma con cantidades */}
      <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 shadow-inner">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">Visualización del Pedido</span>
            <span className="text-sm text-gray-500">Las cantidades se muestran en cada celda</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-green-200 border border-green-600 rounded"></div>
              <span>Pedido realizado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gray-200 border border-gray-400 rounded"></div>
              <span>No pedido</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-full">
          <div className="inline-block border-4 border-gray-800 bg-white shadow-2xl rounded-xl overflow-hidden">
            {/* Header con letras (A-J) */}
            <div className="flex">
              <div className="w-16 h-12 bg-gray-400 border-r-4 border-b-4 border-gray-800 flex items-center justify-center font-bold text-gray-900"></div>
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

                {/* Celdas */}
                {row.map((cell, y) => {
                  const cellRef = `${String.fromCharCode(65 + y)}${x + 1}`;
                  const isOrdered = cell.quantity > 0;
                  
                  return (
                    <div
                      key={`${x}-${y}`}
                      className={`w-24 h-20 border-r-2 border-b-2 flex flex-col items-center justify-center relative transition-all ${
                        cell.product
                          ? isOrdered
                            ? 'bg-green-200 hover:bg-green-300 border-green-600 border-2'
                            : 'bg-gray-200 hover:bg-gray-300 border-gray-400'
                          : 'bg-white hover:bg-gray-50 border-gray-400 border-dashed'
                      }`}
                      title={
                        cell.product
                          ? `${cell.product.name} (${cell.product.sku})\nCelda ${cellRef}\nCantidad: ${cell.quantity} unidades${!isOrdered ? ' - NO PEDIDO' : ''}`
                          : `Celda ${cellRef} - Vacía`
                      }
                    >
                      {cell.product ? (
                        <div className="text-center w-full h-full flex flex-col justify-center p-2 relative">
                          <div className={`font-bold truncate text-sm leading-tight mb-1 ${isOrdered ? 'text-green-800' : 'text-gray-600'}`}>
                            {cell.product.sku}
                          </div>
                          <div className={`text-xs truncate leading-tight ${isOrdered ? 'text-green-700' : 'text-gray-500'}`}>
                            {cell.product.name.split(' ').slice(0, 2).join(' ')}
                          </div>
                          
                          {/* Badge con cantidad pedida */}
                          {isOrdered ? (
                            <div className="absolute -top-1.5 -right-1.5 bg-green-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg font-bold text-xs">
                              {cell.quantity}
                            </div>
                          ) : (
                            <div className="absolute top-1 left-1 w-3 h-3 bg-gray-400 rounded-full shadow-md"></div>
                          )}
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

      {/* Leyenda adicional */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <strong>Trazabilidad:</strong> Este planograma estaba activo cuando se realizó el pedido.
            Los productos con número verde fueron pedidos, los grises estaban en el planograma pero no se pidieron.
          </div>
        </div>
      </div>
    </div>
  );
};

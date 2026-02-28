import React, { useState, useEffect } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';

export interface ProductPositionEdit {
  row: number;
  col: number;
  productId: string;
  productName: string;
  sku: string;
  toOrder: number;
  price: number;
}

interface ProductModalOrderEditProps {
  open: boolean;
  onClose: () => void;
  position: ProductPositionEdit;
  onUpdate: (toOrder: number) => void;
}

export function ProductModalOrderEdit({ open, onClose, position, onUpdate }: ProductModalOrderEditProps) {
  const [toOrder, setToOrder] = useState(position.toOrder);

  useEffect(() => {
    setToOrder(position.toOrder);
  }, [position.row, position.col, position.toOrder]);

  const handleSave = () => {
    onUpdate(toOrder);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-[260px] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800">Cantidad a pedir</span>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
            {position.productId ? (
              <>
                <p className="text-sm font-medium text-gray-900 truncate leading-snug">{position.productName || position.sku}</p>
                <p className="text-xs text-gray-500 mt-1">${(position.price || 0).toFixed(2)} unidad</p>
              </>
            ) : (
              <p className="text-sm text-amber-700">Sin producto</p>
            )}
          </div>

          {position.productId && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Cantidad</label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setToOrder(Math.max(0, toOrder - 1))}
                    className="h-10 w-10 p-0 shrink-0 rounded-lg border-gray-300"
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={toOrder}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setToOrder(Math.max(0, val));
                    }}
                    className="text-center h-10 text-lg font-semibold border-gray-300 w-20"
                    min={0}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setToOrder(toOrder + 1)}
                    className="h-10 w-10 p-0 shrink-0 rounded-lg border-gray-300"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600 pt-1 border-t border-gray-100">
                <span>Total</span>
                <span className="font-bold text-gray-900">${(toOrder * position.price).toFixed(2)}</span>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm rounded-lg">
              Cancelar
            </Button>
            {position.productId && (
              <Button onClick={handleSave} className="flex-1 h-9 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700">
                Guardar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

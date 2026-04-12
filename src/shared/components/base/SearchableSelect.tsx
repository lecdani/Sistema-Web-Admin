'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, X } from 'lucide-react';

/** `label` opcional: por defecto se trata como cadena vacía (sin texto hasta que exista nombre). */
export type SearchableSelectOption = {
  value: string;
  label?: string;
  disabled?: boolean;
};

/** Valores que en cerrado no muestran texto (solo placeholder), p. ej. filtros “todos”. */
export const SEARCHABLE_SELECT_DEFAULT_BLANK_VALUES = ['', 'all', 'all-status', 'all-categories'] as const;

export interface SearchableSelectProps {
  /** Valor seleccionado (id interno). Acepta undefined para alinearlo con filtros tipados como opcionales. */
  value?: string | null;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  'aria-invalid'?: boolean;
  /** Por defecto el menú va a `body` para modales y overflow. */
  portaled?: boolean;
  emptyMessage?: string;
  zIndex?: number;
  /** Altura máxima de la lista (scroll interno). */
  maxListHeight?: string;
  /**
   * Valores para los que el campo cerrado se ve vacío (solo placeholder).
   * `undefined` → {@link SEARCHABLE_SELECT_DEFAULT_BLANK_VALUES}.
   * `[]` → solo `''` cuenta como vacío para la etiqueta.
   */
  blankDisplayValues?: readonly string[];
  /** Muestra botón para volver al valor “vacío” (p. ej. filtros `all`). */
  clearable?: boolean;
  /** Valor al limpiar; en filtros suele ser `all`. Por defecto `''`. */
  clearToValue?: string;
  /** Icono dentro del input (lado izquierdo). Por defecto: lupa. */
  leadingIcon?: React.ReactNode;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Seleccionar…',
  disabled = false,
  className = '',
  inputClassName = '',
  id,
  'aria-invalid': ariaInvalid,
  portaled = true,
  emptyMessage = 'Sin resultados',
  zIndex = 9999,
  maxListHeight = 'min(18rem, 50vh)',
  blankDisplayValues,
  clearable = false,
  clearToValue = '',
  leadingIcon,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' as 'bottom' | 'top', maxHeightPx: 320 });

  const normalizedValue = String(value ?? '').trim();

  const blankSet = useMemo(() => {
    const list =
      blankDisplayValues === undefined
        ? SEARCHABLE_SELECT_DEFAULT_BLANK_VALUES
        : blankDisplayValues.length === 0
          ? ['']
          : blankDisplayValues;
    return new Set(list.map((s) => String(s)));
  }, [blankDisplayValues]);

  const isBlankDisplay = normalizedValue === '' || blankSet.has(normalizedValue);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === normalizedValue),
    [options, normalizedValue]
  );

  const optionLabel = (o: SearchableSelectOption) => (o.label ?? '').trim();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (o.label ?? '').trim().toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    if (isBlankDisplay || !selected) setQuery('');
    else setQuery(optionLabel(selected));
    const idRaf = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(idRaf);
  }, [open, isBlankDisplay, selected]);

  useLayoutEffect(() => {
    if (!open || !portaled) return;
    const trig = wrapRef.current;
    if (!trig) return;
    const update = () => {
      const r = trig.getBoundingClientRect();
      const viewportPad = 8;
      const gap = 4;
      const availableBelow = Math.max(0, window.innerHeight - r.bottom - viewportPad);
      const availableAbove = Math.max(0, r.top - viewportPad);
      const placeTop = availableAbove > availableBelow;
      const availableForMenu = Math.max(0, placeTop ? availableAbove : availableBelow);
      setPos({
        top: placeTop ? r.top - gap : r.bottom + gap,
        left: r.left,
        width: r.width,
        placement: placeTop ? 'top' : 'bottom',
        maxHeightPx: availableForMenu,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, portaled]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (v: string) => {
    const opt = options.find((o) => String(o.value) === String(v));
    if (opt?.disabled) return;
    onValueChange(String(v));
    setOpen(false);
    setQuery('');
  };

  const closedLabel =
    selected && !isBlankDisplay ? optionLabel(selected) : '';
  const inputDisplay = open ? query : closedLabel;

  const borderCls = ariaInvalid ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';
  const showClear = clearable && !disabled && !isBlankDisplay;
  const inputRightPad = showClear ? 'pr-9' : 'pr-3';
  /** Mismo reparto que los buscadores del admin: icono `left-3`, texto `pl-10`. */
  const baseInput =
    `h-10 w-full rounded-lg border bg-white pl-10 ${inputRightPad} py-2 text-sm text-gray-900 ${borderCls} ` +
    'transition-all duration-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 ' +
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50';

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onValueChange(clearToValue);
    setQuery('');
    setOpen(false);
  };

  /** Mantiene el scroll dentro del menú sin bloquear el último ítem. */
  const handleListWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
          {leadingIcon ?? <Search className="h-4 w-4" />}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-autocomplete="list"
          disabled={disabled}
          readOnly={!open}
          autoComplete="off"
          placeholder={placeholder}
          value={inputDisplay}
          onChange={(e) => open && setQuery(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
            }
            if (e.key === 'Enter' && open) {
              const first = filtered.find((o) => !o.disabled);
              if (first) {
                e.preventDefault();
                pick(first.value);
              }
            }
          }}
          className={`${baseInput} ${inputClassName}`}
        />
        {showClear && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 z-[1] -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Limpiar"
            onMouseDown={handleClear}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open &&
        !disabled &&
        portaled &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropRef}
            role="listbox"
            className="overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white p-1 shadow-lg animate-in fade-in-80 [touch-action:pan-y]"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: Math.max(pos.width, 160),
              transform: pos.placement === 'top' ? 'translateY(-100%)' : undefined,
              zIndex,
              maxHeight: `min(${maxListHeight}, ${pos.maxHeightPx}px)`,
              WebkitOverflowScrolling: 'touch',
            }}
            onWheel={handleListWheel}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>
            ) : (
              filtered.map((o) => {
                const isSel = String(o.value) === normalizedValue;
                return (
                  <div
                    key={o.value}
                    role="option"
                    aria-selected={isSel}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!o.disabled) pick(o.value);
                    }}
                    className={`relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none transition-colors ${
                      o.disabled
                        ? 'cursor-not-allowed opacity-50 pointer-events-none text-gray-400'
                        : 'text-gray-700 hover:bg-blue-50'
                    } ${isSel ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
                  >
                    {isSel && (
                      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                        <Check className="h-4 w-4 text-blue-600" />
                      </span>
                    )}
                    <span className="truncate">{optionLabel(o) || '—'}</span>
                  </div>
                );
              })
            )}
          </div>,
          document.body
        )}

      {open && !disabled && !portaled && (
        <div
          ref={dropRef}
          role="listbox"
          className="absolute left-0 right-0 mt-1 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white p-1 shadow-lg [touch-action:pan-y]"
          style={{ maxHeight: maxListHeight, WebkitOverflowScrolling: 'touch', zIndex }}
          onWheel={handleListWheel}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>
          ) : (
            filtered.map((o) => {
              const isSel = String(o.value) === normalizedValue;
              return (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={isSel}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!o.disabled) pick(o.value);
                  }}
                  className={`relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm ${
                    o.disabled ? 'opacity-50 pointer-events-none' : 'hover:bg-blue-50'
                  } ${isSel ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
                >
                  {isSel && (
                    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                      <Check className="h-4 w-4 text-blue-600" />
                    </span>
                  )}
                  <span className="truncate">{optionLabel(o) || '—'}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

import React, { createContext, useContext, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  defaultValue?: string;
}

export const Select: React.FC<SelectProps> = ({
  value: controlledValue,
  onValueChange,
  children,
  defaultValue = ''
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    setOpen(false);
  };

  return (
    <SelectContext.Provider
      value={{ value, onValueChange: handleValueChange, open, setOpen, triggerRef }}
    >
      {children}
    </SelectContext.Provider>
  );
};

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className = '', children, ...props }, ref) => {
    const context = useContext(SelectContext);
    if (!context) throw new Error('SelectTrigger must be used within Select');

    const setRefs = (el: HTMLButtonElement | null) => {
      context.triggerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    };

    return (
      <button
        ref={setRefs}
        type="button"
        onClick={() => context.setOpen(!context.open)}
        className={`flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-all duration-200 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 ${className}`}
        {...props}
      >
        {children}
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${context.open ? 'rotate-180' : ''}`} />
      </button>
    );
  }
);

SelectTrigger.displayName = 'SelectTrigger';

/** Muestra el valor seleccionado. Si pasas children, se muestra ese contenido (ej. nombre) en lugar del value (ej. id). */
export const SelectValue: React.FC<{ placeholder?: string; children?: React.ReactNode }> = ({ placeholder, children }) => {
  const context = useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');

  const display = context.value ? (children ?? context.value) : null;
  return (
    <span className={display ? 'text-gray-900' : 'text-gray-400'}>
      {display || placeholder}
    </span>
  );
};

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Renderiza el menú en `document.body` con posición fija (evita recortes por overflow en modales). */
  portaled?: boolean;
}

export const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className = '', children, portaled = false, style, ...props }, ref) => {
    const context = useContext(SelectContext);
    const contentRef = useRef<HTMLDivElement>(null);
    const [portalPos, setPortalPos] = useState({ top: 0, left: 0, width: 0 });

    if (!context) throw new Error('SelectContent must be used within Select');

    const mergeRef = (el: HTMLDivElement | null) => {
      (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    };

    useLayoutEffect(() => {
      if (!portaled || !context.open) return;
      const trig = context.triggerRef.current;
      if (!trig) return;
      const update = () => {
        const r = trig.getBoundingClientRect();
        const gap = 4;
        setPortalPos({
          top: r.bottom + gap,
          left: r.left,
          width: r.width,
        });
      };
      update();
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    }, [portaled, context.open, context.triggerRef]);

    useEffect(() => {
      if (!context.open) return;
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (contentRef.current?.contains(target)) return;
        if (context.triggerRef.current?.contains(target)) return;
        context.setOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [context, context.open]);

    if (!context.open) return null;

    const panelClass = `min-w-[8rem] overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg animate-in fade-in-80 slide-in-from-top-2 ${className}`;

    const inner = (
      <div className="p-1">{children}</div>
    );

    if (portaled && typeof document !== 'undefined') {
      return createPortal(
        <div
          ref={mergeRef}
          className={panelClass}
          style={{
            position: 'fixed',
            top: portalPos.top,
            left: portalPos.left,
            width: portalPos.width || undefined,
            minWidth: portalPos.width ? undefined : '8rem',
            zIndex: 9999,
            ...style,
          }}
          {...props}
        >
          {inner}
        </div>,
        document.body
      );
    }

    return (
      <div
        ref={mergeRef}
        className={`absolute z-50 mt-1 ${panelClass}`}
        style={style}
        {...props}
      >
        {inner}
      </div>
    );
  }
);

SelectContent.displayName = 'SelectContent';

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className = '', value, children, disabled, ...props }, ref) => {
    const context = useContext(SelectContext);
    if (!context) throw new Error('SelectItem must be used within Select');

    const isSelected = context.value === value;

    return (
      <div
        ref={ref}
        onClick={() => !disabled && context.onValueChange(value)}
        className={`relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none transition-colors 
        ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:bg-blue-50 focus:bg-blue-50'} 
        ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'} ${className}`}
        {...props}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
            <Check className="h-4 w-4 text-blue-600" />
          </span>
        )}
        {children}
      </div>
    );
  }
);

SelectItem.displayName = 'SelectItem';

export { SearchableSelect, SEARCHABLE_SELECT_DEFAULT_BLANK_VALUES } from './SearchableSelect';
export type { SearchableSelectOption } from './SearchableSelect';

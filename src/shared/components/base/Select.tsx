import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
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

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen }}>
      {children}
    </SelectContext.Provider>
  );
};

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className = '', children, ...props }, ref) => {
    const context = useContext(SelectContext);
    if (!context) throw new Error('SelectTrigger must be used within Select');

    return (
      <button
        ref={ref}
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

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> { }

export const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className = '', children, ...props }, ref) => {
    const context = useContext(SelectContext);
    const contentRef = useRef<HTMLDivElement>(null);

    if (!context) throw new Error('SelectContent must be used within Select');

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
          context.setOpen(false);
        }
      };

      if (context.open) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [context, context.open]);

    if (!context.open) return null;

    return (
      <div
        ref={contentRef}
        className={`absolute z-50 mt-1 min-w-[8rem] max-h-80 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg animate-in fade-in-80 slide-in-from-top-2 ${className}`}
        {...props}
      >
        <div className="p-1">
          {children}
        </div>
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

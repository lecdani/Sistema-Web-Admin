import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight } from 'lucide-react';

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(undefined);

export interface DropdownMenuProps {
  children: React.ReactNode;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
};

export interface DropdownMenuTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<T | null>).current = value;
}

export const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(
  ({ onClick, asChild, children, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);
    if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

    const handleClick = (e: React.MouseEvent) => {
      onClick?.(e as any);
      context.setOpen(!context.open);
    };

    const mergedRef = (el: HTMLElement | null) => {
      (context.triggerRef as React.MutableRefObject<HTMLElement | null>).current = el;
      setRef(ref, el);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        onClick: handleClick,
        ref: mergedRef,
      });
    }

    return (
      <button
        ref={mergedRef as any}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  /** Si true, renderiza en portal con posición fija para no ser recortado por overflow de padres */
  usePortal?: boolean;
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className = '', children, align = 'start', sideOffset = 4, usePortal = false, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);
    const contentRef = useRef<HTMLDivElement>(null);
    const [fixedPosition, setFixedPosition] = useState<{ top: number; left: number; width: number } | null>(null);

    if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (contentRef.current && !contentRef.current.contains(target) && context.triggerRef.current && !context.triggerRef.current.contains(target)) {
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

    useEffect(() => {
      if (!context.open || !usePortal || !context.triggerRef.current) {
        setFixedPosition(null);
        return;
      }
      const rect = context.triggerRef.current.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      let left = rect.left;
      if (align === 'center') left = rect.left + rect.width / 2;
      else if (align === 'end') left = rect.right;
      setFixedPosition({ top: rect.bottom + sideOffset, left, width });
    }, [context.open, usePortal, sideOffset, align]);

    if (!context.open) return null;

    const alignClasses = {
      start: 'left-0',
      center: 'left-1/2 -translate-x-1/2',
      end: 'right-0',
    };

    const contentNode = (
      <div
        ref={contentRef}
        className={`z-[9999] min-w-[12rem] rounded-xl border-2 border-gray-100 bg-white shadow-xl animate-in fade-in-80 slide-in-from-top-2 ${!usePortal ? 'absolute' : ''} ${alignClasses[align as keyof typeof alignClasses]} ${className}`}
        style={
          usePortal && fixedPosition
            ? {
                position: 'fixed' as const,
                top: fixedPosition.top,
                left: fixedPosition.left,
                minWidth: '14rem',
                ...(align === 'center' ? { transform: 'translateX(-50%)' } : align === 'end' ? { transform: 'translateX(-100%)' } : {}),
              }
            : { top: `calc(100% + ${sideOffset}px)` }
        }
        {...props}
      >
        <div className="p-1.5">{children}</div>
      </div>
    );

    if (usePortal && typeof document !== 'undefined') {
      return createPortal(contentNode, document.body);
    }

    return contentNode;
  }
);

DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', onClick, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);

    return (
      <div
        ref={ref}
        onClick={(e) => {
          onClick?.(e);
          context?.setOpen(false);
        }}
        className={`relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700 ${className}`}
        {...props}
      />
    );
  }
);

DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { checked?: boolean }
>(({ className = '', checked, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-2.5 pl-10 pr-3 text-sm outline-none transition-colors hover:bg-blue-50 focus:bg-blue-50 ${className}`}
      {...props}
    >
      {checked && (
        <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
          <Check className="h-4 w-4 text-blue-600" />
        </span>
      )}
      {children}
    </div>
  );
});

DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`-mx-1 my-1.5 h-[2px] bg-gradient-to-r from-transparent via-gray-200 to-transparent ${className}`}
        {...props}
      />
    );
  }
);

DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider ${className}`}
        {...props}
      />
    );
  }
);

DropdownMenuLabel.displayName = 'DropdownMenuLabel';

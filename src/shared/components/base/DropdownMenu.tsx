import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Check, ChevronRight } from 'lucide-react';

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(undefined);

export interface DropdownMenuProps {
  children: React.ReactNode;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
};

export interface DropdownMenuTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(
  ({ onClick, asChild, children, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);
    if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

    const handleClick = (e: React.MouseEvent) => {
      onClick?.(e as any);
      context.setOpen(!context.open);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        onClick: handleClick,
        ref,
      });
    }

    return (
      <button
        ref={ref as any}
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
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className = '', children, align = 'start', sideOffset = 4, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);
    const contentRef = useRef<HTMLDivElement>(null);

    if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

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

    const alignClasses = {
      start: 'left-0',
      center: 'left-1/2 -translate-x-1/2',
      end: 'right-0',
    };

    return (
      <div
        ref={contentRef}
        className={`absolute z-50 min-w-[12rem] overflow-hidden rounded-xl border-2 border-gray-100 bg-white shadow-xl animate-in fade-in-80 slide-in-from-top-2 ${alignClasses[align as keyof typeof alignClasses]} ${className}`}
        style={{ top: `calc(100% + ${sideOffset}px)` }}
        {...props}
      >
        <div className="p-1.5">{children}</div>
      </div>
    );
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

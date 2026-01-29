import React, { createContext, useContext, useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open = false, onOpenChange, children }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
      {children}
    </DialogContext.Provider>
  );
};

export interface DialogTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export const DialogTrigger = React.forwardRef<HTMLElement, DialogTriggerProps>(
  ({ onClick, asChild, children, ...props }, ref) => {
    const context = useContext(DialogContext);
    if (!context) throw new Error('DialogTrigger must be used within Dialog');

    const handleClick = (e: React.MouseEvent) => {
      onClick?.(e as any);
      context.onOpenChange(true);
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

DialogTrigger.displayName = 'DialogTrigger';

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  showClose?: boolean;
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className = '', children, showClose = true, ...props }, ref) => {
    const context = useContext(DialogContext);
    if (!context) throw new Error('DialogContent must be used within Dialog');

    if (!context.open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
          onClick={() => context.onOpenChange(false)}
        />

        {/* Content */}
        <div
          ref={ref}
          className={`relative z-50 w-full max-w-xl bg-white shadow-xl animate-in fade-in-0 zoom-in-95 ${className}`}
          {...props}
        >
          {showClose && (
            <button
              onClick={() => context.onOpenChange(false)}
              className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          )}
          {children}
        </div>
      </div>
    );
  }
);

DialogContent.displayName = 'DialogContent';

export const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col space-y-1.5 px-6 pt-6 pb-2 ${className}`}
        {...props}
      />
    );
  }
);

DialogHeader.displayName = 'DialogHeader';

export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={`text-lg font-semibold text-gray-900 leading-none ${className}`}
        {...props}
      />
    );
  }
);

DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-sm text-gray-600 ${className}`}
        {...props}
      />
    );
  }
);

DialogDescription.displayName = 'DialogDescription';

export const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-end gap-3 px-6 pb-6 pt-4 ${className}`}
        {...props}
      />
    );
  }
);

DialogFooter.displayName = 'DialogFooter';

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ onClick, asChild, children, ...props }, ref) => {
    const context = useContext(DialogContext);
    if (!context) throw new Error('DialogClose must be used within Dialog');

    const handleClick = (e: React.MouseEvent) => {
      onClick?.(e as any);
      context.onOpenChange(false);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        onClick: handleClick,
        ref,
      });
    }

    return (
      <button
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);

DialogClose.displayName = 'DialogClose';
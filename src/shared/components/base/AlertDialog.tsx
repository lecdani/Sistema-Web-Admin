import React, { createContext, useContext, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface AlertDialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDialogContext = createContext<AlertDialogContextType | undefined>(undefined);

export interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ open: controlledOpen, onOpenChange: controlledOnOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Si se proporciona open, usamos modo controlado; si no, usamos estado interno
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;
  
  return (
    <AlertDialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
};

export interface AlertDialogTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export const AlertDialogTrigger = React.forwardRef<HTMLElement, AlertDialogTriggerProps>(
  ({ onClick, asChild, children, ...props }, ref) => {
    const context = useContext(AlertDialogContext);
    if (!context) throw new Error('AlertDialogTrigger must be used within AlertDialog');

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

AlertDialogTrigger.displayName = 'AlertDialogTrigger';

export const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    const context = useContext(AlertDialogContext);
    if (!context) throw new Error('AlertDialogContent must be used within AlertDialog');

    if (!context.open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0" />
        <div
          ref={ref}
          className={`relative z-50 w-full max-w-md bg-white rounded-xl shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 overflow-hidden ${className}`}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
);

AlertDialogContent.displayName = 'AlertDialogContent';

export const AlertDialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col space-y-2 px-6 pt-6 pb-2 overflow-hidden ${className}`}
        {...props}
      />
    );
  }
);

AlertDialogHeader.displayName = 'AlertDialogHeader';

export const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={`flex items-center gap-3 text-lg font-semibold text-gray-900 break-words ${className}`}
        style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
        {...props}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <span className="flex-1 break-words">{children}</span>
      </h2>
    );
  }
);

AlertDialogTitle.displayName = 'AlertDialogTitle';

export const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-sm text-gray-600 break-words overflow-wrap-anywhere whitespace-normal ${className}`}
        style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
        {...props}
      />
    );
  }
);

AlertDialogDescription.displayName = 'AlertDialogDescription';

export const AlertDialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
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

AlertDialogFooter.displayName = 'AlertDialogFooter';

export const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = '', onClick, ...props }, ref) => {
    const context = useContext(AlertDialogContext);

    return (
      <button
        ref={ref}
        onClick={(e) => {
          onClick?.(e);
          context?.onOpenChange(false);
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-red-600 text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 active:scale-[0.98] ${className}`}
        {...props}
      />
    );
  }
);

AlertDialogAction.displayName = 'AlertDialogAction';

export const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = '', onClick, ...props }, ref) => {
    const context = useContext(AlertDialogContext);

    return (
      <button
        ref={ref}
        onClick={(e) => {
          onClick?.(e);
          context?.onOpenChange(false);
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200 active:scale-[0.98] ${className}`}
        {...props}
      />
    );
  }
);

AlertDialogCancel.displayName = 'AlertDialogCancel';
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

interface TooltipContextType {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  delayDuration: number;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

export interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ 
  children, 
  delayDuration = 200 
}) => {
  return <>{children}</>;
};

export interface TooltipProps {
  children: React.ReactNode;
  delayDuration?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  delayDuration = 200 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TooltipContext.Provider value={{ isVisible, setIsVisible, delayDuration }}>
      <div className="relative inline-flex">
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

export const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    const context = useContext(TooltipContext);
    if (!context) throw new Error('TooltipTrigger must be used within Tooltip');

    const timeoutRef = useRef<NodeJS.Timeout>();

    const handleMouseEnter = () => {
      timeoutRef.current = setTimeout(() => {
        context.setIsVisible(true);
      }, context.delayDuration);
    };

    const handleMouseLeave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      context.setIsVisible(false);
    };

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        ref,
        ...props,
      });
    }

    return (
      <button
        ref={ref as any}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TooltipTrigger.displayName = 'TooltipTrigger';

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
}

export const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className = '', children, side = 'top', sideOffset = 8, ...props }, ref) => {
    const context = useContext(TooltipContext);
    if (!context) throw new Error('TooltipContent must be used within Tooltip');

    if (!context.isVisible) return null;

    const sideClasses = {
      top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
      right: 'left-full top-1/2 -translate-y-1/2 ml-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
      left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    };

    const arrowClasses = {
      top: 'bottom-[-4px] left-1/2 -translate-x-1/2',
      right: 'left-[-4px] top-1/2 -translate-y-1/2',
      bottom: 'top-[-4px] left-1/2 -translate-x-1/2',
      left: 'right-[-4px] top-1/2 -translate-y-1/2',
    };

    return (
      <div
        ref={ref}
        className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95 ${sideClasses[side]} ${className}`}
        role="tooltip"
        style={{
          [side === 'top' || side === 'bottom' ? 'bottom' : 'left']: 
            side === 'top' || side === 'bottom' 
              ? `calc(100% + ${sideOffset}px)` 
              : undefined,
          [side === 'left' || side === 'right' ? 'left' : 'right']: 
            side === 'left' || side === 'right'
              ? `calc(100% + ${sideOffset}px)` 
              : undefined,
        }}
        {...props}
      >
        {children}
        <div 
          className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${arrowClasses[side]}`}
        />
      </div>
    );
  }
);

TooltipContent.displayName = 'TooltipContent';

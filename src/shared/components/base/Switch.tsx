import React from 'react';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className = '', checked, onCheckedChange, ...props }, ref) => {
    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only peer"
          {...props}
        />
        <div className={`w-11 h-6 bg-gray-200 rounded-full shadow-inner transition-all duration-200 peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed ${className}`}>
          <div className="absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-5" />
        </div>
      </label>
    );
  }
);

Switch.displayName = 'Switch';

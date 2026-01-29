import React from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', checked, onCheckedChange, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only peer"
          {...props}
        />
        <div className={`h-5 w-5 rounded border-2 border-gray-300 bg-white shadow-sm transition-all duration-200 peer-hover:border-gray-400 peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-focus:border-blue-500 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center ${className}`}>
          {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

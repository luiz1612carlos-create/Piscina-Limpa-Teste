import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, className = '', containerClassName = '', ...props }, ref) => {
    return (
        <div className={`w-full ${containerClassName}`}>
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <input 
                ref={ref}
                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-white ${error ? 'border-red-500' : 'border-gray-300' } ${className}`}
                {...props} 
            />
            {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
        </div>
    );
});
Input.displayName = 'Input';
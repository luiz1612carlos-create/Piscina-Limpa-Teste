import React from 'react';

interface Option {
    value: string | number;
    label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: Option[];
    error?: string;
    containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ label, options, error, className = '', containerClassName = '', ...props }, ref) => {
    return (
        <div className={`w-full ${containerClassName}`}>
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <select
                ref={ref}
                className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-white ${error ? 'border-red-500' : 'border-gray-300' } ${className}`}
                {...props}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
        </div>
    );
});
Select.displayName = 'Select';
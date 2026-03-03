
import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'light';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, variant='primary', size='md', isLoading=false, className='', disabled, ...props }) => {
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        light: 'bg-white text-gray-900 hover:bg-gray-100 focus:ring-gray-200'
    };
    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg'
    };

    return (
        <button 
            disabled={disabled || isLoading}
            className={`rounded font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors flex items-center justify-center ${variants[variant]} ${sizes[size]} ${className} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`} 
            {...props}
        >
            {isLoading && <div className="mr-2"><Spinner size="sm"/></div>}
            {children}
        </button>
    );
};
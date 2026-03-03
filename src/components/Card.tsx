import React from 'react';

export const Card = ({ children, className = '', ...props }: any) => (
  <div {...props} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = '' }: any) => (
  <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

export const CardContent = ({ children, className = '' }: any) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);
import React from 'react';
import { Card, CardContent } from './Card';
import { SparklesIcon } from '../constants';

interface GoogleReviewCardProps {
    reviewUrl: string;
}

export const GoogleReviewCard: React.FC<GoogleReviewCardProps> = ({ reviewUrl }) => {
    return (
        <Card className="border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-800 dark:to-blue-900/10 overflow-hidden relative group">
            <div className="absolute -right-10 -top-10 bg-blue-500/10 w-40 h-40 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 relative z-10">
                <div className="flex items-center gap-4 text-center sm:text-left">
                    <div className="p-3 bg-white dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600">
                        <svg className="w-10 h-10" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">Gostando do nosso serviço?</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Sua avaliação no Google nos ajuda muito a crescer!</p>
                        <div className="flex gap-1 mt-2 justify-center sm:justify-start">
                            {[1,2,3,4,5].map(star => <SparklesIcon key={star} className="w-5 h-5 text-yellow-400 fill-current" />)}
                        </div>
                    </div>
                </div>
                <a 
                    href={reviewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transform transition-all active:scale-95 text-center flex items-center justify-center gap-2"
                >
                    <SparklesIcon className="w-5 h-5" />
                    Avaliar no Google
                </a>
            </CardContent>
        </Card>
    );
};

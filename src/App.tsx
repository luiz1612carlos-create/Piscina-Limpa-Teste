import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';
import LoginView from './views/public/LoginView';
import PreBudgetView from './views/public/PreBudgetView';
import AdminLayout from './views/admin/AdminLayout';
import ClientLayout from './views/client/ClientLayout';
import TechnicianLayout from './views/technician/TechnicianLayout';
import { Spinner } from './components/Spinner';
import { Notification } from './components/Notification';
import { NotificationType } from './types';
import { MoonIcon, SunIcon, SettingsIcon, LogoutIcon } from './constants';
import SetupView from './views/public/SetupView';
import { Button } from './components/Button';

const App: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const { user, userData, loading: authLoading, isAnonymous, login, logout, changePassword } = useAuth();
    const appData = useAppData(user, userData);

    const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
    
    const [isLoginView, setIsLoginView] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('view') !== 'budget';
    });

    const [logoError, setLogoError] = useState(false);
    const [logoLoaded, setLogoLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setLogoError(false);
        setLogoLoaded(false);
        
        if (imgRef.current?.complete) {
            setLogoLoaded(true);
        }

        const timer = setTimeout(() => {
            setLogoLoaded(true);
        }, 3000);

        return () => clearTimeout(timer);
    }, [appData.settings?.logoUrl]);

    const showNotification = useCallback((message: string, type: NotificationType) => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    }, []);

    const authContextValue = useMemo(() => ({ 
        user, userData, login, logout, changePassword, showNotification 
    }), [user, userData, login, logout, changePassword, showNotification]);

    const appContextValue = useMemo(() => ({ 
        ...appData, showNotification 
    }), [appData, showNotification]);
    
    if (appData.setupCheck === 'checking') {
        return <div className="h-screen w-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900"><Spinner size="lg" /></div>;
    }

    if (appData.setupCheck === 'needed') {
        return (
            <>
                {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
                <SetupView appContext={appContextValue} />
            </>
        );
    }

    const shouldShowGlobalLoading = authLoading || (user && appData.loading.settings) || (!appData.settings && appData.loading.settings);

    if (shouldShowGlobalLoading) {
        return <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-500 animate-pulse font-medium">Sincronizando dados...</p>
        </div>;
    }

    if (user && !isAnonymous && !userData && !authLoading) {
        return <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-500 font-medium">Carregando Perfil...</p>
        </div>;
    }

    const ThemeToggle = () => (
         <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
            {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
        </button>
    );

    const renderContent = () => {
        if (user && !isAnonymous && userData) {
            if (userData.role === 'client' && appData.settings?.features.maintenanceModeEnabled) {
                const currentClient = appData.clients.find(c => c.uid === user.uid);
                if (!currentClient?.allowAccessInMaintenance) {
                    return (
                        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
                            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
                                <div className="flex justify-center mb-6">
                                    <SettingsIcon className="w-24 h-24 text-yellow-500 animate-spin-slow" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Em Manutenção</h2>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    {appData.settings?.features?.maintenanceMessage || "O sistema está passando por melhorias. Voltaremos em breve!"}
                                </p>
                                <div className="flex justify-center gap-4">
                                    <Button onClick={logout} variant="secondary">
                                        <LogoutIcon className="w-5 h-5 mr-2" />
                                        Sair
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                }
            }

            if (userData.role === 'admin') return <AdminLayout authContext={authContextValue} appContext={appContextValue} />;
            if (userData.role === 'technician') return <TechnicianLayout authContext={authContextValue} appContext={appContextValue} />;
            if (userData.role === 'client') return <ClientLayout authContext={authContextValue} appContext={appContextValue} />;
        }

        const rawLogoUrl = appData.settings?.logoUrl;
        const isValidLogo = rawLogoUrl && typeof rawLogoUrl === 'string' && rawLogoUrl.length > 5;
        
        const logoTransforms = appData.settings?.logoTransforms;
        const brightness = logoTransforms?.brightness ?? 1;
        const contrast = logoTransforms?.contrast ?? 1;
        const grayscale = logoTransforms?.grayscale ?? 0;
        const scale = logoTransforms?.scale ?? 1;
        const rotate = logoTransforms?.rotate ?? 0;
        const logoFilter = `brightness(${brightness}) contrast(${contrast}) grayscale(${grayscale})`;

        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center p-4 relative">
                <div className="absolute top-4 right-4"><ThemeToggle /></div>
                <div className="w-full max-w-4xl mx-auto">
                    <header className="text-center mb-8">
                        {isValidLogo && !logoError ? (
                            <div className="h-24 w-full mx-auto flex items-center justify-center overflow-hidden">
                                <img 
                                    ref={imgRef}
                                    src={rawLogoUrl} 
                                    alt={appData.settings?.companyName || 'Logo'} 
                                    onLoad={() => setLogoLoaded(true)}
                                    onError={() => setLogoError(true)}
                                    loading="eager"
                                    className={`max-w-full max-h-full transition-all duration-700 ease-in-out ${logoLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                                    style={{ 
                                        objectFit: appData.settings?.logoObjectFit || 'contain',
                                        transform: `scale(${scale}) rotate(${rotate}deg)`,
                                        filter: logoFilter
                                    }} 
                                />
                            </div>
                        ) : (
                            <h1 className="text-4xl md:text-5xl font-bold text-primary-600 dark:text-primary-400">
                                {appData.settings?.mainTitle || 'Piscina Limpa'}
                            </h1>
                        )}
                        <p className="text-gray-600 dark:text-gray-300 mt-2">{appData.settings?.mainSubtitle || 'Compromisso e Qualidade'}</p>
                    </header>
                    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-lg overflow-hidden border dark:border-gray-700">
                        <div className="flex border-b border-gray-200 dark:border-gray-700">
                            <button onClick={() => setIsLoginView(false)} className={`flex-1 p-4 text-center font-semibold transition-colors duration-300 ${!isLoginView ? 'bg-primary-500 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>Calcular Orçamento</button>
                            <button onClick={() => setIsLoginView(true)} className={`flex-1 p-4 text-center font-semibold transition-colors duration-300 ${isLoginView ? 'bg-primary-500 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>Acessar Painel</button>
                        </div>
                        <div className="p-4 sm:p-8">
                             {isLoginView ? <LoginView authContext={authContextValue} /> : <PreBudgetView appContext={appContextValue} />}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            {renderContent()}
        </>
    );
};

export default App;
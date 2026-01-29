
import React, { useCallback, useMemo } from 'react';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';
import LoginView from './views/public/LoginView';
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

    const [notification, setNotification] = React.useState<{ message: string; type: NotificationType } | null>(null);

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

    const isWaitingForUserData = user && !isAnonymous && !userData;
    
    if (authLoading || isWaitingForUserData || (user && appData.loading.settings)) {
        return <div className="h-screen w-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900"><Spinner size="lg" /></div>;
    }

    const ThemeToggle = () => (
         <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
            {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
        </button>
    );

    const renderContent = () => {
        if (userData?.role === 'client' && appData.settings?.features.maintenanceModeEnabled) {
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
                                {appData.settings.features.maintenanceMessage || "O sistema está passando por melhorias. Voltaremos em breve!"}
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

        if (userData?.role === 'admin') return <AdminLayout authContext={authContextValue} appContext={appContextValue} />;
        if (userData?.role === 'technician') return <TechnicianLayout authContext={authContextValue} appContext={appContextValue} />;
        if (userData?.role === 'client') return <ClientLayout authContext={authContextValue} appContext={appContextValue} />;

        const logoTransforms = appData.settings?.logoTransforms;
        const logoFilter = [
            logoTransforms?.brightness !== undefined ? `brightness(${logoTransforms.brightness})` : '',
            logoTransforms?.contrast !== undefined ? `contrast(${logoTransforms.contrast})` : '',
            logoTransforms?.grayscale !== undefined ? `grayscale(${logoTransforms.grayscale})` : '',
        ].filter(Boolean).join(' ');

        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center p-4 relative">
                <div className="absolute top-4 right-4"><ThemeToggle /></div>
                <div className="w-full max-w-lg mx-auto">
                    <header className="text-center mb-10">
                        {appData.settings?.logoUrl ? (
                            <div className="h-24 w-full mx-auto flex items-center justify-center overflow-hidden mb-4">
                                <img 
                                    src={appData.settings.logoUrl} 
                                    alt={appData.settings.companyName || 'Logo'} 
                                    className="max-w-full max-h-full"
                                    style={{ 
                                        objectFit: appData.settings.logoObjectFit || 'contain',
                                        transform: `scale(${logoTransforms?.scale || 1}) rotate(${logoTransforms?.rotate || 0}deg)`,
                                        filter: logoFilter
                                    }} 
                                />
                            </div>
                        ) : (
                            <h1 className="text-4xl font-black text-primary-600 dark:text-primary-400 mb-2 uppercase tracking-tighter">Painel do Robô</h1>
                        )}
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Monitor de Cobrança</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Este painel monitora e configura o robô automático de lembretes de cobrança.</p>
                    </header>
                    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl overflow-hidden p-8 border dark:border-gray-700">
                        <LoginView authContext={authContextValue} />
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

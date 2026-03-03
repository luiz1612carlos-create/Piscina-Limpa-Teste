import React, { useState, useEffect, useMemo } from 'react';
import { AuthContextType, AppContextType } from '../../types';
import { MoonIcon, SunIcon, LogoutIcon, DashboardIcon, StoreIcon, DownloadIcon, XMarkIcon, QuestionMarkCircleIcon, CheckBadgeIcon } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import ClientDashboardView from './ClientDashboardView';
import ShopView from './ShopView';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from '../../components/Button';
import { GuidedTour, TourStep } from '../../components/GuidedTour';

interface ClientLayoutProps {
    authContext: AuthContextType;
    appContext: AppContextType;
}

type ClientView = 'dashboard' | 'shop';

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        return isNaN(d.getTime()) ? null : d;
    }
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const ClientLayout: React.FC<ClientLayoutProps> = ({ authContext, appContext }) => {
    const { userData, logout, user } = authContext;
    const { theme, toggleTheme } = useTheme();
    const [currentView, setCurrentView] = useState<ClientView>('dashboard');
    const { canInstall, promptInstall } = usePWAInstall();
    const [isInstallBannerVisible, setIsInstallBannerVisible] = useState(true);
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

    const clientData = useMemo(() => {
        return appContext.clients.find(c => c.uid === user?.uid) || null;
    }, [appContext.clients, user?.uid]);

    const needsTermsAcceptance = useMemo(() => {
        if (!clientData || !appContext.settings) return false;
        const lastAccepted = toDate(clientData.lastAcceptedTermsAt);
        const termsUpdated = toDate(appContext.settings.termsUpdatedAt);
        if (!lastAccepted) return true;
        if (!termsUpdated) return false;
        return lastAccepted < termsUpdated;
    }, [clientData, appContext.settings]);

    const handleAcceptTerms = async () => {
        if (!clientData) return;
        setIsAcceptingTerms(true);
        try {
            await appContext.acknowledgeTerms(clientData.id);
            appContext.showNotification('Termos aceitos com sucesso!', 'success');
        } catch (error) {
            appContext.showNotification('Erro ao processar aceite.', 'error');
        } finally {
            setIsAcceptingTerms(false);
        }
    };

    const renderView = () => {
        switch (currentView) {
            case 'dashboard':
                return <ClientDashboardView authContext={authContext} appContext={appContext} />;
            case 'shop':
                return <ShopView appContext={appContext} />;
            default:
                return <ClientDashboardView authContext={authContext} appContext={appContext} />;
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Início', icon: DashboardIcon },
        { id: 'shop', label: 'Loja', icon: StoreIcon, disabled: !appContext.settings?.features.storeEnabled },
    ];

    const logoTransforms = appContext.settings?.logoTransforms;
    const logoFilter = [
        `brightness(${logoTransforms?.brightness || 1})`,
        `contrast(${logoTransforms?.contrast || 1})`,
        `grayscale(${logoTransforms?.grayscale || 0})`,
    ].filter(Boolean).join(' ');

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {needsTermsAcceptance && appContext.settings && (
                <div className="fixed inset-0 z-[100] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-fade-in border dark:border-gray-700 my-auto">
                        <div className="p-6 border-b dark:border-gray-700 text-center">
                            <CheckBadgeIcon className="w-12 h-12 text-primary-500 mx-auto mb-2" />
                            <h2 className="text-xl font-black">Termos de Serviço e Condições</h2>
                            <p className="text-xs text-gray-500 mt-1">Atualizado em: {toDate(appContext.settings.termsUpdatedAt)?.toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-medium">
                                {clientData?.plan === 'VIP' ? appContext.settings.plans.vip.terms : appContext.settings.plans.simple.terms}
                            </div>
                            <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-800 text-xs text-primary-700 dark:text-primary-300">
                                <strong>Atenção:</strong> Ao clicar em aceitar, você confirma que leu e concorda com as diretrizes de manutenção e precificação acima.
                            </div>
                        </div>
                        <div className="p-6 border-t dark:border-gray-700 flex flex-col sm:flex-row gap-3">
                            <Button variant="secondary" className="flex-1" onClick={logout}>Sair</Button>
                            <Button className="flex-1" onClick={handleAcceptTerms} isLoading={isAcceptingTerms}>Li e Aceito os Termos</Button>
                        </div>
                    </div>
                </div>
            )}

            <div className={needsTermsAcceptance ? 'opacity-20 pointer-events-none' : ''}>
                <header className="bg-white dark:bg-gray-800 shadow-lg sticky top-0 z-10 border-b dark:border-gray-700">
                    <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            {appContext.settings?.logoUrl ? (
                                <div className="h-16 w-40 flex items-center justify-center overflow-hidden">
                                    <img 
                                        src={appContext.settings.logoUrl} 
                                        alt={appContext.settings.companyName} 
                                        className="max-w-full max-h-full"
                                        style={{ 
                                            objectFit: (appContext.settings?.logoObjectFit as React.CSSProperties['objectFit']) || 'contain',
                                            transform: `scale(${(logoTransforms?.scale || 1) * 1.1}) rotate(${logoTransforms?.rotate || 0}deg)`,
                                            filter: logoFilter
                                        }} 
                                    />
                                </div>
                            ) : (
                                <h1 className="text-xl font-black text-primary-600 dark:text-primary-400 uppercase tracking-tighter">{appContext.settings?.companyName || 'Piscina Limpa'}</h1>
                            )}
                            <nav className="hidden md:flex items-center gap-2">
                                {navItems.map(item => !item.disabled && (
                                    <button
                                        key={item.id}
                                        onClick={() => setCurrentView(item.id as ClientView)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentView === item.id ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        {item.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="hidden sm:flex flex-col items-end mr-2">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Cliente</span>
                                <span className="text-xs font-bold truncate max-w-[120px]">{userData?.name || userData?.email}</span>
                            </div>
                            <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                            </button>
                            <button onClick={logout} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <LogoutIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="container mx-auto p-4 md:p-8">
                    {renderView()}
                </main>
            </div>
        </div>
    );
};

export default ClientLayout;
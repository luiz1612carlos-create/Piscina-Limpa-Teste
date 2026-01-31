import React, { useState } from 'react';
import { AuthContextType, AppContextType, AdminView } from '../../types';
import { MenuIcon, SunIcon, MoonIcon, LogoutIcon, UsersIcon, ChartBarIcon, SparklesIcon, PlusIcon } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import ClientsView from './ClientsView';
import ReportsView from './ReportsView';
import AIBotManagerView from './AIBotManagerView';
import RegisterClientsView from './RegisterClientsView';

interface AdminLayoutProps {
    authContext: AuthContextType;
    appContext: AppContextType;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ authContext, appContext }) => {
    const { userData, logout } = authContext;
    const { theme, toggleTheme } = useTheme();
    const [currentView, setCurrentView] = useState<AdminView>('ai_bot');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const menuItems = [
        { id: 'ai_bot', label: 'Monitor do Robô', icon: SparklesIcon },
        { id: 'reports', label: 'Logs de Execução', icon: ChartBarIcon },
        { id: 'register_clients', label: 'Registrar Clientes', icon: PlusIcon },
        { id: 'clients', label: 'Lista de Clientes', icon: UsersIcon },
    ];
    
    const renderView = () => {
        switch (currentView) {
            case 'reports': return <ReportsView appContext={appContext} />;
            case 'clients': return <ClientsView appContext={appContext} />;
            case 'register_clients': return <RegisterClientsView appContext={appContext} />;
            case 'ai_bot': return <AIBotManagerView appContext={appContext} />;
            default: return <AIBotManagerView appContext={appContext} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
            )}

            <aside className={`fixed inset-y-0 left-0 z-30 w-72 bg-white dark:bg-gray-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-8 border-b dark:border-gray-700 h-24 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Painel Central</p>
                    <h1 className="text-xl font-black text-primary-600 dark:text-primary-400 uppercase tracking-tighter truncate w-full text-center">
                        {appContext.settings?.companyName || 'Robô de Cobrança'}
                    </h1>
                </div>
                <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setCurrentView(item.id as AdminView); setIsSidebarOpen(false); }}
                            className={`w-full flex items-center p-4 rounded-2xl transition-all duration-200 ${currentView === item.id ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'}`}
                        >
                            <item.icon className="w-6 h-6 mr-4" />
                            <span className="font-black text-sm uppercase tracking-wider">{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-6 border-t dark:border-gray-700">
                    <button onClick={logout} className="w-full flex items-center p-4 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold">
                        <LogoutIcon className="w-6 h-6 mr-4" />
                        <span>SAIR DO PAINEL</span>
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white dark:bg-gray-800 shadow-sm p-6 flex justify-between items-center h-24 border-b dark:border-gray-700">
                    <button className="p-2 md:hidden" onClick={() => setIsSidebarOpen(true)}><MenuIcon className="w-8 h-8" /></button>
                    <div className="ml-auto flex items-center space-x-6">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black text-gray-400 uppercase">Administrador</p>
                            <p className="text-sm font-bold text-gray-700 dark:text-white">{userData?.name}</p>
                        </div>
                        <button onClick={toggleTheme} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-2xl hover:scale-110 transition-transform">
                            {theme === 'dark' ? <SunIcon className="w-6 h-6 text-yellow-400" /> : <MoonIcon className="w-6 h-6 text-blue-600" />}
                        </button>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-gray-900/50">{renderView()}</main>
            </div>
        </div>
    );
};

export default AdminLayout;
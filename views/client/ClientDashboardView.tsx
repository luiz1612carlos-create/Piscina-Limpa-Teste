
import React, { useMemo } from 'react';
import { AuthContextType, AppContextType } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { CopyIcon, CheckBadgeIcon, CurrencyDollarIcon, DashboardIcon, ArchiveBoxIcon } from '../../constants';
import { calculateClientMonthlyFee } from '../../utils/calculations';

interface ClientDashboardViewProps {
    authContext: AuthContextType;
    appContext: AppContextType;
}

const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ authContext, appContext }) => {
    const { user, showNotification } = authContext;
    const { clients, loading, settings, banks } = appContext;
    
    const clientData = useMemo(() => clients.find(c => c.uid === user.uid) || null, [clients, user.uid]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showNotification('Chave PIX copiada!', 'info');
    };

    if (loading.clients || !settings) return <div className="flex justify-center p-20"><Spinner size="lg" /></div>;
    if (!clientData) return <div className="text-center p-10">Dados não encontrados.</div>;

    const monthlyFee = calculateClientMonthlyFee(clientData, settings);
    const clientBank = banks.find(b => b.id === clientData.bankId);
    const pixKey = clientData.pixKey || clientBank?.pixKey || settings.pixKey;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <header className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <DashboardIcon className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-2xl font-black">Olá, {clientData.name.split(' ')[0]}!</h2>
                    <p className="text-gray-500 text-sm">Bem-vindo ao seu painel de controle.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* FINANCEIRO */}
                <Card className="border-t-4 border-primary-500">
                    <CardHeader className="flex items-center gap-2 font-bold">
                        <CurrencyDollarIcon className="w-5 h-5 text-primary-500" /> Pagamento
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-black">Mensalidade</p>
                                <p className="text-3xl font-black text-gray-800 dark:text-white">R$ {monthlyFee.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400 uppercase font-black">Vencimento</p>
                                <p className="font-bold">{new Date(clientData.payment.dueDate).toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-gray-400 uppercase">Pagar via PIX</p>
                                <p className="text-xs font-mono truncate">{pixKey}</p>
                            </div>
                            <button onClick={() => copyToClipboard(pixKey)} className="p-2 bg-white dark:bg-gray-800 shadow rounded-lg hover:text-primary-500">
                                <CopyIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* STATUS PISCINA */}
                <Card className="border-t-4 border-green-500">
                    <CardHeader className="flex items-center gap-2 font-bold">
                        <CheckBadgeIcon className="w-5 h-5 text-green-500" /> Status da Água
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                            <p className="text-[10px] font-black text-blue-400 uppercase">pH</p>
                            <p className="text-xl font-black text-blue-600">{clientData.poolStatus.ph}</p>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-center">
                            <p className="text-[10px] font-black text-yellow-400 uppercase">Cloro</p>
                            <p className="text-xl font-black text-yellow-600">{clientData.poolStatus.cloro}</p>
                        </div>
                        <div className="col-span-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase">Uso</p>
                            <p className={`font-black ${clientData.poolStatus.uso === 'Livre para uso' ? 'text-green-500' : 'text-amber-500'}`}>
                                {clientData.poolStatus.uso}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* ESTOQUE */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex items-center gap-2 font-bold">
                        <ArchiveBoxIcon className="w-5 h-5 text-amber-500" /> Meus Produtos em Casa
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {clientData.stock.map(item => (
                            <div key={item.productId} className="p-3 border dark:border-gray-700 rounded-xl">
                                <p className="font-bold text-sm truncate">{item.name}</p>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-primary-500 h-full" style={{ width: `${(item.quantity / (item.maxQuantity || 5)) * 100}%` }}></div>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">{item.quantity} de {item.maxQuantity || 5} un.</p>
                            </div>
                        ))}
                        {clientData.stock.length === 0 && <p className="col-span-3 text-center text-gray-400 text-sm py-4">Nenhum produto registrado.</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ClientDashboardView;

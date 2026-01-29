
import React, { useState, useMemo } from 'react';
import { AppContextType, Client, PlanType, ClientStatus, Address } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';

interface ClientsViewProps {
    appContext: AppContextType;
}

const formatAddress = (address: Address) => {
    if (!address) return 'N/A';
    return `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}, ${address.zip}`;
};

const ClientsView: React.FC<ClientsViewProps> = ({ appContext }) => {
    const { clients, loading } = appContext;
    const [filterPlan, setFilterPlan] = useState<PlanType | 'Todos'>('Todos');
    const [filterStatus, setFilterStatus] = useState<ClientStatus | 'Todos'>('Todos');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const planMatch = filterPlan === 'Todos' || client.plan === filterPlan;
            const statusMatch = filterStatus === 'Todos' || client.clientStatus === filterStatus;
            return planMatch && statusMatch;
        });
    }, [clients, filterPlan, filterStatus]);

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 dark:text-white">Lista de Clientes</h2>
                    <p className="text-sm text-gray-500 italic">Os dados de clientes são lidos diretamente do Firebase para monitoramento.</p>
                </div>
                <div className="flex gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-widest">
                    Somente Leitura ✓
                </div>
            </header>

            <div className="flex space-x-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border dark:border-gray-700">
                <Select label="Filtrar Plano" value={filterPlan} onChange={(e) => setFilterPlan(e.target.value as any)} options={[{ value: 'Todos', label: 'Todos' }, { value: 'Simples', label: 'Simples' }, { value: 'VIP', label: 'VIP' }]} containerClassName="mb-0 flex-1" />
                <Select label="Filtrar Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} options={[{ value: 'Todos', label: 'Todos' }, { value: 'Ativo', label: 'Ativo' }, { value: 'Pendente', label: 'Pendente' }]} containerClassName="mb-0 flex-1" />
            </div>

            {loading.clients ? (
                <div className="flex justify-center mt-20"><Spinner size="lg" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredClients.map(client => (
                        <Card key={client.id} className="hover:shadow-xl transition-all duration-300 border dark:border-gray-700 cursor-pointer" onClick={() => setSelectedClient(client)}>
                            <CardHeader className="bg-gray-50/50 dark:bg-gray-900/50">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold truncate pr-2 text-sm">{client.name}</h3>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${client.clientStatus === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {client.clientStatus.toUpperCase()}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Última Cobrança</p>
                                <p className="text-xs font-mono text-gray-600 dark:text-gray-300">Ciclo: {client.payment.lastBillingCycle || 'Nenhum'}</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase mt-3 mb-1">Endereço</p>
                                <p className="text-xs text-gray-500 truncate">{formatAddress(client.address)}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
            
            {selectedClient && (
                <Modal isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} title="Informações do Cliente" size="md">
                    <div className="space-y-6">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
                            <h4 className="font-black text-xs uppercase text-primary-500 mb-3 tracking-widest">Dados de Cobrança</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Status de Pagamento</p>
                                    <p className="font-bold">{selectedClient.payment.status}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Data de Vencimento</p>
                                    <p className="font-bold">{new Date(selectedClient.payment.dueDate).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div className="col-span-2 pt-2 border-t dark:border-gray-800">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Último Log do Robô</p>
                                    <p className="text-xs italic mt-1 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                                        {selectedClient.payment.lastBillingNotificationRomantic || "Nenhuma mensagem gerada ainda."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
                            <h4 className="font-black text-xs uppercase text-gray-500 mb-3 tracking-widest">Contato e Local</h4>
                            <div className="space-y-3 text-sm">
                                <p><strong>Email:</strong> {selectedClient.email}</p>
                                <p><strong>Telefone:</strong> {selectedClient.phone}</p>
                                <p><strong>Endereço:</strong> {formatAddress(selectedClient.address)}</p>
                            </div>
                        </div>
                        
                        <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">EDIÇÃO DESATIVADA</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-500">Este painel é apenas para monitoramento de automação.</p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ClientsView;

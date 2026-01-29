
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
                    <h2 className="text-3xl font-black text-gray-800 dark:text-white">Gerenciar Clientes</h2>
                    <p className="text-sm text-gray-500 italic">Lista de clientes ativos e pendentes para monitoramento.</p>
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
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Status Financeiro</p>
                                <p className={`text-xs font-bold ${client.payment?.status === 'Pago' ? 'text-green-600' : 'text-amber-600'}`}>
                                    {client.payment?.status || 'Pendente'}
                                </p>
                                <p className="text-[10px] font-black text-gray-400 uppercase mt-3 mb-1">Vencimento</p>
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 italic">
                                    {client.payment?.dueDate ? new Date(client.payment.dueDate).toLocaleDateString('pt-BR') : '---'}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
            
            {selectedClient && (
                <Modal 
                    isOpen={!!selectedClient} 
                    onClose={() => setSelectedClient(null)} 
                    title="Detalhes do Cliente" 
                    size="md"
                >
                    <div className="space-y-6">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700">
                            <h4 className="font-black text-xs uppercase text-gray-500 mb-3 tracking-widest">Informações Gerais</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Nome</p>
                                    <p className="font-bold">{selectedClient.name}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Telefone</p>
                                    <p className="font-bold">{selectedClient.phone}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Endereço</p>
                                    <p className="font-medium text-xs">{formatAddress(selectedClient.address)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ClientsView;

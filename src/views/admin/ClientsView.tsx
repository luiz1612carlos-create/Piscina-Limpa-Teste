
import React, { useState, useMemo, useEffect } from 'react';
import { calculateClientMonthlyFee, calculateVolume, normalizeDimension, calculateDrivingDistance, formatAddressForGeocoding } from '../../utils/calculations';
// FIX: Added NotificationType to the import from types
import { AppContextType, Client, ClientProduct, PlanType, ClientStatus, PoolUsageStatus, PaymentStatus, Product, Address, Settings, Bank, FidelityPlan, Visit, StockProduct, NotificationType } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { ClientStockManager } from '../../components/ClientStockManager';
import { SparklesIcon, CheckBadgeIcon } from '../../constants';

interface ClientsViewProps {
    appContext: AppContextType;
}

const formatAddress = (address: Address) => {
    if (!address || !address.street) return 'Endereço não informado';
    return `${address.street}, ${address.number || 'S/N'} - ${address.neighborhood || ''}, ${address.city || ''} - ${address.state || ''}`;
};

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

interface ClientFormData extends Omit<Client, 'poolDimensions'> {
    poolDimensions: {
        width: string | number;
        length: string | number;
        depth: string | number;
    }
}


const ClientsView: React.FC<ClientsViewProps> = ({ appContext }) => {
    const { clients, loading, products, banks, updateClient, deleteClient, markAsPaid, showNotification, settings, stockProducts, cancelScheduledPlanChange, sendAdminChatMessage } = appContext;
    const [filterPlan, setFilterPlan] = useState<PlanType | 'Todos'>('Todos');
    const [filterStatus, setFilterStatus] = useState<ClientStatus | 'Todos'>('Todos');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Announcement state
    const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
    const [selectedClientForAnnouncement, setSelectedClientForAnnouncement] = useState<Client | null>(null);
    const [announcementMessage, setAnnouncementMessage] = useState('');
    const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const planMatch = filterPlan === 'Todos' || client.plan === filterPlan;
            const statusMatch = filterStatus === 'Todos' || client.clientStatus === filterStatus;
            return planMatch && statusMatch;
        });
    }, [clients, filterPlan, filterStatus]);

    const handleOpenModal = (client: Client) => {
        setSelectedClient(client);
    };

    const handleCloseModal = () => {
        setSelectedClient(null);
    };
    
    const handleSaveChanges = async (clientData: ClientFormData) => {
        if (!clientData) return;
        setIsSaving(true);
        try {
            let volume = clientData.poolVolume;
            const calculated = calculateVolume(
                clientData.poolDimensions.width,
                clientData.poolDimensions.length,
                clientData.poolDimensions.depth
            );
            if (calculated > 0) volume = calculated;
            const clientToSave: Client = {
                ...clientData,
                poolDimensions: {
                    width: normalizeDimension(clientData.poolDimensions.width),
                    length: normalizeDimension(clientData.poolDimensions.length),
                    depth: normalizeDimension(clientData.poolDimensions.depth),
                },
                poolVolume: volume,
            };
            const { id, ...dataToUpdate } = clientToSave;
            await updateClient(id, dataToUpdate);
            showNotification('Cliente atualizado com sucesso!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Falha ao salvar alterações.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClient = async () => {
        const confirmationMessage = `Tem certeza que deseja excluir ${selectedClient?.name}?`;
        if (!selectedClient || !window.confirm(confirmationMessage)) return;
        setIsDeleting(true);
        try {
            await deleteClient(selectedClient.id);
            showNotification('Cliente excluído com sucesso!', 'success');
            handleCloseModal();
        } catch(error: any) {
            showNotification(error.message || 'Falha ao excluir cliente.', 'error');
        } finally {
            setIsDeleting(false);
        }
    }
    
    const handleMarkPaid = async (clientData: ClientFormData) => {
        if (!clientData || !settings) return;
        const clientToPay: Client = {
            ...clientData,
            poolDimensions: {
                width: normalizeDimension(clientData.poolDimensions.width),
                length: normalizeDimension(clientData.poolDimensions.length),
                depth: normalizeDimension(clientData.poolDimensions.depth),
            }
        };
        const fee = calculateClientMonthlyFee(clientToPay, settings);
        if (!window.confirm(`Confirma o pagamento de R$ ${fee.toFixed(2)} para ${clientToPay.name}?`)) return;
        setIsSaving(true);
        try {
            await markAsPaid(clientToPay, 1, fee);
            showNotification('Pagamento registrado!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Erro no pagamento.', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleOpenAnnouncement = (e: React.MouseEvent, client: Client) => {
        e.stopPropagation();
        if (!settings) return;
        setSelectedClientForAnnouncement(client);
        let template = settings.announcementMessageTemplate || "Atenção {CLIENTE}!\n\nSeu acesso: {LOGIN}";
        const message = template.replace(/{CLIENTE}/g, client.name).replace(/{LOGIN}/g, client.email).replace(/{SENHA}/g, "Sua senha atual");
        setAnnouncementMessage(message);
        setIsAnnouncementModalOpen(true);
    };

    const handleSendAnnouncement = async () => {
        if (!selectedClientForAnnouncement || !announcementMessage.trim()) return;
        setIsSendingAnnouncement(true);
        try {
            const phoneId = selectedClientForAnnouncement.phone.replace(/\D/g, '');
            const fullPhone = phoneId.startsWith('55') ? phoneId : `55${phoneId}`;
            
            await sendAdminChatMessage(fullPhone, announcementMessage);
            showNotification('Aviso enviado com sucesso via API oficial!', 'success');
            setIsAnnouncementModalOpen(false);
        } catch (error) {
            showNotification('Erro ao enviar aviso via API.', 'error');
        } finally {
            setIsSendingAnnouncement(false);
        }
    };

    const isAdvancePlanActive = (client: Client): boolean => {
        if (!client.advancePaymentUntil) return false;
        const today = new Date();
        const advanceUntilDate = toDate(client.advancePaymentUntil);
        return advanceUntilDate && (advanceUntilDate > today);
    };

    const handleCancelScheduledChange = async () => {
        if (!selectedClient) return;
        setIsSaving(true);
        try {
            await cancelScheduledPlanChange(selectedClient.id);
            showNotification('Mudança cancelada!', 'success');
            handleCloseModal();
        } catch (error) {
            showNotification('Erro ao cancelar.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Gerenciamento de Clientes</h2>
            <div className="flex space-x-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <Select label="Filtrar por Plano" value={filterPlan} onChange={(e) => setFilterPlan(e.target.value as any)} options={[{ value: 'Todos', label: 'Todos' }, { value: 'Simples', label: 'Simples' }, { value: 'VIP', label: 'VIP' }]} containerClassName="mb-0" />
                <Select label="Filtrar por Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} options={[{ value: 'Todos', label: 'Todos' }, { value: 'Ativo', label: 'Ativo' }, { value: 'Pendente', label: 'Pendente' }]} containerClassName="mb-0" />
            </div>

            {loading.clients ? (
                <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredClients.map(client => (
                        <Card key={client.id} className="cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group" onClick={() => handleOpenModal(client)}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-semibold truncate pr-2">{client.name}</h3>
                                    {isAdvancePlanActive(client) && <span className="flex-shrink-0 text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded-full dark:bg-green-900">Adiantado</span>}
                                </div>
                                <p className={`text-sm font-bold ${client.plan === 'VIP' ? 'text-yellow-500' : 'text-blue-500'}`}>{client.plan}</p>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">{formatAddress(client.address)}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{client.phone}</p>
                            </CardContent>
                             <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="light" className="shadow-md !p-2" onClick={(e) => handleOpenAnnouncement(e, client)} title="Enviar Aviso via API">
                                    <SparklesIcon className="w-5 h-5 text-purple-600" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            
            {selectedClient && (
                <ClientEditModal 
                    client={selectedClient} 
                    isOpen={!!selectedClient} 
                    onClose={handleCloseModal} 
                    onSave={handleSaveChanges} 
                    onDelete={handleDeleteClient} 
                    onMarkPaid={handleMarkPaid} 
                    onCancelScheduledChange={handleCancelScheduledChange} 
                    isSaving={isSaving} 
                    isDeleting={isDeleting} 
                    stockProducts={stockProducts} 
                    banks={banks} 
                    settings={settings}
                    // FIX: Pass showNotification to ClientEditModal
                    showNotification={showNotification}
                />
            )}
            
            <Modal isOpen={isAnnouncementModalOpen} onClose={() => setIsAnnouncementModalOpen(false)} title={`Enviar Aviso para ${selectedClientForAnnouncement?.name}`}
                footer={<><Button variant="secondary" onClick={() => setIsAnnouncementModalOpen(false)}>Cancelar</Button><Button onClick={handleSendAnnouncement} isLoading={isSendingAnnouncement}>Enviar via API Meta</Button></>}>
                <div className="space-y-4">
                    <p className="text-xs text-gray-500">Este aviso será enviado diretamente pelo seu número oficial.</p>
                    <textarea value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} rows={10} className="w-full p-3 border rounded-xl bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none text-sm" />
                </div>
            </Modal>
        </div>
    );
};

interface ClientEditModalProps {
    client: Client; 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (clientData: ClientFormData) => void; 
    onDelete: () => void; 
    onMarkPaid: (clientData: ClientFormData) => void; 
    onCancelScheduledChange: () => void; 
    isSaving: boolean; 
    isDeleting: boolean; 
    stockProducts: StockProduct[]; 
    banks: Bank[]; 
    settings: Settings | null;
    // FIX: Added showNotification to ClientEditModalProps
    showNotification: (message: string, type: NotificationType) => void;
}

const ClientEditModal: React.FC<ClientEditModalProps> = (props) => {
    // FIX: Destructure showNotification from props
    const { client, isOpen, onClose, onSave, onDelete, onMarkPaid, onCancelScheduledChange, isSaving, isDeleting, stockProducts, banks, settings, showNotification } = props;
    
    // Inicialização segura para garantir que objetos aninhados existam no formulário
    const initialData = useMemo(() => ({
        ...client,
        address: client.address || { street: '', number: '', neighborhood: '', city: '', state: '', zip: '' },
        payment: client.payment || { status: 'Pendente', dueDate: new Date().toISOString() },
        poolDimensions: client.poolDimensions || { width: 0, length: 0, depth: 0 }
    }), [client]);

    const [clientData, setClientData] = useState<ClientFormData>(initialData);
    const [errors, setErrors] = useState<{ dueDate?: string; }>({});
    const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

    useEffect(() => { 
        setClientData(initialData); 
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let finalValue: any = value;
        if (name === 'payment.dueDate') finalValue = new Date(value + 'T12:00:00').toISOString();
        else if (type === 'number') finalValue = parseFloat(value) || 0;

        const keys = name.split('.');
        setClientData(prev => {
            const newState = JSON.parse(JSON.stringify(prev));
            let current: any = newState;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = finalValue;
            if (name.startsWith('poolDimensions')) {
                 const calc = calculateVolume(newState.poolDimensions.width, newState.poolDimensions.length, newState.poolDimensions.depth);
                 if (calc > 0) newState.poolVolume = calc;
            }
            return newState;
        });
    };
    
    const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'Simples') setClientData(prev => ({ ...prev, plan: 'Simples', fidelityPlan: undefined }));
        else {
            const selectedFidelityPlan = settings?.fidelityPlans.find(fp => fp.id === value);
            if (selectedFidelityPlan) setClientData(prev => ({ ...prev, plan: 'VIP', fidelityPlan: selectedFidelityPlan }));
        }
    };
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setClientData(prev => ({ ...prev, [name]: checked }));
    };

    const handleAutoCalculateDistance = async () => {
        if (!settings) return;
        setIsCalculatingDistance(true);
        try {
            const originStr = formatAddressForGeocoding(settings.baseAddress);
            const destinationStr = formatAddressForGeocoding(clientData.address);
            const km = await calculateDrivingDistance(originStr, destinationStr);
            if (km >= 0) { 
                setClientData(prev => ({ ...prev, distanceFromHq: km })); 
                // FIX: showNotification is now available from props
                showNotification(`Distância calculada: ${km} km`, 'info');
            }
        } catch (error: any) { 
            // FIX: showNotification is now available from props
            showNotification(error.message, 'error'); 
        } finally { 
            setIsCalculatingDistance(false); 
        }
    };

    const calculatedFee = useMemo(() => {
        if (!settings) return 0;
        const tempClient: Partial<Client> = { ...clientData, poolDimensions: { width: normalizeDimension(clientData.poolDimensions.width), length: normalizeDimension(clientData.poolDimensions.length), depth: normalizeDimension(clientData.poolDimensions.depth) } };
        return calculateClientMonthlyFee(tempClient, settings);
    }, [clientData, settings]);

    const planOptions = useMemo(() => {
        if (!settings) return [];
        return [{ value: 'Simples', label: 'Plano Simples' }, ...settings.fidelityPlans.map(fp => ({ value: fp.id, label: `VIP - ${fp.months} Meses` }))];
    }, [settings]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Cliente: ${client.name}`} size="xl">
            <div className="space-y-4">
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Dados Pessoais</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                         <Input label="Nome" name="name" value={clientData.name} onChange={handleChange} />
                         <Input label="Email" name="email" type="email" value={clientData.email} onChange={handleChange} />
                         <Input label="Telefone" name="phone" value={clientData.phone} onChange={handleChange} />
                         <Select label="Plano Atual" value={clientData.plan === 'VIP' ? clientData.fidelityPlan?.id : 'Simples'} onChange={handlePlanChange} options={planOptions} />
                    </div>
                </fieldset>
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Endereço</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mt-2">
                        <Input containerClassName="sm:col-span-4" label="Rua" name="address.street" value={clientData.address?.street || ''} onChange={handleChange} />
                        <Input containerClassName="sm:col-span-2" label="Número" name="address.number" value={clientData.address?.number || ''} onChange={handleChange} />
                        <div className="sm:col-span-6 flex items-end gap-2">
                            <Input label="Distância (Km)" name="distanceFromHq" type="number" value={clientData.distanceFromHq || 0} onChange={handleChange} containerClassName="mb-0 flex-grow" />
                            <Button type="button" onClick={handleAutoCalculateDistance} isLoading={isCalculatingDistance} variant="secondary"><SparklesIcon className="w-5 h-5" /></Button>
                        </div>
                    </div>
                </fieldset>
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Faturamento e Cobrança</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                         <Input label="Nome do Destinatário (Cobrança)" name="recipientName" value={clientData.recipientName || ''} onChange={handleChange} placeholder="Nome para a variável {DESTINATARIO}" />
                         <Select label="Banco Associado" name="bankId" value={clientData.bankId || ''} onChange={handleChange} options={[{ value: '', label: 'Nenhum' }, ...banks.map(b => ({ value: b.id, label: b.name }))]} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Status de Pagamento" name="payment.status" value={clientData.payment?.status || 'Pendente'} onChange={handleChange} options={[{value: 'Pago', label: 'Pago'}, {value: 'Pendente', label: 'Pendente'}]} />
                        <Input label="Data de Vencimento" name="payment.dueDate" type="date" value={(clientData.payment?.dueDate || '').split('T')[0]} onChange={handleChange} />
                    </div>
                    <div className="flex justify-between items-center mt-4 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                        <div><p className="text-sm font-semibold">Valor da Mensalidade:</p><p className="text-2xl font-bold">R$ {calculatedFee.toFixed(2)}</p></div>
                        <Button onClick={() => onMarkPaid(clientData)} isLoading={isSaving} variant="primary">Registrar Pagamento</Button>
                    </div>
                </fieldset>
                <ClientStockManager stock={clientData.stock || []} allStockProducts={stockProducts} onStockChange={(newStock) => setClientData(prev => ({...prev, stock: newStock}))} />
            </div>
            <div className="mt-6 flex justify-between">
                <Button variant="danger" onClick={onDelete} isLoading={isDeleting}>Excluir</Button>
                <div className="flex space-x-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave(clientData)} isLoading={isSaving}>Salvar Alterações</Button></div>
            </div>
        </Modal>
    );
};

export default ClientsView;

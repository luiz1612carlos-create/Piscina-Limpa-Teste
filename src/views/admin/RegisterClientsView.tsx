import React, { useState } from 'react';
import { AppContextType, Client } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { Modal } from '../../components/Modal';
import { PlusIcon, SparklesIcon } from '../../constants';

interface RegisterClientsViewProps {
    appContext: AppContextType;
}

const RegisterClientsView: React.FC<RegisterClientsViewProps> = ({ appContext }) => {
    const { settings, banks, addClient, saveBank, showNotification } = appContext;
    const [isSaving, setIsSaving] = useState(false);
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [newBankName, setNewBankName] = useState('');
    const [isSavingBank, setIsSavingBank] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        pixKey: '',
        recipientName: '',
        bankId: '',
        monthlyFee: 0,
        dueDate: new Date().toISOString().split('T')[0],
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'number' ? parseFloat(value) : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone || !formData.dueDate || formData.monthlyFee <= 0) {
            showNotification('Nome, Telefone, Valor e Vencimento são obrigatórios.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const clientData: Omit<Client, 'id' | 'createdAt'> = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                pixKey: formData.pixKey,
                manualFee: formData.monthlyFee,
                bankId: formData.bankId,
                address: {
                    street: '',
                    number: '',
                    neighborhood: '',
                    city: 'Governador Valadares',
                    state: 'MG',
                    zip: ''
                },
                poolDimensions: { width: 0, length: 0, depth: 0 },
                poolVolume: 0,
                hasWellWater: false,
                includeProducts: false,
                isPartyPool: false,
                plan: 'Simples',
                clientStatus: 'Ativo',
                poolStatus: { ph: 7.2, cloro: 1.5, alcalinidade: 100, uso: 'Livre para uso' },
                payment: {
                    status: 'Pendente',
                    dueDate: new Date(formData.dueDate + 'T12:00:00').toISOString(),
                    recipientName: formData.recipientName || settings?.companyName || formData.name
                },
                stock: []
            };

            await addClient(clientData);
            showNotification('Cliente registrado com sucesso!', 'success');
            
            // Reset form
            setFormData({
                name: '', phone: '', email: '', pixKey: '', recipientName: '',
                bankId: '',
                monthlyFee: 0,
                dueDate: new Date().toISOString().split('T')[0],
            });
        } catch (error: any) {
            showNotification(error.message || 'Erro ao registrar cliente.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleQuickCreateBank = async () => {
        if (!newBankName.trim()) {
            showNotification('Digite o nome do banco.', 'error');
            return;
        }
        setIsSavingBank(true);
        try {
            await saveBank({ name: newBankName.trim() });
            showNotification('Banco criado com sucesso!', 'success');
            setNewBankName('');
            setIsBankModalOpen(false);
        } catch (error: any) {
            showNotification('Erro ao criar banco.', 'error');
        } finally {
            setIsSavingBank(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header>
                <h2 className="text-3xl font-black text-gray-800 dark:text-white">Registrar Novo Cliente</h2>
                <p className="text-sm text-gray-500">Cadastre manualmente os clientes para o monitoramento do robô.</p>
            </header>

            <Card>
                <CardHeader className="bg-primary-50 dark:bg-primary-900/10 border-b dark:border-gray-700">
                    <h3 className="font-bold text-primary-700 dark:text-primary-400">Dados do Contrato e Variáveis de Template</h3>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={handleRegister} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Nome do Cliente {CLIENTE}" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Ex: João Silva" />
                            <Input label="Telefone (WhatsApp)" name="phone" value={formData.phone} onChange={handleInputChange} required placeholder="55..." />
                            <Input label="E-mail (opcional)" name="email" value={formData.email} onChange={handleInputChange} placeholder="joao@email.com" />
                            <Input label="Data do Próximo Vencimento {VENCIMENTO}" name="dueDate" type="date" value={formData.dueDate} onChange={handleInputChange} required />
                            
                            <div className="flex items-end gap-2">
                                <Select 
                                    label="Banco de Destino (Relatórios) {BANCO}" 
                                    name="bankId" 
                                    value={formData.bankId} 
                                    onChange={handleInputChange} 
                                    containerClassName="flex-grow mb-0"
                                    options={[
                                        { value: '', label: 'Selecione um banco...' },
                                        ...banks.map(b => ({ value: b.id, label: b.name }))
                                    ]}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setIsBankModalOpen(true)}
                                    className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 transition-colors"
                                    title="Criar novo banco"
                                >
                                    <PlusIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t dark:border-gray-700">
                            <h4 className="text-sm font-black uppercase text-gray-400 mb-4 tracking-widest">Informações Financeiras</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Valor da Mensalidade {VALOR}" name="monthlyFee" type="number" step="0.01" value={formData.monthlyFee} onChange={handleInputChange} required placeholder="0.00" />
                                <Input label="Nome do Recebedor PIX {DESTINATARIO}" name="recipientName" value={formData.recipientName} onChange={handleInputChange} placeholder="Se vazio, usa o nome da empresa" />
                            </div>
                            <div className="mt-4">
                                <Input label="Chave PIX Individual {PIX}" name="pixKey" value={formData.pixKey} onChange={handleInputChange} placeholder="Se vazio, usa a padrão das configurações" />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">Valor Final no Template</p>
                                <p className="text-3xl font-black text-primary-600">R$ {formData.monthlyFee.toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <VariableBadge name="CLIENTE" />
                                <VariableBadge name="VALOR" />
                                <VariableBadge name="VENCIMENTO" />
                                <VariableBadge name="BANCO" />
                                <VariableBadge name="DESTINATARIO" />
                                <VariableBadge name="PIX" />
                                <VariableBadge name="EMPRESA" />
                            </div>
                        </div>

                        <div className="pt-6 flex justify-end">
                            <Button type="submit" isLoading={isSaving} className="w-full md:w-auto px-12 h-14 rounded-2xl shadow-xl shadow-primary-500/20 font-black uppercase text-sm tracking-widest">
                                <PlusIcon className="w-5 h-5 mr-2" />
                                Registrar Cliente
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Modal de Criação Rápida de Banco */}
            <Modal 
                isOpen={isBankModalOpen} 
                onClose={() => setIsBankModalOpen(false)} 
                title="Cadastrar Novo Banco"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsBankModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleQuickCreateBank} isLoading={isSavingBank}>
                            <SparklesIcon className="w-4 h-4 mr-2" /> Criar Banco
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">Crie um novo banco de destino para vincular a este e a futuros clientes.</p>
                    <Input 
                        label="Nome do Banco" 
                        value={newBankName} 
                        onChange={(e) => setNewBankName(e.target.value)} 
                        placeholder="Ex: Banco do Brasil, Nubank..."
                        autoFocus
                    />
                </div>
            </Modal>
        </div>
    );
};

const VariableBadge = ({ name }: { name: string }) => (
    <span className="text-[10px] bg-white dark:bg-gray-800 text-primary-600 border border-primary-200 dark:border-primary-800 px-3 py-1 rounded-full font-mono font-black">{`{${name}}`}</span>
);

export default RegisterClientsView;
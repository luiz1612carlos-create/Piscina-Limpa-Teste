
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppContextType, AuthContextType, Settings, Bank, AdvancePaymentOption, FidelityPlan, UserData, AffectedClientPreview, PendingPriceChange, RecessPeriod } from '../../types';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { TrashIcon, EditIcon, PlusIcon, CalendarDaysIcon, ChartBarIcon, CurrencyDollarIcon, SparklesIcon } from '../../constants';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { calculateClientMonthlyFee } from '../../utils/calculations';
import { firebase } from '../../firebase';

interface SettingsViewProps {
    appContext: AppContextType;
    authContext: AuthContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const RecessManager = ({ appContext }: { appContext: AppContextType }) => {
    const { settings, saveRecessPeriod, deleteRecessPeriod, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRecess, setCurrentRecess] = useState<Omit<RecessPeriod, 'id'> | RecessPeriod | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleOpenModal = (recess: RecessPeriod | null = null) => {
        if (recess) {
            setCurrentRecess({
                ...recess,
                startDate: toDate(recess.startDate)?.toISOString().split('T')[0],
                endDate: toDate(recess.endDate)?.toISOString().split('T')[0]
            });
        } else {
            setCurrentRecess({ name: '', startDate: '', endDate: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentRecess || !currentRecess.name || !currentRecess.startDate || !currentRecess.endDate) {
            showNotification('Preencha todos os campos.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const recessToSave = {
                ...currentRecess,
                startDate: new Date(currentRecess.startDate + 'T00:00:00'),
                endDate: new Date(currentRecess.endDate + 'T23:59:59'),
            };
            await saveRecessPeriod(recessToSave);
            showNotification('Recesso salvo!', 'success');
            setIsModalOpen(false);
        } catch (error: any) {
            showNotification('Erro ao salvar recesso.', 'error');
        } finally { setIsSaving(false); }
    };

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestão de Recessos</h3>
                <Button size="sm" onClick={() => handleOpenModal()}>Adicionar</Button>
            </div>
            <div className="space-y-2">
                {settings?.recessPeriods?.map(recess => (
                    <div key={recess.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                            <span className="font-medium">{recess.name}</span>
                            <p className="text-xs text-gray-500">
                                {toDate(recess.startDate)?.toLocaleDateString()} - {toDate(recess.endDate)?.toLocaleDateString()}
                            </p>
                        </div>
                        <Button size="sm" variant="danger" onClick={() => deleteRecessPeriod(recess.id)}><TrashIcon className="w-4 h-4" /></Button>
                    </div>
                ))}
            </div>
             {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Configurar Recesso">
                    <Input label="Nome" value={currentRecess?.name} onChange={(e) => setCurrentRecess(prev => ({...prev!, name: e.target.value}))} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Início" type="date" value={currentRecess?.startDate || ''} onChange={(e) => setCurrentRecess(prev => ({...prev!, startDate: e.target.value}))} />
                        <Input label="Fim" type="date" value={currentRecess?.endDate || ''} onChange={(e) => setCurrentRecess(prev => ({...prev!, endDate: e.target.value}))} />
                    </div>
                    <div className="flex justify-end mt-4"><Button onClick={handleSave} isLoading={isSaving}>Salvar</Button></div>
                </Modal>
             )}
        </div>
    );
};

const UserManager = ({ appContext }: { appContext: AppContextType }) => {
    const { users, createTechnician, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await createTechnician(name, email, password);
            showNotification('Usuário criado!', 'success');
            setIsModalOpen(false);
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally { setIsSaving(false); }
    };

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Usuários do Sistema</h3>
                <Button size="sm" onClick={() => setIsModalOpen(true)}><PlusIcon className="w-4 h-4 mr-1" /> Novo</Button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead><tr className="border-b dark:border-gray-700 text-left"><th className="p-2">Nome</th><th className="p-2">Email</th><th className="p-2 text-right">Cargo</th></tr></thead>
                    <tbody>{users.map(user => (<tr key={user.uid} className="border-b dark:border-gray-700"><td className="p-2 font-medium">{user.name}</td><td className="p-2">{user.email}</td><td className="p-2 text-right capitalize">{user.role}</td></tr>))}</tbody>
                </table>
            </div>
            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Técnico">
                    <form onSubmit={handleSave} className="space-y-4">
                        <Input label="Nome" value={name} onChange={e => setName(e.target.value)} required />
                        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                        <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                        <Button type="submit" isLoading={isSaving} className="w-full">Salvar e Deslogar</Button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const SettingsView: React.FC<SettingsViewProps> = ({ appContext, authContext }) => {
    const { settings, updateSettings, showNotification, banks, saveBank, deleteBank, clients, schedulePriceChange } = appContext;
    const { changePassword } = authContext;
    const [localSettings, setLocalSettings] = useState<Settings | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [newPass, setNewPass] = useState('');

    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [customEffectiveDate, setCustomEffectiveDate] = useState<string>(() => {
        const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0];
    });

    useEffect(() => {
        if (settings) {
            setLocalSettings(JSON.parse(JSON.stringify(settings)));
            setLogoPreview(settings.logoUrl || null);
        }
    }, [settings]);

    if (!localSettings) return <Spinner />;

    const handleSimpleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, section?: string) => {
        const { name, value, type } = e.target;
        let val: any = value;
        if (type === 'number') val = parseFloat(value) || 0;
        setLocalSettings(prev => {
            const newState = JSON.parse(JSON.stringify(prev));
            if (section) newState[section][name] = val;
            else newState[name] = val;
            return newState;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const priceChanged = JSON.stringify(localSettings.pricing) !== JSON.stringify(settings?.pricing);
            if (priceChanged) {
                setIsPriceModalOpen(true);
                setIsSaving(false);
                return;
            }
            await updateSettings(localSettings, logoFile || undefined);
            showNotification('Configurações salvas!', 'success');
        } catch (e) { showNotification('Erro ao salvar', 'error'); } finally { setIsSaving(false); }
    };

    const handleConfirmPrice = async () => {
        setIsSaving(true);
        try {
            const affected = clients.filter(c => c.clientStatus === 'Ativo').map(c => ({id: c.id, name: c.name}));
            await schedulePriceChange(localSettings.pricing, affected, new Date(customEffectiveDate + 'T12:00:00'));
            await updateSettings(localSettings, logoFile || undefined);
            showNotification('Preço agendado!', 'success');
            setIsPriceModalOpen(false);
        } catch (e) { showNotification('Erro no agendamento', 'error'); } finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-gray-800 dark:text-white">Configurações Gerais</h2>
                <Button onClick={handleSave} isLoading={isSaving} className="shadow-lg">Salvar Tudo</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* IDENTIDADE VISUAL */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                    <h3 className="text-xl font-bold border-b pb-2">Identidade Visual</h3>
                    <Input label="Nome da Empresa" name="companyName" value={localSettings.companyName} onChange={handleSimpleChange} />
                    <Input label="PIX Padrão" name="pixKey" value={localSettings.pixKey} onChange={handleSimpleChange} />
                    <div>
                        <label className="block text-sm font-medium mb-1">Logo</label>
                        <input type="file" onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) { setLogoFile(f); const r = new FileReader(); r.onload = () => setLogoPreview(r.result as string); r.readAsDataURL(f); }
                        }} className="w-full text-sm bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-300 dark:border-gray-600" />
                        {logoPreview && <img src={logoPreview} className="h-16 mt-2 object-contain border p-1 rounded bg-white" />}
                    </div>
                </div>
                <UserManager appContext={appContext} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    {/* BANCOS */}
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                         <h3 className="text-xl font-bold border-b pb-2">Bancos</h3>
                         <div className="space-y-2 mt-4">
                             {banks.map(b => (
                                 <div key={b.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200">
                                     <span className="font-semibold text-gray-700 dark:text-gray-200">{b.name}</span>
                                     <button onClick={() => deleteBank(b.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><TrashIcon className="w-5 h-5"/></button>
                                 </div>
                             ))}
                             <Button size="sm" variant="secondary" className="w-full mt-2" onClick={() => {
                                 const name = prompt("Nome do Banco:");
                                 if (name) saveBank({name});
                             }}>+ Adicionar Banco</Button>
                         </div>
                    </div>
                    <RecessManager appContext={appContext} />
                </div>

                {/* RECURSOS E SEGURANÇA */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
                    <h3 className="text-xl font-bold border-b pb-2">Recursos e Fidelidade</h3>
                    <div className="space-y-4">
                        <ToggleSwitch label="VIP Ativo" enabled={localSettings.features.vipPlanEnabled} onChange={v => setLocalSettings((p:any)=>({...p, features: {...p.features, vipPlanEnabled: v}}))} />
                        <ToggleSwitch label="Loja Ativa" enabled={localSettings.features.storeEnabled} onChange={v => setLocalSettings((p:any)=>({...p, features: {...p.features, storeEnabled: v}}))} />
                        <ToggleSwitch label="Modo Manutenção" enabled={localSettings.features.maintenanceModeEnabled} onChange={v => setLocalSettings((p:any)=>({...p, features: {...p.features, maintenanceModeEnabled: v}}))} />
                    </div>
                    <div className="pt-6 border-t dark:border-gray-700">
                        <h4 className="font-bold text-sm mb-3 uppercase text-gray-400">Segurança</h4>
                        <div className="flex gap-2">
                            <Input label="" type="password" placeholder="Nova senha" value={newPass} onChange={e => setNewPass(e.target.value)} containerClassName="flex-1 mb-0" />
                            <Button size="sm" onClick={() => { changePassword(newPass).then(() => { setNewPass(''); showNotification('Senha alterada!', 'success'); }); }}>Alterar</Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABELA DE PREÇOS - SEU MODELO CORRETO */}
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h3 className="text-xl font-black border-b pb-2 text-primary-600 uppercase tracking-tight">Tabela de Preços</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
                    <Input label="Valor/KM" name="perKm" type="number" step="0.1" value={localSettings.pricing.perKm} onChange={e => handleSimpleChange(e, 'pricing')} />
                    <Input label="Taxa Poço" name="wellWaterFee" type="number" value={localSettings.pricing.wellWaterFee} onChange={e => handleSimpleChange(e, 'pricing')} />
                    <Input label="Taxa Produtos" name="productsFee" type="number" value={localSettings.pricing.productsFee} onChange={e => handleSimpleChange(e, 'pricing')} />
                    <Input label="Taxa Festa" name="partyPoolFee" type="number" value={localSettings.pricing.partyPoolFee} onChange={e => handleSimpleChange(e, 'pricing')} />
                </div>
                
                <h4 className="font-black mb-4 text-xs uppercase text-gray-400 tracking-widest border-b dark:border-gray-700 pb-1">Faixas de Volume e Preço Base</h4>
                <div className="space-y-2">
                    {localSettings.pricing.volumeTiers.map((tier, i) => (
                        <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                            <Input label="" type="number" value={tier.min} onChange={e => {
                                const t = [...localSettings.pricing.volumeTiers]; t[i].min = +e.target.value;
                                setLocalSettings((p:any)=>({...p, pricing: {...p.pricing, volumeTiers: t}}));
                            }} containerClassName="mb-0 w-28" className="font-bold text-center" />
                            <span className="text-gray-400">-</span>
                            <Input label="" type="number" value={tier.max} onChange={e => {
                                const t = [...localSettings.pricing.volumeTiers]; t[i].max = +e.target.value;
                                setLocalSettings((p:any)=>({...p, pricing: {...p.pricing, volumeTiers: t}}));
                            }} containerClassName="mb-0 w-28" className="font-bold text-center" />
                            <span className="font-bold text-gray-500 text-sm flex-shrink-0">L: R$</span>
                            <Input label="" type="number" value={tier.price} onChange={e => {
                                const t = [...localSettings.pricing.volumeTiers]; t[i].price = +e.target.value;
                                setLocalSettings((p:any)=>({...p, pricing: {...p.pricing, volumeTiers: t}}));
                            }} containerClassName="mb-0 w-28" className="font-black text-primary-600 text-center" />
                            <button onClick={() => {
                                const t = localSettings.pricing.volumeTiers.filter((_, idx) => idx !== i);
                                setLocalSettings((p:any)=>({...p, pricing: {...p.pricing, volumeTiers: t}}));
                            }} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    ))}
                    <Button size="sm" variant="secondary" className="mt-4" onClick={() => {
                        const t = [...localSettings.pricing.volumeTiers, {min: 0, max: 0, price: 0}];
                        setLocalSettings((p:any)=>({...p, pricing: {...p.pricing, volumeTiers: t}}));
                    }}>+ Adicionar Faixa de Preço</Button>
                </div>
            </div>

            {isPriceModalOpen && (
                <Modal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} title="Vigência dos Preços">
                    <p className="text-sm text-gray-500 mb-4">Escolha a data para os novos preços entrarem em vigor para os clientes ativos.</p>
                    <Input label="Data de Início" type="date" value={customEffectiveDate} onChange={e => setCustomEffectiveDate(e.target.value)} />
                    <div className="flex justify-end mt-4"><Button onClick={handleConfirmPrice}>Agendar Mudança</Button></div>
                </Modal>
            )}
        </div>
    );
};

export default SettingsView;

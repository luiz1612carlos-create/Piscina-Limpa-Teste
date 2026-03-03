import React, { useState, useEffect } from 'react';
import { AppContextType, Settings } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { db } from '../../firebase';
import { 
    SparklesIcon, 
    CopyIcon, 
    CalendarDaysIcon, 
    ChartBarIcon, 
    InformationCircleIcon,
    SettingsIcon,
    CheckCircleIcon,
    CurrencyDollarIcon
} from '../../constants';
import { Spinner } from '../../components/Spinner';

interface AIBotManagerViewProps {
    appContext: AppContextType;
}

const AIBotManagerView: React.FC<AIBotManagerViewProps> = ({ appContext }) => {
    const { settings, updateSettings, showNotification, clients } = appContext;
    const [isSaving, setIsSaving] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isTestingBilling, setIsTestingBilling] = useState(false);
    const [isTestingStatus, setIsTestingStatus] = useState(false);
    const [testPhoneNumber, setTestPhoneNumber] = useState('');
    const [activeTab, setActiveTab] = useState<'auto' | 'billing' | 'receipt' | 'status' | 'logs' | 'meta'>('auto');
    const [billingImageFile, setBillingImageFile] = useState<File | null>(null);
    const [billingImagePreview, setBillingImagePreview] = useState<string | null>(null);
    const [receiptImageFile, setReceiptImageFile] = useState<File | null>(null);
    const [receiptImagePreview, setReceiptImagePreview] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    
    const [localBotSettings, setLocalBotSettings] = useState<Settings['aiBot']>({
        enabled: false,
        name: 'Luiz',
        systemInstructions: '',
        siteUrl: '',
        humanHandoffMessage: 'Estamos direcionando seu atendimento para nossa Equipe, aguarde um momento!'
    });

    const [localBillingBot, setLocalBillingBot] = useState<NonNullable<Settings['billingBot']>>({
        enabled: false,
        dryRun: true,
        daysBeforeDue: 3,
        messageTemplate: ''
    });

    const [localReceiptBot, setLocalReceiptBot] = useState<NonNullable<Settings['receiptBot']>>({
        enabled: false,
        templateName: '',
        templateLanguage: 'pt_BR'
    });

    const [localStatusBot, setLocalStatusBot] = useState<NonNullable<Settings['poolStatusBot']>>({
        enabled: false,
        restrictedTemplate: '',
        restrictedImage: '',
        releasedTemplate: '',
        releasedImage: '',
        templateLanguage: 'pt_BR'
    });

    const [localMeta, setLocalMeta] = useState({
        whatsappTemplateName: settings?.whatsappTemplateName || '',
        whatsappTemplateLanguage: settings?.whatsappTemplateLanguage || 'pt_BR'
    });

    // Estados para o Painel de Logs Detalhado
    const [executionLogs, setExecutionLogs] = useState<any[]>([]);
    const [selectedExecution, setSelectedExecution] = useState<any | null>(null);
    const [messagesForExecution, setMessagesForExecution] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (settings?.aiBot) setLocalBotSettings((prev: any) => ({...prev, ...settings.aiBot}));
        if (settings?.billingBot) {
            setLocalBillingBot((prev: any) => ({...prev, ...settings.billingBot}));
            setBillingImagePreview(settings.billingBot.billingImage || null);
        }
        if (settings?.receiptBot) {
            setLocalReceiptBot((prev: any) => ({...prev, ...settings.receiptBot}));
            setReceiptImagePreview(settings.receiptBot.receiptImage || null);
        }
        if (settings?.poolStatusBot) setLocalStatusBot((prev: any) => ({...prev, ...settings.poolStatusBot}));
        setLocalMeta({
            whatsappTemplateName: settings?.whatsappTemplateName || '',
            whatsappTemplateLanguage: settings?.whatsappTemplateLanguage || 'pt_BR'
        });
    }, [settings]);

    // Listener para carregar os ciclos de execução
    useEffect(() => {
        if (activeTab !== 'logs') return;
        setLoadingLogs(true);
        const unsub = db.collection('billing_execution_logs')
            .orderBy('timestamp', 'desc')
            .limit(15)
            .onSnapshot((snap: any) => {
                setExecutionLogs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
                setLoadingLogs(false);
            });
        return () => unsub();
    }, [activeTab]);

    // Listener para carregar mensagens do ciclo selecionado
    useEffect(() => {
        if (!selectedExecution) {
            setMessagesForExecution([]);
            setLoadingDetails(false);
            return;
        }
        
        setLoadingDetails(true);
        const targetId = selectedExecution.batchId || selectedExecution.id;
        
        const unsub = db.collection('billing_messages')
            .where('batchId', '==', targetId)
            .limit(300)
            .onSnapshot((snap: any) => {
                const data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                setMessagesForExecution(data);
                setLoadingDetails(false);
            }, (error: any) => {
                console.error("Erro ao carregar detalhes do log:", error);
                setLoadingDetails(false);
            });
            
        return () => unsub();
    }, [selectedExecution]);

    const handleSave = async () => {
        setIsSaving(true);
        setUploadProgress((billingImageFile || receiptImageFile) ? 0 : null);
        try {
            await updateSettings({ 
                aiBot: localBotSettings,
                billingBot: localBillingBot,
                receiptBot: localReceiptBot,
                poolStatusBot: localStatusBot,
                ...localMeta
            }, undefined, false, (progress) => setUploadProgress(progress), billingImageFile || undefined, receiptImageFile || undefined);
            
            setBillingImageFile(null);
            setReceiptImageFile(null);
            showNotification('Configurações salvas com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao salvar.', 'error');
        } finally {
            setIsSaving(false);
            setUploadProgress(null);
        }
    };

    const handleManualExecute = async () => {
        const modeText = localBillingBot.dryRun ? "MODO TESTE (Simulação)" : "MODO REAL (Envia WhatsApp)";
        if (!window.confirm(`Deseja iniciar a execução agora no ${modeText}?`)) return;

        setIsExecuting(true);
        try {
            const res = await fetch('/api/cron-reminders?manual=true');
            const data = await res.json();
            if (data.success) {
                showNotification(`Execução concluída! ${data.summary.sent} mensagens processadas.`, 'success');
                setActiveTab('logs');
            } else throw new Error(data.error);
        } catch (error: any) {
            showNotification(`Erro na execução: ${error.message}`, 'error');
        } finally {
            setIsExecuting(false);
        }
    };

    const handleTestBilling = async () => {
        const phone = testPhoneNumber || clients.find(c => c.phone)?.phone || clients[0]?.phone;
        const name = testPhoneNumber ? 'Teste Manual' : (clients.find(c => c.phone)?.name || clients[0]?.name || 'Cliente Teste');
        
        if (!phone) {
            showNotification('Nenhum número de telefone definido para teste.', 'error');
            return;
        }
        setIsTestingBilling(true);
        try {
            const res = await fetch(`/api/cron-reminders?manual=true&testPhone=${phone}`);
            const data = await res.json();
            if (data.success) {
                showNotification(`Lembrete de teste enviado para ${name}!`, 'success');
            } else throw new Error(data.error);
        } catch (error: any) {
            showNotification(`Erro no teste: ${error.message}`, 'error');
        } finally {
            setIsTestingBilling(false);
        }
    };

    const handleTestStatus = async (type: 'restricted' | 'released') => {
        const phone = testPhoneNumber || clients.find(c => c.phone)?.phone || clients[0]?.phone;
        const name = testPhoneNumber ? 'Teste Manual' : (clients.find(c => c.phone)?.name || clients[0]?.name || 'Cliente Teste');

        if (!phone) {
            showNotification('Nenhum número de telefone definido para teste.', 'error');
            return;
        }
        setIsTestingStatus(true);
        try {
            await fetch('/api/send-pool-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientPhone: phone,
                    clientName: `[TESTE] ${name}`,
                    newStatus: type === 'restricted' ? 'Em tratamento' : 'Livre para uso',
                    companyName: settings?.companyName || 'S.O.S Piscina Limpa'
                })
            });
            showNotification('Teste enviado!', 'success');
        } catch (e) {
            showNotification('Erro no teste.', 'error');
        } finally {
            setIsTestingStatus(false);
        }
    };

    const handleBillingImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBillingImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setBillingImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleReceiptImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setReceiptImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setReceiptImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-6 pb-24 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-blue-600 flex items-center gap-3">
                        <SparklesIcon className="w-10 h-10" />
                        Robôs de Automação
                    </h2>
                    <p className="text-gray-500 font-medium">Controle toda a inteligência do sistema.</p>
                </div>
                <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl shadow-inner overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('auto')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'auto' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Luiz (IA)</button>
                    <button onClick={() => setActiveTab('billing')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'billing' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Cobrança</button>
                    <button onClick={() => setActiveTab('receipt')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'receipt' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Recibo</button>
                    <button onClick={() => setActiveTab('status')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'status' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Segurança</button>
                    <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'logs' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Logs</button>
                    <button onClick={() => setActiveTab('meta')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'meta' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>API Meta</button>
                </div>
            </header>

            <div className="animate-fade-in">
                {activeTab === 'logs' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
                        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
                            <CardHeader className="bg-gray-50 dark:bg-gray-900/50">
                                <h3 className="font-black text-gray-800 dark:text-white uppercase text-xs flex items-center gap-2">
                                    <ChartBarIcon className="w-4 h-4 text-primary-500" />
                                    Ciclos de Execução
                                </h3>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto no-scrollbar p-0">
                                {loadingLogs ? <div className="p-10 flex justify-center"><Spinner /></div> : (
                                    <div className="divide-y dark:divide-gray-700">
                                        {executionLogs.map(log => (
                                            <button 
                                                key={log.id} 
                                                onClick={() => setSelectedExecution(log)} 
                                                className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all ${selectedExecution?.id === log.id ? 'bg-primary-50 dark:bg-primary-900/20 shadow-inner' : ''}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <div>
                                                        <span className="text-xs font-black text-gray-700 dark:text-gray-200 block">
                                                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString('pt-BR') : 'Hoje'}
                                                        </span>
                                                        <span className="text-[10px] text-primary-600 font-bold uppercase">🕒 {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
                                                    </div>
                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${log.mode === 'live' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{log.mode === 'live' ? 'REAL' : 'TESTE'}</span>
                                                </div>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[9px] text-gray-400">Total: {log.processed || 0}</span>
                                                    <span className="text-[9px] text-green-500">Env: {log.sent || 0}</span>
                                                    <span className="text-[9px] text-red-500">Fal: {log.failed || 0}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
                            {selectedExecution ? (
                                <CardContent className="flex-1 overflow-y-auto p-0 no-scrollbar">
                                    {loadingDetails ? (
                                        <div className="p-20 flex flex-col items-center justify-center gap-3">
                                            <Spinner />
                                            <p className="text-xs text-gray-400 font-bold uppercase animate-pulse">Buscando destinatários...</p>
                                        </div>
                                    ) : (
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                                                <tr className="text-left text-[10px] font-black uppercase text-gray-400 border-b dark:border-gray-700">
                                                    <th className="p-4">Cliente</th>
                                                    <th className="p-4">Valor Calc.</th>
                                                    <th className="p-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-gray-700">
                                                {messagesForExecution.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={3} className="p-10 text-center text-gray-400 italic">Nenhum registro encontrado para este ciclo.</td>
                                                    </tr>
                                                ) : messagesForExecution.map(msg => (
                                                    <tr key={msg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                                        <td className="p-4"><p className="font-bold text-gray-800 dark:text-gray-200">{msg.customerName}</p></td>
                                                        <td className="p-4 font-mono text-xs">R$ {(msg.calculatedValue || 0).toFixed(2)}</td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${msg.status === 'sent' || msg.status === 'skipped_simulation' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {msg.status === 'skipped_simulation' ? 'TESTE OK' : msg.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10 text-center">
                                    <InformationCircleIcon className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="font-black uppercase text-xs tracking-widest">Painel de Detalhes</p>
                                    <p className="text-sm">Selecione um ciclo de execução à esquerda para ver os detalhes do envio.</p>
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {activeTab === 'auto' && (
                    <Card className="border-l-8 border-blue-600 shadow-xl overflow-hidden">
                        <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
                            <h3 className="font-black text-blue-700 uppercase flex items-center gap-2">
                                <SettingsIcon className="w-6 h-6" />
                                Configuração do Robô Luiz (Gemini 3)
                            </h3>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <ToggleSwitch label="Ativar robô de atendimento Luiz?" enabled={localBotSettings?.enabled || false} onChange={v => setLocalBotSettings((p: any) => ({...p!, enabled: v}))} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Nome do Robô" value={localBotSettings?.name || ''} onChange={e => setLocalBotSettings((p: any) => ({...p!, name: e.target.value}))} />
                                <Input label="Link do Painel do Cliente" value={localBotSettings?.siteUrl || ''} onChange={e => setLocalBotSettings((p: any) => ({...p!, siteUrl: e.target.value}))} />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-1 tracking-tight">Instruções de Personalidade (System Prompt)</label>
                                <textarea className="w-full p-4 bg-gray-50 dark:bg-gray-900 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[300px] font-mono" value={localBotSettings?.systemInstructions} onChange={e => setLocalBotSettings((p: any) => ({...p!, systemInstructions: e.target.value}))} />
                            </div>
                            <Input label="Mensagem ao Chamar Humano" value={localBotSettings?.humanHandoffMessage || ''} onChange={e => setLocalBotSettings((p: any) => ({...p!, humanHandoffMessage: e.target.value}))} />
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'billing' && (
                    <Card className="border-l-8 border-green-600">
                        <CardHeader className="bg-green-50 dark:bg-green-950/20">
                            <h3 className="font-black text-green-700 uppercase flex items-center gap-2">
                                <CurrencyDollarIcon className="w-6 h-6" /> Cobrança Automática
                            </h3>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ToggleSwitch label="Ativar cobrança automática?" enabled={localBillingBot.enabled} onChange={v => setLocalBillingBot((p: any) => ({...p, enabled: v}))} />
                                <ToggleSwitch label="Modo Simulação (Teste)?" enabled={localBillingBot.dryRun} onChange={v => setLocalBillingBot((p: any) => ({...p, dryRun: v}))} />
                            </div>
                            <Input label="Dias antes do vencimento" type="number" value={localBillingBot.daysBeforeDue} onChange={e => setLocalBillingBot((p: any) => ({...p, daysBeforeDue: parseInt(e.target.value) || 0}))} />
                            
                            <div>
                                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-1 tracking-tight">Imagem do Template (Opcional)</label>
                                {billingImagePreview && (
                                    <div className="mb-2 h-32 w-full border rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                                        <img src={billingImagePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                                    </div>
                                )}
                                <Input type="file" accept="image/*" onChange={handleBillingImageChange} />
                                <p className="text-[10px] text-gray-400 mt-1 italic">Esta imagem será usada no cabeçalho do seu template de cobrança na Meta.</p>
                            </div>

                            <textarea className="w-full p-4 bg-gray-50 dark:bg-gray-900 border rounded-xl text-sm min-h-[150px]" value={localBillingBot.messageTemplate} onChange={e => setLocalBillingBot((p: any) => ({...p, messageTemplate: e.target.value}))} placeholder="Olá {CLIENTE}, sua mensalidade de R$ {VALOR} vence em {VENCIMENTO}..." />
                            
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 space-y-4">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-blue-700 font-black uppercase">Área de Testes</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                    <Input 
                                        label="Telefone para Teste" 
                                        placeholder="Ex: 5511999999999" 
                                        value={testPhoneNumber} 
                                        onChange={e => setTestPhoneNumber(e.target.value)} 
                                    />
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" className="flex-1" onClick={handleTestBilling} isLoading={isTestingBilling}>Testar Modelo</Button>
                                        <Button size="sm" className="flex-1" onClick={handleManualExecute} isLoading={isExecuting}>Executar Agora</Button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-blue-400 italic">Se o campo de telefone estiver vazio, o robô usará um cliente aleatório da base para o teste.</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'receipt' && (
                    <Card className="border-l-8 border-purple-600">
                        <CardHeader><h3 className="font-black text-purple-700 uppercase">Recibo Automático</h3></CardHeader>
                        <CardContent className="space-y-6">
                            <ToggleSwitch label="Enviar recibo após marcar como pago?" enabled={localReceiptBot.enabled} onChange={v => setLocalReceiptBot((p: any) => ({...p, enabled: v}))} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Nome do Template" value={localReceiptBot.templateName} onChange={e => setLocalReceiptBot((p: any) => ({...p, templateName: e.target.value}))} />
                                <Input label="Idioma" value={localReceiptBot.templateLanguage} onChange={e => setLocalReceiptBot((p: any) => ({...p, templateLanguage: e.target.value}))} />
                            </div>

                            <div>
                                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-1 tracking-tight">Imagem do Recibo (Opcional)</label>
                                {receiptImagePreview && (
                                    <div className="mb-2 h-32 w-full border rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                                        <img src={receiptImagePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                                    </div>
                                )}
                                <Input type="file" accept="image/*" onChange={handleReceiptImageChange} />
                                <p className="text-[10px] text-gray-400 mt-1 italic">Esta imagem será usada no cabeçalho do seu template de recibo na Meta.</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'status' && (
                    <Card className="border-l-8 border-yellow-600">
                        <CardHeader className="bg-yellow-50 dark:bg-yellow-900/10 flex justify-between items-center">
                            <h3 className="font-black text-yellow-700 uppercase">Avisos de Segurança</h3>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <ToggleSwitch label="Enviar aviso quando mudar status da piscina?" enabled={localStatusBot.enabled} onChange={v => setLocalStatusBot((p: any) => ({...p, enabled: v}))} />
                            
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <Input 
                                    label="Telefone para Teste de Segurança" 
                                    placeholder="Ex: 5511999999999" 
                                    value={testPhoneNumber} 
                                    onChange={e => setTestPhoneNumber(e.target.value)} 
                                />
                                <p className="text-[10px] text-blue-400 mt-2 italic">Deixe vazio para usar um cliente aleatório.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t dark:border-gray-700">
                                <div className="space-y-4 p-4 bg-red-50/30 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-black text-red-700 text-xs uppercase tracking-widest">Status: INTERDITADA</h4>
                                        <Button size="sm" variant="danger" onClick={() => handleTestStatus('restricted')} isLoading={isTestingStatus}>Testar Envio</Button>
                                    </div>
                                    <Input label="Nome do Template na Meta" value={localStatusBot.restrictedTemplate} onChange={e => setLocalStatusBot((p: any) => ({...p, restrictedTemplate: e.target.value}))} />
                                    <Input label="URL da Imagem (Opcional)" value={localStatusBot.restrictedImage || ''} onChange={e => setLocalStatusBot((p: any) => ({...p, restrictedImage: e.target.value}))} />
                                </div>
                                <div className="space-y-4 p-4 bg-green-50/30 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-black text-green-700 text-xs uppercase tracking-widest">Status: LIBERADA</h4>
                                        <Button size="sm" className="bg-green-600" onClick={() => handleTestStatus('released')} isLoading={isTestingStatus}>Testar Envio</Button>
                                    </div>
                                    <Input label="Nome do Template na Meta" value={localStatusBot.releasedTemplate} onChange={e => setLocalStatusBot((p: any) => ({...p, releasedTemplate: e.target.value}))} />
                                    <Input label="URL da Imagem (Opcional)" value={localStatusBot.releasedImage || ''} onChange={e => setLocalStatusBot((p: any) => ({...p, releasedImage: e.target.value}))} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'meta' && (
                    <Card className="border-l-8 border-gray-800">
                        <CardHeader><h3 className="font-black uppercase">Dados Técnicos Meta API</h3></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Template Principal" value={localMeta.whatsappTemplateName} onChange={e => setLocalMeta((p: any) => ({...p, whatsappTemplateName: e.target.value}))} />
                                <Input label="Idioma" value={localMeta.whatsappTemplateLanguage} onChange={e => setLocalMeta((p: any) => ({...p, whatsappTemplateLanguage: e.target.value}))} />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex flex-col md:flex-row justify-between items-center z-20 shadow-2xl gap-4">
                {uploadProgress !== null && (
                    <div className="w-full md:max-w-xs">
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <p className="text-[10px] text-center mt-1 font-bold text-blue-600 uppercase">Enviando Imagem: {Math.round(uploadProgress)}%</p>
                    </div>
                )}
                <div className="flex-1"></div>
                <Button onClick={handleSave} isLoading={isSaving} size="lg" className="px-10 shadow-xl w-full md:w-auto">Salvar Mudanças</Button>
            </div>
        </div>
    );
};

export default AIBotManagerView;
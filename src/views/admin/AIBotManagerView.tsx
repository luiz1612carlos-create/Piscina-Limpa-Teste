
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
    CheckCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon
} from '../../constants';
import { Spinner } from '../../components/Spinner';

interface AIBotManagerViewProps {
    appContext: AppContextType;
}

const FieldGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-4 border-t dark:border-gray-700 pt-4 mt-4">
        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">{title}</h4>
        <div className="space-y-4">{children}</div>
    </div>
);

const AIBotManagerView: React.FC<AIBotManagerViewProps> = ({ appContext }) => {
    const { settings, updateSettings, showNotification } = appContext;
    const [isSaving, setIsSaving] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [activeTab, setActiveTab] = useState<'auto' | 'billing' | 'receipt' | 'logs' | 'meta'>('auto');
    
    const [localBotSettings, setLocalBotSettings] = useState<Settings['aiBot']>({
        enabled: false,
        name: 'SOS Assistente',
        siteUrl: '',
        welcomeRegistered: '',
        menuRegistered: '',
        welcomeUnregistered: '',
        menuUnregistered: '',
        accessPanelMessage: '',
        schedulePartyMessage: '',
        planInfoMessage: '',
        quoteInstructionsMessage: '',
        plansOverviewMessage: '',
        humanHandoffMessage: '',
        invoiceMessage: ''
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

    const [localMeta, setLocalMeta] = useState({
        whatsappTemplateName: settings?.whatsappTemplateName || '',
        whatsappTemplateLanguage: settings?.whatsappTemplateLanguage || 'pt_BR'
    });

    const [executionLogs, setExecutionLogs] = useState<any[]>([]);
    const [selectedExecution, setSelectedExecution] = useState<any | null>(null);
    const [messagesForExecution, setMessagesForExecution] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        if (settings?.aiBot) setLocalBotSettings(prev => ({...prev, ...settings.aiBot}));
        if (settings?.billingBot) setLocalBillingBot(prev => ({...prev, ...settings.billingBot}));
        if (settings?.receiptBot) setLocalReceiptBot(prev => ({...prev, ...settings.receiptBot}));
        setLocalMeta({
            whatsappTemplateName: settings?.whatsappTemplateName || '',
            whatsappTemplateLanguage: settings?.whatsappTemplateLanguage || 'pt_BR'
        });
    }, [settings]);

    useEffect(() => {
        if (activeTab !== 'logs') return;
        setLoadingLogs(true);
        const unsub = db.collection('billing_execution_logs')
            .orderBy('timestamp', 'desc')
            .limit(15)
            .onSnapshot(snap => {
                setExecutionLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoadingLogs(false);
            });
        return () => unsub();
    }, [activeTab]);

    useEffect(() => {
        if (!selectedExecution) return;
        const targetId = selectedExecution.batchId || selectedExecution.id;
        const unsub = db.collection('billing_messages')
            .where('batchId', '==', targetId)
            .limit(300)
            .onSnapshot(snap => {
                setMessagesForExecution(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
        return () => unsub();
    }, [selectedExecution]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ 
                aiBot: localBotSettings,
                billingBot: localBillingBot,
                receiptBot: localReceiptBot,
                ...localMeta
            });
            showNotification('Configurações salvas!', 'success');
        } catch (error) {
            showNotification('Erro ao salvar.', 'error');
        } finally {
            setIsSaving(false);
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
            } else {
                throw new Error(data.error || 'Erro desconhecido na API');
            }
        } catch (error: any) {
            console.error("Erro manual execute:", error);
            showNotification(`Erro na execução: ${error.message}`, 'error');
        } finally {
            setIsExecuting(false);
        }
    };

    const suggestedReceiptText = `Olá {{1}}! Confirmamos o recebimento do seu pagamento no valor de R$ {{2}}, realizado em {{3}} via {{4}}. Obrigado pela confiança na {{5}}!`;

    const webhookUrl = `${window.location.origin}/api/whatsapp`;

    return (
        <div className="space-y-6 pb-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-blue-600 flex items-center gap-3">
                        <SparklesIcon className="w-10 h-10" />
                        Gerenciador de Automações
                    </h2>
                    <p className="text-gray-500 font-medium">Controle total dos seus robôs de serviço e cobrança.</p>
                </div>
                <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl shadow-inner overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('auto')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'auto' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Autoatendimento</button>
                    <button onClick={() => setActiveTab('billing')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'billing' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Cobrança</button>
                    <button onClick={() => setActiveTab('receipt')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'receipt' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Recibo</button>
                    <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'logs' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Logs</button>
                    <button onClick={() => setActiveTab('meta')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex-shrink-0 ${activeTab === 'meta' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>API Meta</button>
                </div>
            </header>

            {activeTab === 'logs' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                    <Card className="lg:col-span-1 h-[600px] flex flex-col">
                        <CardHeader className="bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-black text-gray-800 dark:text-white uppercase text-sm flex items-center gap-2">
                                <ChartBarIcon className="w-5 h-5 text-primary-500" />
                                Ciclos de Execução
                            </h3>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto no-scrollbar p-0">
                            {loadingLogs ? <div className="p-10 flex justify-center"><Spinner /></div> : (
                                <div className="divide-y dark:divide-gray-700">
                                    {executionLogs.map(log => (
                                        <button key={log.id} onClick={() => setSelectedExecution(log)} className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all ${selectedExecution?.id === log.id ? 'bg-primary-50 dark:bg-primary-900/20 shadow-inner' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <div>
                                                    <span className="text-xs font-black text-gray-700 dark:text-gray-200 block">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString('pt-BR') : 'Hoje'}</span>
                                                    <span className="text-[10px] text-primary-600 font-bold uppercase">🕒 {log.executionHourBR || '---'}</span>
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
                    <Card className="lg:col-span-2 h-[600px] flex flex-col">
                        {selectedExecution ? (
                            <CardContent className="flex-1 overflow-y-auto p-0">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                                        <tr className="text-left text-[10px] font-black uppercase text-gray-400 border-b">
                                            <th className="p-4">Cliente</th>
                                            <th className="p-4">Valor Calc.</th>
                                            <th className="p-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {messagesForExecution.map(msg => (
                                            <tr key={msg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                                <td className="p-4"><p className="font-bold">{msg.customerName}</p></td>
                                                <td className="p-4 font-mono">R$ {(msg.calculatedValue || 0).toFixed(2)}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${msg.status === 'sent' || msg.status === 'skipped_simulation' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {msg.status === 'skipped_simulation' ? 'TESTE OK' : msg.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        ) : <div className="flex-1 flex items-center justify-center text-gray-400">Selecione uma execução para ver detalhes</div>}
                    </Card>
                </div>
            )}

            {activeTab === 'meta' && (
                <div className="space-y-6 animate-fade-in">
                    <Card className="border-l-8 border-primary-500 shadow-xl">
                        <CardHeader className="bg-primary-50/50 dark:bg-primary-900/10">
                            <h3 className="font-black text-primary-600">DADOS PARA O PAINEL DA META</h3>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border">
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Callback URL (Webhook)</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-white dark:bg-black p-2 rounded border text-xs break-all">{webhookUrl}</code>
                                    <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(webhookUrl); showNotification('Copiado!', 'info'); }}><CopyIcon className="w-4 h-4"/></Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Nome do Modelo (Template Name)" value={localMeta.whatsappTemplateName} onChange={e => setLocalMeta(p => ({...p, whatsappTemplateName: e.target.value}))} placeholder="Ex: cobranca_v1" />
                                <Input label="Código do Idioma" value={localMeta.whatsappTemplateLanguage} onChange={e => setLocalMeta(p => ({...p, whatsappTemplateLanguage: e.target.value}))} placeholder="pt_BR" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'receipt' && (
                <div className="space-y-6 animate-fade-in pb-20">
                    <Card className="border-l-8 border-purple-500 shadow-xl">
                        <CardHeader>
                            <h3 className="font-black text-purple-600 uppercase">Recibo de Pagamento Automático</h3>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <ToggleSwitch 
                                label="Enviar recibo via WhatsApp após confirmar pagamento?" 
                                enabled={localReceiptBot.enabled} 
                                onChange={v => setLocalReceiptBot(p => ({...p, enabled: v}))} 
                            />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-gray-700">
                                <Input 
                                    label="Nome do Template na Meta" 
                                    value={localReceiptBot.templateName} 
                                    onChange={e => setLocalReceiptBot(p => ({...p, templateName: e.target.value}))}
                                    placeholder="Ex: recibo_pagamento_v1"
                                />
                                <Input 
                                    label="Idioma do Template" 
                                    value={localReceiptBot.templateLanguage} 
                                    onChange={e => setLocalReceiptBot(p => ({...p, templateLanguage: e.target.value}))}
                                    placeholder="pt_BR"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                                    <h4 className="font-bold text-purple-800 dark:text-purple-300 text-sm mb-2 flex items-center gap-2">
                                        <InformationCircleIcon className="w-4 h-4" />
                                        Configuração no Painel da Meta
                                    </h4>
                                    <p className="text-xs text-purple-700 dark:text-purple-400 mb-3">
                                        Crie um template do tipo "Marketing" ou "Utilitário" e use exatamente o texto abaixo para garantir compatibilidade:
                                    </p>
                                    <div className="relative group">
                                        <textarea 
                                            readOnly 
                                            value={suggestedReceiptText} 
                                            className="w-full p-3 bg-white dark:bg-black/40 border rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 h-24 outline-none resize-none"
                                        />
                                        <button 
                                            onClick={() => { navigator.clipboard.writeText(suggestedReceiptText); showNotification('Texto copiado!', 'info'); }}
                                            className="absolute top-2 right-2 p-1 bg-purple-100 dark:bg-purple-800 rounded hover:bg-purple-200 transition-colors"
                                        >
                                            <CopyIcon className="w-4 h-4 text-purple-600" />
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border">
                                    <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm mb-2">Mapeamento de Variáveis</h4>
                                    <ul className="text-[11px] space-y-1.5 font-mono text-gray-500">
                                        <li><strong className="text-purple-600">{"{{1}}"}</strong>: Nome do Cliente</li>
                                        <li><strong className="text-purple-600">{"{{2}}"}</strong>: Valor Pago (Ex: 250,00)</li>
                                        <li><strong className="text-purple-600">{"{{3}}"}</strong>: Data do Pagamento</li>
                                        <li><strong className="text-purple-600">{"{{4}}"}</strong>: Forma (PIX, Dinheiro...)</li>
                                        <li><strong className="text-purple-600">{"{{5}}"}</strong>: Nome da sua Empresa</li>
                                    </ul>
                                    <p className="text-[10px] mt-4 text-gray-400 italic">
                                        * O robô preencherá esses campos automaticamente ao disparar.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {(activeTab === 'auto' || activeTab === 'billing' || activeTab === 'receipt' || activeTab === 'meta') && (
                <div className="flex justify-end gap-2">
                    {activeTab === 'billing' && (
                        <Button 
                            variant="secondary" 
                            className="border-blue-500 text-blue-600"
                            onClick={handleManualExecute}
                            isLoading={isExecuting}
                        >
                            <SparklesIcon className="w-4 h-4 mr-2" />
                            {localBillingBot.dryRun ? "Simular Execução (Teste)" : "Executar Manualmente"}
                        </Button>
                    )}
                    <Button onClick={handleSave} isLoading={isSaving}>Salvar Configurações</Button>
                </div>
            )}

            {activeTab === 'auto' && (
                <div className="space-y-8 animate-fade-in pb-20">
                    <Card className="border-l-8 border-gray-500 shadow-xl">
                        <CardHeader className="bg-gray-50 dark:bg-gray-900/10">
                            <h3 className="font-black text-gray-600 uppercase">Configurações Gerais do Robô</h3>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ToggleSwitch label="Ativar Robô de Atendimento?" enabled={localBotSettings?.enabled || false} onChange={v => setLocalBotSettings(prev => ({...prev!, enabled: v}))} />
                            <Input label="Nome de Exibição do Robô" value={localBotSettings?.name || ''} onChange={e => setLocalBotSettings(prev => ({...prev!, name: e.target.value}))} placeholder="Ex: SOS Assistente" />
                            <Input label="URL do Sistema (para links)" value={localBotSettings?.siteUrl || ''} onChange={e => setLocalBotSettings(prev => ({...prev!, siteUrl: e.target.value}))} placeholder="https://seu-sistema.vercel.app" />
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="border-l-8 border-green-500 shadow-xl">
                            <CardHeader className="bg-green-50/50 dark:bg-green-900/10">
                                <h3 className="font-black text-green-600 uppercase">Clientes Cadastrados</h3>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FieldGroup title="Boas-Vindas & Menu">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Mensagem de Boas-Vindas</label>
                                        <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={localBotSettings?.welcomeRegistered} onChange={e => setLocalBotSettings(prev => ({...prev!, welcomeRegistered: e.target.value}))} placeholder="Olá {cliente}..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Texto do Menu Principal</label>
                                        <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={5} value={localBotSettings?.menuRegistered} onChange={e => setLocalBotSettings(prev => ({...prev!, menuRegistered: e.target.value}))} placeholder="Escolha uma opção:&#10;1. Painel&#10;2. Agenda..." />
                                    </div>
                                </FieldGroup>

                                <FieldGroup title="Resposta Opção 1: Painel do Cliente">
                                    <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={localBotSettings?.accessPanelMessage} onChange={e => setLocalBotSettings(prev => ({...prev!, accessPanelMessage: e.target.value}))} placeholder="Aqui está o link para seu painel..." />
                                </FieldGroup>

                                <FieldGroup title="Resposta Opção 2: Agenda de Uso">
                                    <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={localBotSettings?.schedulePartyMessage} onChange={e => setLocalBotSettings(prev => ({...prev!, schedulePartyMessage: e.target.value}))} placeholder="Para agendar um evento, clique aqui..." />
                                </FieldGroup>

                                <FieldGroup title="Resposta Opção 3: Informações do Plano">
                                    <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={localBotSettings?.planInfoMessage} onChange={e => setLocalBotSettings(prev => ({...prev!, planInfoMessage: e.target.value}))} placeholder="Seu plano atual inclui..." />
                                </FieldGroup>

                                <FieldGroup title="Resposta Opção 4: Faturas e Pagamento">
                                    <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={localBotSettings?.invoiceMessage} onChange={e => setLocalBotSettings(prev => ({...prev!, invoiceMessage: e.target.value}))} placeholder="Dados de pagamento e faturas..." />
                                </FieldGroup>
                            </CardContent>
                        </Card>

                        <Card className="border-l-8 border-blue-500 shadow-xl">
                            <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10">
                                <h3 className="font-black text-blue-600 uppercase">Novos Contatos (Visitantes)</h3>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FieldGroup title="Boas-Vindas & Menu">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Mensagem de Boas-Vindas</label>
                                        <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={localBotSettings?.welcomeUnregistered} onChange={e => setLocalBotSettings(prev => ({...prev!, welcomeUnregistered: e.target.value}))} placeholder="Olá! Bem-vindo à SOS Piscina..." />
                                    </div>
                                    <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={5} value={localBotSettings?.menuUnregistered} onChange={e => setLocalBotSettings(prev => ({...prev!, menuUnregistered: e.target.value}))} placeholder="Como podemos ajudar?&#10;1. Orçamento&#10;2. Ver Planos..." />
                                </FieldGroup>

                                <FieldGroup title="Resposta Opção 1: Pedir Orçamento">
                                    <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={localBotSettings?.quoteInstructionsMessage} onChange={e => setLocalBotSettings(prev => ({...prev!, quoteInstructionsMessage: e.target.value}))} placeholder="Para calcular seu orçamento, acesse..." />
                                </FieldGroup>

                                <FieldGroup title="Resposta Opção 2: Conhecer Planos">
                                    <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={3} value={localBotSettings?.plansOverviewMessage} onChange={e => setLocalBotSettings(prev => ({...prev!, plansOverviewMessage: e.target.value}))} placeholder="Nossos planos Simples e VIP funcionam assim..." />
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-l-8 border-purple-500 shadow-xl">
                        <CardHeader className="bg-purple-50 dark:bg-purple-900/10">
                            <h3 className="font-black text-purple-600 uppercase">Atendimento Humano (Opção 5 - Todos)</h3>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup title="Resposta Opção 5: Transbordo para Humano">
                                <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" rows={4} value={localBotSettings?.humanHandoffMessage} onChange={e => setLocalBotSettings(prev => ({...prev!, humanHandoffMessage: e.target.value}))} placeholder="Aguarde um momento, um de nossos especialistas já vai te atender..." />
                            </FieldGroup>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'billing' && (
                <div className="space-y-6 animate-fade-in">
                    <Card className="border-l-8 border-green-500 shadow-xl">
                        <CardHeader><h3 className="font-black text-green-600 uppercase">Configuração de Cobrança Automática</h3></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ToggleSwitch label="Ativar Cobrança Automática?" enabled={localBillingBot.enabled} onChange={v => setLocalBillingBot(p => ({...p, enabled: v}))} />
                                <ToggleSwitch label="Modo Simulação (NÃO envia mensagens reais)?" enabled={localBillingBot.dryRun} onChange={v => setLocalBillingBot(p => ({...p, dryRun: v}))} />
                            </div>
                            <Input label="Dias antes do vencimento" type="number" value={localBillingBot.daysBeforeDue} onChange={e => setLocalBillingBot(p => ({...p, daysBeforeDue: parseInt(e.target.value) || 0}))} />
                            <textarea className="w-full p-4 bg-gray-50 dark:bg-gray-900 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500" rows={6} value={localBillingBot.messageTemplate} onChange={e => setLocalBillingBot(p => ({...p, messageTemplate: e.target.value}))} placeholder="Olá {CLIENTE}..." />
                        </CardContent>
                    </Card>

                    <Card className="border-l-8 border-blue-500 bg-blue-50/50 dark:bg-blue-900/10">
                        <CardHeader>
                            <h3 className="font-black text-blue-600 uppercase flex items-center gap-2">
                                <InformationCircleIcon className="w-5 h-5" />
                                Testes e Execução Manual
                            </h3>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                No <strong>Modo Simulação</strong>, o sistema apenas verificará quem deve ser cobrado e salvará o resultado na aba de logs para você conferir.
                            </p>
                            <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-blue-100">
                                <div className={`p-3 rounded-full ${localBillingBot.dryRun ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                    {localBillingBot.dryRun ? <InformationCircleIcon className="w-6 h-6" /> : <ExclamationTriangleIcon className="w-6 h-6" />}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm">Modo Atual: {localBillingBot.dryRun ? "TESTE (Simulação)" : "PRODUÇÃO (Real)"}</p>
                                    <p className="text-xs text-gray-500">
                                        {localBillingBot.dryRun 
                                            ? "Ao clicar abaixo, mensagens NÃO serão enviadas aos clientes." 
                                            : "Atenção: Mensagens reais de cobrança SERÃO enviadas agora."}
                                    </p>
                                </div>
                                <Button 
                                    onClick={handleManualExecute} 
                                    isLoading={isExecuting}
                                    variant={localBillingBot.dryRun ? "primary" : "danger"}
                                >
                                    {localBillingBot.dryRun ? "Executar Teste" : "Executar Agora"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AIBotManagerView;


import React, { useState, useEffect, useMemo } from 'react';
import { AppContextType, Client, RobotPreview } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { SparklesIcon, CalendarDaysIcon, MegaphoneIcon, CheckBadgeIcon, ExclamationTriangleIcon } from '../../constants';
import { Spinner } from '../../components/Spinner';

interface AIBotManagerViewProps {
    appContext: AppContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const AIBotManagerView: React.FC<AIBotManagerViewProps> = ({ appContext }) => {
    const { settings, updateSettings, showNotification, clients, robotPreviews, loading } = appContext;
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'monitor' | 'config'>('monitor');

    const [botConfig, setBotConfig] = useState({
        enabled: true,
        robotMode: 'dry-run' as 'dry-run' | 'live',
        robotTestDate: null as string | null,
        maxClientsPerRun: 1,
        billingReminder: "Olá {CLIENTE}! 🏊‍♂️ Passando para lembrar do vencimento da sua manutenção no dia {VENCIMENTO}. Valor: R$ {VALOR}. Realizar o PIX para {DESTINATARIO}. Atenciosamente, {EMPRESA}.",
        overdueNotice: "Olá {CLIENTE}! Identificamos um atraso no pagamento de {VENCIMENTO}. Favor realizar o PIX para {DESTINATARIO}. Chave: {PIX}",
    });

    const [billingInfo, setBillingInfo] = useState({
        billingCompanyName: ''
    });

    useEffect(() => {
        if (settings) {
            if (settings.aiBot) {
                setBotConfig(prev => ({ 
                    ...prev, 
                    ...settings.aiBot,
                    robotMode: settings.aiBot.robotMode || 'dry-run',
                    maxClientsPerRun: settings.aiBot.maxClientsPerRun || 1
                }));
            }
            setBillingInfo({
                billingCompanyName: settings.billingCompanyName || ''
            });
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ 
                aiBot: botConfig,
                billingCompanyName: billingInfo.billingCompanyName
            });
            showNotification('Configuração do Robô salva com sucesso!', 'success');
        } catch (e) {
            showNotification('Erro ao salvar configurações.', 'error');
        } finally { setIsSaving(false); }
    };

    const currentCycle = useMemo(() => {
        const d = botConfig.robotTestDate ? new Date(botConfig.robotTestDate + 'T12:00:00') : new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}`;
    }, [botConfig.robotTestDate]);

    const VariableBadge = ({ name, description }: { name: string, description?: string }) => (
        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-primary-100 text-primary-700 border border-primary-200 cursor-help" title={description}>
            {`{${name}}`}
        </span>
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-primary-600 flex items-center gap-2">
                        <SparklesIcon className="w-8 h-8" />
                        Robô de Cobrança
                    </h2>
                    <p className="text-sm text-gray-500 italic">
                        {botConfig.robotMode === 'live' ? '🟢 MODO LIVE: Envios reais habilitados.' : '🟡 MODO DRY-RUN: Apenas simulação.'}
                    </p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('monitor')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'monitor' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>MONITOR</button>
                    <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'config' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>CONFIGURAÇÃO</button>
                </div>
            </header>

            {activeTab === 'monitor' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-primary-600 text-white">
                            <CardContent className="p-6 text-center">
                                <CheckBadgeIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-xs font-bold uppercase opacity-80">Ciclo de Simulação</p>
                                <p className="text-2xl font-black">{currentCycle}</p>
                            </CardContent>
                        </Card>
                        <Card className={`${botConfig.robotMode === 'live' ? 'bg-green-600' : 'bg-amber-500'} text-white`}>
                            <CardContent className="p-6 text-center">
                                <MegaphoneIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-xs font-bold uppercase opacity-80">Modo Atual</p>
                                <p className="text-2xl font-black uppercase tracking-tighter">{botConfig.robotMode}</p>
                            </CardContent>
                        </Card>
                         <Card className="bg-slate-700 text-white">
                            <CardContent className="p-6 text-center">
                                <ExclamationTriangleIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-xs font-bold uppercase opacity-80">Limite por Execução</p>
                                <p className="text-2xl font-black">{botConfig.robotMode === 'dry-run' ? 'Sempre 1' : botConfig.maxClientsPerRun}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="font-bold flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CalendarDaysIcon className="w-5 h-5 text-primary-500" />
                                Logs de Execução e Previews (Últimas 20)
                            </div>
                            {loading.robotPreviews && <Spinner size="sm" />}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {robotPreviews.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
                                        <p className="italic">Nenhum preview ou log de envio disponível.</p>
                                        <p className="text-xs mt-1">O robô gera logs ao ser disparado via Cron.</p>
                                    </div>
                                ) : (
                                    robotPreviews.map(log => (
                                        <div key={log.id} className={`p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border-l-4 shadow-sm ${log.status === 'Sent' ? 'border-green-500' : log.status === 'Error' ? 'border-red-600 bg-red-50 dark:bg-red-900/10' : 'border-amber-400'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className={`font-black text-sm block ${log.status === 'Error' ? 'text-red-700 dark:text-red-400' : ''}`}>{log.clientName}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono uppercase">WhatsApp: {log.phone}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${log.status === 'Sent' ? 'bg-green-100 text-green-700' : log.status === 'Error' ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-700'}`}>
                                                        {log.status === 'Sent' ? '🟢 ENVIADO' : log.status === 'Error' ? '❌ ERRO' : '🟡 SIMULAÇÃO'}
                                                    </span>
                                                    <p className="text-[9px] text-gray-400 mt-1">
                                                        {toDate(log.generatedAt)?.toLocaleString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white dark:bg-gray-800 border rounded border-gray-200 dark:border-gray-700 text-xs italic text-gray-600 dark:text-gray-300">
                                                "{log.messageFinal}"
                                            </div>
                                            <p className="text-[9px] text-gray-400 mt-2 text-right">Referência de Vencimento: {new Date(log.dueDate).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'config' && (
                <Card>
                    <CardHeader className="font-bold">Inteligência do Robô</CardHeader>
                    <CardContent className="p-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b dark:border-gray-700">
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-primary-500 uppercase tracking-widest">Identidade Global</h4>
                                <Input 
                                    label="Nome da Empresa (Variável {EMPRESA})"
                                    value={billingInfo.billingCompanyName}
                                    onChange={e => setBillingInfo(p => ({...p, billingCompanyName: e.target.value}))}
                                    placeholder={settings?.companyName || "Nome Padrão"}
                                />
                                <p className="text-[10px] text-gray-500 italic">
                                    Dica: Se a variável {`{DESTINATARIO}`} estiver no template e o cliente não tiver um destinatário cadastrado, o robô usará o nome acima automaticamente.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-primary-500 uppercase tracking-widest">Segurança de Envio</h4>
                                <Select 
                                    label="Modo de Operação"
                                    value={botConfig.robotMode}
                                    onChange={e => setBotConfig(p => ({...p, robotMode: e.target.value as any}))}
                                    options={[
                                        { value: 'dry-run', label: '🟡 Dry-Run (Apenas Simulação)' },
                                        { value: 'live', label: '🟢 Live (Envio Real Ativado)' }
                                    ]}
                                />
                                <Input 
                                    label="Máx. Clientes por Execução (Apenas em Live)"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={botConfig.maxClientsPerRun}
                                    onChange={e => setBotConfig(p => ({...p, maxClientsPerRun: parseInt(e.target.value) || 1}))}
                                    disabled={botConfig.robotMode === 'dry-run'}
                                />
                            </div>
                        </div>

                        <div className="pb-8 border-b dark:border-gray-700">
                             <h4 className="text-xs font-black text-primary-500 uppercase tracking-widest mb-4">Ambiente de Teste</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <Input 
                                        label="Forçar Data de Teste (Vazia = Hoje)"
                                        type="date"
                                        value={botConfig.robotTestDate || ''}
                                        onChange={e => setBotConfig(p => ({...p, robotTestDate: e.target.value || null}))}
                                    />
                                    <p className="text-xs text-gray-500 italic mt-1">Simula vencimentos como se hoje fosse esta data.</p>
                                </div>
                                <div className="flex items-center gap-2 pt-2 md:pt-8">
                                    <span className="text-sm font-bold">Robô de Mensagens Habilitado?</span>
                                    <input 
                                        type="checkbox" 
                                        checked={botConfig.enabled} 
                                        onChange={e => setBotConfig(p => ({...p, enabled: e.target.checked}))}
                                        className="w-5 h-5 accent-primary-600"
                                    />
                                </div>
                             </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-xs font-black text-primary-500 uppercase tracking-widest">Modelos de Mensagem</h4>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">Lembrete de Cobrança (Vencimento +2 dias)</label>
                                <textarea 
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-2xl text-sm min-h-[120px] focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                    value={botConfig.billingReminder}
                                    onChange={e => setBotConfig(p => ({...p, billingReminder: e.target.value}))}
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <VariableBadge name="CLIENTE" description="Primeiro nome do cliente" /> 
                                    <VariableBadge name="VALOR" description="Valor da manutenção (no painel)" /> 
                                    <VariableBadge name="VENCIMENTO" description="Data de vencimento formatada" /> 
                                    <VariableBadge name="PIX" description="Chave PIX do cliente ou banco" /> 
                                    <VariableBadge name="EMPRESA" description="Identidade de cobrança global" /> 
                                    <VariableBadge name="DESTINATARIO" description="Nome do beneficiário (ou empresa se vazio)" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">Mensagem de Atraso</label>
                                <textarea 
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-2xl text-sm min-h-[120px] focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                    value={botConfig.overdueNotice}
                                    onChange={e => setBotConfig(p => ({...p, overdueNotice: e.target.value}))}
                                />
                            </div>
                        </div>

                        <div className="pt-6 border-t dark:border-gray-700 flex justify-end">
                            <Button onClick={handleSave} isLoading={isSaving} className="px-10 h-14 rounded-2xl shadow-xl shadow-primary-500/20 font-black uppercase text-xs tracking-widest">
                                Atualizar Inteligência do Robô
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default AIBotManagerView;

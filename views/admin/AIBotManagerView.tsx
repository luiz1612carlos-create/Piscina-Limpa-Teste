
import React, { useState, useEffect, useMemo } from 'react';
import { AppContextType, Client } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { SparklesIcon, CalendarDaysIcon, MegaphoneIcon, CheckBadgeIcon } from '../../constants';
import { calculateClientMonthlyFee } from '../../utils/calculations';

interface AIBotManagerViewProps {
    appContext: AppContextType;
}

const AIBotManagerView: React.FC<AIBotManagerViewProps> = ({ appContext }) => {
    const { settings, updateSettings, showNotification, clients } = appContext;
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'monitor' | 'config'>('monitor');

    const [botConfig, setBotConfig] = useState({
        enabled: true,
        billingReminderTemplate: "Olá {CLIENTE}! 🏊‍♂️ Passando para lembrar do vencimento da sua manutenção no dia {VENCIMENTO}. Valor: R$ {VALOR}. Chave PIX: {PIX}",
        overdueNoticeTemplate: "Olá {CLIENTE}! Identificamos um atraso no pagamento de {VENCIMENTO}. PIX: {PIX}",
    });

    useEffect(() => {
        if (settings?.aiBot) {
            setBotConfig(prev => ({ ...prev, ...settings.aiBot }));
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ aiBot: botConfig });
            showNotification('Configuração do Robô salva!', 'success');
        } catch (e) {
            showNotification('Erro ao salvar.', 'error');
        } finally { setIsSaving(false); }
    };

    const currentCycle = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}`;
    }, []);

    const stats = useMemo(() => {
        const billed = clients.filter(c => c.payment.lastBillingCycle === currentCycle);
        const pending = clients.filter(c => 
            c.clientStatus === 'Ativo' && 
            c.payment.status !== 'Pago' && 
            c.payment.lastBillingCycle !== currentCycle
        );
        return { billed, pending };
    }, [clients, currentCycle]);

    const VariableBadge = ({ name }: { name: string }) => (
        <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-mono font-bold">{`{${name}}`}</span>
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-20">
            <header className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700">
                <div>
                    <h2 className="text-2xl font-black text-primary-600 flex items-center gap-2">
                        <SparklesIcon className="w-8 h-8" />
                        Robô de Cobrança Real
                    </h2>
                    <p className="text-sm text-gray-500 italic">O robô gera mensagens automaticamente para o seu Socket enviar.</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('monitor')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'monitor' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>MONITOR</button>
                    <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'config' ? 'bg-white dark:bg-gray-700 shadow text-primary-600' : 'text-gray-500'}`}>CONFIGURAÇÃO</button>
                </div>
            </header>

            {activeTab === 'monitor' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-primary-600 text-white">
                        <CardContent className="p-6 text-center">
                            <CheckBadgeIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-bold uppercase opacity-80">Processados no Ciclo ({currentCycle})</p>
                            <p className="text-5xl font-black">{stats.billed.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-500 text-white">
                        <CardContent className="p-6 text-center">
                            <CalendarDaysIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-bold uppercase opacity-80">Pendentes para o Robô</p>
                            <p className="text-5xl font-black">{stats.pending.length}</p>
                        </CardContent>
                    </Card>

                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader className="font-bold flex items-center gap-2">
                                <MegaphoneIcon className="w-5 h-5 text-primary-500" />
                                Log de Geração de Mensagens (Ciclo Atual)
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {stats.billed.length === 0 ? (
                                        <p className="text-center py-10 text-gray-400 italic">O robô ainda não realizou disparos automáticos neste ciclo.</p>
                                    ) : (
                                        stats.billed.map(c => (
                                            <div key={c.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border dark:border-gray-800">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-sm">{c.name}</span>
                                                    <span className="text-[10px] font-mono text-green-500 font-bold">GERADA ✓</span>
                                                </div>
                                                <p className="text-xs text-gray-500 bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-700 italic">
                                                    "{c.payment.lastBillingNotificationRomantic}"
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'config' && (
                <Card>
                    <CardContent className="p-6 space-y-6">
                        <div className="flex items-center justify-between border-b dark:border-gray-700 pb-4">
                            <h3 className="font-bold">Motor de Mensagens</h3>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-sm font-bold">Robô Ativo?</span>
                                <input 
                                    type="checkbox" 
                                    checked={botConfig.enabled} 
                                    onChange={e => setBotConfig(p => ({...p, enabled: e.target.checked}))}
                                    className="w-5 h-5 accent-primary-600"
                                />
                            </label>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-2 tracking-widest">Template de Cobrança (Vencimento em 2 dias)</label>
                            <textarea 
                                className="w-full p-4 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-2xl text-sm min-h-[120px] focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                value={botConfig.billingReminderTemplate}
                                onChange={e => setBotConfig(p => ({...p, billingReminderTemplate: e.target.value}))}
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                                <VariableBadge name="CLIENTE" /> <VariableBadge name="VALOR" /> <VariableBadge name="VENCIMENTO" /> <VariableBadge name="PIX" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-2 tracking-widest">Template de Atraso</label>
                            <textarea 
                                className="w-full p-4 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-2xl text-sm min-h-[120px] focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                value={botConfig.overdueNoticeTemplate}
                                onChange={e => setBotConfig(p => ({...p, overdueNoticeTemplate: e.target.value}))}
                            />
                        </div>

                        <div className="pt-6 border-t dark:border-gray-700 flex justify-end">
                            <Button onClick={handleSave} isLoading={isSaving} className="px-10 h-14 rounded-2xl shadow-xl shadow-primary-500/20 font-black uppercase text-xs tracking-widest">
                                Salvar Inteligência do Robô
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default AIBotManagerView;

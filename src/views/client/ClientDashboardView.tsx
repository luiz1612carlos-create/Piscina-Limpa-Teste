import { useState, useEffect, useMemo } from 'react';
import { AuthContextType, AppContextType, Client, ReplenishmentQuote, Order, Settings, CartItem, AdvancePaymentRequest, PoolEvent, RecessPeriod, PendingPriceChange, PlanChangeRequest, FidelityPlan, EmergencyRequest, AffectedClientPreview } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { 
    WeatherSunnyIcon, 
    CopyIcon, 
    CheckIcon, 
    XMarkIcon, 
    CalendarDaysIcon, 
    CurrencyDollarIcon, 
    CheckBadgeIcon, 
    SparklesIcon, 
    ExclamationTriangleIcon,
    DashboardIcon,
    ArchiveBoxIcon,
    UsersIcon,
    RouteIcon
} from '../../constants';
import { calculateClientMonthlyFee } from '../../utils/calculations';

interface ClientDashboardViewProps {
    authContext: AuthContextType;
    appContext: AppContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        return isNaN(d.getTime()) ? null : d;
    }
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

type DashboardTab = 'summary' | 'products' | 'plan' | 'account';

const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ authContext, appContext }) => {
    const { user, changePassword, showNotification } = authContext;
    const { clients, loading, settings, routes, replenishmentQuotes, updateReplenishmentQuoteStatus, createOrder, createAdvancePaymentRequest, isAdvancePlanGloballyAvailable, advancePaymentRequests, banks, poolEvents, createPoolEvent, pendingPriceChanges, planChangeRequests, requestPlanChange, acceptPlanChange, cancelPlanChangeRequest, emergencyRequests, createEmergencyRequest } = appContext;
    
    const [activeTab, setActiveTab] = useState<DashboardTab>('summary');

    const clientData = useMemo(() => {
        return clients.find((c: Client) => c.uid === user.uid) || null;
    }, [clients, user.uid]);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    
    const [isPlanUpgradeModalOpen, setIsPlanUpgradeModalOpen] = useState(false);
    const [isRequestingPlanChange, setIsRequestingPlanChange] = useState(false);
    const [selectedUpgradeOptionId, setSelectedUpgradeOptionId] = useState<string>('');

    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
    const [emergencyReason, setEmergencyReason] = useState('');
    const [isSubmittingEmergency, setIsSubmittingEmergency] = useState(false);

    const currentMonthEmergencies = useMemo(() => {
        if (!user || !emergencyRequests) return 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        return emergencyRequests.filter((req: EmergencyRequest) => {
            const reqDate = toDate(req.createdAt);
            return req.clientId === user.uid && reqDate && reqDate >= startOfMonth;
        }).length;
    }, [emergencyRequests, user]);

    const emergencyLimitReached = currentMonthEmergencies >= 2;

    const upcomingRecesses = useMemo(() => {
        if (!settings?.recessPeriods) return [];
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        return settings.recessPeriods.filter((recess: RecessPeriod) => {
            const startDate = toDate(recess.startDate);
            const endDate = toDate(recess.endDate);
            if (!startDate || !endDate) return false;
            const isActive = now >= startDate && now <= endDate;
            const isUpcoming = startDate <= thirtyDaysFromNow && endDate >= now;
            return isActive || isUpcoming;
        }).sort((a: RecessPeriod, b: RecessPeriod) => (toDate(a.startDate)?.getTime() || 0) - (toDate(b.startDate)?.getTime() || 0));
    }, [settings?.recessPeriods]);

    const activeRecess = useMemo(() => {
        const now = new Date();
        return upcomingRecesses.find((r: RecessPeriod) => {
            const start = toDate(r.startDate);
            const end = toDate(r.endDate);
            return start && end && now >= start && now <= end;
        });
    }, [upcomingRecesses]);

    const isInRecess = !!activeRecess;

    // Lógica aprimorada para verificar se o plano adiantado está ativo e calcular prazos de renovação
    const advancePlanInfo = useMemo(() => {
        if (!clientData?.advancePaymentUntil) return null;
        const today = new Date();
        const advanceUntil = toDate(clientData.advancePaymentUntil);
        
        if (advanceUntil && advanceUntil > today) {
            // A cobertura real vai até um dia antes do próximo vencimento
            const coverageEnd = new Date(advanceUntil);
            coverageEnd.setDate(coverageEnd.getDate() - 1);
            
            const diffTime = advanceUntil.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return {
                active: true,
                renewalDate: advanceUntil,
                coverageEnd: coverageEnd,
                isExpiringSoon: diffDays <= 2, // 2 dias antes: Aviso na conta
                showRenewalButton: diffDays <= 1 // 1 dia antes: Botão na dashboard
            };
        }
        return null;
    }, [clientData]);
    
    const nextVisit = useMemo(() => {
        if (!clientData || !routes) return null;
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayIndex = new Date().getDay();
        const searchSequence = [];
        for (let i = 0; i < 7; i++) {
            searchSequence.push({ index: (todayIndex + i) % 7, offset: i });
        }
        for (const item of searchSequence) {
            const dayName = dayNames[item.index];
            const routeDay = routes[dayName];
            if (routeDay && routeDay.clients && routeDay.clients.some((c: Client) => c.uid === clientData.uid || c.id === clientData.id)) {
                return { day: item.offset === 0 ? 'Hoje' : dayName, isRouteActive: routeDay.isRouteActive };
            }
        }
        return null;
    }, [clientData, routes]);

    const pendingQuote = useMemo(() => {
        if (!clientData || !replenishmentQuotes) return null;
        return replenishmentQuotes.find((q: ReplenishmentQuote) => q.clientId === clientData.id && q.status === 'sent');
    }, [clientData, replenishmentQuotes]);

    const mostRecentRequest = useMemo(() => {
        if (!clientData || !advancePaymentRequests || advancePaymentRequests.length === 0) return null;
        const clientRequests = advancePaymentRequests.filter(r => r.clientId === clientData.uid || r.clientId === clientData.id);
        return clientRequests[0] || null;
    }, [clientData, advancePaymentRequests]);

    const showStatusCard = useMemo(() => {
        if (!mostRecentRequest) return false;
        if (mostRecentRequest.status === 'pending') return true;
        const updatedAt = toDate(mostRecentRequest.updatedAt);
        if (!updatedAt) return mostRecentRequest.status !== 'approved'; // Se aprovado e sem updatedAt ainda, esconde (para evitar loading infinito)
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        return updatedAt > threeDaysAgo;
    }, [mostRecentRequest]);
    
    const priceChangeNotification = useMemo(() => {
        if (!clientData || !pendingPriceChanges || pendingPriceChanges.length === 0) return null;
        const relevantChange = pendingPriceChanges.find((change: PendingPriceChange) => 
            change.status === 'pending' && 
            change.affectedClients.some((affected: AffectedClientPreview) => affected.id === clientData.id)
        );
        return relevantChange;
    }, [clientData, pendingPriceChanges]);

    const currentPlanDetails = useMemo(() => {
        if (!clientData || !settings) return null;
        const basePlan = clientData.plan === 'VIP' ? settings.plans.vip : settings.plans.simple;
        return {
            title: basePlan.title,
            benefits: basePlan.benefits,
            terms: basePlan.terms,
            fidelity: clientData.fidelityPlan,
            planType: clientData.plan
        };
    }, [clientData, settings]);
    
    const activePlanChangeRequest = useMemo(() => {
        if (!clientData || !planChangeRequests) return null;
        return planChangeRequests.find((req: PlanChangeRequest) => 
            req.clientId === clientData.uid && (req.status === 'pending' || req.status === 'quoted')
        );
    }, [planChangeRequests, clientData]);

    const upgradeOptions = useMemo(() => {
        if (!activePlanChangeRequest || !activePlanChangeRequest.proposedPrice || !settings) return [];
        const basePrice = activePlanChangeRequest.proposedPrice;
        const options: any[] = [];
        
        settings.fidelityPlans.forEach((plan: FidelityPlan) => {
            const discount = basePrice * (plan.discountPercent / 100);
            options.push({
                id: plan.id,
                title: `Fidelidade ${plan.months} Meses`,
                price: basePrice - discount,
                originalPrice: basePrice,
                discountPercent: plan.discountPercent,
                savings: discount,
                fidelityPlan: plan
            });
        });
        return options;
    }, [activePlanChangeRequest, settings]);

    useEffect(() => {
        if (isPlanUpgradeModalOpen && upgradeOptions.length > 0 && !selectedUpgradeOptionId) {
            setSelectedUpgradeOptionId(upgradeOptions[0].id);
        }
    }, [isPlanUpgradeModalOpen, upgradeOptions, selectedUpgradeOptionId]);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showNotification('As senhas não coincidem.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showNotification('A senha deve ter no mínimo 6 caracteres.', 'error');
            return;
        }
        setIsSavingPassword(true);
        try {
            await changePassword(newPassword);
            showNotification('Senha alterada com sucesso!', 'success');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao alterar senha.', 'error');
        } finally {
            setIsSavingPassword(false);
        }
    };

    const handleRequestPlanChange = async () => {
        if (!clientData || activePlanChangeRequest) return;
        setIsRequestingPlanChange(true);
        try {
            await requestPlanChange(user.uid, clientData.name, clientData.plan, 'VIP');
            showNotification('Solicitação de upgrade enviada com sucesso!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao solicitar mudança.', 'error');
        } finally {
            setIsRequestingPlanChange(false);
        }
    };

    const handleAcceptPlanChange = async () => {
        if (!activePlanChangeRequest || !activePlanChangeRequest.proposedPrice) return;
        const selectedOption = upgradeOptions.find((opt: any) => opt.id === selectedUpgradeOptionId);
        if (!selectedOption) return;

        setIsRequestingPlanChange(true);
        try {
            await acceptPlanChange(activePlanChangeRequest.id, selectedOption.price, selectedOption.fidelityPlan);
            showNotification('Upgrade aceito! A mudança será aplicada no próximo ciclo.', 'success');
            setIsPlanUpgradeModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || 'Erro ao aceitar mudança.', 'error');
        } finally {
            setIsRequestingPlanChange(false);
        }
    };

    const handleRejectPlanChange = async () => {
        if (!activePlanChangeRequest) return;
        setIsRequestingPlanChange(true);
        try {
            await cancelPlanChangeRequest(activePlanChangeRequest.id);
            showNotification('Solicitação cancelada.', 'info');
            setIsPlanUpgradeModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || 'Erro ao cancelar.', 'error');
        } finally {
            setIsRequestingPlanChange(false);
        }
    };

    const handleEmergencyRequest = async () => {
        if (isInRecess) {
            showNotification("O serviço de emergência está temporariamente suspenso devido ao recesso.", "info");
            return;
        }
        if (!clientData || !emergencyReason.trim()) {
            showNotification("Por favor, descreva o motivo da emergência.", "error");
            return;
        }
        setIsSubmittingEmergency(true);
        try {
            await createEmergencyRequest({
                clientId: user.uid,
                clientName: clientData.name,
                clientPhone: clientData.phone,
                address: `${clientData.address.street}, ${clientData.address.number} - ${clientData.address.neighborhood}, ${clientData.address.city}`,
                reason: emergencyReason,
            });
            showNotification("Chamado de emergência enviado!", "success");
            setIsEmergencyModalOpen(false);
            setEmergencyReason('');
        } catch (error: any) {
            showNotification(error.message || "Erro ao enviar chamado.", "error");
        } finally {
            setIsSubmittingEmergency(false);
        }
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showNotification('Chave PIX copiada!', 'info');
    };

    const isBlockedByDueDate = useMemo(() => {
        if (!clientData) return true;
        if (clientData.payment.status === 'Pago') return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(clientData.payment.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 15;
    }, [clientData]);

    if ((loading.clients || loading.settings) || !settings) {
        return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
    }
    
    if (!clientData) {
        return <div className="text-center p-10 text-gray-500">Dados do cliente não encontrados.</div>;
    }

    const monthlyFee = calculateClientMonthlyFee(clientData, settings);
    const clientBank = banks.find(b => b.id === clientData.bankId);
    const pixKeyToDisplay = clientData.pixKey || clientBank?.pixKey || settings?.pixKey || '';

    const tabs = [
        { id: 'summary', label: 'Início', icon: DashboardIcon },
        { id: 'products', label: 'Produtos', icon: ArchiveBoxIcon },
        { id: 'plan', label: 'Plano', icon: CheckBadgeIcon },
        { id: 'account', label: 'Conta', icon: UsersIcon },
    ];

    return (
        <div className="space-y-6">
            <div className="flex overflow-x-auto bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as DashboardTab)}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all min-w-[100px] flex-1 ${
                            activeTab === tab.id 
                                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' 
                                : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        <tab.icon className="w-5 h-5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'summary' && (
                    <div className="space-y-6 animate-fade-in text-gray-800 dark:text-gray-100">
                        <div className="space-y-4">
                            {/* Transparência: Badge de Plano Adiantado Ativo com datas claras */}
                            {advancePlanInfo?.active && (
                                <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white p-4 rounded-xl shadow-lg border border-yellow-400 flex items-center gap-3 animate-fade-in">
                                    <SparklesIcon className="w-8 h-8 flex-shrink-0" />
                                    <div>
                                        <p className="font-black text-sm uppercase tracking-wider">Plano Adiantado Ativo</p>
                                        <div className="space-y-0.5">
                                            <p className="text-xs opacity-95">Manutenção coberta até: <strong>{advancePlanInfo.coverageEnd.toLocaleDateString('pt-BR')}</strong></p>
                                            <p className="text-[10px] bg-white/20 px-2 py-0.5 rounded inline-block font-bold">Próximo vencimento/renovação: {advancePlanInfo.renewalDate.toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {settings.googleReviewUrl && (
                                <Card className="border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-800 dark:to-blue-900/10 overflow-hidden relative group">
                                    <div className="absolute -right-10 -top-10 bg-blue-500/10 w-40 h-40 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
                                    <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 relative z-10">
                                        <div className="flex items-center gap-4 text-center sm:text-left">
                                            <div className="p-3 bg-white dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600">
                                                <svg className="w-10 h-10" viewBox="0 0 24 24">
                                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">Gostando do nosso serviço?</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Sua avaliação no Google nos ajuda muito a crescer!</p>
                                                <div className="flex gap-1 mt-2 justify-center sm:justify-start">
                                                    {[1,2,3,4,5].map(star => <SparklesIcon key={star} className="w-5 h-5 text-yellow-400 fill-current" />)}
                                                </div>
                                            </div>
                                        </div>
                                        <a 
                                            href={settings.googleReviewUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transform transition-all active:scale-95 text-center flex items-center justify-center gap-2"
                                        >
                                            <SparklesIcon className="w-5 h-5" />
                                            Avaliar no Google
                                        </a>
                                    </CardContent>
                                </Card>
                            )}

                            {clientData.plan === 'VIP' && (
                                <Card className={`border ${emergencyLimitReached || isInRecess ? 'opacity-50' : 'border-red-200 dark:border-red-900/50 bg-red-50/30'}`}>
                                    <CardContent className="flex items-center justify-between py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${isInRecess ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600'}`}>
                                                <ExclamationTriangleIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-gray-100">Atendimento de Emergência VIP</h3>
                                                <p className="text-xs text-gray-500">
                                                    {isInRecess 
                                                        ? `Indisponível: Recesso de ${activeRecess?.name}` 
                                                        : `${2 - currentMonthEmergencies} de 2 usos disponíveis este mês`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <Button 
                                            variant={isInRecess ? "secondary" : "danger"} 
                                            size="sm" 
                                            onClick={() => setIsEmergencyModalOpen(true)} 
                                            disabled={emergencyLimitReached || isInRecess}
                                        >
                                            {isInRecess ? 'Recesso' : 'Acionar'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {isAdvancePlanGloballyAvailable && !isBlockedByDueDate && (!advancePlanInfo?.active || (advancePlanInfo?.active && advancePlanInfo.showRenewalButton)) && (
                                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl p-6 shadow-lg animate-fade-in">
                                    <h3 className="text-xl font-black mb-1">
                                        {advancePlanInfo?.active ? "🕒 Hora de Renovar!" : settings.features.advancePaymentTitle}
                                    </h3>
                                    <p className="text-sm opacity-90 mb-4">
                                        {advancePlanInfo?.active 
                                            ? "Sua cobertura acaba amanhã. Renove agora para garantir os descontos no próximo lote!" 
                                            : (clientData.plan === 'VIP' ? settings.features.advancePaymentSubtitleVIP : settings.features.advancePaymentSubtitleSimple)}
                                    </p>
                                    <Button variant="light" size="sm" onClick={() => setIsAdvanceModalOpen(true)}>
                                        {advancePlanInfo?.active ? 'Renovar Adiantamento' : 'Ver Descontos'}
                                    </Button>
                                </div>
                            )}

                            {clientData.plan === 'Simples' && 
                            settings.features.vipPlanEnabled && 
                            !clientData.scheduledPlanChange && 
                            (settings.features.planUpgradeEnabled || activePlanChangeRequest?.status === 'quoted') && (
                                <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl p-6 shadow-lg">
                                    <h3 className="text-xl font-black mb-1">
                                        {activePlanChangeRequest?.status === 'quoted' ? "✨ Sua Proposta VIP chegou!" : settings.features.vipUpgradeTitle}
                                    </h3>
                                    <p className="text-sm opacity-90 mb-4">
                                        {activePlanChangeRequest?.status === 'pending' 
                                            ? "Recebemos seu interesse! Nossa equipe está preparando uma proposta personalizada para sua piscina."
                                            : settings.features.vipUpgradeDescription}
                                    </p>
                                    <Button 
                                        variant="light" 
                                        size="sm" 
                                        className="text-amber-700 disabled:opacity-75 disabled:cursor-not-allowed"
                                        onClick={activePlanChangeRequest?.status === 'quoted' ? () => setIsPlanUpgradeModalOpen(true) : handleRequestPlanChange}
                                        isLoading={isRequestingPlanChange}
                                        disabled={activePlanChangeRequest?.status === 'pending' || isRequestingPlanChange}
                                    >
                                        {activePlanChangeRequest?.status === 'quoted' ? 'Ver Orçamento Especial' : activePlanChangeRequest?.status === 'pending' ? 'Aguardando Análise' : 'Solicitar Upgrade VIP'}
                                    </Button>
                                </div>
                            )}

                            {upcomingRecesses.length > 0 && <RecessNotificationCard recesses={upcomingRecesses} />}
                            {priceChangeNotification && <PriceChangeNotificationCard notification={priceChangeNotification} currentFee={monthlyFee} />}
                            {pendingQuote && <ReplenishmentCard quote={pendingQuote} client={clientData} updateStatus={updateReplenishmentQuoteStatus} createOrder={createOrder} showNotification={showNotification}/>}
                            {showStatusCard && mostRecentRequest && <RequestStatusCard request={mostRecentRequest} />}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader><h3 className="font-bold">Status da Água</h3></CardHeader>
                                    <CardContent className="grid grid-cols-2 gap-4 text-center">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-900 dark:text-blue-100">
                                            <p className="text-xs text-gray-500">pH</p>
                                            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{clientData.poolStatus.ph.toFixed(1)}</p>
                                        </div>
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-900 dark:text-yellow-100">
                                            <p className="text-xs text-gray-500">Cloro</p>
                                            <p className="text-2xl font-black text-yellow-600 dark:text-blue-400">{clientData.poolStatus.cloro.toFixed(1)}</p>
                                        </div>
                                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-900 dark:text-purple-100">
                                            <p className="text-xs text-gray-500">Alcalinidade</p>
                                            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{clientData.poolStatus.alcalinidade}</p>
                                        </div>
                                        <div className={`p-3 rounded-lg ${clientData.poolStatus.uso === 'Livre para uso' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-green-900/20'}`}>
                                            <p className="text-xs text-gray-500">Uso</p>
                                            <p className={`text-sm font-black ${clientData.poolStatus.uso === 'Livre para uso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{clientData.poolStatus.uso}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <EventSchedulerCard client={clientData} poolEvents={poolEvents} createPoolEvent={createPoolEvent} showNotification={showNotification} />
                            </div>

                            <div className="space-y-6">
                                <Card>
                                    <CardHeader><h3 className="font-bold">Cronograma</h3></CardHeader>
                                    <CardContent className="text-center py-6">
                                        {nextVisit ? (
                                            <>
                                                <WeatherSunnyIcon className="w-16 h-16 mx-auto text-yellow-400 mb-2"/>
                                                <p className="text-sm text-gray-500 uppercase font-bold">Próxima Visita</p>
                                                <p className="text-3xl font-black text-gray-800 dark:text-white">{nextVisit.day}</p>
                                                {nextVisit.isRouteActive && (
                                                    <div className="mt-4 p-2 bg-green-500 text-white rounded-full text-xs font-bold animate-pulse">Equipe em rota de atendimento!</div>
                                                )}
                                            </>
                                        ) : <p className="text-gray-400 italic">Visita não agendada para esta semana.</p>}
                                    </CardContent>
                                </Card>

                                <Card data-tour-id="payment">
                                    <CardHeader data-tour-id="payment-header" className="flex justify-between items-center">
                                        <h3 className="font-bold">Dados de Pagamento</h3>
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${clientData.payment.status === 'Pago' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30 animate-pulse'}`}>
                                            {clientData.payment.status}
                                        </span>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase font-black">Mensalidade</p>
                                                <p className="text-xl font-black text-primary-600 dark:text-primary-400">R$ {monthlyFee.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase font-black">Vencimento</p>
                                                <p className="text-xl font-black text-gray-800 dark:text-white">
                                                    {toDate(clientData.payment.dueDate)?.toLocaleDateString('pt-BR') || '---'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {advancePlanInfo?.active && (
                                            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <SparklesIcon className="w-4 h-4 text-yellow-600" />
                                                    <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase">PLANO ADIANTADO ATIVO</span>
                                                </div>
                                                <p className="text-[9px] text-yellow-600 dark:text-yellow-500 italic">O serviço está garantido até {advancePlanInfo.coverageEnd.toLocaleDateString('pt-BR')}.</p>
                                            </div>
                                        )}

                                        <div className="pt-2 border-t dark:border-gray-700">
                                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Chave PIX para pagamento:</p>
                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border dark:border-gray-700">
                                                <code className="text-xs font-mono truncate flex-1">{pixKeyToDisplay}</code>
                                                <button onClick={() => copyToClipboard(pixKeyToDisplay)} className="p-1 hover:text-primary-500 transition-colors">
                                                    <CopyIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="space-y-4 animate-fade-in text-gray-800 dark:text-gray-100">
                        <Card>
                            <CardHeader><h3 className="font-bold">Meus Produtos em Casa</h3></CardHeader>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {clientData.stock.length > 0 ? clientData.stock.map((item: any) => {
                                    const max = item.maxQuantity || 5;
                                    const percentage = Math.min(100, (item.quantity / max) * 100);
                                    const lowStock = item.quantity <= (item.maxQuantity ? item.maxQuantity * 0.3 : 2);
                                    return (
                                        <div key={item.productId} className="p-4 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">
                                            <div className="flex justify-between items-start mb-3">
                                                <p className="font-bold text-gray-800 dark:text-gray-100">{item.name}</p>
                                                <span className={`text-xs font-black px-2 py-1 rounded-full ${lowStock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    {item.quantity} / {max}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-2">
                                                <div className={`h-2 rounded-full transition-all ${lowStock ? 'bg-red-500' : 'bg-green-50'}`} style={{ width: `${percentage}%` }}></div>
                                            </div>
                                            {lowStock && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">⚠️ Estoque Baixo</p>}
                                        </div>
                                    );
                                }) : (
                                    <div className="col-span-full py-10 text-center text-gray-400">
                                        <ArchiveBoxIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>Nenhum controle de estoque ativo para seu perfil.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'plan' && currentPlanDetails && (
                    <div className="space-y-6 animate-fade-in text-gray-800 dark:text-gray-100">
                        <Card>
                            <CardHeader><h3 className="font-bold">Detalhes do Plano</h3></CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className={`text-3xl font-black ${currentPlanDetails.planType === 'VIP' ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary-600 dark:text-primary-400'}`}>{currentPlanDetails.title}</h4>
                                        {advancePlanInfo?.active && <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded font-black uppercase">PROMO ATIVA</span>}
                                    </div>
                                    {currentPlanDetails.fidelity && (
                                        <p className="text-sm font-bold text-gray-500">Fidelidade: {currentPlanDetails.fidelity.months} meses ({currentPlanDetails.fidelity.discountPercent}% OFF)</p>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <p className="font-black text-xs uppercase tracking-widest text-gray-400">Benefícios Inclusos:</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {currentPlanDetails.benefits.map((b: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200">
                                                <CheckIcon className="w-4 h-4 text-green-500" />
                                                {b}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <Button variant="secondary" className="w-full" onClick={() => setIsTermsModalOpen(true)}>Visualizar Termos e Condições</Button>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="space-y-6 animate-fade-in text-gray-800 dark:text-gray-100">
                        <Card>
                            <CardHeader><h3 className="font-bold">Dados Cadastrais e Situação do Plano</h3></CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><p className="text-xs text-gray-400 uppercase font-black">Nome</p><p className="font-bold text-gray-900 dark:text-white">{clientData.name}</p></div>
                                    <div><p className="text-xs text-gray-400 uppercase font-black">E-mail de Acesso</p><p className="font-bold text-gray-900 dark:text-white">{clientData.email}</p></div>
                                    <div><p className="text-xs text-gray-400 uppercase font-black">Telefone</p><p className="font-bold text-gray-900 dark:text-white">{clientData.phone}</p></div>
                                    <div><p className="text-xs text-gray-400 uppercase font-black">Mensalidade Atual</p><p className="font-bold text-primary-600 dark:text-primary-400">R$ {monthlyFee.toFixed(2)}</p></div>
                                </div>
                                
                                <div className="pt-6 border-t dark:border-gray-700 space-y-4">
                                    <h4 className="text-sm font-black uppercase text-gray-500 tracking-widest">Informações de Cobrança e Benefícios</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Status da Última Fatura</p>
                                            <p className={`font-black text-lg ${clientData.payment.status === 'Pago' ? 'text-green-600' : 'text-red-600'}`}>
                                                {clientData.payment.status.toUpperCase()}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Data de Renovação</p>
                                            <p className="font-black text-lg text-gray-800 dark:text-white">
                                                {toDate(clientData.payment.dueDate)?.toLocaleDateString('pt-BR') || '---'}
                                            </p>
                                        </div>
                                        {advancePlanInfo?.active && (
                                            <div className="md:col-span-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-800 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <SparklesIcon className="w-6 h-6 text-yellow-600" />
                                                    <div>
                                                        <p className="text-[10px] text-yellow-700 dark:text-yellow-400 uppercase font-black">Plano Promocional Ativo</p>
                                                        <p className="text-sm font-bold text-yellow-800 dark:text-yellow-100">
                                                            Sua manutenção já está quitada e coberta até o dia {advancePlanInfo.coverageEnd.toLocaleDateString('pt-BR')}.
                                                        </p>
                                                    </div>
                                                </div>
                                                {advancePlanInfo.isExpiringSoon ? (
                                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-[11px] text-red-900 dark:text-red-200 border border-red-200/50 animate-pulse">
                                                        <strong>⚠️ RENOVAÇÃO PENDENTE:</strong> Sua cobertura termina em breve. Amanhã, o botão de renovação estará disponível na aba <strong>Início</strong> para garantir o valor promocional do próximo ciclo.
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-white/40 dark:bg-black/20 rounded-lg text-[11px] text-yellow-900 dark:text-yellow-200 border border-yellow-200/50">
                                                        <strong>💡 Dica de Economia:</strong> Para renovar seu desconto e garantir o valor promocional, você deve solicitar um novo adiantamento na aba <strong>Início</strong> no dia anterior ao vencimento ({advancePlanInfo.coverageEnd.toLocaleDateString('pt-BR')}).
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><h3 className="font-bold">Segurança da Conta</h3></CardHeader>
                            <CardContent>
                                <form onSubmit={handlePasswordChange} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="Nova Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                                        <Input label="Confirme a Senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                                    </div>
                                    <Button type="submit" isLoading={isSavingPassword} className="w-full md:w-auto">Atualizar Senha de Acesso</Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Modals */}
            {isAdvanceModalOpen && (
                <AdvancePaymentModal
                    isOpen={isAdvanceModalOpen}
                    onClose={() => setIsAdvanceModalOpen(false)}
                    client={clientData}
                    settings={settings}
                    monthlyFee={monthlyFee}
                    onSubmit={createAdvancePaymentRequest}
                    showNotification={showNotification}
                />
            )}

            {isEmergencyModalOpen && (
                <Modal 
                    isOpen={isEmergencyModalOpen} 
                    onClose={() => setIsEmergencyModalOpen(false)} 
                    title="Solicitar Emergência VIP"
                    footer={<><Button variant="secondary" onClick={() => setIsEmergencyModalOpen(false)}>Cancelar</Button><Button variant="danger" onClick={handleEmergencyRequest} isLoading={isSubmittingEmergency}>Enviar Chamado</Button></>}
                >
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                            <p className="text-xs text-red-800 dark:text-red-200">
                                <strong>Aviso:</strong> Este serviço é exclusivo para situações críticas que não podem esperar a visita semanal (ex: água verde súbita, transbordo, vazamento).
                            </p>
                        </div>
                        <textarea 
                            className="w-full p-4 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-gray-800 dark:text-white" 
                            placeholder="Descreva o que aconteceu..." 
                            rows={4}
                            value={emergencyReason}
                            onChange={e => setEmergencyReason(e.target.value)}
                        />
                    </div>
                </Modal>
            )}

            {isPlanUpgradeModalOpen && activePlanChangeRequest && (
                <Modal
                    isOpen={isPlanUpgradeModalOpen}
                    onClose={() => setIsPlanUpgradeModalOpen(false)}
                    title="Proposta VIP Personalizada"
                    footer={
                        <>
                            <Button variant="danger" onClick={handleRejectPlanChange} isLoading={isRequestingPlanChange}>Recusar Proposta</Button>
                            <Button onClick={handleAcceptPlanChange} isLoading={isRequestingPlanChange}>Aceitar Upgrade</Button>
                        </>
                    }
                >
                    <div className="space-y-4 text-gray-800 dark:text-gray-100">
                        <p className="font-bold text-lg text-center">Temos ótimas notícias!</p>
                        <p className="text-center text-gray-500 dark:text-gray-400 text-sm">Preparamos condições especiais para sua migração VIP.</p>
                        <div className="space-y-2 mt-4">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Escolha sua Fidelidade:</p>
                            {upgradeOptions.map(opt => (
                                <div 
                                    key={opt.id} 
                                    onClick={() => setSelectedUpgradeOptionId(opt.id)}
                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex justify-between items-center ${selectedUpgradeOptionId === opt.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'}`}
                                >
                                    <div>
                                        <p className="font-black text-sm">{opt.title}</p>
                                        {opt.discountPercent > 0 && <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full">-{opt.discountPercent}% OFF</span>}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-primary-600 dark:text-primary-400">R$ {opt.price.toFixed(2)}</p>
                                        <p className="text-[10px] text-gray-400">por mês</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}

            {isTermsModalOpen && currentPlanDetails && (
                <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} title={`Termos: ${currentPlanDetails.title}`} size="lg">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl max-h-96 overflow-y-auto no-scrollbar border dark:border-gray-700 text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                        {currentPlanDetails.terms}
                    </div>
                </Modal>
            )}
        </div>
    );
};

const PriceChangeNotificationCard = ({ notification, currentFee }: { notification: PendingPriceChange, currentFee: number }) => (
    <Card className="border-l-8 border-blue-500 bg-blue-50 dark:bg-blue-900/10">
        <CardContent className="flex items-center gap-4 py-4">
            <CurrencyDollarIcon className="w-10 h-10 text-blue-600" />
            <div>
                <h4 className="font-black text-blue-900 dark:text-blue-100">Atualização de Tabela de Preços</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 opacity-80">
                    A partir de {toDate(notification.effectiveDate)?.toLocaleDateString('pt-BR')}, sua mensalidade será updated conforme as novas diretrizes da empresa.
                </p>
            </div>
        </CardContent>
    </Card>
);

const RecessNotificationCard = ({ recesses }: { recesses: RecessPeriod[] }) => (
    <div className="space-y-2">
        {recesses.map(r => (
            <Card key={r.id} className="border-l-8 border-orange-500 bg-orange-50 dark:bg-orange-900/10">
                <CardContent className="flex items-center gap-4 py-4">
                    <CalendarDaysIcon className="w-8 h-8 text-orange-600" />
                    <div>
                        <h4 className="font-black text-orange-900 dark:text-orange-100">Comunicado: {r.name}</h4>
                        <p className="text-sm text-orange-800 dark:text-orange-200 opacity-80">Estaremos em recesso de {toDate(r.startDate)?.toLocaleDateString('pt-BR')} até {toDate(r.endDate)?.toLocaleDateString('pt-BR')}.</p>
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
);

const ReplenishmentCard = ({ quote, client, updateStatus, createOrder, showNotification }: any) => {
    const [isSaving, setIsSaving] = useState(false);
    const handleApprove = async () => {
        setIsSaving(true);
        try {
            await createOrder({ clientId: client.uid || client.id, clientName: client.name, items: quote.items, total: quote.total, status: 'Pendente' });
            await updateStatus(quote.id, 'approved');
            showNotification("Pedido confirmado com sucesso!", "success");
        } catch (e) { showNotification("Erro ao processar.", "error"); } finally { setIsSaving(false); }
    };
    return (
        <Card className="border-l-8 border-green-500 shadow-lg animate-pulse-slow">
            <CardHeader className="bg-green-50/50 dark:bg-green-900/10"><h3 className="font-black text-green-700 dark:text-green-300 flex items-center gap-2"><SparklesIcon className="w-5 h-5"/> Reposição Sugerida</h3></CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm dark:text-gray-200">Identificamos que seu estoque está baixo. Sugerimos a reposição abaixo para garantir o tratamento da sua piscina:</p>
                <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-700">
                    {quote.items.map((i: any) => (
                        <div key={i.id} className="flex justify-between text-xs py-1 border-b last:border-0 dark:border-gray-800 dark:text-gray-300">
                            <span>{i.name} <span className="font-bold">x{i.quantity}</span></span>
                            <span className="font-mono">R$ {(i.price * i.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="flex justify-between pt-2 mt-2 border-t font-black text-lg text-primary-600 dark:text-primary-400"><span>TOTAL</span><span>R$ {quote.total.toFixed(2)}</span></div>
                </div>
                <div className="flex gap-2"><Button onClick={handleApprove} isLoading={isSaving} className="flex-1">Confirmar Pedido</Button><Button variant="secondary" onClick={() => updateStatus(quote.id, 'rejected')} disabled={isSaving}>Ignorar</Button></div>
            </CardContent>
        </Card>
    );
};

const RequestStatusCard = ({ request }: { request: AdvancePaymentRequest }) => {
    const isApproved = request.status === 'approved';
    const isRejected = request.status === 'rejected';
    const isPending = request.status === 'pending';

    return (
        <Card className={`border-l-8 ${isRejected ? 'border-red-500' : isApproved ? 'border-green-500' : 'border-yellow-500'}`}>
            <CardContent className="flex items-center gap-4 py-4">
                <div className={`p-2 rounded-full ${isRejected ? 'bg-red-100 text-red-600' : isApproved ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                    {isRejected ? <XMarkIcon className="w-6 h-6"/> : isApproved ? <CheckIcon className="w-6 h-6" /> : <Spinner size="sm"/>}
                </div>
                <div>
                    <h4 className="font-black uppercase text-xs tracking-widest text-gray-400">Solicitação de Adiantamento</h4>
                    <p className="font-bold dark:text-white">
                        {isPending ? 'Em análise pela administração' : isApproved ? 'Solicitação aprovada com sucesso!' : 'Solicitação não aprovada'}
                    </p>
                    {isRejected && <p className="text-xs text-red-500 mt-1">O financeiro não identificou o pagamento deste lote.</p>}
                    {isApproved && <p className="text-xs text-green-600 mt-1">Seu plano foi atualizado. Verifique os novos prazos na aba Conta.</p>}
                </div>
            </CardContent>
        </Card>
    );
};

const EventSchedulerCard = ({ client, poolEvents, createPoolEvent, showNotification }: any) => {
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const clientEvents = useMemo(() => poolEvents.filter((e: any) => e.clientId === client.uid).sort((a: any, b: any) => (toDate(b.eventDate)?.getTime() || 0) - (toDate(a.eventDate)?.getTime() || 0)), [poolEvents, client.uid]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await createPoolEvent({ clientId: client.uid, clientName: client.name, eventDate: new Date(date + 'T12:00:00'), notes });
            showNotification("Evento agendado com sucesso!", "success");
            setDate(''); setNotes('');
        } catch (e) { showNotification("Erro ao agendar.", "error"); } finally { setIsSaving(false); }
    };

    return (
        <Card>
            <CardHeader><h3 className="font-black flex items-center gap-2"><CalendarDaysIcon className="w-5 h-5 text-primary-500"/> Agendar Uso da Piscina</h3></CardHeader>
            <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Input label="Data do Evento" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    <Input label="Observações (Opcional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Churrasco no sábado" />
                    <Button type="submit" isLoading={isSaving} className="w-full">Agendar</Button>
                </form>
                {clientEvents.length > 0 && (
                    <div className="space-y-2 border-t dark:border-gray-700 pt-4">
                        <p className="text-[10px] font-black uppercase text-gray-400">Meus Agendamentos</p>
                        {clientEvents.map((e: any) => (
                            <div key={e.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex justify-between items-center text-xs text-gray-700 dark:text-gray-200">
                                <div><p className="font-bold">{toDate(e.eventDate)?.toLocaleDateString('pt-BR')}</p><p className="text-[10px] text-gray-500 italic truncate max-w-[150px]">{e.notes}</p></div>
                                <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${e.status === 'acknowledged' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{e.status === 'acknowledged' ? 'Confirmado' : 'Notificado'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const AdvancePaymentModal = ({ isOpen, onClose, client, settings, monthlyFee, onSubmit, showNotification }: any) => {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const handleSubmit = async () => {
        if (selectedIdx === null) return;
        const opt = settings.advancePaymentOptions[selectedIdx];
        const orig = monthlyFee * opt.months;
        const disc = orig * (opt.discountPercent / 100);
        setIsSaving(true);
        try {
            await onSubmit({ clientId: client.uid, clientName: client.name, months: opt.months, discountPercent: opt.discountPercent, originalAmount: orig, finalAmount: orig - disc });
            showNotification("Solicitação enviada!", "success"); onClose();
        } catch (e) { showNotification("Erro ao solicitar.", "error"); } finally { setIsSaving(false); }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Economize com Adiantamento">
            <div className="space-y-3 text-gray-800 dark:text-gray-100">
                {settings.advancePaymentOptions.map((opt: any, i: number) => (
                    <div key={i} onClick={() => setSelectedIdx(i)} className={`p-4 border-2 rounded-xl cursor-pointer flex justify-between items-center transition-all ${selectedIdx === i ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md' : 'border-gray-100 dark:border-gray-800'}`}>
                        <div><p className="font-black">{opt.months} Meses</p><p className="text-xs text-green-600 font-bold">{opt.discountPercent}% de desconto real</p></div>
                        <div className="text-right"><p className="text-xl font-black text-primary-600 dark:text-primary-400">R$ {(monthlyFee * opt.months * (1 - opt.discountPercent/100)).toFixed(2)}</p><p className="text-[10px] text-gray-400">Total do pacote</p></div>
                    </div>
                ))}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs text-gray-500 text-center"><p>Ao solicitar, as chaves PIX para pagamento serão apresentadas no painel após a análise.</p></div>
                <Button className="w-full mt-4" size="lg" onClick={handleSubmit} isLoading={isSaving} disabled={selectedIdx === null}>Enviar Solicitação</Button>
            </div>
        </Modal>
    );
};

export default ClientDashboardView;

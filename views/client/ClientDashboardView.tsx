import React, { useState, useEffect, useMemo } from 'react';
import { AuthContextType, AppContextType, Client, ReplenishmentQuote, Order, Settings, CartItem, AdvancePaymentRequest, PoolEvent, RecessPeriod, PendingPriceChange, PlanChangeRequest, FidelityPlan, EmergencyRequest } from '../../types';
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
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

type DashboardTab = 'summary' | 'products' | 'plan' | 'account';

const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ authContext, appContext }) => {
    const { user, changePassword, showNotification } = authContext;
    const { clients, loading, settings, routes, replenishmentQuotes, updateReplenishmentQuoteStatus, createOrder, createAdvancePaymentRequest, isAdvancePlanGloballyAvailable, advancePaymentRequests, banks, poolEvents, createPoolEvent, pendingPriceChanges, planChangeRequests, requestPlanChange, acceptPlanChange, cancelPlanChangeRequest, emergencyRequests, createEmergencyRequest } = appContext;
    
    const [activeTab, setActiveTab] = useState<DashboardTab>('summary');

    const clientData = useMemo(() => {
        return clients.find(c => c.uid === user.uid) || null;
    }, [clients, user.uid]);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    
    const [isPlanUpgradeModalOpen, setIsPlanUpgradeModalOpen] = useState(false);
    const [isRequestingPlanChange, setIsRequestingPlanChange] = useState(false);
    const [selectedUpgradeOptionId, setSelectedUpgradeOptionId] = useState<string>('');
    const [hasAcceptedUpgradeTerms, setHasAcceptedUpgradeTerms] = useState(false);

    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
    const [emergencyReason, setEmergencyReason] = useState('');
    const [isSubmittingEmergency, setIsSubmittingEmergency] = useState(false);

    const currentMonthEmergencies = useMemo(() => {
        if (!user || !emergencyRequests) return 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        return emergencyRequests.filter(req => {
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
        return settings.recessPeriods.filter(recess => {
            const startDate = toDate(recess.startDate);
            const endDate = toDate(recess.endDate);
            if (!startDate || !endDate) return false;
            const isActive = now >= startDate && now <= endDate;
            const isUpcoming = startDate <= thirtyDaysFromNow && endDate >= now;
            return isActive || isUpcoming;
        }).sort((a, b) => (toDate(a.startDate)?.getTime() || 0) - (toDate(b.startDate)?.getTime() || 0));
    }, [settings?.recessPeriods]);

    const activeRecess = useMemo(() => {
        const now = new Date();
        return upcomingRecesses.find(r => {
            const start = toDate(r.startDate);
            const end = toDate(r.endDate);
            return start && end && now >= start && now <= end;
        });
    }, [upcomingRecesses]);

    const isInRecess = !!activeRecess;
    
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
            if (routeDay && routeDay.clients && routeDay.clients.some(c => c.uid === clientData.uid || c.id === clientData.id)) {
                return { day: item.offset === 0 ? 'Hoje' : dayName, isRouteActive: routeDay.isRouteActive };
            }
        }
        return null;
    }, [clientData, routes]);

    const pendingQuote = useMemo(() => {
        if (!clientData || !replenishmentQuotes) return null;
        return replenishmentQuotes.find(q => q.clientId === clientData.id && q.status === 'sent');
    }, [clientData, replenishmentQuotes]);

    const mostRecentRequest = useMemo(() => {
        if (!clientData || !advancePaymentRequests || advancePaymentRequests.length === 0) return null;
        return advancePaymentRequests[0];
    }, [clientData, advancePaymentRequests]);

    const showStatusCard = useMemo(() => {
        if (!mostRecentRequest) return false;
        if (mostRecentRequest.status === 'pending') return true;
        const updatedAt = toDate(mostRecentRequest.updatedAt);
        if (!updatedAt) return false;
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        return updatedAt > threeDaysAgo;
    }, [mostRecentRequest]);
    
    const priceChangeNotification = useMemo(() => {
        if (!clientData || !pendingPriceChanges || pendingPriceChanges.length === 0) return null;
        return pendingPriceChanges.find(change => 
            change.status === 'pending' && 
            change.affectedClients.some(affected => affected.id === clientData.id)
        );
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
        return planChangeRequests.find(req => 
            req.clientId === clientData.uid && (req.status === 'pending' || req.status === 'quoted')
        );
    }, [planChangeRequests, clientData]);

    const upgradeOptions = useMemo(() => {
        if (!activePlanChangeRequest || !activePlanChangeRequest.proposedPrice || !settings) return [];
        const basePrice = activePlanChangeRequest.proposedPrice;
        const options: any[] = [];
        
        settings.fidelityPlans.forEach(plan => {
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
    }, [isPlanUpgradeModalOpen, upgradeOptions]);

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
        const selectedOption = upgradeOptions.find(opt => opt.id === selectedUpgradeOptionId);
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
                    <div className="space-y-6 animate-fade-in">
                        <div className="space-y-4">
                            {/* MECANISMO DE AVALIAÇÃO DO GOOGLE */}
                            {settings.googleReviewUrl && (
                                <Card className="border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-800 dark:to-blue-900/10">
                                    <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                                        <div className="flex items-center gap-4 text-center sm:text-left">
                                            <div className="p-3 bg-white dark:bg-gray-700 rounded-full shadow-sm">
                                                <svg className="w-8 h-8" viewBox="0 0 24 24">
                                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 dark:text-white">Gostando do nosso serviço?</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">Sua avaliação no Google nos ajuda muito a crescer!</p>
                                                <div className="flex gap-1 mt-1 justify-center sm:justify-start">
                                                    {[1,2,3,4,5].map(star => <SparklesIcon key={star} className="w-4 h-4 text-yellow-400 fill-current" />)}
                                                </div>
                                            </div>
                                        </div>
                                        <a 
                                            href={settings.googleReviewUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all text-center"
                                        >
                                            Avaliar agora
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

                            {isAdvancePlanGloballyAvailable && !isBlockedByDueDate && (
                                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl p-6 shadow-lg">
                                    <h3 className="text-xl font-black mb-1">{settings.features.advancePaymentTitle}</h3>
                                    <p className="text-sm opacity-90 mb-4">{clientData.plan === 'VIP' ? settings.features.advancePaymentSubtitleVIP : settings.features.advancePaymentSubtitleSimple}</p>
                                    <Button variant="light" size="sm" onClick={() => setIsAdvanceModalOpen(true)}>Ver Descontos</Button>
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
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <p className="text-xs text-gray-500">pH</p>
                                            <p className="text-2xl font-black text-blue-600">{clientData.poolStatus.ph.toFixed(1)}</p>
                                        </div>
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                            <p className="text-xs text-gray-500">Cloro</p>
                                            <p className="text-2xl font-black text-yellow-600">{clientData.poolStatus.cloro.toFixed(1)}</p>
                                        </div>
                                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                            <p className="text-xs text-gray-500">Alcalinidade</p>
                                            <p className="text-2xl font-black text-purple-600">{clientData.poolStatus.alcalinidade}</p>
                                        </div>
                                        <div className={`p-3 rounded-lg ${clientData.poolStatus.uso === 'Livre para uso' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-green-900/20'}`}>
                                            <p className="text-xs text-gray-500">Uso</p>
                                            <p className={`text-sm font-black ${clientData.poolStatus.uso === 'Livre para uso' ? 'text-green-600' : 'text-red-600'}`}>{clientData.poolStatus.uso}</p>
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
                                                <p className="text-3xl font-black text-gray-800 dark:text-gray-100">{nextVisit.day}</p>
                                                {nextVisit.isRouteActive && (
                                                    <div className="mt-4 p-2 bg-green-500 text-white rounded-full text-xs font-bold animate-pulse">Equipe em rota de atendimento!</div>
                                                )}
                                            </>
                                        ) : <p className="text-gray-400 italic">Visita não agendada para esta semana.</p>}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader><h3 className="font-bold">Histórico de Visitas</h3></CardHeader>
                                    <CardContent className="max-h-64 overflow-y-auto space-y-3 no-scrollbar">
                                        {clientData.visitHistory?.length ? clientData.visitHistory.slice(0, 5).map(visit => (
                                            <div key={visit.id} className="p-3 border-l-4 border-primary-500 bg-gray-50 dark:bg-gray-700/50 rounded-r-lg text-sm">
                                                <p className="font-bold">{toDate(visit.timestamp)?.toLocaleDateString('pt-BR')}</p>
                                                <p className="text-xs text-gray-500">pH: {visit.ph} | Cloro: {visit.cloro} | {visit.uso}</p>
                                                {visit.photoUrl && <a href={visit.photoUrl} target="_blank" rel="noreferrer" className="text-primary-500 text-xs font-bold mt-1 inline-block">Ver Foto</a>}
                                            </div>
                                        )) : <p className="text-center text-gray-400 text-sm py-4">Nenhuma visita registrada.</p>}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="space-y-4 animate-fade-in">
                        <Card>
                            <CardHeader><h3 className="font-bold">Meus Produtos em Casa</h3></CardHeader>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {clientData.stock.length > 0 ? clientData.stock.map(item => {
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
                                                <div className={`h-2 rounded-full transition-all ${lowStock ? 'bg-red-50' : 'bg-green-50'}`} style={{ width: `${percentage}%` }}></div>
                                            </div>
                                            {lowStock && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">⚠️ Estoque Baixo</p>}
                                        </div>
                                    );
                                }) : <div className="col-span-full py-20 text-center text-gray-400">Nenhum produto registrado em seu estoque.</div>}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'plan' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                        <div className="md:col-span-2 space-y-6">
                            <Card className="overflow-hidden">
                                <div className={`p-6 text-white ${clientData.plan === 'VIP' ? 'bg-gradient-to-br from-yellow-500 to-amber-600' : 'bg-gradient-to-br from-primary-500 to-primary-700'}`}>
                                    <p className="text-xs font-bold uppercase tracking-widest opacity-80">Plano Atual</p>
                                    <h2 className="text-4xl font-black">{currentPlanDetails?.title}</h2>
                                    {clientData.fidelityPlan && (
                                        <p className="mt-2 inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-bold">Fidelidade: {clientData.fidelityPlan.months} Meses</p>
                                    )}
                                </div>
                                <CardContent className="p-6">
                                    <h4 className="font-bold mb-4 text-gray-800 dark:text-gray-200">Benefícios Inclusos:</h4>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {currentPlanDetails?.benefits.map((b, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-8 pt-6 border-t dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                                        <Button variant="secondary" size="sm" onClick={() => setIsTermsModalOpen(true)}>Termos do Serviço</Button>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Valor da Mensalidade</p>
                                            <p className="text-2xl font-black text-gray-900 dark:text-gray-100">R$ {monthlyFee.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        
                        <div className="space-y-6">
                            <Card>
                                <CardHeader><h3 className="font-bold">Dados de Pagamento</h3></CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Vencimento:</p>
                                        <p className="text-xl font-black text-primary-600">{new Date(clientData.payment.dueDate).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Pague via PIX:</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <code className="text-xs break-all font-mono text-gray-600 dark:text-gray-400">{pixKeyToDisplay}</code>
                                            <button onClick={() => copyToClipboard(pixKeyToDisplay)} className="p-2 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                                                <CopyIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        <Card>
                            <CardHeader><h3 className="font-bold">Dados do Perfil</h3></CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Nome:</p>
                                    <p className="font-bold">{clientData.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Email:</p>
                                    <p className="font-bold">{clientData.email}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Telefone:</p>
                                    <p className="font-bold">{clientData.phone}</p>
                                </div>
                                <div className="pt-4 border-t dark:border-gray-700">
                                    <p className="text-xs text-gray-500 font-bold uppercase">Endereço:</p>
                                    <p className="text-sm">{clientData.address.street}, {clientData.address.number}</p>
                                    <p className="text-sm">{clientData.address.neighborhood} - {clientData.address.city}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><h3 className="font-bold">Segurança</h3></CardHeader>
                            <CardContent>
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Alterar Senha de Acesso</h4>
                                <form onSubmit={handlePasswordChange} className="space-y-4">
                                    <Input label="Nova Senha" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} containerClassName="mb-0"/>
                                    <Input label="Confirmar Senha" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} containerClassName="mb-0"/>
                                    <Button type="submit" isLoading={isSavingPassword} className="w-full">Atualizar Senha</Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

             {isEmergencyModalOpen && (
                <Modal isOpen={isEmergencyModalOpen} onClose={() => setIsEmergencyModalOpen(false)} title="Acionar Atendimento VIP" footer={<><Button variant="secondary" onClick={() => setIsEmergencyModalOpen(false)}>Cancelar</Button><Button onClick={handleEmergencyRequest} isLoading={isSubmittingEmergency}>Confirmar Chamado</Button></>}>
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 rounded text-sm text-red-800 dark:text-red-200">
                            <p className="font-bold mb-1">Atenção:</p>
                            <p>O atendimento de emergência é prioritário. Descreva o problema para que possamos enviar um técnico o mais rápido possível.</p>
                        </div>
                        <textarea className="w-full p-3 border rounded-md dark:bg-gray-900 dark:border-gray-700 focus:ring-red-500 focus:border-red-500" rows={4} placeholder="Descreva o que está ocorrendo..." value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} />
                    </div>
                </Modal>
            )}

            {isAdvanceModalOpen && <AdvancePaymentModal isOpen={isAdvanceModalOpen} onClose={() => setIsAdvanceModalOpen(false)} client={clientData} settings={settings} monthlyFee={monthlyFee} onSubmit={createAdvancePaymentRequest} showNotification={showNotification} />}

            {isPlanUpgradeModalOpen && activePlanChangeRequest && (
                <Modal isOpen={isPlanUpgradeModalOpen} onClose={() => setIsPlanUpgradeModalOpen(false)} title="✨ Sua Piscina no Nível VIP" size="lg" footer={<div className="flex flex-col w-full items-center"><Button onClick={handleAcceptPlanChange} isLoading={isRequestingPlanChange} disabled={!hasAcceptedUpgradeTerms || isRequestingPlanChange} className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transform transition-all active:scale-[0.98] ${hasAcceptedUpgradeTerms ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white hover:brightness-110 shadow-yellow-500/20' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>Confirmar Upgrade VIP ✨</Button><button onClick={handleRejectPlanChange} className="text-sm font-bold text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors mt-4">Não tenho interesse agora</button></div>}>
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4"><SparklesIcon className="w-8 h-8 text-yellow-600" /></div>
                            <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100">Escolha seu Upgrade VIP</h3>
                            <p className="text-sm text-gray-500 mt-1">Selecione o plano de fidelidade que melhor lhe atende.</p>
                        </div>
                        <div className="space-y-3">
                            {upgradeOptions.map((option) => (
                                <div key={option.id} onClick={() => setSelectedUpgradeOptionId(option.id)} className={`p-4 border-2 rounded-2xl cursor-pointer transition-all flex justify-between items-center relative overflow-hidden group ${selectedUpgradeOptionId === option.id ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 ring-2 ring-yellow-500 shadow-lg' : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedUpgradeOptionId === option.id ? 'border-yellow-500 bg-yellow-500' : 'border-gray-300'}`}>{selectedUpgradeOptionId === option.id && <CheckIcon className="w-4 h-4 text-white" />}</div>
                                        <div>
                                            <p className="font-black text-lg text-gray-900 dark:text-gray-100">{option.title}</p>
                                            <div className="flex gap-2 items-center">
                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase">✨ Economia de R$ {option.savings.toFixed(2)} /mês</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] text-gray-400 line-through">R$ {option.originalPrice.toFixed(2)}</span>
                                        <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">R$ {option.price.toFixed(2)}<span className="text-xs text-gray-500 font-normal">/mês</span></p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-200 dark:border-yellow-700/50 shadow-inner">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" checked={hasAcceptedUpgradeTerms} onChange={(e) => setHasAcceptedUpgradeTerms(e.target.checked)} className="mt-1 h-6 w-6 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"/>
                                <div className="text-xs">
                                    <p className="font-bold text-yellow-800 dark:text-yellow-200 text-sm">Declaração de Aceite VIP</p>
                                    <p className="text-yellow-700 dark:text-yellow-400">Li e concordo integralmente com os termos de serviço do Plano VIP. A mudança será processada no próximo fechamento.</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </Modal>
            )}

            {isTermsModalOpen && currentPlanDetails && (
                <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} title={`Termos do Serviço - ${currentPlanDetails.title}`} size="lg" footer={<Button onClick={() => setIsTermsModalOpen(false)}>Fechar</Button>} >
                    <div className="prose dark:prose-invert max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700"><p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{currentPlanDetails.terms || "Termos não disponíveis no momento."}</p></div>
                </Modal>
            )}
        </div>
    );
};

const PriceChangeNotificationCard = ({ notification, currentFee }: any) => (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-xl text-sm flex items-center gap-3"><CurrencyDollarIcon className="w-6 h-6 text-blue-500 flex-shrink-0"/><p><strong>Aviso de Reajuste:</strong> Uma nova tabela de preços entrará em vigor em {toDate(notification.effectiveDate)?.toLocaleDateString('pt-BR')}. Sua mensalidade será atualizada automaticamente.</p></div>
);

const RecessNotificationCard = ({ recesses }: { recesses: RecessPeriod[] }) => (
    <div className="space-y-2">{recesses.map(r => (<div key={r.id} className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 rounded-xl text-sm flex items-center gap-3"><CalendarDaysIcon className="w-6 h-6 text-orange-500 flex-shrink-0"/><p><strong>Recesso ({r.name}):</strong> Estaremos ausentes de {toDate(r.startDate)?.toLocaleDateString('pt-BR')} a {toDate(r.endDate)?.toLocaleDateString('pt-BR')}.</p></div>))}</div>
);

const ReplenishmentCard = ({ quote, client, updateStatus, createOrder, showNotification }: any) => {
    const [loading, setLoading] = useState(false);
    const handleApprove = async () => {
        setLoading(true);
        try {
            await createOrder({ clientId: client.id, clientName: client.name, items: quote.items, total: quote.total, status: 'Pendente' });
            await updateStatus(quote.id, 'approved');
            showNotification("Pedido criado com sucesso!", "success");
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };
    return (<Card className="border-l-4 border-green-500 shadow-sm"><CardContent className="py-4"><div className="flex flex-row items-center justify-between gap-4"><div className="flex-1"><h3 className="font-bold text-sm text-green-700 dark:text-green-400">Reposição Sugerida</h3><p className="text-[11px] text-gray-500 dark:text-gray-400">Itens acabando. Valor total: <strong>R$ {quote.total.toFixed(2)}</strong></p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => updateStatus(quote.id, 'rejected')} className="text-xs">Ignorar</Button><Button size="sm" onClick={handleApprove} isLoading={loading} className="text-xs">Pedir</Button></div></div></CardContent></Card>);
};

const RequestStatusCard = ({ request }: { request: AdvancePaymentRequest }) => {
    const isApproved = request.status === 'approved';
    const isRejected = request.status === 'rejected';
    const isPending = request.status === 'pending';
    return (<div className={`p-4 border rounded-xl text-sm flex items-center gap-3 ${isPending ? 'bg-yellow-50 border-yellow-200' : isApproved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}><CheckBadgeIcon className={`w-6 h-6 ${isPending ? 'text-yellow-600' : isApproved ? 'text-green-600' : 'text-red-600'}`} /><p className="font-medium text-gray-700">Solicitação de adiantamento: <strong>{isPending ? 'Em Análise' : isApproved ? 'Aprovada' : 'Recusada'}</strong></p></div>);
};

const EventSchedulerCard = ({ client, poolEvents, createPoolEvent, showNotification }: any) => {
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const clientEvents = useMemo(() => {
        return poolEvents.filter((e: any) => e.clientId === client.uid).sort((a: any, b: any) => (toDate(b.eventDate)?.getTime() || 0) - (toDate(a.eventDate)?.getTime() || 0));
    }, [poolEvents, client.uid]);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createPoolEvent({ clientId: client.uid, clientName: client.name, eventDate: new Date(date + 'T12:00:00'), notes });
            showNotification("Evento agendado!", "success");
            setDate(''); setNotes('');
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="w-5 h-5 text-primary-500" />
                    <h3 className="font-bold">Agendar Uso</h3>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-gray-500 mb-4">Tem uma programação de festa? Avise-nos para garantirmos a qualidade ideal da água na data escolhida.</p>
                <form onSubmit={handleSubmit} className="space-y-2"><Input label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} required /><Input label="Obs" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Festa..." /><Button type="submit" isLoading={loading} className="w-full">Agendar</Button></form>
                {clientEvents.length > 0 && (<div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-2">{clientEvents.slice(0, 2).map((event: any) => (<div key={event.id} className="flex justify-between items-center text-xs p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"><span className="font-bold">{toDate(event.eventDate)?.toLocaleDateString('pt-BR')}</span><span className={`font-black uppercase ${event.status === 'acknowledged' ? 'text-green-500' : 'text-yellow-500'}`}>{event.status === 'acknowledged' ? 'Ok' : 'Pendente'}</span></div>))}</div>)}
            </CardContent>
        </Card>
    );
};

const AdvancePaymentModal = ({ isOpen, onClose, client, settings, monthlyFee, onSubmit, showNotification }: any) => {
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const handleSubmit = async () => {
        if (selectedOption === null) return;
        const option = settings.advancePaymentOptions[selectedOption];
        const originalAmount = monthlyFee * option.months;
        const finalAmount = originalAmount - (originalAmount * (option.discountPercent / 100));
        setLoading(true);
        try {
            await onSubmit({ clientId: client.uid, clientName: client.name, months: option.months, discountPercent: option.discountPercent, originalAmount, finalAmount });
            showNotification("Solicitação enviada!", "success");
            onClose();
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adiantamento com Desconto" size="lg">
            <div className="space-y-3">
                {settings.advancePaymentOptions.map((opt: any, idx: number) => {
                    const originalTotal = monthlyFee * opt.months;
                    const discountedTotal = originalTotal * (1 - opt.discountPercent / 100);
                    const savings = originalTotal - discountedTotal;
                    
                    return (
                        <div 
                            key={idx} 
                            onClick={() => setSelectedOption(idx)} 
                            className={`p-4 border-2 rounded-xl cursor-pointer transition-all relative overflow-hidden group ${selectedOption === idx ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}
                        >
                            <div className="flex justify-between items-start font-black">
                                <div>
                                    <span className="text-lg text-gray-800 dark:text-gray-100">{opt.months} Meses</span>
                                    <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase mt-1">
                                        ✨ Economia de R$ {savings.toFixed(2)}
                                    </p>
                                </div>
                                <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full text-xs">
                                    {opt.discountPercent}% OFF
                                </span>
                            </div>
                            <div className="mt-4 flex items-baseline gap-2">
                                <p className="text-2xl font-black text-primary-600 dark:text-primary-400">R$ {discountedTotal.toFixed(2)}</p>
                                <p className="text-xs text-gray-400 line-through">R$ {originalTotal.toFixed(2)}</p>
                            </div>
                            {selectedOption === idx && (
                                <div className="absolute top-0 right-0 h-full w-1 bg-primary-500"></div>
                            )}
                        </div>
                    );
                })}
                <Button onClick={handleSubmit} isLoading={loading} disabled={selectedOption === null} className="w-full mt-4 py-4 text-lg font-black shadow-lg">Confirmar Solicitação</Button>
            </div>
        </Modal>
    );
};

export default ClientDashboardView;
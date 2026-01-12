
import React, { useState, useEffect, useMemo } from 'react';
import { AuthContextType, AppContextType, Client, ReplenishmentQuote, Order, Settings, CartItem, AdvancePaymentRequest, PoolEvent, RecessPeriod, PendingPriceChange, PlanChangeRequest, FidelityPlan, EmergencyRequest } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { WeatherSunnyIcon, CopyIcon, CheckIcon, XMarkIcon, CalendarDaysIcon, CurrencyDollarIcon, CheckBadgeIcon, SparklesIcon, ExclamationTriangleIcon } from '../../constants';
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

const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ authContext, appContext }) => {
    const { user, changePassword, showNotification } = authContext;
    const { clients, loading, settings, routes, replenishmentQuotes, updateReplenishmentQuoteStatus, createOrder, createAdvancePaymentRequest, isAdvancePlanGloballyAvailable, advancePaymentRequests, banks, poolEvents, createPoolEvent, pendingPriceChanges, planChangeRequests, requestPlanChange, acceptPlanChange, cancelPlanChangeRequest, emergencyRequests, createEmergencyRequest } = appContext;
    
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
    
    const nextVisit = useMemo(() => {
        if (!clientData || !routes) return null;
        
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayIndex = new Date().getDay();

        const searchSequence = [];
        for (let i = 0; i < 7; i++) {
            searchSequence.push({
                index: (todayIndex + i) % 7,
                offset: i
            });
        }
        
        for (const item of searchSequence) {
            const dayName = dayNames[item.index];
            const routeDay = routes[dayName];
            
            if (routeDay && routeDay.clients && routeDay.clients.some(c => c.uid === clientData.uid || c.id === clientData.id)) {
                return { 
                    day: item.offset === 0 ? 'Hoje' : dayName, 
                    isRouteActive: routeDay.isRouteActive 
                };
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
        
        const relevantChange = pendingPriceChanges.find(change => 
            change.status === 'pending' && 
            change.affectedClients.some(affected => affected.id === clientData.id)
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
        return planChangeRequests.find(req => 
            req.clientId === clientData.uid && (req.status === 'pending' || req.status === 'quoted' || req.status === 'accepted')
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
                title: `${plan.months} Meses`,
                basePrice: basePrice,
                price: basePrice - discount,
                discountPercent: plan.discountPercent,
                savings: discount,
                fidelityPlan: plan
            });
        });
        
        return options.sort((a, b) => b.discountPercent - a.discountPercent);
    }, [activePlanChangeRequest, settings]);

    useEffect(() => {
        if (isPlanUpgradeModalOpen) {
            setHasAcceptedUpgradeTerms(false);
            if (upgradeOptions.length > 0 && !selectedUpgradeOptionId) {
                setSelectedUpgradeOptionId(upgradeOptions[0].id);
            }
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
    
    const hasPendingAdvanceRequest = useMemo(() => {
        if (!clientData || !advancePaymentRequests) return false;
        return advancePaymentRequests.some(r => r.clientId === clientData.uid && r.status === 'pending');
    }, [clientData, advancePaymentRequests]);

    const disabledTitle = useMemo(() => {
        if (hasPendingAdvanceRequest) return "Você já possui uma solicitação de adiantamento pendente.";
        if (isBlockedByDueDate) return "Opção bloqueada devido ao vencimento próximo. Regularize sua mensalidade atual primeiro.";
        return "Ver opções de desconto";
    }, [hasPendingAdvanceRequest, isBlockedByDueDate]);

    const upcomingRecesses = useMemo(() => {
        if (!settings?.recessPeriods) return [];
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        now.setHours(0,0,0,0);
        return settings.recessPeriods.filter(recess => {
            const startDate = toDate(recess.startDate);
            const endDate = toDate(recess.endDate);
            if (!startDate || !endDate) return false;
            const isActive = now >= startDate && now <= endDate;
            const isUpcoming = startDate <= thirtyDaysFromNow && endDate >= now;
            return isActive || isUpcoming;
        }).sort((a, b) => (toDate(a.startDate)?.getTime() || 0) - (toDate(b.startDate)?.getTime() || 0));
    }, [settings?.recessPeriods]);
    
    const handleRequestPlanChange = async () => {
        if (!clientData) return;
        setIsRequestingPlanChange(true);
        try {
            await requestPlanChange(clientData.uid!, clientData.name, clientData.plan, 'VIP');
            showNotification('Solicitação de upgrade enviada com sucesso!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao solicitar mudança.', 'error');
        } finally {
            setIsRequestingPlanChange(false);
        }
    };
    
    const handleAcceptPlanChange = async () => {
        if (!activePlanChangeRequest || !activePlanChangeRequest.proposedPrice || !hasAcceptedUpgradeTerms) return;
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
        if (!clientData || emergencyLimitReached) return;
        if (!emergencyReason.trim()) {
            showNotification("Por favor, descreva o motivo da emergência.", "error");
            return;
        }

        setIsSubmittingEmergency(true);
        try {
            await createEmergencyRequest({
                clientId: clientData.uid!,
                clientName: clientData.name,
                clientPhone: clientData.phone,
                address: `${clientData.address.street}, ${clientData.address.number} - ${clientData.address.neighborhood}`,
                reason: emergencyReason
            });
            showNotification("Emergência enviada! Nossa equipe foi notificada.", "success");
            setIsEmergencyModalOpen(false);
            setEmergencyReason('');
        } catch (error: any) {
            showNotification("Falha ao enviar emergência.", "error");
        } finally {
            setIsSubmittingEmergency(false);
        }
    };


    if ((loading.clients || loading.settings) || !settings) {
        return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
    }
    
    if (!clientData) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <p>Não foi possível carregar os dados do cliente.</p>
                <p className="text-sm">Se o problema persistir, entre em contato com o suporte.</p>
            </div>
        );
    }

    const clientBank = banks.find(b => b.id === clientData.bankId);
    const pixKeyToDisplay = clientData.pixKey || clientBank?.pixKey || settings?.pixKey || '';
    const monthlyFee = calculateClientMonthlyFee(clientData, settings);

    const advancePlanSubtitle = clientData.plan === 'VIP'
        ? settings.features.advancePaymentSubtitleVIP
        : settings.features.advancePaymentSubtitleSimple;

    const getUpgradeButtonProps = () => {
        if (activePlanChangeRequest?.status === 'accepted') {
            return { text: 'Upgrade Agendado', disabled: true, onClick: () => {} };
        }
        if (activePlanChangeRequest?.status === 'pending') {
            return { text: 'Aguardando Análise', disabled: true, onClick: () => {} };
        }
        if (activePlanChangeRequest?.status === 'quoted') {
            return { text: 'Ver Proposta VIP', disabled: false, onClick: () => setIsPlanUpgradeModalOpen(true) };
        }
        return { text: 'Solicitar Orçamento VIP', disabled: false, onClick: handleRequestPlanChange };
    };

    const upgradeBtn = getUpgradeButtonProps();

    const vipBenefitsList = settings.plans.vip.benefits;
    
    // Função para gerar descrição inteligente baseada nos benefícios REAIS
    const generateSmartVipDescription = () => {
        if (settings.features.vipUpgradeDescription) return settings.features.vipUpgradeDescription;
        
        const hasEmergencies = vipBenefitsList.some(b => b.toLowerCase().includes('emergência') || b.toLowerCase().includes('prioritário'));
        const hasProducts = vipBenefitsList.some(b => b.toLowerCase().includes('produto'));
        
        let text = "Mude para o nível VIP e tenha mais tranquilidade.";
        if (hasEmergencies && hasProducts) text = "Tenha produtos inclusos, atendimento de emergência e suporte prioritário.";
        else if (hasEmergencies) text = "Garanta atendimento de emergência prioritário e maior agilidade.";
        else if (hasProducts) text = "Simplifique: tenha todos os produtos de limpeza já inclusos em sua mensalidade.";
        
        return text;
    };

    const vipDescriptionToDisplay = generateSmartVipDescription();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                
                {clientData.plan === 'VIP' && (
                    <Card className={`border-2 transition-all ${emergencyLimitReached ? 'border-gray-300 opacity-75' : 'border-red-500 shadow-lg shadow-red-500/20'}`}>
                        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 py-6">
                            <div className="text-center md:text-left">
                                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                    <ExclamationTriangleIcon className={`w-6 h-6 ${emergencyLimitReached ? 'text-gray-400' : 'text-red-600 animate-pulse'}`} />
                                    <h3 className={`text-xl font-bold ${emergencyLimitReached ? 'text-gray-500' : 'text-red-700'}`}>Botão de Emergência VIP</h3>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Atendimento prioritário fora do cronograma.</p>
                                <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                                    {2 - currentMonthEmergencies} de 2 usos disponíveis este mês
                                </div>
                            </div>
                            <Button 
                                onClick={() => setIsEmergencyModalOpen(true)}
                                variant="danger"
                                className={`px-8 py-3 rounded-full text-lg shadow-xl uppercase tracking-widest font-black ${emergencyLimitReached ? 'grayscale cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                                disabled={emergencyLimitReached}
                            >
                                {emergencyLimitReached ? 'Limite Mensal Atingido' : 'Acionar Agora'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {clientData.scheduledPlanChange && (
                    <div className="p-4 bg-green-100 border-l-4 border-green-500 text-green-800 rounded-md">
                        <p className="font-bold flex items-center"><CheckBadgeIcon className="w-5 h-5 mr-2" /> Mudança de Plano Agendada</p>
                        <p>Seu plano será atualizado para <strong>{clientData.scheduledPlanChange.newPlan}</strong> (R$ {clientData.scheduledPlanChange.newPrice.toFixed(2)}) automaticamente após a confirmação do pagamento atual.</p>
                    </div>
                )}

                {priceChangeNotification && (
                    <PriceChangeNotificationCard 
                        notification={priceChangeNotification} 
                        currentFee={monthlyFee} 
                        client={clientData}
                        settings={settings}
                    />
                )}
                
                {upcomingRecesses.length > 0 && <RecessNotificationCard recesses={upcomingRecesses} />}

                {pendingQuote && <ReplenishmentCard quote={pendingQuote} client={clientData} updateStatus={updateReplenishmentQuoteStatus} createOrder={createOrder} showNotification={showNotification}/>}
                
                {showStatusCard && mostRecentRequest && (
                    <RequestStatusCard request={mostRecentRequest} client={clientData} />
                )}

                {isAdvancePlanGloballyAvailable && settings.advancePaymentOptions.length > 0 &&
                    (!showStatusCard || (mostRecentRequest && mostRecentRequest.status === 'rejected')) && (
                    <div className="bg-primary-500 text-white rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg overflow-hidden relative">
                        <div className="text-center md:text-left z-10">
                            <h3 className="font-bold text-xl">{settings.features.advancePaymentTitle}</h3>
                            <p className="text-primary-100">{advancePlanSubtitle}</p>
                            
                            {isBlockedByDueDate && (
                                <div className="mt-3 p-2 bg-yellow-400 text-yellow-900 text-xs font-black rounded-md inline-flex items-center animate-bounce-slow">
                                    <CurrencyDollarIcon className="w-4 h-4 mr-1" />
                                    Regularize sua mensalidade atual para liberar novos descontos.
                                </div>
                            )}
                        </div>
                        <Button 
                            onClick={() => setIsAdvanceModalOpen(true)} 
                            variant="light"
                            className="flex-shrink-0 z-10"
                            size="lg"
                            disabled={isBlockedByDueDate || hasPendingAdvanceRequest}
                            title={disabledTitle}
                        >
                            {mostRecentRequest?.status === 'rejected' && showStatusCard ? 'Tentar Novamente' : 'Ver Opções de Desconto'}
                        </Button>
                        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                             <SparklesIcon className="w-32 h-32" />
                        </div>
                    </div>
                )}
                
                {clientData.plan === 'Simples' && 
                 settings.features.vipPlanEnabled && 
                 (settings.features.planUpgradeEnabled || activePlanChangeRequest) && 
                 !clientData.scheduledPlanChange && (
                    <Card className={`border-2 transition-all relative overflow-hidden group ${activePlanChangeRequest?.status === 'quoted' ? 'border-yellow-500 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 shadow-lg shadow-yellow-500/20' : 'border-primary-400 bg-blue-50 dark:bg-blue-900/10'}`}>
                        <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                             <SparklesIcon className="w-32 h-32 text-yellow-600" />
                        </div>
                        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                            <div className="flex-1">
                                <h3 className={`text-xl font-black flex items-center ${activePlanChangeRequest?.status === 'quoted' ? 'text-yellow-700 dark:text-yellow-300' : 'text-primary-700 dark:text-primary-300'}`}>
                                    {activePlanChangeRequest?.status === 'quoted' ? (
                                        <>✨ {settings.features.vipUpgradeTitle || "Seu Convite VIP Chegou!"}</>
                                    ) : (
                                        <><SparklesIcon className="w-5 h-5 mr-2" /> {settings.features.vipUpgradeTitle || "Descubra o Plano VIP"}</>
                                    )}
                                </h3>
                                <p className={`text-sm mt-1 font-medium ${activePlanChangeRequest?.status === 'quoted' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {activePlanChangeRequest?.status === 'quoted' ? (
                                        "Analisamos sua piscina e preparamos condições imperdíveis para você ter tranquilidade total."
                                    ) : (
                                        vipDescriptionToDisplay
                                    )}
                                </p>
                            </div>
                            <Button 
                                onClick={upgradeBtn.onClick}
                                variant={activePlanChangeRequest?.status === 'quoted' ? 'primary' : 'secondary'}
                                className={`px-8 py-3 rounded-full font-black uppercase tracking-wider shadow-md ${activePlanChangeRequest?.status === 'quoted' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'border-primary-500 text-primary-700 hover:bg-blue-100'}`}
                                isLoading={isRequestingPlanChange}
                                disabled={upgradeBtn.disabled}
                            >
                                {upgradeBtn.text}
                            </Button>
                        </CardContent>
                    </Card>
                )}
                
                <EventSchedulerCard
                    client={clientData}
                    poolEvents={poolEvents}
                    createPoolEvent={createPoolEvent}
                    showNotification={showNotification}
                />

                <Card data-tour-id="visit-history">
                    <CardHeader data-tour-id="visit-history-header"><h3 className="text-xl font-semibold">Histórico de Visitas</h3></CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                        {clientData.visitHistory && clientData.visitHistory.length > 0 ?
                            [...clientData.visitHistory].sort((a, b) => (toDate(b.timestamp)?.getTime() || 0) - (toDate(a.timestamp)?.getTime() || 0)).map(visit => (
                                <div key={visit.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="font-semibold text-sm">
                                        {toDate(visit.timestamp)?.toLocaleString('pt-BR')}
                                        <span className="font-normal text-gray-500"> por {visit.technicianName}</span>
                                    </p>
                                    <p className="text-xs mt-1">
                                        <span title="pH">pH: {visit.ph}</span> | 
                                        <span title="Cloro"> Cl: {visit.cloro}</span> | 
                                        <span title="Alcalinidade"> Alc: {visit.alcalinidade}</span> | 
                                        <span className={`font-bold ${visit.uso === 'Livre para uso' ? 'text-green-500' : 'text-yellow-500'}`}> {visit.uso}</span>
                                    </p>
                                    {visit.notes && <p className="mt-1 text-sm italic bg-white dark:bg-gray-800 p-2 rounded">"{visit.notes}"</p>}
                                    {visit.photoUrl && <a href={visit.photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:underline mt-1 inline-block">Ver Foto da Visita</a>}
                                </div>
                            ))
                            : <p className="text-gray-500">Nenhum registro de visita encontrado.</p>
                        }
                    </CardContent>
                </Card>

                <Card data-tour-id="pool-status">
                    <CardHeader data-tour-id="pool-status-header"><h3 className="text-xl font-semibold">Status Atual da Piscina</h3></CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div><p className="text-sm text-gray-500">pH</p><p className="text-2xl font-bold">{clientData.poolStatus.ph.toFixed(1)}</p></div>
                        <div><p className="text-sm text-gray-500">Cloro</p><p className="text-2xl font-bold">{clientData.poolStatus.cloro.toFixed(1)}</p></div>
                        <div><p className="text-sm text-gray-500">Alcalinidade</p><p className="text-2xl font-bold">{clientData.poolStatus.alcalinidade}</p></div>
                        <div className={`${clientData.poolStatus.uso === 'Livre para uso' ? 'text-green-500' : 'text-yellow-500'}`}>
                            <p className="text-sm">Uso</p>
                            <p className="text-lg font-bold">{clientData.poolStatus.uso}</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><h3 className="text-xl font-semibold">Próxima Visita</h3></CardHeader>
                        <CardContent className="text-center">
                            {nextVisit ? (
                                <>
                                    <WeatherSunnyIcon className="w-16 h-16 mx-auto text-yellow-400 mb-2"/>
                                    <p className="text-3xl font-bold">{nextVisit.day}</p>
                                    <p className="text-gray-500">Previsão: Ensolarado, 28°C</p>
                                    {nextVisit.isRouteActive && (
                                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                                            <p className="text-green-600 dark:text-green-400 font-bold text-sm animate-pulse flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                                Equipe em rota!
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : <p className="text-gray-500 py-4 italic">Nenhuma visita agendada para esta semana.</p>}
                        </CardContent>
                    </Card>
                     <Card data-tour-id="payment">
                        <CardHeader data-tour-id="payment-header"><h3 className="text-xl font-semibold">Pagamento</h3></CardHeader>
                        <CardContent className="flex flex-col justify-between h-full">
                             <div>
                                <p className="text-gray-500">Mensalidade</p>
                                <p className="text-2xl font-bold">R$ {monthlyFee.toFixed(2)}</p>
                                <p className="text-gray-500 mt-2">Próximo Vencimento</p>
                                <p className="text-3xl font-bold mb-2">{new Date(clientData.payment.dueDate).toLocaleDateString('pt-BR')}</p>
                                 <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                                    <p className="text-xs">Pague com PIX:</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <p className="font-mono text-sm">{pixKeyToDisplay}</p>
                                        <button onClick={() => pixKeyToDisplay && copyToClipboard(pixKeyToDisplay)} className="text-gray-500 hover:text-primary-500">
                                            <CopyIcon className="w-4 h-4"/>
                                        </button>
                                    </div>
                                 </div>
                             </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader><h3 className="text-xl font-semibold">Minha Conta</h3></CardHeader>
                    <CardContent>
                        <p><strong>Nome:</strong> {clientData.name}</p>
                        <p><strong>Email:</strong> {clientData.email}</p>
                        <p><strong>Telefone:</strong> {clientData.phone}</p>
                        <hr className="my-4 dark:border-gray-700"/>
                        <h4 className="font-semibold mb-2">Alterar Senha</h4>
                        <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <Input label="Nova Senha" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} containerClassName="mb-0"/>
                            <Input label="Confirmar Senha" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} containerClassName="mb-0"/>
                            <Button type="submit" isLoading={isSavingPassword}>Salvar Senha</Button>
                        </form>
                    </CardContent>
                </Card>

            </div>

            <div className="lg:col-span-1 space-y-6">
                
                {currentPlanDetails && (
                    <Card data-tour-id="plan-info">
                        <CardHeader data-tour-id="plan-info-header">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckBadgeIcon className="w-6 h-6 text-primary-500" />
                                    <h3 className="text-xl font-semibold">Meu Plano Atual</h3>
                                </div>
                                {clientData.scheduledPlanChange && (
                                    <div className="animate-pulse" title="Sua mudança para VIP está agendada para o próximo ciclo financeiro.">
                                        <SparklesIcon className="w-6 h-6 text-yellow-500" />
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <h4 className={`text-2xl font-bold mb-1 ${currentPlanDetails.planType === 'VIP' ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary-600 dark:text-primary-400'}`}>
                                    {currentPlanDetails.title}
                                </h4>
                                {clientData.scheduledPlanChange && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                                        Upgrade Agendado (VIP)
                                    </span>
                                )}
                            </div>
                            
                            {currentPlanDetails.fidelity && (
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">
                                    Fidelidade: {currentPlanDetails.fidelity.months} Meses ({currentPlanDetails.fidelity.discountPercent}% OFF)
                                </p>
                            )}
                            
                            <div className="space-y-2 mb-6">
                                <p className="font-semibold text-gray-700 dark:text-gray-300">Benefícios Inclusos:</p>
                                <ul className="space-y-1">
                                    {currentPlanDetails.benefits.map((benefit: string, idx: number) => (
                                        <li key={idx} className="flex items-start text-sm">
                                            <CheckIcon className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                            <span>{benefit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <Button 
                                variant="secondary" 
                                size="sm" 
                                className="w-full"
                                onClick={() => setIsTermsModalOpen(true)}
                            >
                                Ler Termos e Condições
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <Card data-tour-id="client-stock">
                    <CardHeader data-tour-id="client-stock-header"><h3 className="text-xl font-semibold">Meus Produtos</h3></CardHeader>
                    <CardContent className="space-y-3 max-h-[80vh] overflow-y-auto">
                        {clientData.stock.length > 0 ? clientData.stock.map(item => {
                            const max = item.maxQuantity || 5;
                            const percentage = Math.min(100, (item.quantity / max) * 100);
                            const lowStock = item.quantity <= (item.maxQuantity ? item.maxQuantity * 0.3 : (settings?.automation.replenishmentStockThreshold || 2));
                            
                            return (
                                <div key={item.productId} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                            {item.quantity} / {max}
                                        </p>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                                        <div 
                                            className={`h-2.5 rounded-full ${lowStock ? 'bg-red-500' : 'bg-green-500'}`} 
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                    {lowStock && <p className="text-xs text-red-500 font-semibold mt-1">Estoque baixo</p>}
                                </div>
                            );
                        }) : <p>Nenhum produto em seu estoque.</p>}
                    </CardContent>
                </Card>
            </div>

            {isEmergencyModalOpen && (
                <Modal 
                    isOpen={isEmergencyModalOpen} 
                    onClose={() => setIsEmergencyModalOpen(false)} 
                    title="Solicitar Emergência VIP"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setIsEmergencyModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleEmergencyRequest} isLoading={isSubmittingEmergency}>Enviar Alerta</Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 rounded text-sm text-red-800 dark:text-red-200">
                            <p className="font-bold mb-1">Atenção!</p>
                            <p>O serviço de emergência é exclusivo para situações críticas. Você tem <strong>{2 - currentMonthEmergencies} créditos</strong> de emergência para este mês.</p>
                        </div>
                        <textarea
                            className="w-full p-3 border rounded-md dark:bg-gray-900 dark:border-gray-700 focus:ring-red-500 focus:border-red-500"
                            rows={4}
                            placeholder="Descreva brevemente o problema (ex: vazamento, água turva antes de evento, erro técnico...)"
                            value={emergencyReason}
                            onChange={(e) => setEmergencyReason(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">Ao enviar, o administrador será notificado imediatamente para remanejar a rota e atendê-lo com prioridade.</p>
                    </div>
                </Modal>
            )}

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

            {isPlanUpgradeModalOpen && activePlanChangeRequest && (
                <Modal
                    isOpen={isPlanUpgradeModalOpen}
                    onClose={() => setIsPlanUpgradeModalOpen(false)}
                    title="✨ Sua Piscina no Nível VIP"
                    size="lg"
                    footer={
                        <div className="flex flex-col sm:flex-row justify-between w-full items-center gap-4">
                            <button onClick={handleRejectPlanChange} className="text-sm font-bold text-red-500 hover:underline uppercase tracking-widest order-2 sm:order-1">Não tenho interesse</button>
                            <Button 
                                onClick={handleAcceptPlanChange} 
                                isLoading={isRequestingPlanChange}
                                disabled={!hasAcceptedUpgradeTerms || isRequestingPlanChange}
                                className={`w-full sm:w-auto px-12 py-4 rounded-full font-black text-lg shadow-xl order-1 sm:order-2 ${hasAcceptedUpgradeTerms ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/30 animate-bounce-slow' : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'}`}
                            >
                                Confirmar Upgrade VIP
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
                                 <SparklesIcon className="w-10 h-10 text-yellow-600" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100">Parabéns pela decisão!</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">
                                Você está a um passo de ter <strong>atendimento de emergência</strong> e uma piscina sempre cristalina sem preocupações.
                            </p>
                        </div>

                        {activePlanChangeRequest.adminNotes && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 italic text-sm text-blue-800 dark:text-blue-200">
                                "{activePlanChangeRequest.adminNotes}"
                            </div>
                        )}

                        <div className="space-y-4">
                            <p className="font-black text-sm uppercase tracking-widest text-gray-500">Escolha o seu plano de fidelidade:</p>
                            <div className="grid grid-cols-1 gap-3">
                                {upgradeOptions.map((option, idx) => (
                                    <div 
                                        key={option.id}
                                        onClick={() => setSelectedUpgradeOptionId(option.id)}
                                        className={`p-4 border-2 rounded-2xl cursor-pointer transition-all flex justify-between items-center relative overflow-hidden group ${selectedUpgradeOptionId === option.id ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 ring-2 ring-yellow-500 ring-offset-2 dark:ring-offset-gray-900' : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300'}`}
                                    >
                                        {idx === 0 && (
                                            <div className="absolute -left-10 top-2 bg-yellow-500 text-white text-[10px] font-black px-10 py-1 -rotate-45 uppercase tracking-tighter">
                                                Melhor Valor
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedUpgradeOptionId === option.id ? 'border-yellow-500 bg-yellow-500' : 'border-gray-300'}`}>
                                                {selectedUpgradeOptionId === option.id && <CheckIcon className="w-4 h-4 text-white" />}
                                            </div>
                                            <div>
                                                <p className="font-black text-lg text-gray-900 dark:text-gray-100">{option.title}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">-{option.discountPercent}% OFF</span>
                                                    <span className="text-xs text-gray-400 line-through">R$ {option.basePrice.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">
                                                R$ {option.price.toFixed(2)}<span className="text-xs text-gray-500 font-normal">/mês</span>
                                            </p>
                                            <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Economize R$ {option.savings.toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-200 dark:border-yellow-700/50 mt-4">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={hasAcceptedUpgradeTerms}
                                    onChange={(e) => setHasAcceptedUpgradeTerms(e.target.checked)}
                                    className="mt-1 h-5 w-5 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500 cursor-pointer"
                                />
                                <div className="text-sm">
                                    <p className="font-bold text-yellow-800 dark:text-yellow-200">Declaração de Aceite</p>
                                    <p className="text-yellow-700 dark:text-yellow-400">
                                        Li e concordo integralmente com os <button type="button" onClick={() => setIsTermsModalOpen(true)} className="underline font-bold hover:text-yellow-600">Termos e Condições de Uso</button> do Plano VIP.
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                            <p className="font-bold text-xs uppercase tracking-widest text-gray-400 mb-3 text-center">Você terá acesso a:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {vipBenefitsList.slice(0, 4).map((b, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                        <CheckBadgeIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                                        <span>{b}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {isTermsModalOpen && currentPlanDetails && (
                <Modal
                    isOpen={isTermsModalOpen}
                    onClose={() => setIsTermsModalOpen(false)}
                    title={`Termos do Serviço - ${currentPlanDetails.title}`}
                    size="lg"
                    footer={<Button onClick={() => setIsTermsModalOpen(false)}>Fechar</Button>}
                >
                    <div className="prose dark:prose-invert max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                            {currentPlanDetails.terms || "Termos não disponíveis no momento."}
                        </p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const PriceChangeNotificationCard = ({ notification, currentFee, client, settings }: any) => {
    return (
        <div className="p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-800 rounded-md">
            <h4 className="font-bold flex items-center"><CurrencyDollarIcon className="w-5 h-5 mr-2"/> Atualização de Preço</h4>
            <p>A partir de {toDate(notification.effectiveDate)?.toLocaleDateString()}, sua mensalidade será reajustada.</p>
        </div>
    );
};

const RecessNotificationCard = ({ recesses }: { recesses: RecessPeriod[] }) => (
    <div className="space-y-2">
        {recesses.map(r => (
            <div key={r.id} className="p-4 bg-orange-100 border-l-4 border-orange-500 text-orange-800 rounded-md">
                <h4 className="font-bold flex items-center"><CalendarDaysIcon className="w-5 h-5 mr-2"/> {r.name}</h4>
                <p>Estaremos de recesso entre {toDate(r.startDate)?.toLocaleDateString()} e {toDate(r.endDate)?.toLocaleDateString()}.</p>
            </div>
        ))}
    </div>
);

const ReplenishmentCard = ({ quote, client, updateStatus, createOrder, showNotification }: any) => {
    const [loading, setLoading] = useState(false);
    const handleApprove = async () => {
        setLoading(true);
        try {
            await createOrder({
                clientId: client.id,
                clientName: client.name,
                items: quote.items,
                total: quote.total,
                status: 'Pendente'
            });
            await updateStatus(quote.id, 'approved');
            showNotification("Pedido criado com sucesso!", "success");
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };
    return (
        <Card className="border-l-4 border-green-500">
            <CardHeader><h3 className="font-bold">Sugestão de Reposição de Produtos</h3></CardHeader>
            <CardContent>
                <p>Detectamos que alguns produtos estão acabando. Deseja repor?</p>
                <p className="font-bold">Total: R$ {quote.total.toFixed(2)}</p>
                <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handleApprove} isLoading={loading}>Aprovar e Pedir</Button>
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(quote.id, 'rejected')}>Dispensar</Button>
                </div>
            </CardContent>
        </Card>
    );
};

const RequestStatusCard = ({ request }: any) => {
    const isApproved = request.status === 'approved';
    const isRejected = request.status === 'rejected';
    const isPending = request.status === 'pending';

    const getStatusText = () => {
        if (isPending) return 'Em análise';
        if (isApproved) return 'Aprovado';
        if (isRejected) return 'Rejeitado';
        return request.status;
    };

    const getBorderClass = () => {
        if (isPending) return 'border-yellow-500';
        if (isApproved) return 'border-green-500';
        if (isRejected) return 'border-red-500';
        return 'border-gray-200';
    };

    const getBgClass = () => {
        if (isPending) return 'bg-yellow-50 dark:bg-yellow-900/10';
        if (isApproved) return 'bg-green-50 dark:bg-green-900/10';
        if (isRejected) return 'bg-red-50 dark:bg-red-900/10';
        return 'bg-white dark:bg-gray-800';
    };

    return (
        <Card className={`${getBorderClass()} border-l-4 ${getBgClass()}`}>
            <CardContent className="flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">Status da Solicitação de Adiantamento</h4>
                    <div className="flex items-center gap-2 mt-1">
                        {isApproved && <CheckBadgeIcon className="w-5 h-5 text-green-500" />}
                        <p className={`font-black ${isApproved ? 'text-green-600 dark:text-green-400' : isRejected ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                            Status: {getStatusText()}
                        </p>
                    </div>
                    {isApproved && (
                        <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                            Seu pagamento foi confirmado e seu desconto aplicado! Aproveite a economia.
                        </p>
                    )}
                </div>
                {isApproved && <SparklesIcon className="w-10 h-10 text-green-500 opacity-20" />}
            </CardContent>
        </Card>
    );
};

const EventSchedulerCard = ({ client, poolEvents, createPoolEvent, showNotification }: any) => {
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const clientEvents = useMemo(() => {
        return poolEvents.filter((e: any) => e.clientId === client.uid)
            .sort((a: any, b: any) => (toDate(b.eventDate)?.getTime() || 0) - (toDate(a.eventDate)?.getTime() || 0));
    }, [poolEvents, client.uid]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createPoolEvent({ 
                clientId: client.uid,
                clientName: client.name, 
                eventDate: new Date(date + 'T12:00:00'), 
                notes 
            });
            showNotification("Evento agendado!", "success");
            setDate(''); 
            setNotes('');
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader><h3 className="font-bold flex items-center"><CalendarDaysIcon className="w-5 h-5 mr-2"/> Agendar Uso da Piscina</h3></CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-2">
                    <Input label="Data do Evento" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    <Input label="Observações" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Churrasco..." />
                    <Button type="submit" isLoading={loading} className="w-full">Agendar</Button>
                </form>

                {clientEvents.length > 0 && (
                    <div className="mt-6 pt-4 border-t dark:border-gray-700">
                        <h4 className="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-300">Meus Agendamentos:</h4>
                        <div className="space-y-3">
                            {clientEvents.map((event: any) => {
                                const isConfirmed = event.status === 'acknowledged';
                                return (
                                    <div 
                                        key={event.id} 
                                        className={`p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm border-l-4 shadow-sm transition-all ${isConfirmed ? 'border-green-500' : 'border-yellow-400'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-800 dark:text-gray-100">
                                                    {toDate(event.eventDate)?.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </p>
                                                {isConfirmed && <CheckBadgeIcon className="w-4 h-4 text-green-500" />}
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isConfirmed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                                {isConfirmed ? 'Confirmado' : 'Pendente'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
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
        const discountAmount = originalAmount * (option.discountPercent / 100);
        const finalAmount = originalAmount - discountAmount;
        
        setLoading(true);
        try {
            await onSubmit({
                clientId: client.uid,
                clientName: client.name,
                months: option.months,
                discountPercent: option.discountPercent,
                originalAmount,
                finalAmount
            });
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
            <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 rounded text-sm">
                    <p className="text-blue-800 dark:text-blue-200">
                        Selecione uma das opções abaixo para pagar vários meses de uma vez e garantir um desconto exclusivo. 
                        <strong> Sua economia é calculada na hora!</strong>
                    </p>
                </div>
                
                <div className="space-y-3">
                    {settings.advancePaymentOptions.map((opt: any, idx: number) => {
                        const originalTotal = monthlyFee * opt.months;
                        const discountedTotal = originalTotal * (1 - opt.discountPercent / 100);
                        const savings = originalTotal - discountedTotal;
                        const isSelected = selectedOption === idx;

                        return (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedOption(idx)}
                                className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-primary-400 group ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'}`}>
                                            {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                                        </div>
                                        <div>
                                            <p className="font-black text-lg text-gray-900 dark:text-gray-100">{opt.months} Meses</p>
                                            <p className="text-xs text-gray-500 line-through font-medium">De: R$ {originalTotal.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        {opt.discountPercent}% OFF
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-end pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Total a pagar</p>
                                        <p className="text-3xl font-black text-primary-600 dark:text-primary-400">R$ {discountedTotal.toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 justify-end text-green-600 dark:text-green-400 mb-0.5">
                                            <SparklesIcon className="w-4 h-4" />
                                            <p className="text-xs font-black uppercase">Economia Real</p>
                                        </div>
                                        <p className="text-xl font-black text-green-600 dark:text-green-400">R$ {savings.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t dark:border-gray-700">
                    <Button variant="secondary" onClick={onClose} className="sm:order-1">Cancelar</Button>
                    <Button 
                        onClick={handleSubmit} 
                        isLoading={loading} 
                        disabled={selectedOption === null}
                        className="sm:order-2 px-8"
                    >
                        Confirmar e Solicitar Adiantamento
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ClientDashboardView;


import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { AppContextType, PlanType, Settings, FidelityPlan, BudgetQuote, Client } from '../../types';
import { Spinner } from '../../components/Spinner';
import { normalizeDimension, calculateDrivingDistance, calculateClientMonthlyFee } from '../../utils/calculations';
import BudgetSuccessView from './BudgetSuccessView';
import { Modal } from '../../components/Modal';
import { GuidedTour, TourStep } from '../../components/GuidedTour';
import { QuestionMarkCircleIcon, SparklesIcon, CheckBadgeIcon } from '../../constants';

interface PreBudgetViewProps {
    appContext: AppContextType;
}

const preBudgetTourSteps: TourStep[] = [
    {
        selector: '[data-tour-id="form-title"]',
        position: 'bottom',
        title: 'Bem-vindo ao Tour!',
        content: 'Vamos mostrar como é fácil e rápido calcular um orçamento para a limpeza da sua piscina.',
    },
    {
        selector: '[data-tour-id="dimensions"] legend',
        highlightSelector: '[data-tour-id="dimensions"]',
        position: 'bottom',
        title: '1. Volume da Piscina',
        content: 'Selecione a faixa de volume que mais se aproxima da sua piscina. O valor é calculado automaticamente com base nessa escolha.',
    },
    {
        selector: '[data-tour-id="options"] legend',
        highlightSelector: '[data-tour-id="options"]',
        position: 'bottom',
        title: '2. Opções Adicionais',
        content: 'Marque estas opções se sua piscina usa água de poço ou é usada para festas/eventos, pois isso pode influenciar no tratamento e no valor.',
    },
    {
        selector: '[data-tour-id="plans"] h3',
        highlightSelector: '[data-tour-id="plans"]',
        position: 'bottom',
        title: '3. Selecione um Plano',
        content: 'Escolha o plano que melhor se adapta às suas necessidades. Ao selecionar, você verá os termos de serviço para aceitá-los.',
    },
    {
        selector: '[data-tour-id="personal-data"] legend',
        highlightSelector: '[data-tour-id="personal-data"]',
        position: 'top',
        title: '4. Seus Dados',
        content: 'Preencha seus dados de contato. O e-mail que você informar aqui será usado para seu futuro acesso ao painel do cliente.',
    },
    {
        selector: '[data-tour-id="address-section"] legend',
        highlightSelector: '[data-tour-id="address-section"]',
        position: 'top',
        title: '5. Endereço',
        content: 'Após preencher o endereço, clique no botão para validar a localização. Isso é obrigatório para ver o valor final.',
    },
    {
        selector: '[data-tour-id="final-value"]',
        position: 'top',
        title: 'Valor Final e Envio',
        content: 'Após aceitar os termos e calcular a distância, o valor mensal estimado aparecerá aqui. Se estiver de acordo, clique no botão para enviar sua solicitação.',
    },
];


const PreBudgetView: React.FC<PreBudgetViewProps> = ({ appContext }) => {
    const { settings, loading, createBudgetQuote, showNotification } = appContext;
    const [showSuccessPage, setShowSuccessPage] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        street: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        zip: '',
    });
    const [selectedTierIndex, setSelectedTierIndex] = useState<string>('');
    const [options, setOptions] = useState({
        hasWellWater: false,
        isPartyPool: false,
    });
    
    const [selectedPlanIdentifier, setSelectedPlanIdentifier] = useState('');
    const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTourOpen, setIsTourOpen] = useState(false);

    const [distanceFromHq, setDistanceFromHq] = useState<number | null>(null);
    const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenBudgetTour');
        if (!hasSeenTour) {
            setIsTourOpen(true);
        }
    }, []);

    const handleCloseTour = () => {
        localStorage.setItem('hasSeenBudgetTour', 'true');
        setIsTourOpen(false);
    };

    const selectedPlanType: PlanType = selectedPlanIdentifier === 'simples' ? 'Simples' : 'VIP';
    
    const filteredTiers = useMemo(() => {
        if (!settings) return [];
        return settings.pricing.volumeTiers.filter(tier => tier.max > 3000);
    }, [settings]);

    const tierOptions = useMemo(() => {
        return [
            { value: '', label: 'Selecione o volume da sua piscina...' },
            ...filteredTiers.map((tier, index) => ({
                value: index.toString(),
                label: `De ${tier.min.toLocaleString('pt-BR')} até ${tier.max.toLocaleString('pt-BR')} Litros`
            }))
        ];
    }, [filteredTiers]);

    const selectedFidelityPlan = useMemo(() => {
        if (selectedPlanType === 'VIP' && settings) {
            return settings.fidelityPlans.find(fp => fp.id === selectedPlanIdentifier);
        }
        return undefined;
    }, [selectedPlanIdentifier, selectedPlanType, settings]);

    const isFormComplete = useMemo(() => {
        const requiredFields: (keyof typeof formData)[] = [
            'name', 'email', 'phone', 
            'street', 'number', 'neighborhood', 'city', 'state', 'zip'
        ];
        return requiredFields.every(field => formData[field] && formData[field].trim() !== '') && 
               selectedTierIndex !== '' && 
               selectedPlanIdentifier !== '';
    }, [formData, selectedTierIndex, selectedPlanIdentifier]);

    const volume = useMemo(() => {
        if (selectedTierIndex === '' || !filteredTiers[Number(selectedTierIndex)]) return 0;
        return filteredTiers[Number(selectedTierIndex)].max;
    }, [selectedTierIndex, filteredTiers]);

    const monthlyFee = useMemo(() => {
        if (!settings || volume <= 0 || !hasAgreedToTerms || !selectedPlanIdentifier) return 0;

        const tempClient: Partial<Client> = {
            poolVolume: volume,
            hasWellWater: options.hasWellWater,
            isPartyPool: options.isPartyPool,
            includeProducts: false,
            plan: selectedPlanType,
            fidelityPlan: selectedFidelityPlan,
            distanceFromHq: distanceFromHq || 0,
        };

        return calculateClientMonthlyFee(tempClient, settings);
    }, [volume, options, selectedPlanType, selectedFidelityPlan, settings, distanceFromHq, hasAgreedToTerms, selectedPlanIdentifier]);

    const handlePlanSelect = (identifier: string) => {
        setSelectedPlanIdentifier(identifier);
        setHasAgreedToTerms(false);
        setIsTermsModalOpen(true);
    };

    const handleAcceptTerms = () => {
        setHasAgreedToTerms(true);
        setIsTermsModalOpen(false);
        showNotification('Termos aceitos! O cálculo do orçamento foi liberado.', 'success');
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'zip') {
            const formattedCep = value
                .replace(/\D/g, '')
                .replace(/(\d{5})(\d)/, '$1-$2')
                .slice(0, 9);
            setFormData({ ...formData, zip: formattedCep });
        } else {
            setFormData({ ...formData, [name]: value });
        }
        if (['street', 'number', 'city', 'neighborhood', 'state'].includes(name)) {
            setDistanceFromHq(null);
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOptions({ ...options, [e.target.name]: e.target.checked });
    };

    const handleCalculateDistance = async () => {
        if (!settings) return;
        const { street, number, neighborhood, city, state } = formData;
        if (!street || !neighborhood || !city || !state) {
            showNotification('Preencha os campos de endereço antes de validar.', 'error');
            return;
        }

        setIsCalculatingDistance(true);
        try {
            // Formatação mais robusta para geocodificação (separada por vírgulas)
            const origin = `${settings.baseAddress.street}, ${settings.baseAddress.number}, ${settings.baseAddress.neighborhood}, ${settings.baseAddress.city}, ${settings.baseAddress.state}, Brasil`;
            const destination = `${street}, ${number}, ${neighborhood}, ${city}, ${state}, Brasil`;
            
            const km = await calculateDrivingDistance(origin, destination);

            if (km >= 0) {
                setDistanceFromHq(km);
                showNotification(`Endereço validado! Distância: ${km} km.`, 'success');
            } else {
                throw new Error("Distância inválida.");
            }
        } catch (error: any) {
            console.error(error);
            const msg = error.message.includes("origem") 
                ? "Erro: O endereço base da empresa não foi configurado corretamente pelo administrador."
                : error.message || "Erro ao validar endereço.";
            showNotification(msg, 'error');
        } finally {
            setIsCalculatingDistance(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!isFormComplete || !hasAgreedToTerms) {
            showNotification("Por favor, preencha todos os campos e aceite os termos.", "error");
            return;
        }
        if (volume <= 0) {
             showNotification("Selecione uma faixa de volume válida.", "error");
             return;
        }
        if (distanceFromHq === null) {
            showNotification("Por favor, clique em 'Validar Endereço' antes de finalizar.", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const budgetData: Omit<BudgetQuote, 'id' | 'status' | 'createdAt'> = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                address: {
                    street: formData.street,
                    number: formData.number,
                    neighborhood: formData.neighborhood,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                },
                poolDimensions: { width: 0, length: 0, depth: 0 },
                poolVolume: volume,
                hasWellWater: options.hasWellWater,
                isPartyPool: options.isPartyPool,
                plan: selectedPlanType,
                monthlyFee: monthlyFee,
                distanceFromHq: distanceFromHq,
            };

            if (selectedPlanType === 'VIP' && selectedFidelityPlan) {
                budgetData.fidelityPlan = selectedFidelityPlan;
            }

            await createBudgetQuote(budgetData);
            setShowSuccessPage(true);
        } catch (error: any) {
            showNotification(error.message || "Falha ao enviar orçamento.", 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading.settings) {
        return <div className="flex justify-center items-center p-8"><Spinner /></div>;
    }

    if (!settings) {
        return <div className="text-center p-8 text-red-500">Configurações indisponíveis.</div>;
    }

    if (showSuccessPage) {
        return <BudgetSuccessView onGoBack={() => setShowSuccessPage(false)} />;
    }

    return (
        <div data-tour-id="welcome">
            <GuidedTour steps={preBudgetTourSteps} isOpen={isTourOpen} onClose={handleCloseTour} />
            <div className="flex justify-between items-center mb-6">
                 <h2 data-tour-id="form-title" className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200">Calculadora de Orçamento</h2>
                 <button
                    onClick={() => setIsTourOpen(true)}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    title="Fazer tour guiado"
                >
                    <QuestionMarkCircleIcon className="w-6 h-6" />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                
                <fieldset data-tour-id="dimensions" className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">1. Volume da Piscina</legend>
                    <div className="mt-2">
                        <Select
                            label="Selecione a capacidade da sua piscina"
                            value={selectedTierIndex}
                            onChange={(e) => setSelectedTierIndex(e.target.value)}
                            options={tierOptions}
                        />
                    </div>
                </fieldset>

                <fieldset data-tour-id="options" className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">2. Opções Adicionais</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 items-center">
                        <div className="space-y-2">
                            <label className="flex items-center gap-3">
                                <input type="checkbox" name="hasWellWater" checked={options.hasWellWater} onChange={handleCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                                Água de poço
                            </label>
                            <label className="flex items-center gap-3">
                                <input type="checkbox" name="isPartyPool" checked={options.isPartyPool} onChange={handleCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                                Piscina para eventos/festa?
                            </label>
                        </div>
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-3 rounded-r-lg">
                            <p className="text-sm font-bold">Não trabalhamos com IGUI/SPLASH.</p>
                        </div>
                    </div>
                </fieldset>
                
                 <div data-tour-id="plans">
                    <h3 className="text-lg font-semibold text-center mb-4">3. Selecione um Plano</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PlanCard 
                            title={settings.plans.simple.title}
                            benefits={settings.plans.simple.benefits}
                            isSelected={selectedPlanIdentifier === 'simples'} 
                            onSelect={() => handlePlanSelect('simples')} 
                        />
                        {!settings.features.vipPlanEnabled && (
                             <div className="p-6 border-2 rounded-lg relative bg-gray-200 dark:bg-gray-700 opacity-60 cursor-not-allowed">
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-500/50 rounded-lg">
                                    <span className="px-3 py-1 bg-gray-800 text-white text-sm font-bold rounded-full">{settings.features.vipPlanDisabledMessage}</span>
                                </div>
                                <h4 className="text-xl font-bold text-center">{settings.plans.vip.title}</h4>
                            </div>
                        )}
                    </div>
                    {settings.features.vipPlanEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            {settings.fidelityPlans.map(plan => (
                                <PlanCard
                                    key={plan.id}
                                    title={`${settings.plans.vip.title} ${plan.months} Meses`}
                                    benefits={[`${plan.discountPercent}% de Desconto`, ...settings.plans.vip.benefits]}
                                    isSelected={selectedPlanIdentifier === plan.id}
                                    onSelect={() => handlePlanSelect(plan.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {selectedPlanIdentifier && (
                    <div className={`p-4 border rounded-lg transition-all ${hasAgreedToTerms ? 'bg-green-50 border-green-200 dark:bg-green-900/10' : 'bg-blue-50 border-blue-200 dark:bg-blue-900/10'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {hasAgreedToTerms ? <CheckBadgeIcon className="w-6 h-6 text-green-500" /> : <QuestionMarkCircleIcon className="w-6 h-6 text-blue-500" />}
                                <span className="font-semibold text-sm">
                                    {hasAgreedToTerms ? 'Termos de Serviço Aceitos' : 'Aceite os termos para ver o orçamento'}
                                </span>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setIsTermsModalOpen(true)}>
                                {hasAgreedToTerms ? 'Revisar Termos' : 'Ler e Aceitar Termos'}
                            </Button>
                        </div>
                    </div>
                )}

                <fieldset data-tour-id="personal-data" className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">4. Seus Dados</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                        <Input label="Nome Completo" name="name" value={formData.name} onChange={handleInputChange} required />
                        <Input label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                        <Input label="Telefone" name="phone" value={formData.phone} onChange={handleInputChange} required />
                    </div>
                </fieldset>

                <fieldset data-tour-id="address-section" className="border p-4 rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">5. Endereço e Validação</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mt-2">
                        <Input containerClassName="sm:col-span-2" label="CEP" name="zip" value={formData.zip} onChange={handleInputChange} required maxLength={9} />
                        <Input containerClassName="sm:col-span-4" label="Rua" name="street" value={formData.street} onChange={handleInputChange} required />
                        <Input containerClassName="sm:col-span-2" label="Número" name="number" value={formData.number} onChange={handleInputChange} required />
                        <Input containerClassName="sm:col-span-4" label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleInputChange} required />
                        <Input containerClassName="sm:col-span-4" label="Cidade" name="city" value={formData.city} onChange={handleInputChange} required />
                        <Input containerClassName="sm:col-span-2" label="UF" name="state" value={formData.state} onChange={handleInputChange} required maxLength={2} />
                    </div>
                    
                    <div className="mt-4 flex flex-col items-center">
                        <Button type="button" onClick={handleCalculateDistance} isLoading={isCalculatingDistance} disabled={!formData.street || !formData.city || distanceFromHq !== null} variant={distanceFromHq !== null ? 'secondary' : 'primary'}>
                            <SparklesIcon className="w-5 h-5 mr-2" />
                            {distanceFromHq !== null ? 'Endereço Validado ✓' : 'Validar Endereço'}
                        </Button>
                    </div>
                </fieldset>
                
                {isFormComplete && distanceFromHq !== null && hasAgreedToTerms ? (
                    <div data-tour-id="final-value" className="text-center p-4 bg-primary-50 dark:bg-primary-900/50 rounded-lg animate-fade-in border-2 border-primary-200">
                        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Valor Mensal Estimado:</p>
                        <p className="text-4xl font-bold text-primary-600 dark:text-primary-400">R$ {monthlyFee.toFixed(2).replace('.', ',')}</p>
                        <p className="text-sm text-gray-500 mt-1">Cálculo validado para {distanceFromHq} km.</p>
                    </div>
                ) : selectedPlanIdentifier && (
                    <div className="text-center p-4 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 italic">
                        {!hasAgreedToTerms ? 'Aceite os termos para liberar o cálculo do valor.' : 'Preencha o endereço e valide para ver o valor.'}
                    </div>
                )}

                <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg" disabled={!isFormComplete || !hasAgreedToTerms || distanceFromHq === null || isSubmitting}>
                    Enviar Solicitação de Orçamento
                </Button>
            </form>
            
            {isTermsModalOpen && settings && (
                <Modal
                    isOpen={isTermsModalOpen}
                    onClose={() => {
                        setIsTermsModalOpen(false);
                        if (!hasAgreedToTerms) setSelectedPlanIdentifier('');
                    }}
                    title={`Termos do Serviço - ${selectedPlanType === 'Simples' ? settings.plans.simple.title : settings.plans.vip.title}`}
                    size="lg"
                    footer={
                        <div className="flex justify-between w-full items-center">
                             <Button variant="secondary" onClick={() => { setIsTermsModalOpen(false); if(!hasAgreedToTerms) setSelectedPlanIdentifier(''); }}>Cancelar</Button>
                             <Button onClick={handleAcceptTerms}>Li e Aceito os Termos</Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="prose dark:prose-invert max-h-64 overflow-y-auto p-4 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                            <p className="whitespace-pre-wrap text-sm">{selectedPlanType === 'Simples' ? settings.plans.simple.terms : settings.plans.vip.terms}</p>
                        </div>
                        <p className="text-xs text-gray-500">Ao clicar em "Aceitar", você confirma que leu e concorda com as condições de serviço acima para o plano selecionado.</p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

interface PlanCardProps {
    title: string;
    benefits: string[];
    isSelected: boolean;
    onSelect: () => void;
    disabled?: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({ title, benefits, isSelected, onSelect, disabled = false }) => {
    const baseClasses = "p-6 border-2 rounded-lg transition-all duration-300 relative";
    const selectedClasses = 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900';
    const unselectedClasses = 'border-gray-300 dark:border-gray-600';
    const enabledClasses = 'cursor-pointer hover:border-primary-400';
    const disabledClasses = 'bg-gray-200 dark:bg-gray-700 opacity-60 cursor-not-allowed';

    return (
        <div onClick={() => !disabled && onSelect()} className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses} ${disabled ? disabledClasses : enabledClasses}`}>
            {isSelected && <div className="absolute top-2 right-2 bg-primary-500 text-white p-1 rounded-full"><CheckBadgeIcon className="w-4 h-4" /></div>}
            <h4 className="text-xl font-bold text-center">{title}</h4>
            <ul className="mt-4 space-y-2 list-disc list-inside text-gray-600 dark:text-gray-300 text-sm">
                {benefits.map((benefit, i) => <li key={i}>{benefit}</li>)}
            </ul>
        </div>
    )
}

export default PreBudgetView;

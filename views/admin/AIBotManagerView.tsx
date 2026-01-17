import React, { useState, useMemo, useEffect } from 'react';
import { AppContextType, Settings } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { SparklesIcon, CheckBadgeIcon, CopyIcon, UsersIcon } from '../../constants';
import { GoogleGenAI } from "@google/genai";

interface AIBotManagerViewProps {
    appContext: AppContextType;
}

const AIBotManagerView: React.FC<AIBotManagerViewProps> = ({ appContext }) => {
    const { settings, updateSettings, showNotification, clients } = appContext;
    const [isSaving, setIsSaving] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [chatHistory, setChatHistory] = useState<{role: 'user' | 'bot', text: string}[]>([]);
    const [userInput, setUserInput] = useState('');

    const [botConfig, setBotConfig] = useState(settings?.aiBot || {
        enabled: true,
        name: 'SOS Piscina Bot',
        instructions: 'Você é o assistente virtual da S.O.S Piscina Limpa. Seja educado e direto. Use emojis de piscina e água.',
        whatsappAutoReply: true
    });

    const systemPrompt = useMemo(() => {
        if (!settings) return '';
        
        const tiers = settings.pricing.volumeTiers.map(t => `- De ${t.min} a ${t.max} Litros: R$ ${t.price}`).join('\n');
        const activeClients = clients.filter(c => c.clientStatus === 'Ativo');
        
        return `
        PERSONA: ${botConfig.name}.
        CONTEXTO: Assistente de atendimento da empresa ${settings.companyName}.
        INSTRUÇÕES ADICIONAIS: ${botConfig.instructions}
        
        REGRAS DE NEGÓCIO (TABELA ATUAL):
        ${tiers}
        - Taxa Água de Poço: R$ ${settings.pricing.wellWaterFee}
        - Taxa Piscina de Festa: R$ ${settings.pricing.partyPoolFee}
        - Valor por KM excedente (Raio > ${settings.pricing.serviceRadius}km): R$ ${settings.pricing.perKm}
        
        DADOS DE CLIENTES ATIVOS (Para consultas):
        ${activeClients.map(c => `- ${c.name}, Vencimento: ${c.payment.dueDate.split('T')[0]}, Status: ${c.payment.status}, Plano: ${c.plan}`).join('\n')}
        
        TAREFAS:
        1. Se o cliente pedir orçamento, pergunte as medidas (largura, comprimento, profundidade) ou o volume em litros.
        2. Se ele informar as medidas, calcule o volume (C x L x P * 1000) e dê o preço mensal base conforme a tabela.
        3. Se for um cliente ativo perguntando de vencimento, informe a data baseada nos dados acima.
        4. SEMPRE responda de forma curta e amigável.
        5. Se não souber algo, peça para falar com um humano.
        `.trim();
    }, [settings, botConfig, clients]);

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ aiBot: botConfig });
            showNotification('Configurações do robô salvas!', 'success');
        } catch (error) {
            showNotification('Erro ao salvar.', 'error');
        } finally {
            setIsSaving(true);
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    const handleSendMessage = async () => {
        if (!userInput.trim() || isSimulating) return;

        const newMsg = { role: 'user' as const, text: userInput };
        setChatHistory(prev => [...prev, newMsg]);
        setUserInput('');
        setIsSimulating(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const model = 'gemini-3-flash-preview';
            
            const contents = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                ...chatHistory.map(h => ({ role: h.role === 'bot' ? 'model' : 'user', parts: [{ text: h.text }] })),
                { role: 'user', parts: [{ text: userInput }] }
            ];

            const response = await ai.models.generateContent({
                model,
                contents: contents as any,
                config: { temperature: 0.7 }
            });

            const botText = response.text || "Desculpe, tive um erro ao processar.";
            setChatHistory(prev => [...prev, { role: 'bot', text: botText }]);
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'bot', text: "Erro na conexão com a Inteligência Artificial." }]);
        } finally {
            setIsSimulating(false);
        }
    };

    const copyPrompt = () => {
        navigator.clipboard.writeText(systemPrompt);
        showNotification('Instruções copiadas para a área de transferência!', 'info');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-purple-600 flex items-center gap-3">
                    <SparklesIcon className="w-10 h-10" />
                    Robô Inteligente (WhatsApp/Chat)
                </h2>
                <Button onClick={handleSaveConfig} isLoading={isSaving}>Salvar Configurações</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configurações do Bot */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader><h3 className="font-bold">Personalidade do Assistente</h3></CardHeader>
                        <CardContent className="space-y-4">
                            <Input 
                                label="Nome do Robô" 
                                value={botConfig.name} 
                                onChange={e => setBotConfig({...botConfig, name: e.target.value})} 
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruções de Comportamento</label>
                                <textarea 
                                    className="w-full p-3 border rounded-md dark:bg-gray-900 dark:border-gray-700 text-sm h-32"
                                    value={botConfig.instructions}
                                    onChange={e => setBotConfig({...botConfig, instructions: e.target.value})}
                                    placeholder="Ex: Seja muito formal, use o nome do cliente..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-purple-50 dark:bg-purple-900/10 border-purple-200">
                        <CardHeader className="flex justify-between items-center">
                            <h3 className="font-bold text-purple-800 dark:text-purple-300">Prompt do Sistema (Lógica de Orçamento)</h3>
                            <Button size="sm" variant="secondary" onClick={copyPrompt}>
                                <CopyIcon className="w-4 h-4 mr-1" /> Copiar
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-purple-700 dark:text-purple-400 mb-4">
                                Esta é a "inteligência" que você deve colar na sua ferramenta de WhatsApp (Typebot, n8n, etc). Ela contém seus preços e dados atuais.
                            </p>
                            <div className="max-h-64 overflow-y-auto p-3 bg-white dark:bg-gray-950 rounded border text-[10px] font-mono whitespace-pre-wrap">
                                {systemPrompt}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Simulador de Chat */}
                <Card className="flex flex-col h-[700px]">
                    <CardHeader className="bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                            <h3 className="font-bold">Simulador de Atendimento</h3>
                        </div>
                        <button onClick={() => setChatHistory([])} className="text-xs text-red-500 font-bold uppercase">Limpar Chat</button>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#e5ddd5] dark:bg-gray-950/50">
                        {chatHistory.length === 0 && (
                            <div className="text-center py-10">
                                <SparklesIcon className="w-12 h-12 mx-auto text-purple-300" />
                                <p className="text-gray-500 text-sm mt-2">Envie um oi para testar o orçamento automático.</p>
                            </div>
                        )}
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-lg shadow-sm text-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-[#dcf8c6] dark:bg-primary-900 text-gray-900 dark:text-white rounded-tr-none' 
                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isSimulating && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                                    <Spinner size="sm" />
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
                        <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                            <input 
                                type="text"
                                className="flex-1 p-2 border rounded-full px-4 focus:ring-2 focus:ring-purple-500 dark:bg-gray-900 dark:border-gray-700 outline-none"
                                placeholder="Digite como se fosse o cliente..."
                                value={userInput}
                                onChange={e => setUserInput(e.target.value)}
                            />
                            <Button className="rounded-full !p-2" type="submit" disabled={isSimulating}>
                                <svg className="w-6 h-6 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AIBotManagerView;
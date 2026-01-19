import React, { useState, useEffect, useRef } from 'react';
import { AppContextType, Settings, Client } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { Select } from '../../components/Select';
import { SparklesIcon, CopyIcon, SettingsIcon, CheckBadgeIcon, UsersIcon, MenuIcon, XMarkIcon, QuestionMarkCircleIcon, ChartBarIcon, ExclamationTriangleIcon } from '../../constants';
import { GoogleGenAI, Type } from "@google/genai";

interface AIBotManagerViewProps {
    appContext: AppContextType;
}

interface TestMessage {
    role: 'user' | 'model';
    text: string;
    isFunction?: boolean;
}

const AIBotManagerView: React.FC<AIBotManagerViewProps> = ({ appContext }) => {
    const { settings, updateSettings, showNotification, clients } = appContext;
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'test' | 'guide'>('config');
    
    // Config State
    const [localBotSettings, setLocalBotSettings] = useState<Settings['aiBot']>({
        enabled: false,
        name: 'SOS Bot',
        systemInstructions: '',
        humanHandoffMessage: 'Aguarde um instante, estou chamando um atendente humano para você!',
        autoSchedulingEnabled: true
    });

    // Test Simulator State
    const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [selectedClientToSimulate, setSelectedClientToSimulate] = useState<string>('visitor');
    const [isThinking, setIsThinking] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (settings?.aiBot) {
            setLocalBotSettings(settings.aiBot);
        }
    }, [settings]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [testMessages, isThinking]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ aiBot: localBotSettings });
            showNotification('Configurações do Robô atualizadas!', 'success');
        } catch (error) {
            showNotification('Erro ao salvar configurações.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || isThinking) return;

        const userMsg = inputMessage;
        setInputMessage('');
        setTestMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsThinking(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
            
            const client = selectedClientToSimulate === 'visitor' 
                ? null 
                : clients.find(c => c.id === selectedClientToSimulate);

            const tools = [{
                functionDeclarations: [
                    {
                        name: 'agendar_festa_piscina',
                        description: 'Registra um evento de uso da piscina.',
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                data: { type: Type.STRING },
                                motivo: { type: Type.STRING }
                            },
                            required: ['data']
                        }
                    },
                    {
                        name: 'chamar_atendente',
                        description: 'Transfere para humano.',
                        parameters: { type: Type.OBJECT, properties: { razao: { type: Type.STRING } } }
                    }
                ]
            }];

            const systemInstruction = `
                VOCÊ: ${localBotSettings.name} 🌊.
                REGRAS DO ADMIN: ${localBotSettings.systemInstructions}
                
                CONTEXTO SIMULADO:
                - Nome: ${client?.name || "Visitante"}
                - Status: ${client ? 'CLIENTE CADASTRADO' : 'NÃO CADASTRADO'}
                - Vencimento: ${client?.payment?.dueDate ? new Date(client.payment.dueDate).toLocaleDateString('pt-BR') : 'Sem dados'}
                
                TABELA DE PREÇOS ATUAL:
                ${JSON.stringify(settings?.pricing?.volumeTiers || [])}
            `;

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [{ role: "user", parts: [{ text: userMsg }] }],
                config: { systemInstruction, tools },
            });

            if (response.functionCalls) {
                for (const fc of response.functionCalls) {
                    setTestMessages(prev => [...prev, { 
                        role: 'model', 
                        text: `[SISTEMA] IA tentou executar: ${fc.name}(${JSON.stringify(fc.args)})`,
                        isFunction: true 
                    }]);
                }
            }

            setTestMessages(prev => [...prev, { role: 'model', text: response.text || "Sem resposta textual." }]);

        } catch (error) {
            setTestMessages(prev => [...prev, { role: 'model', text: "Erro ao processar mensagem no simulador." }]);
        } finally {
            setIsThinking(false);
        }
    };

    const webhookUrl = 'https://whatsapp-bot-drab-nu.vercel.app/api/whatsapp';

    const promptLength = localBotSettings.systemInstructions.length;
    const getPromptStatus = () => {
        if (promptLength < 100) return { label: 'Muito Curto', color: 'text-yellow-500' };
        if (promptLength < 2000) return { label: 'Excelente', color: 'text-green-500' };
        return { label: 'Complexo (Pode perder foco)', color: 'text-blue-500' };
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-purple-600 flex items-center gap-3">
                        <SparklesIcon className="w-10 h-10" />
                        Gerenciador do Robô IA
                    </h2>
                    <p className="text-gray-500">Configure e teste a inteligência do seu WhatsApp.</p>
                </div>
                <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-white dark:bg-gray-700 shadow text-purple-600' : 'text-gray-500'}`}
                    >
                        Configuração
                    </button>
                    <button 
                        onClick={() => setActiveTab('test')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'test' ? 'bg-white dark:bg-gray-700 shadow text-purple-600' : 'text-gray-500'}`}
                    >
                        Testar Robô
                    </button>
                    <button 
                        onClick={() => setActiveTab('guide')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'guide' ? 'bg-white dark:bg-gray-700 shadow text-purple-600' : 'text-gray-500'}`}
                    >
                        Guia de Setup
                    </button>
                </div>
            </header>

            {activeTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-l-8 border-purple-500 shadow-xl">
                            <CardHeader className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <SettingsIcon className="w-5 h-5 text-purple-600"/> 
                                    <h3 className="font-bold">Cérebro e Comportamento</h3>
                                </div>
                                <Button onClick={handleSave} isLoading={isSaving} size="sm">Salvar Alterações</Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input 
                                        label="Nome de Exibição da IA" 
                                        value={localBotSettings?.name || ''} 
                                        onChange={e => setLocalBotSettings(prev => ({...prev!, name: e.target.value}))}
                                        placeholder="Ex: Amanda da Piscina"
                                    />
                                    <div className="pt-7">
                                        <ToggleSwitch 
                                            label="Robô Ativo no WhatsApp" 
                                            enabled={localBotSettings?.enabled || false} 
                                            onChange={val => setLocalBotSettings(prev => ({...prev!, enabled: val}))}
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                            Instruções Mestres (Prompts do Sistema)
                                        </label>
                                        <span className={`text-[10px] font-black uppercase ${getPromptStatus().color}`}>
                                            {getPromptStatus().label} | {promptLength} caracteres
                                        </span>
                                    </div>
                                    <textarea 
                                        className="w-full p-4 border rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 h-80 focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm leading-relaxed"
                                        value={localBotSettings?.systemInstructions || ''}
                                        onChange={e => setLocalBotSettings(prev => ({...prev!, systemInstructions: e.target.value}))}
                                        placeholder="Descreva aqui todas as regras. Ex: 'Seja sempre cordial. Se perguntarem preço, use a tabela. Se for problema técnico, chame um humano...'"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-2 italic">Dica: Use frases curtas e diretas para garantir que a IA não ignore nenhuma regra importante.</p>
                                </div>

                                <Input 
                                    label="Frase de Transbordo (Humano)" 
                                    value={localBotSettings?.humanHandoffMessage || ''} 
                                    onChange={e => setLocalBotSettings(prev => ({...prev!, humanHandoffMessage: e.target.value}))}
                                    placeholder="O que o robô diz antes de parar de responder..."
                                />

                                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                    <ToggleSwitch 
                                        label="IA pode criar agendamentos no seu calendário" 
                                        enabled={localBotSettings?.autoSchedulingEnabled || false} 
                                        onChange={val => setLocalBotSettings(prev => ({...prev!, autoSchedulingEnabled: val}))}
                                    />
                                    <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-2 font-medium">Se ativado, quando o cliente disser que quer usar a piscina em tal data, a IA criará o evento automaticamente na aba "Eventos".</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="bg-gray-900 text-white border-none shadow-2xl">
                            <CardHeader className="border-gray-800">
                                <h3 className="font-bold text-purple-400 flex items-center gap-2">
                                    <ChartBarIcon className="w-5 h-5"/> Saúde da Integração
                                </h3>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-black mb-1">Status do Webhook:</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-xs font-bold text-green-400">Endpoint Online</span>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <p className="text-[10px] text-gray-400 uppercase font-black mb-1">URL DO WEBHOOK:</p>
                                    <div className="flex gap-2">
                                        <code className="bg-black p-2 rounded text-[10px] break-all flex-1 border border-gray-800 text-purple-300 font-bold">{webhookUrl}</code>
                                        <button onClick={() => {navigator.clipboard.writeText(webhookUrl); showNotification('URL Copiada!', 'info')}} className="text-purple-400 hover:text-white transition-colors">
                                            <CopyIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </div>
                                <div className="p-3 bg-purple-900/40 rounded-lg border border-purple-500/30 text-[11px] leading-relaxed">
                                    Certifique-se de que a <strong>VITE_API_KEY</strong> está configurada nas variáveis de ambiente da Vercel para o simulador funcionar.
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader><h3 className="font-bold flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-600"/> Dicas de Mestre</h3></CardHeader>
                            <CardContent className="text-sm space-y-4 text-gray-600 dark:text-gray-400">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                    <p className="font-bold text-gray-800 dark:text-gray-200 text-xs mb-1">Use Variáveis:</p>
                                    <p className="text-[11px]">Você não precisa ensinar o nome de cada cliente. O sistema já injeta automaticamente o nome e o status do cliente em cada conversa.</p>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                    <p className="font-bold text-gray-800 dark:text-gray-200 text-xs mb-1">Limite de Aprendizado:</p>
                                    <p className="text-[11px]">A IA "aprende" as regras instantaneamente. Se você quer que ela mude o jeito de falar, basta mudar as instruções aqui e salvar.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'test' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in max-h-[800px]">
                    <div className="lg:col-span-1 space-y-4">
                        <Card>
                            <CardHeader><h3 className="font-bold">Laboratório de Testes</h3></CardHeader>
                            <CardContent className="space-y-4">
                                <Select 
                                    label="Simular como se eu fosse:"
                                    value={selectedClientToSimulate}
                                    onChange={e => setSelectedClientToSimulate(e.target.value)}
                                    options={[
                                        { value: 'visitor', label: '👤 Pessoa Nova (Visitante)' },
                                        ...clients.filter(c => c.clientStatus === 'Ativo').map(c => ({ value: c.id, label: `✅ Cliente: ${c.name}` }))
                                    ]}
                                />
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-[11px] text-blue-600 leading-relaxed">
                                    <p className="font-bold mb-1">O que acontece aqui?</p>
                                    Ao testar, a IA recebe as instruções que você escreveu na aba anterior + os dados reais do cliente selecionado.
                                </div>
                                <Button variant="secondary" size="sm" className="w-full" onClick={() => setTestMessages([])}>Limpar Conversa</Button>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="lg:col-span-3 flex flex-col shadow-2xl h-[600px] border-none overflow-hidden rounded-2xl">
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-950 no-scrollbar">
                            {testMessages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                    <SparklesIcon className="w-12 h-12 mb-2 animate-pulse" />
                                    <p className="font-bold">O Robô está pronto. Diga 'Olá'!</p>
                                </div>
                            )}
                            {testMessages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${
                                        msg.role === 'user' 
                                            ? 'bg-purple-600 text-white rounded-tr-none' 
                                            : msg.isFunction 
                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 font-mono text-[10px] italic'
                                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none border dark:border-gray-700'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex gap-2">
                            <input 
                                className="flex-1 bg-gray-100 dark:bg-gray-800 border-none rounded-full px-6 py-3 focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
                                placeholder="Envie uma pergunta difícil para testar o cérebro da IA..."
                                value={inputMessage}
                                onChange={e => setInputMessage(e.target.value)}
                                disabled={isThinking}
                            />
                            <button 
                                type="submit"
                                disabled={isThinking || !inputMessage.trim()}
                                className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            </button>
                        </form>
                    </Card>
                </div>
            )}

            {activeTab === 'guide' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
                    <Card className="border-t-4 border-blue-500 shadow-lg">
                        <CardHeader>
                            <h3 className="text-xl font-black flex items-center gap-2">
                                <QuestionMarkCircleIcon className="w-6 h-6 text-blue-500" />
                                Como Conectar ao WhatsApp (Meta Cloud API)
                            </h3>
                        </CardHeader>
                        <CardContent className="space-y-8 p-6">
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="bg-blue-600 text-white font-black rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 shadow-md">1</div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-100">Crie seu App no Facebook Developers</p>
                                        <p className="text-sm text-gray-500 mt-1">Acesse <a href="https://developers.facebook.com" target="_blank" className="text-blue-500 underline font-bold">developers.facebook.com</a>, crie um App do tipo "Empresa" e adicione o produto "WhatsApp".</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="bg-blue-600 text-white font-black rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 shadow-md">2</div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-100">Configure o Webhook</p>
                                        <p className="text-sm text-gray-500 mt-1">No menu esquerdo, vá em <strong>WhatsApp &gt; Configuração</strong>. Clique em "Editar" Webhook e use os dados abaixo:</p>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 ml-12 shadow-inner">
                                    <div className="space-y-5">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Callback URL (URL de Retorno):</p>
                                            <p className="text-xs font-mono bg-white dark:bg-black p-3 rounded-lg border dark:border-gray-700 break-all shadow-sm text-purple-600 dark:text-purple-400 font-bold">{webhookUrl}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Verify Token (Token de Verificação):</p>
                                            <p className="text-xs font-mono bg-white dark:bg-black p-3 rounded-lg border dark:border-gray-700 shadow-sm font-bold">whatsapp_verify_123</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="bg-blue-600 text-white font-black rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 shadow-md">3</div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-100">Assine as Mensagens</p>
                                        <p className="text-sm text-gray-500 mt-1">Clique em <strong>Gerenciar Webhooks</strong> e clique em "Assinar" para o campo <strong>messages</strong>. Isso é o que faz o Facebook enviar os textos para sua IA.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 p-5 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-xl text-sm text-amber-800 dark:text-amber-200 flex gap-3">
                                <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0 text-amber-600" />
                                <div>
                                    <p className="font-black uppercase tracking-wider text-xs mb-1">Lembrete de Produção:</p>
                                    <p className="leading-relaxed">Certifique-se de que o App da Meta esteja em modo "Live" (Ao vivo) e que o seu nível de WhatsApp de teste esteja verificado.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AIBotManagerView;
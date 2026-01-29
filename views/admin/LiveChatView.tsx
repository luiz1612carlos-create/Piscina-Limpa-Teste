
import React, { useState, useEffect, useRef } from 'react';
import { AppContextType, ChatSession, ChatMessage } from '../../types';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { db } from '../../firebase';
import { SparklesIcon, CheckBadgeIcon } from '../../constants';

interface LiveChatViewProps {
    appContext: AppContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const LiveChatView: React.FC<LiveChatViewProps> = ({ appContext }) => {
    const { chatSessions, sendAdminChatMessage, closeChatSession, loading, showNotification } = appContext;
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const activeSession = chatSessions.find(s => s.id === selectedSessionId);

    useEffect(() => {
        if (!selectedSessionId) {
            setMessages([]);
            return;
        }

        console.log(`🔍 Escutando mensagens da sessão: ${selectedSessionId}`);

        // Listener para a sub-coleção de mensagens
        const unsub = db.collection('chatSessions')
            .doc(selectedSessionId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot: any) => {
                // Sincronizar mensagens
                const msgs = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data()
                } as ChatMessage));
                
                setMessages(msgs);
                
                // Marcar como lido ao abrir ou receber nova mensagem enquanto focado
                if (activeSession && activeSession.unreadCount > 0) {
                    db.collection('chatSessions').doc(selectedSessionId).update({ unreadCount: 0 }).catch(() => {});
                }
            }, (error: any) => {
                console.error("❌ Erro no listener de mensagens:", error);
                showNotification('Erro ao sincronizar mensagens.', 'error');
            });

        return () => unsub();
    }, [selectedSessionId, activeSession?.id]);

    useEffect(() => {
        // Scroll suave para a última mensagem
        if (messages.length > 0) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !selectedSessionId || isSending) return;

        const messageText = input.trim();
        setInput('');
        setIsSending(true);

        try {
            await sendAdminChatMessage(selectedSessionId, messageText);
        } catch (error) {
            showNotification('Falha ao enviar mensagem via WhatsApp.', 'error');
            setInput(messageText); // Devolver o texto para tentar de novo
        } finally {
            setIsSending(false);
        }
    };

    const handleCloseSession = async () => {
        if (!selectedSessionId || !window.confirm("Deseja encerrar o atendimento humano e devolver ao Robô?")) return;
        try {
            await closeChatSession(selectedSessionId);
            setSelectedSessionId(null);
            showNotification('Atendimento encerrado.', 'success');
        } catch (error) {
            showNotification('Erro ao encerrar.', 'error');
        }
    };

    if (loading.chatSessions) return <div className="flex justify-center p-20"><Spinner size="lg" /></div>;

    return (
        <div className="h-[calc(100vh-160px)] flex flex-col md:flex-row gap-6">
            {/* Lista de Conversas */}
            <div className="w-full md:w-80 flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700 font-black text-xs uppercase tracking-widest text-gray-500 text-center">
                    Conversas Ativas ({chatSessions.length})
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {chatSessions.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 text-sm italic">Nenhuma conversa no momento.</div>
                    ) : (
                        chatSessions.map(session => (
                            <button
                                key={session.id}
                                onClick={() => setSelectedSessionId(session.id)}
                                className={`w-full text-left p-4 border-b dark:border-gray-700 transition-all flex items-center gap-3 relative ${selectedSessionId === session.id ? 'bg-primary-50 dark:bg-primary-900/20 shadow-inner' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${session.status === 'waiting' ? 'bg-red-500 animate-pulse ring-4 ring-red-500/20' : 'bg-primary-500'}`}>
                                    {session.clientName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="font-bold text-sm truncate pr-2">{session.clientName}</h4>
                                        {session.unreadCount > 0 && (
                                            <span className="bg-green-600 text-white text-[10px] font-black h-5 w-5 flex items-center justify-center rounded-full shadow-lg shadow-green-600/20">
                                                {session.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">{session.lastMessage || 'Nova conversa...'}</p>
                                </div>
                                {session.status === 'waiting' && (
                                    <div className="absolute top-2 right-2">
                                        <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Janela de Chat */}
            <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700 overflow-hidden">
                {activeSession ? (
                    <>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold">
                                    {activeSession.clientName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">{activeSession.clientName}</h3>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${activeSession.status === 'waiting' ? 'text-red-500' : 'text-green-500'}`}>
                                        {activeSession.status === 'waiting' ? '● Aguardando Atendimento' : '● Em Atendimento Humano'}
                                    </span>
                                </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={handleCloseSession}>
                                <CheckBadgeIcon className="w-4 h-4 mr-2" />
                                Devolver ao Robô
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-50 dark:bg-gray-950/20">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm relative ${msg.sender === 'client' ? 'bg-white dark:bg-gray-800 rounded-tl-none border dark:border-gray-700' : msg.sender === 'bot' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100 rounded-tr-none italic border border-blue-200' : 'bg-primary-600 text-white rounded-tr-none shadow-lg shadow-primary-500/20'}`}>
                                        <div className="flex flex-col">
                                            {msg.sender === 'bot' && <span className="text-[9px] font-black uppercase mb-1 opacity-60">Robô Automático</span>}
                                            {msg.sender === 'admin' && <span className="text-[9px] font-black uppercase mb-1 opacity-60">Administrador</span>}
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                            <div className="text-[9px] text-right mt-1 opacity-50 flex items-center justify-end gap-1">
                                                {toDate(msg.timestamp)?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'Enviando...'}
                                                {msg.sender !== 'client' && <CheckBadgeIcon className="w-2.5 h-2.5" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={handleSend} className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800 flex gap-2">
                            <input 
                                className="flex-1 bg-white dark:bg-gray-800 border-none rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-inner dark:text-white" 
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                placeholder="Responda para o WhatsApp do cliente..." 
                                autoComplete="off"
                            />
                            <button 
                                type="submit" 
                                disabled={!input.trim() || isSending}
                                className="bg-primary-600 text-white p-3 rounded-full shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSending ? <Spinner size="sm" /> : (
                                    <svg viewBox="0 0 24 24" width="24" height="24" className="fill-current rotate-45"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                                )}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 text-gray-400">
                        <SparklesIcon className="w-16 h-16 text-gray-200 dark:text-gray-700 mb-4" />
                        <p className="font-black text-lg">Central de Atendimento</p>
                        <p className="text-sm">Selecione uma conversa ao lado para responder via WhatsApp.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveChatView;

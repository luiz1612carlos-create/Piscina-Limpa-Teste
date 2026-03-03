
import React, { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { AuthContextType } from '../../types';
import { SparklesIcon } from '../../constants';

interface LoginViewProps {
    authContext: AuthContextType;
}

const LoginView: React.FC<LoginViewProps> = ({ authContext }) => {
    const { login, showNotification } = authContext;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(email, password);
        } catch (error: any) {
            console.error("Login Error:", error);
            let errorMessage = 'Falha ao fazer login. Verifique suas credenciais.';
            
            if (error.code === 'auth/user-not-found') errorMessage = 'Nenhum usuário encontrado com este e-mail.';
            else if (error.code === 'auth/wrong-password') errorMessage = 'Senha incorreta.';
            else if (error.code === 'auth/invalid-email') errorMessage = 'E-mail inválido.';
            
            showNotification(errorMessage, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleWhatsAppQuote = () => {
        const phone = "5533997011279";
        const message = encodeURIComponent("Olá! Gostaria de fazer um orçamento para limpeza da minha piscina.");
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h2 className="text-2xl font-black text-center text-gray-800 dark:text-gray-100 uppercase tracking-tight">Acesse seu Painel</h2>
                <p className="text-center text-xs text-gray-500 mt-1 font-medium">Gerencie o tratamento da sua piscina em tempo real</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
                <Input
                    label="E-mail"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="ex: cliente@email.com"
                />
                <Input
                    label="Senha"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                />
                <Button type="submit" isLoading={isLoading} className="w-full shadow-xl shadow-primary-500/25" size="lg">
                    Entrar no Sistema
                </Button>
            </form>

            <div className="relative pt-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.2em]">
                    <span className="bg-white dark:bg-gray-800 px-4 text-gray-400">Primeira vez conosco?</span>
                </div>
            </div>

            <div className="text-center pt-2">
                <button 
                    onClick={handleWhatsAppQuote}
                    className="group relative w-full flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg hover:shadow-green-500/40 transform transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] overflow-hidden"
                >
                    {/* Efeito de brilho pulsante */}
                    <div className="absolute inset-0 bg-white/10 animate-pulse group-hover:hidden"></div>
                    
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-white/20 rounded-xl group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 shadow-inner">
                            <SparklesIcon className="w-7 h-7 text-white" />
                        </div>
                        <div className="text-left">
                            <p className="font-black text-white text-lg leading-none">Sou Novo!</p>
                            <p className="text-white/80 text-[11px] font-bold uppercase tracking-wider mt-1">Pedir Orçamento Grátis</p>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center justify-center bg-white/20 p-2 rounded-full backdrop-blur-sm group-hover:translate-x-1 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>

                    {/* Badge lateral flutuante */}
                    <div className="absolute -right-6 -top-6 bg-yellow-400 w-16 h-16 rotate-45 flex items-end justify-center pb-1 shadow-lg">
                        <span className="text-[9px] font-black text-yellow-900 -rotate-45 mb-1 mr-1">OFF</span>
                    </div>
                </button>
                <p className="text-[9px] text-gray-400 mt-3 font-bold uppercase tracking-widest opacity-60">Atendimento imediato via WhatsApp</p>
            </div>
        </div>
    );
};

export default LoginView;
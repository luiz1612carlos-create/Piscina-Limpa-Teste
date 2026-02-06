
import React, { useState, useEffect } from 'react';
import { AppContextType, Settings } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { SparklesIcon, CheckBadgeIcon } from '../../constants';

interface MetaConfigViewProps {
    appContext: AppContextType;
}

const MetaConfigView: React.FC<MetaConfigViewProps> = ({ appContext }) => {
    const { settings, updateSettings, showNotification } = appContext;
    const [isSaving, setIsSaving] = useState(false);
    const [localMeta, setLocalMeta] = useState({
        whatsappTemplateName: '',
        whatsappTemplateLanguage: 'pt_BR'
    });

    useEffect(() => {
        if (settings) {
            setLocalMeta({
                whatsappTemplateName: settings.whatsappTemplateName || '',
                whatsappTemplateLanguage: settings.whatsappTemplateLanguage || 'pt_BR'
            });
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings(localMeta);
            showNotification('Configurações da Meta salvas com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao salvar configurações técnicos.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <header>
                <h2 className="text-3xl font-black text-primary-600 flex items-center gap-3">
                    <SparklesIcon className="w-10 h-10" />
                    Configuração da Meta API
                </h2>
                <p className="text-gray-500 font-medium">Parâmetros técnicos para o envio de mensagens oficiais (templates).</p>
            </header>

            <Card className="border-l-8 border-primary-500">
                <CardHeader>
                    <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-wider">Identificação do Template</h3>
                    <p className="text-sm text-gray-500">Insira os dados exatamente como estão no seu Painel de Desenvolvedor da Meta.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input 
                            label="Nome do Modelo (Template Name)" 
                            value={localMeta.whatsappTemplateName} 
                            onChange={e => setLocalMeta(p => ({...p, whatsappTemplateName: e.target.value}))}
                            placeholder="Ex: cobranca_piscina_v1"
                        />
                        <Input 
                            label="Código do Idioma" 
                            value={localMeta.whatsappTemplateLanguage} 
                            onChange={e => setLocalMeta(p => ({...p, whatsappTemplateLanguage: e.target.value}))}
                            placeholder="Ex: pt_BR"
                        />
                    </div>
                    
                    <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-800">
                        <h4 className="font-bold text-primary-800 dark:text-primary-300 text-sm mb-2 flex items-center gap-2">
                            <CheckBadgeIcon className="w-4 h-4" />
                            Estrutura de Variáveis (Cobrança Inteligente)
                        </h4>
                        <p className="text-xs text-primary-700 dark:text-primary-400 mb-3">
                            Ao usar este template, o sistema preencherá as variáveis automaticamente na seguinte ordem:
                        </p>
                        <ul className="text-xs space-y-1 font-mono text-gray-600 dark:text-gray-400">
                            <li><strong>{"{{1}}"}</strong>: Nome do Cliente</li>
                            <li><strong>{"{{2}}"}</strong>: Valor Mensal (Ex: 250,00)</li>
                            <li><strong>{"{{3}}"}</strong>: Data de Vencimento (Ex: 10/12/2024)</li>
                            <li><strong>{"{{4}}"}</strong>: Status (Ex: Pendente)</li>
                            <li><strong>{"{{5}}"}</strong>: Chave PIX</li>
                            <li><strong>{"{{6}}"}</strong>: Destinatário do Pagamento</li>
                        </ul>
                    </div>
                </CardContent>
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
                    <Button onClick={handleSave} isLoading={isSaving} className="shadow-lg shadow-primary-500/20">
                        Salvar Configuração Meta
                    </Button>
                </div>
            </Card>

            <Card className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/50">
                <CardContent className="flex gap-4 p-6 text-sm text-yellow-800 dark:text-yellow-200">
                    <SparklesIcon className="w-6 h-6 flex-shrink-0" />
                    <div>
                        <p className="font-bold mb-1">Como funciona a Janela de 24h?</p>
                        <p>Se o cliente não interagiu com seu número nas últimas 24 horas, o sistema detectará o erro automaticamente e tentará enviar este template oficial para restabelecer o contato.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default MetaConfigView;

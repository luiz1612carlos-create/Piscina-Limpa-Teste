
import React, { useState, useMemo } from 'react';
import { AppContextType, EmergencyRequest } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { ExclamationTriangleIcon, CheckIcon, TrashIcon } from '../../constants';

interface EmergenciesViewProps {
    appContext: AppContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const EmergenciesView: React.FC<EmergenciesViewProps> = ({ appContext }) => {
    const { emergencyRequests, loading, resolveEmergencyRequest, showNotification } = appContext;
    const [processingId, setProcessingId] = useState<string | null>(null);

    const pendingEmergencies = useMemo(() => {
        return emergencyRequests.filter(e => e.status === 'pending');
    }, [emergencyRequests]);

    const resolvedEmergencies = useMemo(() => {
        return emergencyRequests.filter(e => e.status === 'resolved');
    }, [emergencyRequests]);

    const handleResolve = async (id: string) => {
        setProcessingId(id);
        try {
            await resolveEmergencyRequest(id);
            showNotification("Emergência marcada como resolvida.", "success");
        } catch (error) {
            showNotification("Erro ao resolver emergência.", "error");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-black text-red-600 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-10 h-10" />
                    Emergências VIP
                </h2>
                <p className="text-gray-500 mt-1">Solicitações urgentes com prioridade de remanejamento de rota.</p>
            </header>

            {loading.emergencyRequests ? (
                <div className="flex justify-center p-20"><Spinner size="lg" /></div>
            ) : (
                <>
                    <section>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            Pendentes ({pendingEmergencies.length})
                        </h3>
                        {pendingEmergencies.length === 0 ? (
                            <p className="p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-400 italic">Nenhuma emergência pendente no momento. Bom trabalho!</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {pendingEmergencies.map(req => (
                                    <Card key={req.id} className="border-t-8 border-red-600 animate-pulse-slow">
                                        <CardHeader className="bg-red-50 dark:bg-red-900/10">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="text-lg font-black text-red-900 dark:text-red-100">{req.clientName}</h4>
                                                    <p className="text-xs text-red-600 font-bold uppercase">{req.clientPhone}</p>
                                                </div>
                                                <span className="bg-red-600 text-white text-[10px] px-2 py-1 rounded font-black">URGENTE</span>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div>
                                                <p className="text-xs text-gray-400 font-bold uppercase">Endereço:</p>
                                                <p className="text-sm font-medium">{req.address}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 font-bold uppercase">Motivo:</p>
                                                <div className="p-3 bg-white dark:bg-gray-900 rounded border border-red-100 dark:border-red-900/50 italic text-sm">
                                                    "{req.reason}"
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-400 text-right">
                                                Recebido em: {toDate(req.createdAt)?.toLocaleString('pt-BR')}
                                            </div>
                                        </CardContent>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex gap-2">
                                            <Button 
                                                className="flex-1 bg-green-600 hover:bg-green-700" 
                                                onClick={() => handleResolve(req.id)}
                                                isLoading={processingId === req.id}
                                            >
                                                <CheckIcon className="w-5 h-5 mr-2" />
                                                Resolver
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>

                    {resolvedEmergencies.length > 0 && (
                        <section className="pt-8 border-t dark:border-gray-700">
                            <h3 className="text-xl font-bold mb-4 text-gray-500">Histórico Recente (Resolvidos)</h3>
                            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                                <table className="min-w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500">
                                        <tr>
                                            <th className="px-6 py-3">Cliente</th>
                                            <th className="px-6 py-3">Motivo</th>
                                            <th className="px-6 py-3">Data</th>
                                            <th className="px-6 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {resolvedEmergencies.slice(0, 10).map(req => (
                                            <tr key={req.id}>
                                                <td className="px-6 py-4 font-bold">{req.clientName}</td>
                                                <td className="px-6 py-4 truncate max-w-xs">{req.reason}</td>
                                                <td className="px-6 py-4">{toDate(req.createdAt)?.toLocaleDateString('pt-BR')}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-green-500 font-bold flex items-center gap-1">
                                                        <CheckIcon className="w-4 h-4" /> Resolvido
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

export default EmergenciesView;

import React, { useState, useMemo } from 'react';
import { AppContextType, Client, Visit } from '../../types';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import jsPDF from 'jspdf';

interface MaintenanceHistoryViewProps {
    appContext: AppContextType;
}

export const MaintenanceHistoryView: React.FC<MaintenanceHistoryViewProps> = ({ appContext }) => {
    const { clients } = appContext;
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    const selectedClient = useMemo(() => {
        return clients.find(c => c.id === selectedClientId) || null;
    }, [clients, selectedClientId]);

    const visitHistory = useMemo(() => {
        if (!selectedClient || !selectedClient.visitHistory) return [];
        return selectedClient.visitHistory.sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
            return dateB - dateA;
        });
    }, [selectedClient]);

    const generatePDF = () => {
        if (!selectedClient) return;

        const doc = new jsPDF();
        doc.text(`Histórico de Manutenção - ${selectedClient.name}`, 10, 10);

        let y = 20;
        visitHistory.forEach(visit => {
            doc.text(`Data: ${visit.timestamp?.toDate ? visit.timestamp.toDate().toLocaleDateString('pt-BR') : 'N/A'}`, 10, y);
            y += 10;
            doc.text(`Técnico: ${visit.technicianName}`, 10, y);
            y += 10;
            doc.text(`Observações: ${visit.obs}`, 10, y);
            y += 10;
            doc.text('Medições:', 10, y);
            y += 10;
            doc.text(`- pH: ${visit.ph}`, 15, y);
            y += 10;
            doc.text(`- Cloro: ${visit.cloro}`, 15, y);
            y += 10;
            doc.text(`- Alcalinidade: ${visit.alcalinidade}`, 15, y);
            y += 10;
            doc.text('Produtos Utilizados:', 10, y);
            y += 10;
            visit.productsUsed?.forEach(p => {
                doc.text(`- ${p.name}: ${p.quantity}`, 15, y);
                y += 10;
            });
            y += 10;
        });

        doc.save(`historico_${selectedClient.id}.pdf`);
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Histórico de Manutenção</h2>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div className="mb-4">
                        {clients && clients.length > 0 ? (
                            <Select
                                label="Selecione um Cliente"
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                options={[
                                    { value: '', label: '-- Selecione --' },
                                    ...clients.map(client => ({ value: client.id, label: client.name }))
                                ]}
                            />
                        ) : (
                            <p>Nenhum cliente encontrado.</p>
                        )}
                </div>

                {selectedClient && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">Histórico de {selectedClient.name}</h3>
                            <Button onClick={generatePDF}>Gerar Relatório</Button>
                        </div>
                        {visitHistory.length > 0 ? (
                            <div className="space-y-4">
                                {visitHistory.map((visit: Visit) => (
                                    <div key={visit.id} className="p-4 border dark:border-gray-700 rounded-lg">
                                        <p className="font-bold">Data: {visit.timestamp?.toDate ? visit.timestamp.toDate().toLocaleDateString('pt-BR') : 'N/A'}</p>
                                        <p>Técnico: {visit.technicianName}</p>
                                        <p>Observações: {visit.obs || visit.notes}</p>
                                        <div>
                                            <p className="font-semibold mt-2">Medições:</p>
                                            <ul className="list-disc list-inside text-sm">
                                                <li>pH: {visit.ph}</li>
                                                <li>Cloro: {visit.cloro}</li>
                                                <li>Alcalinidade: {visit.alcalinidade}</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="font-semibold mt-2">Produtos Utilizados:</p>
                                            <ul className="list-disc list-inside text-sm">
                                                {visit.productsUsed?.map((p: any) => (
                                                    <li key={p.productId}>{p.name}: {p.quantity}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>Nenhum histórico de visita encontrado para este cliente.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

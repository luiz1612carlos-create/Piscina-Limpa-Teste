import React, { useMemo, useEffect, useRef, useState } from 'react';
import { AppContextType, Client, Transaction } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { UsersIcon, CurrencyDollarIcon, CheckBadgeIcon, StoreIcon, TrashIcon, CalendarDaysIcon, ChartBarIcon, SparklesIcon } from '../../constants';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { calculateClientMonthlyFee } from '../../utils/calculations';

declare const Chart: any;

interface ReportsViewProps {
    appContext: AppContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        return isNaN(d.getTime()) ? null : d;
    }
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const ReportsView: React.FC<ReportsViewProps> = ({ appContext }) => {
    const { clients, orders, budgetQuotes, transactions, loading, resetReportsData, settings, banks, showNotification, sendAdminChatMessage } = appContext;
    
    const isCriticalLoading = loading.clients || loading.transactions || loading.settings;

    const stats = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyRevenue = transactions.filter(t => {
            const d = toDate(t.date);
            return d && d >= startOfMonth;
        }).reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const newBudgets = budgetQuotes.filter(b => {
            const d = toDate(b.createdAt);
            return d && d >= startOfMonth;
        }).length;
        return { activeClients: clients.filter(c => c.clientStatus === 'Ativo').length, monthlyRevenue, newBudgets, ordersCount: orders.length };
    }, [clients, orders, budgetQuotes, transactions]);

    const revenueByBank = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactions.filter(t => {
                const d = toDate(t.date);
                return d && d >= startOfMonth;
            }).reduce((acc, t) => {
                // CORREÇÃO: Tenta bankName salvo, se não houver, cruza bankId com lista de banks, se não houver, vira "Outros"
                const activeBank = banks.find(b => b.id === t.bankId);
                const name = t.bankName || activeBank?.name || 'Não Identificado';
                
                acc[name] = (acc[name] || 0) + Number(t.amount || 0);
                return acc;
            }, {} as { [key: string]: number });
    }, [transactions, banks]); // DEPENDÊNCIA DE BANKS ADICIONADA

    if (isCriticalLoading) return <div className="flex justify-center items-center h-full min-h-[400px]"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-8 pb-10 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-black text-gray-800 dark:text-white">Dashboard de Performance</h2>
                <Button variant="danger" size="sm" onClick={resetReportsData}><TrashIcon className="w-4 h-4 mr-2" /> Limpar Dados de Teste</Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Ativos" value={stats.activeClients} icon={UsersIcon} color="blue" />
                <KpiCard title="Receita (Mês)" value={`R$ ${stats.monthlyRevenue.toFixed(2)}`} icon={CurrencyDollarIcon} color="green" />
                <KpiCard title="Novos Orçamentos" value={stats.newBudgets} icon={CheckBadgeIcon} color="purple" />
                <KpiCard title="Pedidos" value={stats.ordersCount} icon={StoreIcon} color="orange" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-3">
                    <CardHeader className="flex items-center gap-2 font-black"><ChartBarIcon className="w-5 h-5 text-primary-500" /> Crescimento Mensal</CardHeader>
                    <CardContent><MonthlyGrowthChart clients={clients} transactions={transactions} settings={settings} /></CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader className="flex items-center gap-2 font-black"><CurrencyDollarIcon className="w-5 h-5 text-green-500" /> Por Banco (Mês)</CardHeader>
                    <CardContent><DataTable headers={['Banco', 'Valor']} data={Object.entries(revenueByBank).map(([k, v]) => [k, `R$ ${Number(v).toFixed(2)}`])} /></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="font-black">Últimas Transações Confirmadas</CardHeader>
                <CardContent>
                    <div className="max-h-60 overflow-y-auto">
                        <DataTable headers={['Data', 'Cliente', 'Valor']} data={transactions.slice(0, 10).map(t => [toDate(t.date)?.toLocaleDateString('pt-BR') || '---', t.clientName, <span className="font-bold text-green-600">R$ {(Number(t.amount) || 0).toFixed(2)}</span>])} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const KpiCard = ({ title, value, icon: Icon, color }: any) => (
    <Card className="hover:shadow-lg transition-shadow"><CardContent className="flex items-center p-6"><div className={`p-4 rounded-2xl mr-4 bg-${color}-100 dark:bg-${color}-900/40 text-${color}-600 dark:text-${color}-300`}><Icon className="w-8 h-8" /></div><div><p className="text-xs font-black uppercase text-gray-400 tracking-widest">{title}</p><p className="text-2xl font-black text-gray-800 dark:text-white">{value}</p></div></CardContent></Card>
);

const DataTable = ({ headers, data }: any) => (
    <div className="overflow-x-auto w-full"><table className="min-w-full text-sm"><thead className="border-b dark:border-gray-700 text-gray-400 text-[10px] font-black uppercase tracking-tighter"><tr>{headers.map((h:any) => <th key={h} className="text-left p-2">{h}</th>)}</tr></thead><tbody className="divide-y dark:divide-gray-700">{data.length > 0 ? data.map((row:any, i:any) => (<tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">{row.map((cell:any, j:any) => <td key={j} className="p-2 py-3">{cell}</td>)}</tr>)) : <tr><td colSpan={headers.length} className="text-center p-10 text-gray-400 italic">Sem registros.</td></tr>}</tbody></table></div>
);

const MonthlyGrowthChart = ({ clients, transactions, settings }: any) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);
    useEffect(() => {
        if (!canvasRef.current || !settings) return;
        if (chartRef.current) chartRef.current.destroy();
        const labels = [];
        const dataSet = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            labels.push(d.toLocaleString('pt-BR', { month: 'short' }));
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            const sum = transactions.filter((t:any) => {
                const dt = toDate(t.date);
                return dt && dt >= start && dt <= end;
            }).reduce((s:any, t:any) => s + Number(t.amount || 0), 0);
            dataSet.push(sum);
        }
        const ctx = canvasRef.current.getContext('2d');
        chartRef.current = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Faturamento Real', data: dataSet, backgroundColor: '#3b82f6', borderRadius: 8 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } } } });
    }, [transactions, settings]);
    return <canvas ref={canvasRef} height="120"></canvas>;
};

export default ReportsView;
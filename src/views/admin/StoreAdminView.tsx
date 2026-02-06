import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppContextType, Product, OrderStatus } from '../../types';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { TrashIcon, CheckIcon, SparklesIcon, CloudRainIcon } from '../../constants';
import { Select } from '../../components/Select';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Input } from '../../components/Input';
import { db } from '../../firebase';

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) return d;
    }
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

interface StoreAdminViewProps {
    appContext: AppContextType;
}

const StoreAdminView: React.FC<StoreAdminViewProps> = ({ appContext }) => {
    const [activeTab, setActiveTab] =
        useState<'products' | 'orders' | 'replenishment'>('products');

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Gerenciamento da Loja</h2>

            <div className="flex border-b dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`py-2 px-4 text-lg font-semibold ${
                        activeTab === 'products'
                            ? 'border-b-2 border-primary-500 text-primary-500'
                            : 'text-gray-500'
                    }`}
                >
                    Produtos
                </button>

                <button
                    onClick={() => setActiveTab('orders')}
                    className={`py-2 px-4 text-lg font-semibold ${
                        activeTab === 'orders'
                            ? 'border-b-2 border-primary-500 text-primary-500'
                            : 'text-gray-500'
                    }`}
                >
                    Pedidos
                </button>

                <button
                    onClick={() => setActiveTab('replenishment')}
                    className={`py-2 px-4 text-lg font-semibold relative ${
                        activeTab === 'replenishment'
                            ? 'border-b-2 border-primary-500 text-primary-500'
                            : 'text-gray-500'
                    }`}
                >
                    Sugestões de Reposição
                </button>
            </div>

            {activeTab === 'products' && <ProductsManagement appContext={appContext} />}
            {activeTab === 'orders' && <OrdersManagement appContext={appContext} />}
            {activeTab === 'replenishment' && (
                <ReplenishmentManagement appContext={appContext} />
            )}
        </div>
    );
};

/* ===========================
   REPLENISHMENT
=========================== */

const ReplenishmentManagement = ({ appContext }: { appContext: AppContextType }) => {
    const {
        replenishmentQuotes,
        triggerReplenishmentAnalysis,
        updateReplenishmentQuoteStatus,
        showNotification
    } = appContext;

    const [loading, setLoading] = useState(false);

    const suggestedQuotes = replenishmentQuotes.filter(q => q.status === 'suggested');

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            await triggerReplenishmentAnalysis();
            showNotification('Análise de reposição executada.', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro na análise.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Button onClick={handleAnalyze} isLoading={loading}>
                <SparklesIcon className="w-5 h-5 mr-2" />
                Gerar Propostas
            </Button>

            {suggestedQuotes.length === 0 ? (
                <p className="text-gray-500">Nenhuma sugestão encontrada.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {suggestedQuotes.map(quote => (
                        <Card key={quote.id}>
                            <CardHeader>
                                <h3 className="font-bold">{quote.clientName}</h3>
                            </CardHeader>
                            <CardContent>
                                <p className="font-bold">
                                    Total: R$ {quote.total.toFixed(2)}
                                </p>

                                <Button
                                    size="sm"
                                    onClick={() =>
                                        updateReplenishmentQuoteStatus(quote.id, 'sent')
                                    }
                                >
                                    Propor ao Cliente
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ===========================
   PRODUCTS
=========================== */

const PRODUCTS_PER_PAGE = 8;

const ProductsManagement = ({ appContext }: { appContext: AppContextType }) => {
    const { deleteProduct, showNotification } = appContext;

    const [products, setProducts] = useState<Product[]>([]);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);

    const observer = useRef<IntersectionObserver | null>(null);

    const fetchProducts = useCallback(
        async (isInitial = false) => {
            if (loading && !isInitial) return;
            setLoading(true);

            try {
                let query = db
                    .collection('products')
                    .orderBy('name')
                    .limit(PRODUCTS_PER_PAGE);

                if (lastVisible && !isInitial) query = query.startAfter(lastVisible);

                const snapshot = await query.get();
                const newProducts = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data()
                })) as Product[];

                setProducts(prev =>
                    isInitial ? newProducts : [...prev, ...newProducts]
                );

                setLastVisible(snapshot.docs[snapshot.docs.length - 1]);

                if (snapshot.docs.length < PRODUCTS_PER_PAGE) setHasMore(false);
            } catch {
                showNotification('Erro ao carregar produtos.', 'error');
            } finally {
                setLoading(false);
            }
        },
        [lastVisible, loading, showNotification]
    );

    useEffect(() => {
        fetchProducts(true);
    }, []);

    return <Spinner />;
};

/* ===========================
   ORDERS
=========================== */

const OrdersManagement = ({ appContext }: { appContext: AppContextType }) => {
    const { orders, loading, updateOrderStatus } = appContext;

    return loading.orders ? (
        <Spinner />
    ) : (
        <div>
            {orders.map(order => (
                <div key={order.id}>
                    {order.clientName} — {order.total}
                </div>
            ))}
        </div>
    );
};

export default StoreAdminView;

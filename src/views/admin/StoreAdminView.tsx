
import React, { useState, useMemo } from 'react';
import { AppContextType, Product, Order, OrderStatus, ReplenishmentQuote, Client, ClientProduct } from '../../types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { EditIcon, TrashIcon, PlusIcon, CheckIcon, SparklesIcon, CloudRainIcon } from '../../constants';
import { Select } from '../../components/Select';
import { Card, CardContent, CardHeader } from '../../components/Card';

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
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'replenishment'>('products');

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Gerenciamento da Loja</h2>
            <div className="flex border-b dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`py-2 px-4 text-lg font-semibold ${activeTab === 'products' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
                >
                    Produtos
                </button>
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`py-2 px-4 text-lg font-semibold ${activeTab === 'orders' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
                >
                    Pedidos
                </button>
                 <button
                    onClick={() => setActiveTab('replenishment')}
                    className={`py-2 px-4 text-lg font-semibold relative ${activeTab === 'replenishment' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
                >
                    Sugestões de Reposição
                    {appContext.replenishmentQuotes.filter(q => q.status === 'suggested').length > 0 && (
                        <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{appContext.replenishmentQuotes.filter(q => q.status === 'suggested').length}</span>
                    )}
                </button>
            </div>
            {activeTab === 'products' && <ProductsManagement appContext={appContext} />}
            {activeTab === 'orders' && <OrdersManagement appContext={appContext} />}
            {activeTab === 'replenishment' && <ReplenishmentManagement appContext={appContext} />}
        </div>
    );
};

const ReplenishmentManagement = ({ appContext }: { appContext: AppContextType }) => {
    const { replenishmentQuotes, clients, settings, loading, updateReplenishmentQuoteStatus, triggerReplenishmentAnalysis, showNotification, products } = appContext;
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const suggestedQuotes = useMemo(() => {
        return replenishmentQuotes.filter(q => q.status === 'suggested');
    }, [replenishmentQuotes]);

    /**
     * Identifica clientes que têm estoque baixo baseado nos produtos da loja.
     * Deve usar a mesma lógica do triggerReplenishmentAnalysis no useAppData.ts
     */
    const clientsWithLiveLowStock = useMemo(() => {
        if (!settings || products.length === 0) return [];
        
        const threshold = settings.automation.replenishmentStockThreshold || 2;
        const pendingClientIds = new Set(replenishmentQuotes.filter(q => q.status !== 'rejected' && q.status !== 'approved').map(q => q.clientId));

        return clients
            .filter(c => c.clientStatus === 'Ativo' && !pendingClientIds.has(c.id))
            .map(client => {
                const lowStockItems = client.stock.filter(sItem => {
                    const current = sItem.currentStock ?? sItem.quantity ?? 0;
                    
                    // Só alerta se o produto existir na loja para poder vender
                    const existsInStore = products.some(p => 
                        p.id === sItem.productId || 
                        p.name.trim().toLowerCase() === sItem.name.trim().toLowerCase()
                    );

                    return current <= threshold && existsInStore;
                });
                return { client, lowStockItems };
            })
            .filter(data => data.lowStockItems.length > 0);
    }, [clients, settings, replenishmentQuotes, products]);

    const filteredQuotes = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return suggestedQuotes;
        return suggestedQuotes.filter(q => 
            q.clientName.toLowerCase().includes(term) || 
            q.items.some(i => i.name.toLowerCase().includes(term))
        );
    }, [suggestedQuotes, searchTerm]);

    const filteredLiveAlerts = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return clientsWithLiveLowStock;
        return clientsWithLiveLowStock.filter(data => 
            data.client.name.toLowerCase().includes(term) ||
            data.lowStockItems.some(i => i.name.toLowerCase().includes(term))
        );
    }, [clientsWithLiveLowStock, searchTerm]);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const count = await triggerReplenishmentAnalysis();
            if (count > 0) {
                showNotification(`Sucesso! ${count} novos orçamentos de reposição gerados.`, 'success');
            } else {
                showNotification('Nenhum cliente novo identificado com estoque baixo que já não possua um orçamento pendente.', 'info');
            }
        } catch (error: any) {
            showNotification(error.message || 'Erro ao processar análise.', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSend = async (quoteId: string) => {
        setProcessingId(quoteId);
        try {
            await updateReplenishmentQuoteStatus(quoteId, 'sent');
            showNotification('Sugestão enviada ao cliente!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao enviar sugestão.', 'error');
        } finally {
            setProcessingId(null);
        }
    };
    
    const handleDiscard = async (quoteId: string) => {
        setProcessingId(quoteId);
        try {
            await updateReplenishmentQuoteStatus(quoteId, 'rejected');
            showNotification('Sugestão descartada.', 'info');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao descartar sugestão.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <div className="w-full md:w-1/2">
                    <Input
                        label="Buscar por Cliente ou Produto"
                        placeholder="Pesquise para ver quem precisa de reposição..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        containerClassName="mb-0"
                    />
                </div>
                <Button 
                    onClick={handleAnalyze} 
                    isLoading={isAnalyzing}
                    className="w-full md:w-auto bg-purple-600 hover:bg-purple-700"
                >
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    Analisar Estoque e Gerar Propostas
                </Button>
            </div>

            <div>
                <h3 className="text-xl font-bold mb-4 flex items-center">
                    <CheckIcon className="w-6 h-6 mr-2 text-green-500" />
                    Orçamentos Propostos ({filteredQuotes.length})
                </h3>
                {filteredQuotes.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                        Nenhum orçamento sugerido aguardando envio.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredQuotes.map(quote => (
                            <Card key={quote.id} className="border-t-4 border-primary-500">
                                <CardHeader>
                                    <h3 className="text-xl font-semibold">{quote.clientName}</h3>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {quote.items.map(item => (
                                            <li key={item.id} className="flex justify-between text-sm">
                                                <span className="text-gray-600 dark:text-gray-400">{item.name} <span className="font-bold">x {item.quantity}</span></span>
                                                <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-4 pt-2 border-t dark:border-gray-700 text-right">
                                        <p className="text-xs text-gray-400">Total sugerido:</p>
                                        <p className="font-bold text-xl text-primary-600">R$ {quote.total.toFixed(2)}</p>
                                    </div>
                                </CardContent>
                                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center gap-2">
                                    <Button variant="secondary" size="sm" onClick={() => handleDiscard(quote.id)} isLoading={processingId === quote.id} disabled={!!processingId} className="flex-1">
                                        Descartar
                                    </Button>
                                    <Button size="sm" onClick={() => handleSend(quote.id)} isLoading={processingId === quote.id} disabled={!!processingId} className="flex-1">
                                        Propor ao Cliente
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-8 border-t dark:border-gray-700">
                <h3 className="text-xl font-bold mb-4 flex items-center text-red-500">
                    <CloudRainIcon className="w-6 h-6 mr-2" />
                    Clientes com Estoque Baixo ({filteredLiveAlerts.length})
                </h3>
                <p className="text-sm text-gray-500 mb-4 italic">Estes clientes têm produtos abaixo do limite, mas o orçamento ainda não foi gerado. Clique no botão "Analisar Estoque" acima para criar as propostas.</p>
                
                {filteredLiveAlerts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                        Nenhum alerta de estoque baixo adicional.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredLiveAlerts.map(data => (
                            <div key={data.client.id} className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg shadow-sm">
                                <h4 className="font-bold text-red-800 dark:text-red-300 truncate">{data.client.name}</h4>
                                <div className="mt-2 space-y-1">
                                    {data.lowStockItems.map(item => (
                                        <div key={item.productId} className="flex justify-between text-xs">
                                            <span className="text-gray-600 dark:text-gray-400">{item.name}:</span>
                                            <span className="font-bold text-red-600">{item.currentStock ?? item.quantity} / {item.maxStock ?? item.maxQuantity ?? 5}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const ProductsManagement = ({ appContext }: { appContext: AppContextType }) => {
    const { products, loading, saveProduct, deleteProduct, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | Omit<Product, 'id'> | null>(null);
    const [productImageFile, setProductImageFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleOpenModal = (product: Product | null = null) => {
        if (product) {
            setSelectedProduct(product);
        } else {
            setSelectedProduct({ name: '', description: '', price: 0, stock: 0, imageUrl: `https://via.placeholder.com/400x300.png?text=Sem+Imagem` });
        }
        setProductImageFile(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedProduct(null);
        setProductImageFile(null);
    };

    const handleSave = async () => {
        if (!selectedProduct) return;
        setIsSaving(true);
        try {
            await saveProduct(selectedProduct, productImageFile || undefined);
            showNotification('Produto salvo com sucesso!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Erro ao salvar produto.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (productId: string) => {
        if (window.confirm('Tem certeza que deseja excluir este produto?')) {
            try {
                await deleteProduct(productId);
                showNotification('Produto excluído com sucesso!', 'success');
            } catch (error: any) {
                showNotification(error.message || 'Erro ao excluir produto.', 'error');
            }
        }
    };

    if (loading.products) {
        return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Button onClick={() => handleOpenModal()}>
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Adicionar Produto
                </Button>
            </div>
            
            {products.length === 0 ? (
                <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <p className="text-gray-500">Nenhum produto cadastrado na loja.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map(product => (
                        <div key={product.id} className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden flex flex-col">
                            <img src={product.imageUrl} alt={product.name} className="h-48 w-full object-cover" />
                            <div className="p-4 flex-grow">
                                <h3 className="font-bold text-lg">{product.name}</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">{product.description}</p>
                                <p className="text-primary-500 font-bold mt-2">R$ {product.price.toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-1">Estoque: {product.stock || 0}</p>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-700 flex justify-end gap-2 border-t dark:border-gray-600">
                                <Button size="sm" variant="secondary" onClick={() => handleOpenModal(product)}><EditIcon className="w-4 h-4" /></Button>
                                <Button size="sm" variant="danger" onClick={() => handleDelete(product.id)}><TrashIcon className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

             {isModalOpen && selectedProduct && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in selectedProduct ? 'Editar Produto' : 'Adicionar Produto'}>
                    <ProductForm product={selectedProduct} setProduct={setSelectedProduct} onFileChange={setProductImageFile} />
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleSave} isLoading={isSaving}>Salvar</Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const ProductForm = ({ product, setProduct, onFileChange }: { product: any, setProduct: any, onFileChange: (file: File | null) => void }) => {
    const [imagePreview, setImagePreview] = useState<string | null>(product.imageUrl);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileChange(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setProduct({ ...product, [name]: type === 'number' ? parseFloat(value) : value });
    };

    return (
        <div className="space-y-4">
            <Input label="Nome do Produto" name="name" value={product.name} onChange={handleChange} />
            <Input label="Descrição" name="description" value={product.description} onChange={handleChange} />
            <div className="grid grid-cols-2 gap-4">
                <Input label="Preço" name="price" type="number" step="0.01" value={product.price} onChange={handleChange} />
                <Input label="Estoque" name="stock" type="number" value={product.stock || 0} onChange={handleChange} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Imagem do Produto
                </label>
                {imagePreview && (
                    <img 
                        src={imagePreview} 
                        alt="Preview do produto" 
                        className="w-full h-48 object-cover rounded-md mb-2 bg-gray-100 dark:bg-gray-700"
                    />
                )}
                <Input 
                    label=""
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    containerClassName="mb-0"
                />
            </div>
        </div>
    );
}


const OrdersManagement = ({ appContext }: { appContext: AppContextType }) => {
    const { orders, loading, updateOrderStatus, showNotification } = appContext;
    
    const handleStatusChange = async (orderId: string, status: OrderStatus) => {
        try {
            await updateOrderStatus(orderId, status);
            showNotification('Status do pedido atualizado!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao atualizar status.', 'error');
        }
    };
    
    return (
        <div>
            {loading.orders ? <Spinner /> : (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Itens</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{order.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">R$ {order.total.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{toDate(order.createdAt)?.toLocaleDateString() || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Select 
                                            label=""
                                            value={order.status} 
                                            onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                                            options={[{value: 'Pendente', label: 'Pendente'}, {value: 'Enviado', label: 'Enviado'}, {value: 'Entregue', label: 'Entregue'}]}
                                            containerClassName="mb-0"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};


export default StoreAdminView;
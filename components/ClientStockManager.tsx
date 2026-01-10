
import React, { useState } from 'react';
import { ClientProduct, StockProduct } from '../types';
import { Select } from './Select';
import { Input } from './Input';
import { Button } from './Button';
import { TrashIcon, PlusIcon } from '../constants';

interface ClientStockManagerProps {
    stock: ClientProduct[];
    allStockProducts: StockProduct[];
    onStockChange: (stock: ClientProduct[]) => void;
}

export const ClientStockManager: React.FC<ClientStockManagerProps> = ({ stock, allStockProducts, onStockChange }) => {
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [maxQuantity, setMaxQuantity] = useState(5);

    const addProductToStock = () => {
        const productToAdd = allStockProducts.find(p => p.id === selectedProduct);
        if (productToAdd && !stock.some(p => p.productId === selectedProduct)) {
            onStockChange([...stock, { 
                productId: productToAdd.id, 
                name: productToAdd.name, 
                quantity: quantity,
                maxQuantity: maxQuantity
            }]);
            setSelectedProduct('');
            setQuantity(1);
            setMaxQuantity(5);
        }
    };

    const removeProductFromStock = (productId: string) => {
        onStockChange(stock.filter(p => p.productId !== productId));
    };

    const updateStockItem = (productId: string, field: 'quantity' | 'maxQuantity', value: number) => {
        onStockChange(stock.map(p => p.productId === productId ? { ...p, [field]: value } : p));
    };

    return (
        <fieldset className="border p-3 md:p-4 rounded-lg dark:border-gray-600 bg-gray-50/30 dark:bg-gray-800/10">
            <legend className="px-2 font-bold text-gray-700 dark:text-gray-300">📦 Gerenciar Estoque no Cliente</legend>
            
            {/* Seção de Adição */}
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 mb-4 shadow-sm">
                <div className="flex flex-col space-y-3">
                    <Select
                        label="Novo Produto"
                        value={selectedProduct}
                        onChange={e => setSelectedProduct(e.target.value)}
                        options={[
                            { value: '', label: 'Selecione para adicionar...' }, 
                            ...allStockProducts
                                .filter(ap => !stock.some(s => s.productId === ap.id))
                                .map(p => ({ value: p.id, label: `${p.name} (${p.unit})` }))
                        ]}
                        containerClassName="!mb-0"
                    />
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <Input
                                label="Qtd. Atual"
                                type="number"
                                value={quantity}
                                onChange={e => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                                min="0"
                                className="text-center font-bold"
                                containerClassName="!mb-0"
                            />
                        </div>
                        <div className="flex-1">
                            <Input
                                label="Capacidade Máx."
                                type="number"
                                value={maxQuantity}
                                onChange={e => setMaxQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                min="1"
                                className="text-center font-bold"
                                containerClassName="!mb-0"
                            />
                        </div>
                        <Button 
                            onClick={addProductToStock} 
                            className="h-[42px] px-4" 
                            disabled={!selectedProduct}
                            title="Adicionar ao cliente"
                        >
                            <PlusIcon className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Cabeçalho da Lista (Apenas Desktop) */}
            <div className="hidden md:flex items-center gap-4 px-3 mb-2 text-[10px] uppercase tracking-wider font-bold text-gray-400">
                <div className="flex-grow">Produto</div>
                <div className="w-24 text-center">Atual</div>
                <div className="w-24 text-center">Máximo</div>
                <div className="w-10"></div>
            </div>

            {/* Lista de Itens */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {stock.length > 0 ? stock.map(item => {
                    const stockItem = allStockProducts.find(sp => sp.id === item.productId);
                    const unit = stockItem?.unit || 'un';
                    const isLow = item.maxQuantity ? (item.quantity <= item.maxQuantity * 0.3) : false;
                    
                    return (
                        <div key={item.productId} className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-colors hover:border-primary-300 dark:hover:border-primary-800">
                            <div className="flex-grow min-w-0">
                                <span className={`font-bold block truncate ${isLow ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>
                                    {item.name}
                                </span>
                                <span className="text-[10px] text-gray-500 uppercase">{unit}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-gray-50 dark:bg-gray-900 rounded-md border dark:border-gray-600 p-1">
                                    <Input
                                        label=""
                                        type="number"
                                        value={item.quantity}
                                        onChange={e => updateStockItem(item.productId, 'quantity', parseInt(e.target.value) || 0)}
                                        min="0"
                                        className="!w-16 !p-1 text-center font-bold border-none bg-transparent !ring-0"
                                        containerClassName="!mb-0"
                                    />
                                    <span className="text-gray-400 text-xs px-1">/</span>
                                    <Input
                                        label=""
                                        type="number"
                                        value={item.maxQuantity || 0}
                                        onChange={e => updateStockItem(item.productId, 'maxQuantity', parseInt(e.target.value) || 0)}
                                        min="1"
                                        className="!w-16 !p-1 text-center font-bold border-none bg-transparent !ring-0 text-gray-500"
                                        containerClassName="!mb-0"
                                    />
                                </div>

                                <Button 
                                    variant="danger" 
                                    size="sm" 
                                    onClick={() => removeProductFromStock(item.productId)}
                                    className="!p-2"
                                    title="Remover produto"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                        <p className="text-gray-400 text-sm">Nenhum produto no estoque deste cliente.</p>
                    </div>
                )}
            </div>
        </fieldset>
    );
};

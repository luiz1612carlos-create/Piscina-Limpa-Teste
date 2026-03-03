import React, { useState } from 'react';
import { ClientProduct, StockProduct } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { PlusIcon, TrashIcon } from '../constants';

interface ClientStockManagerProps {
    stock: ClientProduct[];
    allStockProducts: StockProduct[];
    onStockChange: (newStock: ClientProduct[]) => void;
}

export const ClientStockManager: React.FC<ClientStockManagerProps> = ({ stock, allStockProducts, onStockChange }) => {
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);

    const handleAdd = () => {
        if (!selectedProductId) return;
        
        const productToAdd = allStockProducts.find(p => p.id === selectedProductId);
        if (!productToAdd) return;

        const existingItemIndex = stock.findIndex(item => item.productId === selectedProductId);
        
        if (existingItemIndex >= 0) {
            // Update existing
            const newStock = [...stock];
            newStock[existingItemIndex].maxQuantity = (newStock[existingItemIndex].maxQuantity || 0) + quantity;
            onStockChange(newStock);
        } else {
            // Add new
            const newItem: ClientProduct = {
                productId: productToAdd.id,
                name: productToAdd.name,
                quantity: 0, 
                currentStock: 0,
                maxStock: quantity
            };
            onStockChange([...stock, newItem]);
        }
        setSelectedProductId('');
        setQuantity(1);
    };

    const handleRemove = (index: number) => {
        const newStock = [...stock];
        newStock.splice(index, 1);
        onStockChange(newStock);
    };

    const handleUpdate = (index: number, field: keyof ClientProduct, value: number) => {
        const newStock = [...stock];
        (newStock[index] as any)[field] = value;
        onStockChange(newStock);
    };

    const availableProducts = allStockProducts.filter(p => !stock.some(s => s.productId === p.id));
    
    const productOptions = [
        { value: '', label: 'Selecione um produto' },
        ...availableProducts.map(p => ({ value: p.id, label: p.name }))
    ];

    return (
        <div className="border p-4 rounded-md dark:border-gray-600 mt-4">
             <legend className="px-2 font-semibold mb-4">Estoque do Cliente (Produtos Químicos)</legend>
             
             <div className="flex gap-2 mb-4 items-end">
                 <Select 
                    label="Adicionar Produto" 
                    options={productOptions} 
                    value={selectedProductId} 
                    onChange={(e) => setSelectedProductId(e.target.value)} 
                    containerClassName="flex-grow !mb-0"
                 />
                 <Input 
                    label="Qtd Ideal" 
                    type="number" 
                    value={quantity} 
                    onChange={(e) => setQuantity(Number(e.target.value))} 
                    containerClassName="w-24 !mb-0"
                 />
                 <Button onClick={handleAdd} disabled={!selectedProductId} size="sm" className="h-[42px] px-4">
                    <PlusIcon className="w-5 h-5" />
                 </Button>
             </div>

             <div className="space-y-2">
                 {stock.length === 0 && <p className="text-gray-500 text-sm text-center">Nenhum produto monitorado.</p>}
                 {stock.map((item, index) => (
                     <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                         <span className="font-medium text-sm flex-grow truncate mr-2">{item.name}</span>
                         <div className="flex items-center gap-2 flex-shrink-0">
                             <div className="text-xs">
                                 <label className="block text-gray-500 text-[10px] mb-0.5 text-center">Atual</label>
                                 <input 
                                    type="number" 
                                    className="w-16 p-1 border rounded text-center dark:bg-gray-800 dark:border-gray-600 text-sm"
                                    value={item.currentStock || 0}
                                    onChange={(e) => handleUpdate(index, 'currentStock', Number(e.target.value))}
                                 />
                             </div>
                             <div className="text-xs">
                                 <label className="block text-gray-500 text-[10px] mb-0.5 text-center">Ideal</label>
                                 <input 
                                    type="number" 
                                    className="w-16 p-1 border rounded text-center dark:bg-gray-800 dark:border-gray-600 text-sm"
                                    value={item.maxStock || item.quantity || 0}
                                    onChange={(e) => handleUpdate(index, 'maxStock', Number(e.target.value))}
                                 />
                             </div>
                             <button onClick={() => handleRemove(index)} className="text-red-500 hover:text-red-700 p-1 ml-1">
                                 <TrashIcon className="w-5 h-5" />
                             </button>
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
};
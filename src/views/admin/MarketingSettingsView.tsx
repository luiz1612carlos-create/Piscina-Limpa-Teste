import React, { useState } from 'react';
import { AppContextType, ReviewSlide } from '../../types';
import { Card, CardHeader, CardContent } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ToggleSwitch } from '../../components/ToggleSwitch';

interface MarketingSettingsViewProps {
    appContext: AppContextType;
}

const MarketingSettingsView: React.FC<MarketingSettingsViewProps> = ({ appContext }) => {
    const { settings, updateSettings, showNotification } = appContext;
    const [localSlides, setLocalSlides] = useState<ReviewSlide[]>(settings?.reviewSlides || []);
    const [slideImages, setSlideImages] = useState<{ [key: string]: File }>({});
    const [previews, setPreviews] = useState<{ [key: string]: string }>({});
    const [isSaving, setIsSaving] = useState(false);

    const handleSlideChange = (id: string, field: keyof ReviewSlide, value: any) => {
        setLocalSlides(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleImageChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSlideImages(prev => ({ ...prev, [id]: file }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviews(prev => ({ ...prev, [id]: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddSlide = () => {
        const newId = Date.now().toString();
        setLocalSlides(prev => [...prev, { id: newId, imageUrl: '', linkUrl: '', text: 'Novo Slide', active: true }]);
    };

    const handleRemoveSlide = (id: string) => {
        setLocalSlides(prev => prev.filter(s => s.id !== id));
        const newImages = { ...slideImages };
        delete newImages[id];
        setSlideImages(newImages);
        const newPreviews = { ...previews };
        delete newPreviews[id];
        setPreviews(newPreviews);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ reviewSlides: localSlides }, undefined, false, undefined, undefined, undefined, slideImages);
            showNotification('Configurações de marketing salvas!', 'success');
        } catch (error) {
            showNotification('Erro ao salvar configurações.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Marketing & Slides</h2>
                    <p className="text-sm text-gray-500">Gerencie os slides de avaliação que aparecem no painel público.</p>
                </div>
                <Button onClick={handleAddSlide} variant="secondary" size="sm">
                    + Adicionar Slide
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {localSlides.map((slide, index) => (
                    <Card key={slide.id} className="border-l-4 border-primary-500 overflow-hidden">
                        <CardHeader className="bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center py-3">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-gray-600 dark:text-gray-400">Slide #{index + 1}</h3>
                            <div className="flex items-center gap-4">
                                <ToggleSwitch 
                                    label="Ativo" 
                                    enabled={slide.active} 
                                    onChange={(val) => handleSlideChange(slide.id, 'active', val)} 
                                />
                                <button 
                                    onClick={() => handleRemoveSlide(slide.id)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Remover Slide"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-widest">Imagem do Slide</label>
                                    <div className="relative group aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center">
                                        {(previews[slide.id] || slide.imageUrl) ? (
                                            <img 
                                                src={previews[slide.id] || slide.imageUrl} 
                                                alt="Preview" 
                                                className="w-full h-full object-contain"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <div className="text-center p-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mx-auto text-gray-400 mb-2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                                </svg>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">Upload Imagem</span>
                                            </div>
                                        )}
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => handleImageChange(slide.id, e)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 italic">Recomendado: 1200x600px. A imagem será ajustada para caber sem cortes.</p>
                                </div>
                                <div className="md:col-span-2 space-y-4">
                                    <Input 
                                        label="Texto do Slide" 
                                        value={slide.text} 
                                        onChange={(e) => handleSlideChange(slide.id, 'text', e.target.value)}
                                        placeholder="Ex: Veja nossas avaliações no Google"
                                    />
                                    <Input 
                                        label="Link de Redirecionamento" 
                                        value={slide.linkUrl} 
                                        onChange={(e) => handleSlideChange(slide.id, 'linkUrl', e.target.value)}
                                        placeholder="Ex: https://g.page/sua-empresa/review"
                                    />
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase leading-tight">
                                            Dica: Use links diretos para suas avaliações no Google, Facebook ou TripAdvisor para aumentar sua credibilidade.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {localSlides.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500">Nenhum slide configurado. Adicione um para começar.</p>
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-6 border-t dark:border-gray-700">
                <Button onClick={handleSave} isLoading={isSaving} size="lg" className="w-full md:w-auto px-12">
                    Salvar Todas as Alterações
                </Button>
            </div>
        </div>
    );
};

export default MarketingSettingsView;

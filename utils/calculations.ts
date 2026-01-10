
import { Client, Settings, PricingSettings } from '../types';

/**
 * Normaliza uma dimensão (largura, comprimento, profundidade) para um número seguro.
 * Trata vírgulas, strings vazias, null, undefined e NaN.
 */
export const normalizeDimension = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    
    const stringValue = String(value).trim();
    if (stringValue === '') return 0;
    
    const normalized = stringValue.replace(',', '.');
    const number = parseFloat(normalized);
    
    if (isNaN(number) || !isFinite(number)) return 0;
    
    return number;
};

/**
 * Calcula o volume da piscina em litros.
 */
export const calculateVolume = (
    width: string | number | null | undefined, 
    length: string | number | null | undefined, 
    depth: string | number | null | undefined
): number => {
    const w = normalizeDimension(width);
    const l = normalizeDimension(length);
    const d = normalizeDimension(depth);

    if (w > 0 && l > 0 && d > 0) {
        const volume = w * l * d * 1000;
        return isFinite(volume) ? volume : 0;
    }
    
    return 0;
};

/**
 * Calcula a distância de condução entre dois pontos usando OSRM e OpenStreetMap.
 * Inclui fallbacks agressivos para evitar erros de "Endereço não encontrado".
 */
export const calculateDrivingDistance = async (origin: string, destination: string): Promise<number> => {
    try {
        const fetchCoords = async (query: string): Promise<{ lat: string, lon: string } | null> => {
            // Limpa a query de caracteres especiais e espaços extras
            const cleanQuery = query.replace(/[#-]/g, ' ').replace(/\s+/g, ' ').trim();
            
            // Pequeno delay para evitar rate limit do Nominatim
            await new Promise(r => setTimeout(r, 400)); 
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1`, {
                    headers: { 'User-Agent': 'PiscinaLimpaApp/1.0' }
                });
                
                if (!response.ok) return null;
                
                const data = await response.json();
                if (data && data.length > 0) {
                    return { lat: data[0].lat, lon: data[0].lon };
                }
            } catch (e) {
                console.warn("Falha na requisição de geocodificação:", e);
            }
            return null;
        };

        const getBestCoords = async (address: string, isOrigin = false): Promise<{ lat: string, lon: string }> => {
            const parts = address.split(',').map(p => p.trim()).filter(p => p !== '');
            
            // Tentativa 1: Endereço completo
            let coords = await fetchCoords(address);
            if (coords) return coords;

            // Tentativa 2: Sem o número (ajuda se o número for novo ou mal mapeado)
            if (parts.length > 2) {
                const noNumber = parts.filter((_, i) => i !== 1).join(', ');
                coords = await fetchCoords(noNumber);
                if (coords) return coords;
            }

            // Tentativa 3: Apenas Rua e Cidade
            if (parts.length >= 2) {
                coords = await fetchCoords(`${parts[0]}, ${parts[parts.length - 1]}`);
                if (coords) return coords;
            }
            
            // Tentativa 4: Apenas Cidade e Estado (Fallback de segurança)
            if (parts.length > 0) {
                const cityState = parts[parts.length - 1];
                coords = await fetchCoords(cityState);
                if (coords) return coords;
            }

            const errorMsg = isOrigin 
                ? "Endereço de origem (base da empresa) não configurado corretamente no painel administrativo."
                : `Não conseguimos localizar o endereço: ${address}. Tente simplificar o nome da rua.`;
            throw new Error(errorMsg);
        };

        const start = await getBestCoords(origin, true);
        const end = await getBestCoords(destination, false);

        // Cálculo da Rota via OSRM
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
        const routeResponse = await fetch(osrmUrl);
        const routeData = await routeResponse.json();

        if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
            const distanceInMeters = routeData.routes[0].distance;
            return parseFloat((distanceInMeters / 1000).toFixed(1));
        }
        
        // Fallback: Haversine com fator de correção urbana (1.3x)
        const R = 6371; 
        const dLat = (parseFloat(end.lat) - parseFloat(start.lat)) * (Math.PI/180);
        const dLon = (parseFloat(end.lon) - parseFloat(start.lon)) * (Math.PI/180);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(parseFloat(start.lat) * (Math.PI/180)) * Math.cos(parseFloat(end.lat) * (Math.PI/180)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; 
        return parseFloat((d * 1.3).toFixed(1));

    } catch (error: any) {
        console.error("Erro no cálculo de distância:", error);
        throw error;
    }
};

export const calculateClientMonthlyFee = (client: Partial<Client>, settings: Settings, overridePricing?: PricingSettings): number => {
    if (!client.poolVolume || client.poolVolume <= 0) return 0;

    const pricing = overridePricing || client.customPricing || settings.pricing;
    
    if (!pricing || !pricing.volumeTiers || pricing.volumeTiers.length === 0) {
        return 0;
    }
    
    const safeTiers = pricing.volumeTiers.map(tier => ({
        min: Number(tier.min),
        max: Number(tier.max),
        price: Number(tier.price)
    }));

    let basePrice = 0;
    const tier = safeTiers.find(t => client.poolVolume! >= t.min && client.poolVolume! <= t.max);

    if (tier) {
        basePrice = tier.price;
    } else {
        const sortedTiers = [...safeTiers].sort((a, b) => b.max - a.max);
        if (sortedTiers.length > 0 && client.poolVolume! > sortedTiers[0].max) {
            basePrice = sortedTiers[0].price;
        }
    }
    
    let total = basePrice;
    
    if (client.hasWellWater) total += Number(pricing.wellWaterFee || 0);
    if (client.includeProducts) total += Number(pricing.productsFee || 0);
    if (client.isPartyPool) total += Number(pricing.partyPoolFee || 0);

    if (client.distanceFromHq && client.distanceFromHq > 0 && pricing.perKm) {
        total += Number(client.distanceFromHq) * Number(pricing.perKm);
    }
    
    if (client.plan === 'VIP' && client.fidelityPlan) {
        const discount = total * (Number(client.fidelityPlan.discountPercent) / 100);
        total -= discount;
    }

    return parseFloat(total.toFixed(2));
};

export const compressImage = async (file: File, options: { maxWidth: number, quality: number }): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > options.maxWidth) {
                    height = Math.round((height * options.maxWidth) / width);
                    width = options.maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    } else {
                        reject(new Error('Canvas to Blob failed'));
                    }
                }, 'image/jpeg', options.quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

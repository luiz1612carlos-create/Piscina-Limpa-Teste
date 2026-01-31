import { Client, Settings, PricingSettings, Address } from '../types';

/**
 * Normaliza uma dimensão (largura, comprimento, profundidade) para um número seguro.
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

// FIX: Added missing formatAddressForGeocoding export to satisfy admin views requirements
/**
 * Formata um objeto Address em uma string para geocodificação simples.
 */
export const formatAddressForGeocoding = (addr: Address): string => {
    if (!addr) return '';
    return `${addr.street}, ${addr.number}, ${addr.neighborhood}, ${addr.city}, ${addr.state}`;
};

/**
 * Calcula a distância de condução entre dois pontos com fallback agressivo.
 * FIX: Updated to handle both Address objects and pre-formatted strings passed by some components.
 */
export const calculateDrivingDistance = async (origin: Address | string, dest: Address | string): Promise<number> => {
    const fetchCoords = async (query: string): Promise<{ lat: string, lon: string } | null> => {
        // Limpeza rigorosa da string de busca
        const cleanQuery = query
            .replace(/[#-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Delay obrigatório para respeitar a política de uso do Nominatim
        await new Promise(r => setTimeout(r, 1000)); 
        
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1&countrycodes=br`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'PiscinaLimpaApp_v2' }
            });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            if (data && data.length > 0) {
                return { lat: data[0].lat, lon: data[0].lon };
            }
        } catch (e) {
            console.warn("Falha na geocodificação:", e);
        }
        return null;
    };

    const getResilientCoords = async (loc: Address | string): Promise<{ lat: string, lon: string }> => {
        // FIX: Handle string input for backward compatibility with views using formatAddressForGeocoding
        if (typeof loc === 'string') {
            const coords = await fetchCoords(loc);
            if (coords) return coords;
            throw new Error(`Não foi possível localizar o endereço: ${loc}`);
        }

        // Tentativa 1: Endereço Completo (Rua, Número, Bairro, Cidade, Estado)
        let coords = await fetchCoords(`${loc.street}, ${loc.number}, ${loc.neighborhood}, ${loc.city}, ${loc.state}`);
        if (coords) return coords;

        // Tentativa 2: Rua e Número e Cidade (Ignora o Bairro, que costuma dar erro)
        coords = await fetchCoords(`${loc.street}, ${loc.number}, ${loc.city}, ${loc.state}`);
        if (coords) return coords;

        // Tentativa 3: Apenas Rua e Cidade (Ignora o Número exato)
        coords = await fetchCoords(`${loc.street}, ${loc.city}, ${loc.state}`);
        if (coords) return coords;

        // Tentativa 4: Apenas o Bairro e Cidade
        coords = await fetchCoords(`${loc.neighborhood}, ${loc.city}, ${loc.state}`);
        if (coords) return coords;

        throw new Error(`Não foi possível localizar o endereço: ${loc.street}. Tente simplificar o nome da rua.`);
    };

    try {
        const start = await getResilientCoords(origin);
        const end = await getResilientCoords(dest);

        // Se lat/lon forem idênticos (indicando que o mapa retornou o centro da cidade para ambos)
        if (start.lat === end.lat && start.lon === end.lon) {
            // Se forem objetos Address e as ruas forem diferentes, assume uma distância mínima simbólica
            const originStreet = typeof origin === 'string' ? '' : origin.street;
            const destStreet = typeof dest === 'string' ? '' : dest.street;
            return originStreet !== destStreet ? 2.0 : 0.5;
        }

        // Tenta calcular rota real via OSRM
        try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
            const routeResponse = await fetch(osrmUrl);
            const routeData = await routeResponse.json();

            if (routeData.code === 'Ok' && routeData.routes?.length > 0) {
                return parseFloat((routeData.routes[0].distance / 1000).toFixed(1));
            }
        } catch (e) {
            console.warn("OSRM falhou, usando cálculo linear");
        }
        
        // Fallback: Distância Haversine (Linha reta) com fator de correção para ruas (30% a mais)
        const R = 6371; 
        const dLat = (parseFloat(end.lat) - parseFloat(start.lat)) * (Math.PI/180);
        const dLon = (parseFloat(end.lon) - parseFloat(start.lon)) * (Math.PI/180);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(parseFloat(start.lat) * (Math.PI/180)) * Math.cos(parseFloat(end.lat) * (Math.PI/180)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return parseFloat((R * c * 1.3).toFixed(1));

    } catch (error: any) {
        console.error("Erro no cálculo de distância:", error);
        throw error;
    }
};

export const calculateClientMonthlyFee = (client: Partial<Client>, settings: Settings, overridePricing?: PricingSettings): number => {
    // PRIORIDADE: Valor manual inserido no cadastro
    if (client.manualFee !== undefined && client.manualFee !== null) {
        return client.manualFee;
    }

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
        const radius = Number(pricing.serviceRadius || 0);
        const distanceToCharge = Math.max(0, Number(client.distanceFromHq) - radius);
        total += distanceToCharge * Number(pricing.perKm);
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
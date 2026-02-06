import { Client, Settings, PricingSettings, Address } from '../types';

export const normalizeDimension = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    const stringValue = String(value).trim();
    if (stringValue === '') return 0;
    const normalized = stringValue.replace(',', '.');
    const number = parseFloat(normalized);
    if (isNaN(number) || !isFinite(number)) return 0;
    return number;
};

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

export const formatAddressForGeocoding = (addr: Address): string => {
    if (!addr) return '';
    return `${addr.street}, ${addr.number}, ${addr.neighborhood}, ${addr.city}, ${addr.state}`;
};

export const calculateDrivingDistance = async (origin: Address | string, dest: Address | string): Promise<number> => {
    const fetchCoords = async (query: string): Promise<{ lat: string, lon: string } | null> => {
        const cleanQuery = query.split(',')[0].split('-')[0].replace(/[#]/g, ' ').trim();
        const finalQuery = cleanQuery.length < 5 ? query : cleanQuery;
        await new Promise(r => setTimeout(r, 600)); 
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(finalQuery)}&limit=1&countrycodes=br`;
            const response = await fetch(url, { headers: { 'User-Agent': 'PiscinaLimpa_SafeSearch_v4' } });
            if (!response.ok) return null;
            const data = await response.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                if (Math.abs(lat) < 0.1 && Math.abs(lon) < 0.1) return null;
                return { lat: data[0].lat, lon: data[0].lon };
            }
        } catch (e) { console.warn("Falha na geocodificação:", e); }
        return null;
    };

    const getResilientCoords = async (loc: Address | string): Promise<{ lat: string, lon: string }> => {
        if (typeof loc === 'string') {
            const coords = await fetchCoords(loc);
            if (coords) return coords;
            throw new Error(`Localização não encontrada.`);
        }
        const streetBase = loc.street.split(',')[0].split('-')[0].trim();
        let coords = await fetchCoords(`${streetBase}, ${loc.number}, ${loc.city}, ${loc.state}, Brasil`);
        if (coords) return coords;
        coords = await fetchCoords(`${streetBase}, ${loc.city}, ${loc.state}, Brasil`);
        if (coords) return coords;
        coords = await fetchCoords(`${loc.city}, ${loc.state}, Brasil`);
        if (coords) return coords;
        throw new Error(`Não foi possível validar este endereço.`);
    };

    try {
        const start = await getResilientCoords(origin);
        const end = await getResilientCoords(dest);
        try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
            const routeResponse = await fetch(osrmUrl);
            const routeData = await routeResponse.json();
            if (routeData.code === 'Ok' && routeData.routes?.length > 0) {
                const distKm = parseFloat((routeData.routes[0].distance / 1000).toFixed(1));
                return distKm > 500 ? 0 : distKm;
            }
        } catch (e) { console.warn("Rota real falhou, usando cálculo linear"); }
        const R = 6371; 
        const dLat = (parseFloat(end.lat) - parseFloat(start.lat)) * (Math.PI/180);
        const dLon = (parseFloat(end.lon) - parseFloat(start.lon)) * (Math.PI/180);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(parseFloat(start.lat) * (Math.PI/180)) * Math.cos(parseFloat(end.lat) * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const linearDist = parseFloat((R * c * 1.3).toFixed(1));
        return linearDist > 500 ? 0 : linearDist;
    } catch (error: any) { console.error("Erro no cálculo de distância:", error); throw error; }
};

export const calculateClientMonthlyFee = (client: Partial<Client>, settings: Settings, overridePricing?: PricingSettings): number => {
    if (!client.poolVolume || client.poolVolume <= 0) return 0;
    const pricing = overridePricing || client.customPricing || settings.pricing;
    if (!pricing || !pricing.volumeTiers || pricing.volumeTiers.length === 0) return 0;
    const safeTiers = pricing.volumeTiers.map(tier => ({ min: Number(tier.min), max: Number(tier.max), price: Number(tier.price) }));
    let basePrice = 0;
    const tier = safeTiers.find(t => client.poolVolume! >= t.min && client.poolVolume! <= t.max);
    if (tier) basePrice = tier.price;
    else {
        const sortedTiers = [...safeTiers].sort((a, b) => b.max - a.max);
        if (sortedTiers.length > 0 && client.poolVolume! > sortedTiers[0].max) basePrice = sortedTiers[0].price;
    }
    let total = basePrice;
    if (client.hasWellWater) total += Number(pricing.wellWaterFee || 0);
    if (client.includeProducts) total += Number(pricing.productsFee || 0);
    if (client.isPartyPool) total += Number(pricing.partyPoolFee || 0);
    if (client.distanceFromHq && client.distanceFromHq > 0 && pricing.perKm) {
        if (client.distanceFromHq < 200) {
            const radius = Number(pricing.serviceRadius || 0);
            const distanceToCharge = Math.max(0, Number(client.distanceFromHq) - radius);
            total += distanceToCharge * Number(pricing.perKm);
        }
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
                        const newFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                        resolve(newFile);
                    } else reject(new Error('Canvas to Blob failed'));
                }, 'image/jpeg', options.quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
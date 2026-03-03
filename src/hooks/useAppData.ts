
// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'react';
import { db, firebase, auth, storage } from '../firebase';
import {
    Client, BudgetQuote, Routes, Product, Order, Settings, ClientProduct, UserData,
    OrderStatus, AppData, ReplenishmentQuote, ReplenishmentQuoteStatus, Bank, Transaction,
    AdvancePaymentRequest, AdvancePaymentRequestStatus, FidelityPlan, Visit, StockProduct,
    PendingPriceChange, PricingSettings, AffectedClientPreview, PoolEvent, RecessPeriod, PlanChangeRequest, PlanType,
    EmergencyRequest, ChatSession
} from '../types';
import { compressImage } from '../utils/calculations';

const isObject = (item: any) => (item && typeof item === 'object' && !Array.isArray(item));

const sanitizeData = (obj: any): any => {
    if (!isObject(obj)) return obj;
    const clean: any = {};
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (val !== undefined) {
            if (isObject(val) && !(val instanceof Date)) {
                clean[key] = sanitizeData(val);
            } else {
                clean[key] = val;
            }
        }
    });
    return clean;
};

const deepMerge = (target: any, source: any): any => {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

const defaultSettings: Settings = {
    companyName: "S.O.S Piscina Limpa",
    mainTitle: "S.O.S Piscina Limpa",
    mainSubtitle: "Compromisso e Qualidade",
    logoUrl: "",
    logoObjectFit: 'contain',
    logoTransforms: { scale: 1, rotate: 0, brightness: 1, contrast: 1, grayscale: 0 },
    baseAddress: { street: "", number: "", neighborhood: "", city: "", state: "", zip: "" },
    pixKey: "",
    pricing: { perKm: 1.5, serviceRadius: 5, wellWaterFee: 50, productsFee: 75, partyPoolFee: 100, publicPoolFee: 2400, volumeTiers: [] },
    plans: {
        simple: { title: "Plano Simples", benefits: [], terms: "" },
        vip: { title: "Plano VIP", benefits: [], terms: "" },
    },
    fidelityPlans: [],
    features: { vipPlanEnabled: true, planUpgradeEnabled: true, vipPlanDisabledMessage: "Em breve!", storeEnabled: true, advancePaymentPlanEnabled: false, advancePaymentTitle: "Economize!", advancePaymentSubtitleVIP: "", advancePaymentSubtitleSimple: "", maintenanceModeEnabled: false, maintenanceMessage: "" },
    automation: { replenishmentStockThreshold: 2 },
    advancePaymentOptions: [],
    aiBot: {
        enabled: false,
        name: 'Luiz',
        systemInstructions: '',
        siteUrl: '',
        humanHandoffMessage: 'Estamos direcionando seu atendimento para nossa Equipe, aguarde um momento!'
    },
    billingBot: {
        enabled: false,
        dryRun: true,
        daysBeforeDue: 3,
        messageTemplate: '',
        billingImage: ''
    },
    receiptBot: {
        enabled: false,
        templateName: '',
        templateLanguage: 'pt_BR',
        receiptImage: ''
    },
    poolStatusBot: {
        enabled: false,
        restrictedTemplate: '',
        restrictedImage: '',
        releasedTemplate: '',
        releasedImage: '',
        templateLanguage: 'pt_BR'
    },
    reviewSlides: [
        { id: '1', imageUrl: '', linkUrl: '', text: 'Avalie-nos no Google', active: true },
        { id: '2', imageUrl: '', linkUrl: '', text: 'Confira nossos serviços', active: true },
        { id: '3', imageUrl: '', linkUrl: '', text: 'Qualidade garantida', active: true }
    ],
    announcementMessageTemplate: ""
};

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

export const useAppData = (user: any | null, userData: UserData | null): AppData => {
    const [clients, setClients] = useState<Client[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [budgetQuotes, setBudgetQuotes] = useState<BudgetQuote[]>([]);
    const [routes, setRoutes] = useState<Routes>({});
    const [products, setProducts] = useState<Product[]>([]);
    const [stockProducts, setStockProducts] = useState<StockProduct[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [replenishmentQuotes, setReplenishmentQuotes] = useState<ReplenishmentQuote[]>([]);
    const [advancePaymentRequests, setAdvancePaymentRequests] = useState<AdvancePaymentRequest[]>([]);
    const [pendingPriceChanges, setPendingPriceChanges] = useState<PendingPriceChange[]>([]);
    const [poolEvents, setPoolEvents] = useState<PoolEvent[]>([]);
    const [planChangeRequests, setPlanChangeRequests] = useState<PlanChangeRequest[]>([]);
    const [emergencyRequests, setEmergencyRequests] = useState<EmergencyRequest[]>([]);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [setupCheck, setSetupCheck] = useState<'checking' | 'needed' | 'done'>('checking');
    
    const [loading, setLoading] = useState({
        clients: true, users: true, budgetQuotes: true, routes: true, products: true, stockProducts: true,
        orders: true, settings: true, replenishmentQuotes: true, banks: true, transactions: true,
        advancePaymentRequests: true, pendingPriceChanges: true, poolEvents: true, planChangeRequests: true,
        emergencyRequests: true, chatSessions: true
    });

    const isUserAdmin = userData?.role === 'admin';
    const isUserTechnician = userData?.role === 'technician';

    const setLoadingState = useCallback((key: keyof typeof loading, value: boolean) => {
        setLoading(prev => (prev[key] === value ? prev : { ...prev, [key]: value }));
    }, []);

    useEffect(() => {
        const unsub = db.collection('settings').doc('main').onSnapshot((doc: any) => {
            if (doc.exists) {
                setSettings(deepMerge(defaultSettings, doc.data()));
            } else {
                setSettings(defaultSettings);
            }
            setLoadingState('settings', false);
        }, (err: any) => {
            console.error("Settings error:", err);
            setSettings(defaultSettings);
            setLoadingState('settings', false);
        });
        return () => unsub();
    }, [setLoadingState]);

    useEffect(() => {
        if (!user) {
            setClients([]);
            setOrders([]);
            return;
        }
        
        const unsubs: (() => void)[] = [];

        if (isUserAdmin || isUserTechnician) {
            const sync = (col: string, set: Function, load: keyof typeof loading, order?: string) => {
                let q: any = db.collection(col);
                if (order) q = q.orderBy(order, 'desc');
                unsubs.push(q.onSnapshot((s: any) => {
                    set(s.docs.map((d: any) => ({ id: d.id, ...d.data() })));
                    setLoadingState(load, false);
                }, () => setLoadingState(load, false)));
            };

            sync('clients', setClients, 'clients', 'createdAt');
            sync('products', setProducts, 'products');
            sync('pre-budgets', setBudgetQuotes, 'budgetQuotes', 'createdAt');
            sync('orders', setOrders, 'orders', 'createdAt');
            sync('transactions', setTransactions, 'transactions', 'date');
            sync('stockProducts', setStockProducts, 'stockProducts');
            sync('chatSessions', setChatSessions, 'chatSessions', 'lastMessageAt');
            sync('emergencyRequests', setEmergencyRequests, 'emergencyRequests', 'createdAt');
            sync('banks', setBanks, 'banks');
            sync('advancePaymentRequests', setAdvancePaymentRequests, 'advancePaymentRequests', 'createdAt');
            sync('poolEvents', setPoolEvents, 'poolEvents');
            sync('planChangeRequests', setPlanChangeRequests, 'planChangeRequests', 'createdAt');
            sync('replenishmentQuotes', setReplenishmentQuotes, 'replenishmentQuotes', 'createdAt');
            sync('pendingPriceChanges', setPendingPriceChanges, 'pendingPriceChanges', 'createdAt');

            unsubs.push(db.collection('routes').doc('main').onSnapshot((doc: any) => {
                if (doc.exists) setRoutes(doc.data() as Routes);
                setLoadingState('routes', false);
            }, () => setLoadingState('routes', false)));

            unsubs.push(db.collection('users').where('role', '==', 'admin').onSnapshot((s: any) => {
                setUsers(s.docs.map(d => d.data() as UserData));
                setLoadingState('users', false);
            }, () => setLoadingState('users', false)));
        } else if (userData?.role === 'client') {
            unsubs.push(db.collection('clients').where('uid', '==', user.uid).onSnapshot((s: any) => {
                setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
                setLoadingState('clients', false);
            }, () => setLoadingState('clients', false)));

            unsubs.push(db.collection('products').onSnapshot((s: any) => {
                setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
                setLoadingState('products', false);
            }, () => setLoadingState('products', false)));
        }

        return () => unsubs.forEach(u => u());
    }, [user?.uid, isUserAdmin, isUserTechnician, userData?.role, setLoadingState]);

    useEffect(() => {
        const check = async () => {
            try {
                const s = await db.collection('users').where('role', '==', 'admin').limit(1).get();
                setSetupCheck(s.empty ? 'needed' : 'done');
            } catch (e) { setSetupCheck('done'); }
        };
        check();
    }, []);

    const updateClient = useCallback(async (id: string, data: Partial<Client>) => { 
        const clientRef = db.collection('clients').doc(id);
        const oldDoc = await clientRef.get();
        
        if (oldDoc.exists) {
            const oldData = oldDoc.data() as Client;
            const newUsage = data.poolStatus?.uso;
            
            if (newUsage && newUsage !== oldData.poolStatus?.uso) {
                try {
                    await fetch('/api/send-pool-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clientId: id,
                            clientPhone: data.phone || oldData.phone,
                            clientName: data.name || oldData.name,
                            newStatus: newUsage,
                            companyName: settings?.companyName || 'S.O.S Piscina Limpa'
                        })
                    });
                } catch (e) {
                    console.error("Erro ao disparar aviso de segurança:", e);
                }
            }
        }
        await clientRef.update(data); 
    }, [settings]);

    const deleteClient = useCallback(async (id: string) => { await db.collection('clients').doc(id).delete(); }, []);

    const updateSettings = useCallback(async (newSettings: Partial<Settings>, logoFile?: File, removeLogo?: boolean, onProgress?: (progress: number) => void, billingImageFile?: File, receiptImageFile?: File, slideImages?: { [key: string]: File }) => {
        const finalData = sanitizeData({ ...newSettings });

        if (removeLogo) {
            finalData.logoUrl = firebase.firestore.FieldValue.delete();
        } else if (logoFile) {
            const ref = storage.ref(`logos/logo_${Date.now()}`);
            const uploadTask = ref.put(logoFile);
            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snap: any) => onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100),
                    reject,
                    async () => {
                        finalData.logoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve();
                    }
                );
            });
        }

        if (billingImageFile) {
            const ref = storage.ref(`billing/image_${Date.now()}`);
            const uploadTask = ref.put(billingImageFile);
            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snap: any) => onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100),
                    reject,
                    async () => {
                        const url = await uploadTask.snapshot.ref.getDownloadURL();
                        if (!finalData.billingBot) finalData.billingBot = {};
                        finalData.billingBot.billingImage = url;
                        resolve();
                    }
                );
            });
        }

        if (receiptImageFile) {
            const ref = storage.ref(`receipts/image_${Date.now()}`);
            const uploadTask = ref.put(receiptImageFile);
            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snap: any) => onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100),
                    reject,
                    async () => {
                        const url = await uploadTask.snapshot.ref.getDownloadURL();
                        if (!finalData.receiptBot) finalData.receiptBot = {};
                        finalData.receiptBot.receiptImage = url;
                        resolve();
                    }
                );
            });
        }

        if (slideImages && Object.keys(slideImages).length > 0) {
            const slides = finalData.reviewSlides || [];
            for (const slideId of Object.keys(slideImages)) {
                const file = slideImages[slideId];
                const ref = storage.ref(`slides/slide_${slideId}_${Date.now()}`);
                const uploadTask = ref.put(file);
                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        null,
                        reject,
                        async () => {
                            const url = await uploadTask.snapshot.ref.getDownloadURL();
                            const slideIndex = slides.findIndex(s => s.id === slideId);
                            if (slideIndex > -1) {
                                slides[slideIndex].imageUrl = url;
                            }
                            resolve();
                        }
                    );
                });
            }
            finalData.reviewSlides = slides;
        }

        await db.collection('settings').doc('main').set(finalData, { merge: true });
    }, []);

    const markAsPaid = useCallback(async (client: Client, months: number, total: number) => {
        if (!client.bankId) throw new Error("Associe um banco.");
        const batch = db.batch();
        batch.set(db.collection('transactions').doc(), { clientId: client.id, clientName: client.name, bankId: client.bankId, amount: total, date: firebase.firestore.FieldValue.serverTimestamp() });
        const next = new Date(client.payment.dueDate);
        next.setMonth(next.getMonth() + months);
        batch.update(db.collection('clients').doc(client.id), { 'payment.status': 'Pago', 'payment.dueDate': next.toISOString() });
        await batch.commit();

        try {
            const bank = banks.find(b => b.id === client.bankId);
            await fetch('/api/send-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: client.id,
                    clientPhone: client.phone,
                    clientName: client.name,
                    amount: total,
                    paymentMethod: bank?.name || 'Pix/Transferência',
                    companyName: settings?.companyName || 'S.O.S Piscina Limpa'
                })
            });
        } catch (e) {
            console.error("Erro ao disparar recibo:", e);
        }
    }, [banks, settings]);

    const addVisitRecord = useCallback(async (cid: string, v: any, file?: File, onProgress?: (progress: number) => void) => {
        const visitId = db.collection('clients').doc().id;
        let photoUrl = '';
        if (file) {
            const compressed = await compressImage(file, { maxWidth: 1920, quality: 0.75 });
            const uploadTask = storage.ref(`visits/${cid}/${visitId}`).put(compressed);
            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', (s: any) => onProgress?.((s.bytesTransferred / s.totalBytes) * 100), reject, async () => {
                    photoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve();
                });
            });
        }
        
        const clientDoc = await db.collection('clients').doc(cid).get();
        if (clientDoc.exists) {
            const oldData = clientDoc.data() as Client;
            if (v.uso !== oldData.poolStatus?.uso) {
                try {
                    await fetch('/api/send-pool-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clientId: cid,
                            clientPhone: oldData.phone,
                            clientName: oldData.name,
                            newStatus: v.uso,
                            companyName: settings?.companyName || 'S.O.S Piscina Limpa'
                        })
                    });
                } catch (e) {
                    console.error("Erro ao enviar aviso de status da visita:", e);
                }
            }
        }

        await db.collection('clients').doc(cid).update({
            visitHistory: firebase.firestore.FieldValue.arrayUnion({ ...v, id: visitId, photoUrl, timestamp: firebase.firestore.Timestamp.now() }),
            'poolStatus.ph': v.ph, 'poolStatus.cloro': v.cloro, 'poolStatus.uso': v.uso
        });
    }, [settings]);

    const approveBudgetQuote = useCallback(async (id: string, pass: string, dist?: number) => { 
        const budgetDoc = await db.collection('pre-budgets').doc(id).get();
        if (!budgetDoc.exists) throw new Error("Orçamento não encontrado.");
        const budget = budgetDoc.data() as BudgetQuote;
        
        const config = (window as any).firebaseConfig;
        const secondaryApp = firebase.initializeApp(config, `AppApproval_${Date.now()}`);
        
        try {
            const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(budget.email, pass);
            const newUid = userCredential.user.uid;
            const batch = db.batch();
            batch.set(db.collection('users').doc(newUid), { name: budget.name, email: budget.email, role: 'client', uid: newUid });
            batch.set(db.collection('clients').doc(), {
                uid: newUid, name: budget.name, email: budget.email, phone: budget.phone, address: budget.address,
                poolDimensions: budget.poolDimensions, poolVolume: budget.poolVolume, hasWellWater: budget.hasWellWater,
                includeProducts: false, isPartyPool: budget.isPartyPool, isPublicPool: budget.isPublicPool || false,
                plan: budget.plan, clientStatus: 'Ativo',
                poolStatus: { ph: 7.2, cloro: 1.5, alcalinidade: 100, uso: 'Livre para uso' },
                payment: { status: 'Pendente', dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() },
                stock: [], pixKey: '', createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastVisitDuration: 0,
                distanceFromHq: dist || budget.distanceFromHq || 0, fidelityPlan: budget.fidelityPlan || null
            });
            batch.update(db.collection('pre-budgets').doc(id), { status: 'approved' });
            await batch.commit();
        } finally {
            await secondaryApp.delete();
        }
    }, []);

    const createBudgetQuote = useCallback(async (b: any) => { await db.collection('pre-budgets').add({ ...b, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const createOrder = useCallback(async (o: any) => { await db.collection('orders').add({ ...o, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    
    const sendAdminChatMessage = useCallback(async (sessionId: string, text: string) => {
        try {
            await fetch('/api/admin-chat', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ sessionId, text }) 
            });
        } catch (error) {
            const sessionRef = db.collection("chatSessions").doc(sessionId);
            await sessionRef.collection("messages").add({ text, sender: "admin", timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            await sessionRef.update({ lastMessage: text, lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(), status: "human", isHuman: true, unreadCount: 0 });
        }
    }, []);

    const closeChatSession = useCallback(async (sid: string) => { 
        await db.collection('chatSessions').doc(sid).update({ status: 'bot', isHuman: false, lastInteractionAt: firebase.firestore.FieldValue.serverTimestamp() }); 
    }, []);

    const rejectBudgetQuote = useCallback(async (id: string) => { await db.collection('pre-budgets').doc(id).delete(); }, []);
    const updateClientStock = useCallback(async (id: string, s: ClientProduct[]) => { await db.collection('clients').doc(id).update({ stock: s }); }, []);
    const scheduleClient = useCallback(async (id: string, day: string) => {
        const c = clients.find(cl => cl.id === id);
        if (c) await db.collection('routes').doc('main').set({ [day]: { day, isRouteActive: false, clients: firebase.firestore.FieldValue.arrayUnion(c) } }, { merge: true });
    }, [clients]);

    const unscheduleClient = useCallback(async (id: string, day: string) => {
        const c = routes[day]?.clients.find(cl => cl.id === id);
        if (c) await db.collection('routes').doc('main').update({ [`${day}.clients`]: firebase.firestore.FieldValue.arrayRemove(c) });
    }, [routes]);

    const toggleRouteStatus = useCallback(async (d: string, s: boolean) => { await db.collection('routes').doc('main').update({ [`${d}.isRouteActive`]: s }); }, []);
    
    const saveProduct = useCallback(async (p: any, file?: File) => {
        const ref = p.id ? db.collection('products').doc(p.id) : db.collection('products').doc();
        let data = { ...p };
        if (file) {
            const snap = await storage.ref(`products/${ref.id}`).put(file);
            data.imageUrl = await snap.ref.getDownloadURL();
        }
        p.id ? await ref.update(data) : await ref.set(data);
    }, []);

    const deleteProduct = useCallback(async (id: string) => { await db.collection('products').doc(id).delete(); }, []);
    const saveStockProduct = useCallback(async (p: any) => { p.id ? await db.collection('stockProducts').doc(p.id).update(p) : await db.collection('stockProducts').add(p); }, []);
    const deleteStockProduct = useCallback(async (id: string, cleanupClients?: boolean) => { 
        await db.collection('stockProducts').doc(id).delete();
        if (cleanupClients) await removeStockProductFromAllClients(id);
    }, []);

    const removeStockProductFromAllClients = useCallback(async (id: string) => {
        const affected = clients.filter(c => c.stock.some(s => s.productId === id));
        if (affected.length === 0) return 0;
        const batch = db.batch();
        affected.forEach(client => {
            const newStock = client.stock.filter(s => s.productId !== id);
            batch.update(db.collection('clients').doc(client.id), { stock: newStock });
        });
        await batch.commit();
        return affected.length;
    }, [clients]);

    const saveBank = useCallback(async (b: any) => { b.id ? await db.collection('banks').doc(b.id).update(b) : await db.collection('banks').add(b); }, []);
    const deleteBank = useCallback(async (id: string) => { await db.collection('banks').doc(id).delete(); }, []);
    const updateOrderStatus = useCallback(async (id: string, s: OrderStatus) => { await db.collection('orders').doc(id).update({ status: s }); }, []);
    
    const schedulePriceChange = useCallback(async (p: PricingSettings, a: AffectedClientPreview[], d: Date) => {
        await db.collection('pendingPriceChanges').add({ effectiveDate: firebase.firestore.Timestamp.fromDate(d), newPricing: p, affectedClients: a, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }, []);
    
    const getClientData = useCallback(async () => clients[0] || null, [clients]);
    
    const createInitialAdmin = useCallback(async (n: string, e: string, p: string) => {
        const cred = await auth.createUserWithEmailAndPassword(e, p);
        await db.collection('users').doc(cred.user.uid).set({ name: n, email: e, role: 'admin', uid: cred.user.uid });
        setSetupCheck('done');
    }, []);

    const createTechnician = useCallback(async (n: string, e: string, p: string) => {
        const cred = await auth.createUserWithEmailAndPassword(e, p);
        await db.collection('users').doc(cred.user.uid).set({ name: n, email: e, role: 'technician', uid: cred.user.uid });
        await auth.signOut();
    }, []);

    const updateReplenishmentQuoteStatus = useCallback(async (id: string, s: ReplenishmentQuoteStatus) => { await db.collection('replenishmentQuotes').doc(id).update({ status: s }); }, []);
    
    const triggerReplenishmentAnalysis = useCallback(async () => {
        if (userData?.role !== 'admin' || products.length === 0) return 0;
        const threshold = settings?.automation?.replenishmentStockThreshold || 2;
        const batch = db.batch();
        let createdCount = 0;
        const activeQuoteClientIds = new Set(replenishmentQuotes.filter(q => q.status === 'suggested' || q.status === 'sent').map(q => q.clientId));
        clients.forEach(client => {
            if (client.clientStatus !== 'Ativo' || !client.stock || client.stock.length === 0) return;
            const clientIdForQuote = client.id;
            if (activeQuoteClientIds.has(clientIdForQuote)) return;
            const itemsToReplenish: any[] = [];
            client.stock.forEach(sItem => {
                const current = sItem.currentStock ?? sItem.quantity ?? 0;
                const max = sItem.maxStock ?? sItem.maxQuantity ?? 5;
                if (current <= threshold) {
                    const storeProduct = products.find(p => p.id === sItem.productId || p.name.trim().toLowerCase() === sItem.name.trim().toLowerCase());
                    const quantityNeeded = max - current;
                    if (storeProduct && quantityNeeded > 0) {
                        itemsToReplenish.push({ ...storeProduct, quantity: quantityNeeded, subtotal: quantityNeeded * storeProduct.price });
                    }
                }
            });
            if (itemsToReplenish.length > 0) {
                const total = itemsToReplenish.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
                const ref = db.collection('replenishmentQuotes').doc();
                batch.set(ref, sanitizeData({ clientId: clientIdForQuote, clientName: client.name, items: itemsToReplenish, total, status: 'suggested', createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
                createdCount++;
            }
        });
        if (createdCount > 0) await batch.commit();
        return createdCount;
    }, [clients, products, replenishmentQuotes, settings, userData]);

    const createAdvancePaymentRequest = useCallback(async (r: any) => { await db.collection('advancePaymentRequests').add({ ...r, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    
    const approveAdvancePaymentRequest = useCallback(async (id: string) => {
        const reqDoc = await db.collection('advancePaymentRequests').doc(id).get();
        if (!reqDoc.exists) throw new Error("Solicitação não encontrada.");
        const request = reqDoc.data() as AdvancePaymentRequest;
        let clientDocRef = null;
        let clientData: any = null;
        const clientByUidQuery = await db.collection('clients').where('uid', '==', request.clientId).limit(1).get();
        if (!clientByUidQuery.empty) {
            clientDocRef = clientByUidQuery.docs[0].ref;
            clientData = clientByUidQuery.docs[0].data() as Client;
        } else {
            const clientByIdDoc = await db.collection('clients').doc(request.clientId).get();
            if (clientByIdDoc.exists) {
                clientDocRef = clientByIdDoc.ref;
                clientData = clientByIdDoc.data() as Client;
            }
        }
        if (!clientDocRef || !clientData) throw new Error("Cliente não localizado.");
        const batch = db.batch();
        batch.update(db.collection('advancePaymentRequests').doc(id), { status: 'approved', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        let currentDueDate = toDate(clientData.payment?.dueDate);
        if (!currentDueDate) currentDueDate = new Date();
        const nextDate = new Date(currentDueDate);
        nextDate.setMonth(nextDate.getMonth() + request.months);
        batch.update(clientDocRef, { 'payment.status': 'Pago', 'payment.dueDate': nextDate.toISOString(), 'advancePaymentUntil': firebase.firestore.Timestamp.fromDate(nextDate) });
        const bank = banks.find(b => b.id === clientData!.bankId);
        batch.set(db.collection('transactions').doc(), { clientId: clientDocRef.id, clientName: clientData.name, bankId: clientData.bankId || 'advance', bankName: bank?.name || 'Plano Adiantado', amount: request.finalAmount, date: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        try {
            await fetch('/api/send-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: clientDocRef.id, clientPhone: clientData.phone, clientName: clientData.name, amount: request.finalAmount, paymentMethod: bank?.name || 'Adiantamento', companyName: settings?.companyName || 'S.O.S Piscina Limpa' }) });
        } catch (e) {}
    }, [banks, settings]);

    const rejectAdvancePaymentRequest = useCallback(async (id: string) => { await db.collection('advancePaymentRequests').doc(id).update({ status: 'rejected', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    
    const resetReportsData = useCallback(async () => {
        if (!window.confirm("Apagar dados?")) return;
        ['pre-budgets', 'orders', 'replenishmentQuotes', 'transactions', 'advancePaymentRequests', 'planChangeRequests', 'emergencyRequests'].forEach(async (c) => {
            const s = await db.collection(c).get();
            s.docs.forEach((d: any) => d.ref.delete());
        });
    }, []);

    const createPoolEvent = useCallback(async (e: any) => { await db.collection('poolEvents').add({ ...e, status: 'notified', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const acknowledgePoolEvent = useCallback(async (id: string) => { await db.collection('poolEvents').doc(id).update({ status: 'acknowledged' }); }, []);
    const deletePoolEvent = useCallback(async (id: string) => { await db.collection('poolEvents').doc(id).delete(); }, []);
    
    const saveRecessPeriod = useCallback(async (r: any) => { 
        const currentSettings = await db.collection('settings').doc('main').get();
        const data = currentSettings.data() as Settings;
        const periods = data.recessPeriods || [];
        if (r.id) {
            const index = periods.findIndex(p => p.id === r.id);
            if (index > -1) periods[index] = r;
        } else {
            periods.push({ ...r, id: Date.now().toString() });
        }
        await db.collection('settings').doc('main').update({ recessPeriods: periods });
    }, []);
    
    const deleteRecessPeriod = useCallback(async (id: string) => { 
        const currentSettings = await db.collection('settings').doc('main').get();
        const data = currentSettings.data() as Settings;
        const periods = (data.recessPeriods || []).filter(p => p.id !== id);
        await db.collection('settings').doc('main').update({ recessPeriods: periods });
    }, []);
    
    const requestPlanChange = useCallback(async (cid: string, n: string, cp: PlanType, rp: PlanType) => { await db.collection('planChangeRequests').add({ clientId: cid, clientName: n, currentPlan: cp, requestedPlan: rp, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const respondToPlanChangeRequest = useCallback(async (id: string, p: number, n: string) => { await db.collection('planChangeRequests').doc(id).update({ status: 'quoted', proposedPrice: p, adminNotes: n }); }, []);
    
    const acceptPlanChange = useCallback(async (id: string, p: number, fidelityPlan?: FidelityPlan) => {
        const reqDoc = await db.collection('planChangeRequests').doc(id).get();
        const request = reqDoc.data() as PlanChangeRequest;
        const clientQuery = await db.collection('clients').where('uid', '==', request.clientId).limit(1).get();
        if (!clientQuery.empty) {
            const clientRef = clientQuery.docs[0].ref;
            await clientRef.update({ scheduledPlanChange: { newPlan: request.requestedPlan, newPrice: p, fidelityPlan: fidelityPlan || null, effectiveDate: firebase.firestore.Timestamp.now() } });
            await db.collection('planChangeRequests').doc(id).update({ status: 'accepted' });
        }
    }, []);
    
    const cancelPlanChangeRequest = useCallback(async (id: string) => { await db.collection('planChangeRequests').doc(id).update({ status: 'rejected' }); }, []);
    const cancelScheduledPlanChange = useCallback(async (id: string) => { await db.collection('clients').doc(id).update({ scheduledPlanChange: firebase.firestore.FieldValue.delete() }); }, []);
    const acknowledgeTerms = useCallback(async (id: string) => { await db.collection('clients').doc(id).update({ lastAcceptedTermsAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const createEmergencyRequest = useCallback(async (d: any) => { await db.collection('emergencyRequests').add({ ...d, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const resolveEmergencyRequest = useCallback(async (id: string) => { await db.collection('emergencyRequests').doc(id).update({ status: 'resolved' }); }, []);

    const advancePlanUsage = useMemo(() => {
        const active = clients.filter(c => c.clientStatus === 'Ativo');
        if (active.length === 0) return { count: 0, percentage: 0 };
        const today = new Date();
        const count = active.filter(c => c.advancePaymentUntil && toDate(c.advancePaymentUntil)! > today).length;
        return { count, percentage: (count / active.length) * 100 };
    }, [clients]);

    const isAdvancePlanGloballyAvailable = useMemo(() => {
        return !!(settings?.features.advancePaymentPlanEnabled && advancePlanUsage.percentage < 10);
    }, [settings, advancePlanUsage]);

    return {
        clients, users, budgetQuotes, routes, products, stockProducts, orders, banks, transactions, replenishmentQuotes, advancePaymentRequests, planChangeRequests, poolEvents, emergencyRequests, chatSessions, settings, pendingPriceChanges, loading, setupCheck, isAdvancePlanGloballyAvailable, advancePlanUsage,
        approveBudgetQuote, rejectBudgetQuote, updateClient, deleteClient, markAsPaid, updateClientStock, scheduleClient, unscheduleClient, toggleRouteStatus, saveProduct, deleteProduct, saveStockProduct, deleteStockProduct, removeStockProductFromAllClients, saveBank, deleteBank, updateOrderStatus, updateSettings, schedulePriceChange, createBudgetQuote, createOrder, getClientData, createInitialAdmin, createTechnician, updateReplenishmentQuoteStatus, triggerReplenishmentAnalysis, createAdvancePaymentRequest, approveAdvancePaymentRequest, rejectAdvancePaymentRequest, addVisitRecord, resetReportsData, createPoolEvent, acknowledgePoolEvent, deletePoolEvent, saveRecessPeriod, deleteRecessPeriod, requestPlanChange, respondToPlanChangeRequest, acceptPlanChange, cancelPlanChangeRequest, cancelScheduledPlanChange, acknowledgeTerms, createEmergencyRequest, resolveEmergencyRequest, sendAdminChatMessage, closeChatSession
    };
};

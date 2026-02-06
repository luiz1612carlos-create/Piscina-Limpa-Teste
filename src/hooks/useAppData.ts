import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db, firebase, auth, storage, firebaseConfig } from '../firebase';
import {
    Client, BudgetQuote, Routes, Product, Order, Settings, ClientProduct, UserData,
    OrderStatus, AppData, ReplenishmentQuote, ReplenishmentQuoteStatus, Bank, Transaction,
    AdvancePaymentRequest, AdvancePaymentRequestStatus, RouteDay, FidelityPlan, Visit, StockProduct,
    PendingPriceChange, PricingSettings, AffectedClientPreview, PoolEvent, RecessPeriod, PlanChangeRequest, PlanType,
    EmergencyRequest, ChatSession
} from '../types';
import { compressImage } from '../utils/calculations';

const isObject = (item: any) => (item && typeof item === 'object' && !Array.isArray(item));
const deepMerge = (target: any, ...sources: any[]): any => {
    if (!sources.length) return target;
    const source = sources.shift();
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return deepMerge(target, ...sources);
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
    pricing: { perKm: 1.5, serviceRadius: 5, wellWaterFee: 50, productsFee: 75, partyPoolFee: 100, volumeTiers: [] },
    plans: {
        simple: { title: "Plano Simples", benefits: [], terms: "" },
        vip: { title: "Plano VIP", benefits: [], terms: "" },
    },
    fidelityPlans: [],
    features: { vipPlanEnabled: true, planUpgradeEnabled: true, vipPlanDisabledMessage: "Em breve!", storeEnabled: true, advancePaymentPlanEnabled: false, advancePaymentTitle: "Economize!", advancePaymentSubtitleVIP: "", advancePaymentSubtitleSimple: "", maintenanceModeEnabled: false, maintenanceMessage: "" },
    automation: { replenishmentStockThreshold: 2 },
    advancePaymentOptions: [],
};

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        return isNaN(d.getTime()) ? null : d;
    }
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
        if (!user) return;
        
        const unsubs: (() => void)[] = [];

        unsubs.push(db.collection('settings').doc('main').onSnapshot(doc => {
            if (doc.exists) setSettings(deepMerge(JSON.parse(JSON.stringify(defaultSettings)), doc.data()));
            else setSettings(defaultSettings);
            setLoadingState('settings', false);
        }, () => setLoadingState('settings', false)));

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

            unsubs.push(db.collection('routes').doc('main').onSnapshot(doc => {
                if (doc.exists) setRoutes(doc.data() as Routes);
                setLoadingState('routes', false);
            }, () => setLoadingState('routes', false)));

            unsubs.push(db.collection('users').where('role', '==', 'admin').onSnapshot(s => {
                setUsers(s.docs.map(d => d.data() as UserData));
                setLoadingState('users', false);
            }, () => setLoadingState('users', false)));
        } else if (userData?.role === 'client') {
            unsubs.push(db.collection('clients').where('uid', '==', user.uid).onSnapshot(s => {
                setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
                setLoadingState('clients', false);
            }, () => setLoadingState('clients', false)));
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

    const lastCheckRef = useRef<number>(0);
    useEffect(() => {
        if (!isUserAdmin || clients.length === 0) return;
        const now = Date.now();
        if (now - lastCheckRef.current < 60000) return;
        lastCheckRef.current = now;

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const expired = clients.filter(c => c.clientStatus === 'Ativo' && c.payment.status === 'Pago' && new Date(c.payment.dueDate) <= today);
        
        if (expired.length > 0) {
            const batch = db.batch();
            expired.forEach(c => batch.update(db.collection('clients').doc(c.id), { 'payment.status': 'Pendente' }));
            batch.commit().catch(console.error);
        }
    }, [isUserAdmin, clients]);

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

    const updateSettings = useCallback(async (s: Partial<Settings>) => { await db.collection('settings').doc('main').set(s, { merge: true }); }, []);
    const createBudgetQuote = useCallback(async (b: any) => { await db.collection('pre-budgets').add({ ...b, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const createOrder = useCallback(async (o: any) => { await db.collection('orders').add({ ...o, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);

    const sendAdminChatMessage = useCallback(async (sessionId: string, text: string) => {
        try {
            const res = await fetch('/api/admin-chat', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ sessionId, text }) 
            });

            if (res.status === 404) {
                const sessionRef = db.collection("chatSessions").doc(sessionId);
                await sessionRef.collection("messages").add({
                    text,
                    sender: "admin",
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                });
                await sessionRef.update({
                    lastMessage: text,
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: "human",
                    unreadCount: 0,
                });
                return;
            }

            if (!res.ok) throw new Error('Erro na API de Chat');
        } catch (error) {
            console.error("Erro ao enviar chat:", error);
            throw error;
        }
    }, []);

    const closeChatSession = useCallback(async (sid: string) => { await db.collection('chatSessions').doc(sid).update({ status: 'closed' }); }, []);
    const updateClient = useCallback(async (id: string, data: Partial<Client>) => { await db.collection('clients').doc(id).update(data); }, []);
    const deleteClient = useCallback(async (id: string) => { await db.collection('clients').doc(id).delete(); }, []);
    
    const approveBudgetQuote = useCallback(async (id: string, pass: string, dist?: number) => { 
        const budgetDoc = await db.collection('pre-budgets').doc(id).get();
        if (!budgetDoc.exists) throw new Error("Orçamento não encontrado.");
        const budget = budgetDoc.data() as BudgetQuote;
        const secondaryApp = firebase.initializeApp(firebaseConfig, `AppApproval_${Date.now()}`);
        try {
            const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(budget.email, pass);
            const newUid = userCredential.user.uid;
            const batch = db.batch();
            batch.set(db.collection('users').doc(newUid), { name: budget.name, email: budget.email, role: 'client', uid: newUid });
            batch.set(db.collection('clients').doc(), {
                uid: newUid, name: budget.name, email: budget.email, phone: budget.phone, address: budget.address,
                poolDimensions: budget.poolDimensions, poolVolume: budget.poolVolume, hasWellWater: budget.hasWellWater,
                includeProducts: false, isPartyPool: budget.isPartyPool, plan: budget.plan, clientStatus: 'Ativo',
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

    const rejectBudgetQuote = useCallback(async (id: string) => { await db.collection('pre-budgets').doc(id).delete(); }, []);
    const markAsPaid = useCallback(async (client: Client, months: number, total: number) => {
        if (!client.bankId) throw new Error("Associe um banco.");
        const batch = db.batch();
        batch.set(db.collection('transactions').doc(), { clientId: client.id, clientName: client.name, bankId: client.bankId, amount: total, date: firebase.firestore.FieldValue.serverTimestamp() });
        const next = new Date(client.payment.dueDate);
        next.setMonth(next.getMonth() + months);
        batch.update(db.collection('clients').doc(client.id), { 'payment.dueDate': next.toISOString(), 'payment.status': 'Pago' });
        await batch.commit();
    }, []);

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
    const deleteStockProduct = useCallback(async (id: string) => { await db.collection('stockProducts').doc(id).delete(); }, []);
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
    const triggerReplenishmentAnalysis = useCallback(async () => 0, []);
    const createAdvancePaymentRequest = useCallback(async (r: any) => { await db.collection('advancePaymentRequests').add({ ...r, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const approveAdvancePaymentRequest = useCallback(async (id: string) => { /* logic */ }, []);
    const rejectAdvancePaymentRequest = useCallback(async (id: string) => { await db.collection('advancePaymentRequests').doc(id).update({ status: 'rejected' }); }, []);
    
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
        await db.collection('clients').doc(cid).update({
            visitHistory: firebase.firestore.FieldValue.arrayUnion({ ...v, id: visitId, photoUrl, timestamp: firebase.firestore.Timestamp.now() }),
            'poolStatus.ph': v.ph, 'poolStatus.cloro': v.cloro, 'poolStatus.alcalinidade': v.alcalinidade, 'poolStatus.uso': v.uso
        });
    }, []);

    const resetReportsData = useCallback(async () => {
        if (!window.confirm("Apagar dados?")) return;
        ['pre-budgets', 'orders', 'replenishmentQuotes', 'transactions', 'advancePaymentRequests', 'planChangeRequests', 'emergencyRequests'].forEach(async (c) => {
            const s = await db.collection(c).get();
            s.docs.forEach(d => d.ref.delete());
        });
    }, []);

    const createPoolEvent = useCallback(async (e: any) => { await db.collection('poolEvents').add({ ...e, status: 'notified', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const acknowledgePoolEvent = useCallback(async (id: string) => { await db.collection('poolEvents').doc(id).update({ status: 'acknowledged' }); }, []);
    const deletePoolEvent = useCallback(async (id: string) => { await db.collection('poolEvents').doc(id).delete(); }, []);
    const saveRecessPeriod = useCallback(async (r: any) => { /* logic */ }, []);
    const deleteRecessPeriod = useCallback(async (id: string) => { /* logic */ }, []);
    const requestPlanChange = useCallback(async (cid: string, n: string, cp: PlanType, rp: PlanType) => { await db.collection('planChangeRequests').add({ clientId: cid, clientName: n, currentPlan: cp, requestedPlan: rp, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const respondToPlanChangeRequest = useCallback(async (id: string, p: number, n: string) => { await db.collection('planChangeRequests').doc(id).update({ status: 'quoted', proposedPrice: p, adminNotes: n }); }, []);
    const acceptPlanChange = useCallback(async (id: string, p: number) => { /* logic */ }, []);
    const cancelPlanChangeRequest = useCallback(async (id: string) => { await db.collection('planChangeRequests').doc(id).update({ status: 'rejected' }); }, []);
    const cancelScheduledPlanChange = useCallback(async (id: string) => { await db.collection('clients').doc(id).update({ scheduledPlanChange: firebase.firestore.FieldValue.delete() }); }, []);
    const acknowledgeTerms = useCallback(async (id: string) => { await db.collection('clients').doc(id).update({ lastAcceptedTermsAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const createEmergencyRequest = useCallback(async (d: any) => { await db.collection('emergencyRequests').add({ ...d, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }, []);
    const resolveEmergencyRequest = useCallback(async (id: string) => { await db.collection('emergencyRequests').doc(id).update({ status: 'resolved' }); }, []);
    const removeStockProductFromAllClients = useCallback(async (id: string) => 0, []);

    const appDataValue = useMemo(() => ({
        clients, users, budgetQuotes, routes, products, stockProducts, orders, banks, transactions, replenishmentQuotes, advancePaymentRequests, planChangeRequests, poolEvents, emergencyRequests, chatSessions, settings, pendingPriceChanges, loading,
        setupCheck, isAdvancePlanGloballyAvailable, advancePlanUsage,
        approveBudgetQuote, rejectBudgetQuote, updateClient, deleteClient, markAsPaid, updateClientStock,
        scheduleClient, unscheduleClient, toggleRouteStatus, saveProduct, deleteProduct, saveStockProduct, deleteStockProduct, removeStockProductFromAllClients, saveBank, deleteBank,
        updateOrderStatus, updateSettings, schedulePriceChange, createBudgetQuote, createOrder, getClientData,
        createInitialAdmin, createTechnician, updateReplenishmentQuoteStatus, triggerReplenishmentAnalysis, createAdvancePaymentRequest, approveAdvancePaymentRequest, rejectAdvancePaymentRequest,
        addVisitRecord, resetReportsData, createPoolEvent, acknowledgePoolEvent, deletePoolEvent, saveRecessPeriod, deleteRecessPeriod,
        requestPlanChange, respondToPlanChangeRequest, acceptPlanChange, cancelPlanChangeRequest, cancelScheduledPlanChange, acknowledgeTerms,
        createEmergencyRequest, resolveEmergencyRequest, sendAdminChatMessage, closeChatSession
    }), [
        clients, users, budgetQuotes, routes, products, stockProducts, orders, banks, transactions, replenishmentQuotes, advancePaymentRequests, planChangeRequests, poolEvents, emergencyRequests, chatSessions, settings, pendingPriceChanges, loading,
        setupCheck, isAdvancePlanGloballyAvailable, advancePlanUsage,
        approveBudgetQuote, rejectBudgetQuote, updateClient, deleteClient, markAsPaid, updateClientStock,
        scheduleClient, unscheduleClient, toggleRouteStatus, saveProduct, deleteProduct, saveStockProduct, deleteStockProduct, removeStockProductFromAllClients, saveBank, deleteBank,
        updateOrderStatus, updateSettings, schedulePriceChange, createBudgetQuote, createOrder, getClientData,
        createInitialAdmin, createTechnician, updateReplenishmentQuoteStatus, triggerReplenishmentAnalysis, createAdvancePaymentRequest, approveAdvancePaymentRequest, rejectAdvancePaymentRequest,
        addVisitRecord, resetReportsData, createPoolEvent, acknowledgePoolEvent, deletePoolEvent, saveRecessPeriod, deleteRecessPeriod,
        requestPlanChange, respondToPlanChangeRequest, acceptPlanChange, cancelPlanChangeRequest, cancelScheduledPlanChange, acknowledgeTerms,
        createEmergencyRequest, resolveEmergencyRequest, sendAdminChatMessage, closeChatSession
    ]);

    return appDataValue;
};
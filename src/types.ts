
export enum PoolType {
  CHLORINE = 'Cloro',
  SALT = 'Sal',
  OZONE = 'Ozônio',
  UV = 'UV'
}

export type NotificationType = 'success' | 'error' | 'info';

export interface ChemistryReading {
  id: string;
  date: string;
  ph: number;
  chlorine: number;
  alkalinity: number;
  cyanuricAcid: number;
  temperature: number;
  notes?: string;
}

export interface Pool {
  id: string;
  clientName: string;
  address: string;
  volume: number;
  type: PoolType;
  lastService: string;
  readings: ChemistryReading[];
  imageUrl?: string;
}

export interface ServiceTask {
  id: string;
  poolId: string;
  date: string;
  completed: boolean;
  tasks: string[];
}

export type UserRole = 'admin' | 'technician' | 'client';
export type PlanType = 'simple' | 'vip' | 'Simples' | 'VIP';
export type OrderStatus = 'pending' | 'completed' | 'cancelled' | 'Pendente' | 'Enviado' | 'Entregue';
export type ReplenishmentQuoteStatus = 'suggested' | 'sent' | 'approved' | 'rejected';
export type AdvancePaymentRequestStatus = 'pending' | 'approved' | 'rejected';
export type ClientStatus = 'Ativo' | 'Inativo' | 'Suspenso';
export type PoolUsageStatus = 'Livre para uso' | 'Em tratamento' | 'Interditada';
export type PaymentStatus = 'Pago' | 'Pendente' | 'Atrasado';

export interface UserData {
    uid: string;
    email: string;
    name: string;
    role: UserRole;
}

export interface ClientProduct {
    productId: string;
    name: string;
    quantity: number;
    currentStock?: number;
    maxStock?: number;
    maxQuantity?: number;
}

export interface Address {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
}

export interface Client {
    id: string;
    uid: string;
    name: string;
    email: string;
    phone: string;
    address: Address;
    poolDimensions?: any;
    poolVolume?: number;
    hasWellWater?: boolean;
    includeProducts?: boolean;
    isPartyPool?: boolean;
    isPublicPool?: boolean;
    plan: string;
    clientStatus: ClientStatus;
    poolStatus: {
        ph: number;
        cloro: number;
        alcalinidade: number;
        uso: string;
    };
    payment: {
        status: PaymentStatus;
        dueDate: string;
    };
    stock: ClientProduct[];
    pixKey?: string;
    createdAt?: any;
    lastVisitDuration?: number;
    distanceFromHq?: number;
    fidelityPlan?: FidelityPlan | null;
    visitHistory?: Visit[];
    bankId?: string;
    recipientName?: string;
    advancePaymentUntil?: any;
    scheduledPlanChange?: any;
    lastAcceptedTermsAt?: any;
    allowAccessInMaintenance?: boolean;
    customPricing?: PricingSettings;
    disableReminders?: boolean;
}

export interface BudgetQuote {
    id?: string;
    name: string;
    email: string;
    phone: string;
    address: any;
    poolDimensions: any;
    poolVolume: number;
    hasWellWater: boolean;
    isPartyPool: boolean;
    isPublicPool?: boolean;
    plan: string;
    distanceFromHq?: number;
    fidelityPlan?: FidelityPlan | null;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
    monthlyFee?: number;
}

export interface Product {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    description?: string;
    category?: string;
    stock?: number;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface StockProduct {
    id: string;
    name: string;
    quantity?: number;
    minQuantity?: number;
    productId?: string;
    description?: string;
    unit?: string;
}

export interface Order {
    id: string;
    clientId: string;
    clientName: string;
    items: any[];
    total: number;
    status: OrderStatus;
    createdAt: any;
}

export interface AdvancePaymentOption {
    months: number;
    discountPercent: number;
}

export interface ReviewSlide {
    id: string;
    imageUrl: string;
    linkUrl: string;
    text: string;
    active: boolean;
}

export interface Settings {
    companyName: string;
    mainTitle: string;
    mainSubtitle: string;
    logoUrl?: any;
    logoObjectFit?: string;
    logoTransforms?: any;
    baseAddress: any;
    pixKey: string;
    pricing: PricingSettings;
    plans: any;
    fidelityPlans: FidelityPlan[];
    features: any;
    automation: any;
    advancePaymentOptions: AdvancePaymentOption[];
    aiBot: any;
    billingBot: {
        enabled: boolean;
        dryRun: boolean;
        daysBeforeDue: number;
        messageTemplate: string;
        billingImage?: string;
    };
    receiptBot: {
        enabled: boolean;
        templateName: string;
        templateLanguage: string;
        receiptImage?: string;
    };
    poolStatusBot: any;
    recessPeriods?: RecessPeriod[];
    reviewSlides?: ReviewSlide[];
    whatsappTemplateName?: string;
    whatsappTemplateLanguage?: string;
    pixKeyRecipient?: string;
    announcementMessageTemplate?: string;
    termsUpdatedAt?: any;
    googleReviewUrl?: string;
}

export interface PricingSettings {
    perKm: number;
    serviceRadius: number;
    wellWaterFee: number;
    productsFee: number;
    partyPoolFee: number;
    publicPoolFee: number;
    volumeTiers: any[];
}

export interface Routes {
    [key: string]: {
        day: string;
        isRouteActive: boolean;
        clients: Client[];
    }
}

export interface ReplenishmentQuote {
    id: string;
    clientId: string;
    clientName: string;
    items: any[];
    total: number;
    status: ReplenishmentQuoteStatus;
    createdAt: any;
}

export interface Bank {
    id: string;
    name: string;
    code?: string;
    pixKey?: string;
    pixKeyRecipient?: string;
}

export interface Transaction {
    id?: string;
    clientId: string;
    clientName: string;
    bankId: string;
    bankName?: string;
    amount: number;
    date: any;
}

export interface AdvancePaymentRequest {
    id: string;
    clientId: string;
    clientName?: string;
    months: number;
    finalAmount: number;
    originalAmount?: number;
    discountPercent?: number;
    status: AdvancePaymentRequestStatus;
    createdAt: any;
    updatedAt?: any;
}

export interface FidelityPlan {
    id: string;
    months: number;
    discountPercent: number;
    title: string;
}

export interface Visit {
    id: string;
    ph: number;
    cloro: number;
    alcalinidade: number;
    uso: string;
    photoUrl?: string;
    timestamp: any;
    notes?: string;
    obs?: string;
    productsUsed?: { productId: string; name: string; quantity: number }[];
    technicianName?: string;
    technicianId?: string;
}

export interface PendingPriceChange {
    id?: string;
    effectiveDate: any;
    newPricing: PricingSettings;
    affectedClients: AffectedClientPreview[];
    status: string;
    createdAt: any;
    updatedAt?: any;
}

export interface AffectedClientPreview {
    clientId: string;
    clientName: string;
    oldPrice: number;
    newPrice: number;
}

export interface PoolEvent {
    id?: string;
    status: string;
    createdAt: any;
    type?: string;
    description?: string;
    clientName?: string;
    eventDate?: any;
    notes?: string;
}

export interface RecessPeriod {
    id: string;
    startDate: string;
    endDate: string;
    reason: string;
    name?: string;
}

export interface PlanChangeRequest {
    id?: string;
    clientId: string;
    clientName: string;
    currentPlan: string;
    requestedPlan: string;
    status: string;
    createdAt: any;
    proposedPrice?: number;
    adminNotes?: string;
}

export interface EmergencyRequest {
    id?: string;
    clientId: string;
    clientName?: string;
    clientPhone?: string;
    address?: string;
    reason?: string;
    description?: string;
    status: string;
    createdAt: any;
}

export interface ChatSession {
    id?: string;
    clientName: string;
    clientPhone: string;
    lastMessage: string;
    lastMessageAt: any;
    status: 'bot' | 'human' | 'waiting';
    isHuman?: boolean;
    unreadCount?: number;
}

export interface ChatMessage {
    id?: string;
    text: string;
    sender: 'client' | 'bot' | 'admin';
    timestamp: any;
}

export interface AppData {
    clients: Client[];
    users: UserData[];
    budgetQuotes: BudgetQuote[];
    routes: Routes;
    products: Product[];
    stockProducts: StockProduct[];
    orders: Order[];
    banks: Bank[];
    transactions: Transaction[];
    replenishmentQuotes: ReplenishmentQuote[];
    advancePaymentRequests: AdvancePaymentRequest[];
    planChangeRequests: PlanChangeRequest[];
    poolEvents: PoolEvent[];
    emergencyRequests: EmergencyRequest[];
    chatSessions: ChatSession[];
    settings: Settings | null;
    pendingPriceChanges: PendingPriceChange[];
    loading: any;
    setupCheck: 'checking' | 'needed' | 'done';
    isAdvancePlanGloballyAvailable: boolean;
    advancePlanUsage: { count: number; percentage: number };
    
    approveBudgetQuote: (id: string, pass: string, dist?: number) => Promise<void>;
    rejectBudgetQuote: (id: string) => Promise<void>;
    updateClient: (id: string, data: Partial<Client>) => Promise<void>;
    deleteClient: (id: string) => Promise<void>;
    markAsPaid: (client: Client, months: number, total: number) => Promise<void>;
    updateClientStock: (id: string, s: ClientProduct[]) => Promise<void>;
    scheduleClient: (id: string, day: string) => Promise<void>;
    unscheduleClient: (id: string, day: string) => Promise<void>;
    toggleRouteStatus: (d: string, s: boolean) => Promise<void>;
    saveProduct: (p: any, file?: File) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    saveStockProduct: (p: any) => Promise<void>;
    deleteStockProduct: (id: string, cleanupClients?: boolean) => Promise<void>;
    removeStockProductFromAllClients: (id: string) => Promise<number>;
    saveBank: (b: any) => Promise<void>;
    deleteBank: (id: string) => Promise<void>;
    updateOrderStatus: (id: string, s: OrderStatus) => Promise<void>;
    updateSettings: (newSettings: Partial<Settings>, logoFile?: File, removeLogo?: boolean, onProgress?: (progress: number) => void, billingImageFile?: File, receiptImageFile?: File, slideImages?: { [key: string]: File }) => Promise<void>;
    schedulePriceChange: (p: PricingSettings, a: AffectedClientPreview[], d: Date) => Promise<void>;
    createBudgetQuote: (b: any) => Promise<void>;
    createOrder: (o: any) => Promise<void>;
    getClientData: () => Promise<Client | null>;
    createInitialAdmin: (n: string, e: string, p: string) => Promise<void>;
    createTechnician: (n: string, e: string, p: string) => Promise<void>;
    updateReplenishmentQuoteStatus: (id: string, s: ReplenishmentQuoteStatus) => Promise<void>;
    triggerReplenishmentAnalysis: () => Promise<number>;
    createAdvancePaymentRequest: (r: any) => Promise<void>;
    approveAdvancePaymentRequest: (id: string) => Promise<void>;
    rejectAdvancePaymentRequest: (id: string) => Promise<void>;
    addVisitRecord: (cid: string, v: any, file?: File, onProgress?: (progress: number) => void) => Promise<void>;
    resetReportsData: () => Promise<void>;
    createPoolEvent: (e: any) => Promise<void>;
    acknowledgePoolEvent: (id: string) => Promise<void>;
    deletePoolEvent: (id: string) => Promise<void>;
    saveRecessPeriod: (r: any) => Promise<void>;
    deleteRecessPeriod: (id: string) => Promise<void>;
    requestPlanChange: (cid: string, n: string, cp: PlanType, rp: PlanType) => Promise<void>;
    respondToPlanChangeRequest: (id: string, p: number, n: string) => Promise<void>;
    acceptPlanChange: (id: string, p: number, fidelityPlan?: FidelityPlan) => Promise<void>;
    cancelPlanChangeRequest: (id: string) => Promise<void>;
    cancelScheduledPlanChange: (id: string) => Promise<void>;
    acknowledgeTerms: (id: string) => Promise<void>;
    createEmergencyRequest: (d: any) => Promise<void>;
    resolveEmergencyRequest: (id: string) => Promise<void>;
    sendAdminChatMessage: (sessionId: string, text: string) => Promise<void>;
    closeChatSession: (sid: string) => Promise<void>;
}

export type AdminView = 'reports' | 'clients' | 'routes' | 'approvals' | 'store' | 'settings' | 'advances' | 'stock' | 'events' | 'emergencies' | 'ai_bot' | 'live_chat' | 'maintenance_history' | 'marketing';

export interface AuthContextType {
    user: any;
    userData: UserData | null;
    loading: boolean;
    isAnonymous: boolean;
    login: (email: string, pass: string) => Promise<any>;
    loginAnonymously: () => Promise<any>;
    logout: () => Promise<void>;
    changePassword: (newPass: string) => Promise<void>;
    showNotification: (msg: string, type: NotificationType) => void;
}

export type AppContextType = AppData & { showNotification: (msg: string, type: NotificationType) => void };

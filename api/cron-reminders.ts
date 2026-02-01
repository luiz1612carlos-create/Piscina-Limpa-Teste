// api/cron-reminders.ts
import * as admin from 'firebase-admin';

/**
 * 🤖 MOTOR DO ROBÔ REAL (APP B)
 * Este endpoint deve ser chamado via Cron Job.
 * Ele gera as mensagens e marca o ciclo como processado.
 * 
 * ATUALIZAÇÃO CRÍTICA: Removida qualquer validação de obrigatoriedade para {DESTINATARIO}.
 * O sistema agora funciona normalmente mesmo se recipientName for nulo.
 * CORREÇÃO: Variável {VALOR} agora exibe o valor real (manual ou calculado).
 * NOVO: Suporte à variável {BANCO}.
 */

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Utilitário de substituição de variáveis - Simples e sem validações impeditivas
function parseMessage(template: string, data: Record<string, string>) {
    let msg = template || "";
    if (typeof msg !== 'string') return "";
    
    Object.entries(data).forEach(([key, val]) => {
        const regex = new RegExp(`{${key}}`, 'gi');
        msg = msg.replace(regex, String(val || ""));
    });
    return msg;
}

// Local helper to calculate or retrieve fee in the API environment
function getClientFee(client: any, settings: any): string {
    if (client.manualFee !== undefined && client.manualFee !== null) {
        return Number(client.manualFee).toFixed(2).replace('.', ',');
    }
    
    const pricing = settings?.pricing;
    if (!pricing || !pricing.volumeTiers) return "0,00";
    
    const volume = Number(client.poolVolume || 0);
    let basePrice = 0;
    const tier = pricing.volumeTiers.find((t: any) => volume >= Number(t.min) && volume <= Number(t.max));
    if (tier) basePrice = Number(tier.price);
    else if (pricing.volumeTiers.length > 0) {
        const sorted = [...pricing.volumeTiers].sort((a,b) => b.max - a.max);
        if (volume > sorted[0].max) basePrice = sorted[0].price;
    }
    
    let total = basePrice;
    if (client.hasWellWater) total += Number(pricing.wellWaterFee || 0);
    if (client.includeProducts) total += Number(pricing.productsFee || 0);
    if (client.isPartyPool) total += Number(pricing.partyPoolFee || 0);
    
    return total.toFixed(2).replace('.', ',');
}

export default async function handler(req: any, res: any) {
    // Segurança: Verificar token da Cron
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const settingsSnap = await db.collection('settings').doc('main').get();
        const settings = settingsSnap.data();
        const bot = settings?.aiBot;

        if (!bot?.enabled) return res.status(200).json({ status: "Robot is off" });

        // 1️⃣ MODO DO ROBÔ E DATA TESTE
        const robotMode = bot.robotMode || 'dry-run';
        const robotTestDateStr = bot.robotTestDate;
        const now = robotTestDateStr ? new Date(robotTestDateStr + 'T12:00:00') : new Date();
        const currentCycle = `${now.getFullYear()}-${now.getMonth() + 1}`;
        
        // Alvo: Vencimento em 2 dias com base na data do robô (real ou teste)
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + 2);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // 2️⃣ LIMITE DE SEGURANÇA
        const MAX_CLIENTS = robotMode === 'dry-run' ? 1 : (bot.maxClientsPerRun || 1);

        const clientsSnap = await db.collection('clients').where('clientStatus', '==', 'Ativo').get();
        let count = 0;

        for (const doc of clientsSnap.docs) {
            if (count >= MAX_CLIENTS) break;

            const client = doc.data();
            const clientId = doc.id;

            if (!client || !client.payment) continue;

            // 3️⃣ TRAVA DE CICLO
            if (client.payment.lastBillingCycle === currentCycle && robotMode === 'live') continue;
            if (client.payment.status === 'Pago') continue;

            const rawDueDate = client.payment.dueDate;
            const dueDateStr = rawDueDate && typeof rawDueDate === 'string' ? rawDueDate.split('T')[0] : "";

            if (dueDateStr === targetDateStr) {
                const clientFirstName = (client.name || "Cliente").split(' ')[0];
                const companyName = settings?.companyName || "Piscina Limpa";
                const resolvedRecipient = client.payment.recipientName || client.name || companyName;
                
                // CORREÇÃO: Obter o valor real para o template
                const feeValue = getClientFee(client, settings);
                
                // BUSCAR NOME DO BANCO
                let bankName = "Não Identificado";
                if (client.bankId) {
                    const bankSnap = await db.collection('banks').doc(client.bankId).get();
                    if (bankSnap.exists) bankName = bankSnap.data()?.name || bankName;
                }

                const finalMessage = parseMessage(bot.billingReminder, {
                    'CLIENTE': clientFirstName,
                    'VALOR': `R$ ${feeValue}`, 
                    'VENCIMENTO': rawDueDate ? new Date(rawDueDate).toLocaleDateString('pt-BR') : "---",
                    'PIX': client.pixKey || settings?.pixKey || "Chave no painel",
                    'BANCO': bankName,
                    'DESTINATARIO': resolvedRecipient,
                    'EMPRESA': companyName
                });

                // 4️⃣ REGISTRO DE PREVIEW
                const previewData = {
                    clientId: clientId,
                    clientName: client.name || "N/A",
                    phone: client.phone || 'N/A',
                    messageFinal: finalMessage,
                    dueDate: rawDueDate || "",
                    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: robotMode === 'live' ? 'Sent' : 'Simulation'
                };

                await db.collection('robotPreviews').add(previewData);

                // 5️⃣ ENVIO REAL
                if (robotMode === 'live') {
                    await db.collection('clients').doc(clientId).update({
                        'payment.lastBillingNotificationRomantic': finalMessage,
                        'payment.lastBillingCycle': currentCycle,
                        'payment.generatedAt': admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                count++;
            }
        }

        return res.status(200).json({ 
            success: true, 
            mode: robotMode,
            processed: count
        });

    } catch (error: any) {
        return res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
    }
}

// api/cron-reminders.ts
import * as admin from 'firebase-admin';

/**
 * 🤖 MOTOR DO ROBÔ REAL (APP B)
 * Este endpoint deve ser chamado via Cron Job.
 * Ele gera as mensagens e marca o ciclo como processado.
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

// Utilitário de substituição de variáveis
function parseMessage(template: string, data: Record<string, string>) {
    let msg = template || "";
    Object.entries(data).forEach(([key, val]) => {
        const regex = new RegExp(`{${key}}`, 'gi');
        msg = msg.replace(regex, val);
    });
    return msg;
}

export default async function handler(req: any, res: any) {
    // Segurança: Verificar token da Cron
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const today = new Date();
        const currentCycle = `${today.getFullYear()}-${today.getMonth() + 1}`;
        
        // Alvo: Vencimento em 2 dias
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + 2);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        const settingsSnap = await db.collection('settings').doc('main').get();
        const settings = settingsSnap.data();
        const bot = settings?.aiBot;

        if (!bot?.enabled) return res.status(200).json({ status: "Robot is off" });

        const clientsSnap = await db.collection('clients').where('clientStatus', '==', 'Ativo').get();
        let count = 0;

        for (const doc of clientsSnap.docs) {
            const client = doc.data();
            const clientId = doc.id;

            // Pula se já processou este mês
            if (client.payment?.lastBillingCycle === currentCycle) continue;
            // Pula se já pagou
            if (client.payment?.status === 'Pago') continue;

            const dueDateStr = String(client.payment?.dueDate).split('T')[0];

            if (dueDateStr === targetDateStr) {
                // GERA A MENSAGEM FINAL
                const finalMessage = parseMessage(bot.billingReminderTemplate, {
                    'CLIENTE': client.name.split(' ')[0],
                    'VALOR': "consulte seu painel", 
                    'VENCIMENTO': new Date(client.payment.dueDate).toLocaleDateString('pt-BR'),
                    'PIX': settings?.pixKey || "Chave no painel"
                });

                // SALVA NO FIREBASE PARA O SOCKET EXTERNO CONSUMIR
                await db.collection('clients').doc(clientId).update({
                    'payment.lastBillingNotificationRomantic': finalMessage,
                    'payment.lastBillingCycle': currentCycle,
                    'payment.generatedAt': admin.firestore.FieldValue.serverTimestamp()
                });

                count++;
            }
        }

        return res.status(200).json({ 
            success: true, 
            cycle: currentCycle, 
            messagesGenerated: count 
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

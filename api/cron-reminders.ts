
// api/cron-reminders.ts
import * as admin from 'firebase-admin';

/**
 * 🤖 MOTOR DO ROBÔ REAL (APP B)
 * Este endpoint deve ser chamado via Cron Job.
 * Ele gera as mensagens e marca o ciclo como processado.
 * 
 * ATUALIZAÇÃO: MODO DRY-RUN E TRAVAS DE SEGURANÇA.
 * ADIÇÃO: VARIÁVEIS {EMPRESA} E {DESTINATARIO}
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
function parseMessage(template: string, data: Record<string, string>, settings: any) {
    let msg = template || "";
    
    // Resolução de {EMPRESA}
    const companyName = settings?.billingCompanyName || settings?.companyName || "Equipe Financeira";
    
    // Resolução de {DESTINATARIO}
    const recipientName = settings?.billingRecipientName || settings?.pixKeyRecipient || settings?.companyName || "Não informado";

    // Substituições prioritárias solicitadas
    msg = msg.replace(/{EMPRESA}/g, companyName);
    msg = msg.replace(/{DESTINATARIO}/g, recipientName);

    // Outras variáveis dinâmicas do objeto data
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
        // Em dry-run o limite é sempre 1. Em live, usa o configurado ou 1 por padrão.
        const MAX_CLIENTS = robotMode === 'dry-run' ? 1 : (bot.maxClientsPerRun || 1);

        const clientsSnap = await db.collection('clients').where('clientStatus', '==', 'Ativo').get();
        let count = 0;

        for (const doc of clientsSnap.docs) {
            if (count >= MAX_CLIENTS) break;

            const client = doc.data();
            const clientId = doc.id;

            // 3️⃣ TRAVA DE CICLO (Ignora se já processado real no ciclo atual)
            if (client.payment?.lastBillingCycle === currentCycle && robotMode === 'live') continue;
            // Pula se já pagou
            if (client.payment?.status === 'Pago') continue;

            const dueDateStr = String(client.payment?.dueDate).split('T')[0];

            if (dueDateStr === targetDateStr) {
                // GERA A MENSAGEM FINAL PASSANDO SETTINGS PARA RESOLVER NOVAS VARS
                // FIX: Renamed property from billingReminderTemplate to billingReminder to match Settings type
                const finalMessage = parseMessage(bot.billingReminder, {
                    'CLIENTE': client.name.split(' ')[0],
                    'VALOR': "consulte seu painel", 
                    'VENCIMENTO': new Date(client.payment.dueDate).toLocaleDateString('pt-BR'),
                    'PIX': settings?.pixKey || "Chave no painel"
                }, settings);

                // 4️⃣ REGISTRO DE PREVIEW (OBRIGATÓRIO PARA AMBOS OS MODOS)
                const previewData = {
                    clientId: clientId,
                    clientName: client.name,
                    phone: client.phone || 'N/A',
                    messageFinal: finalMessage,
                    dueDate: client.payment.dueDate,
                    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: robotMode === 'live' ? 'Sent' : 'Simulation'
                };

                await db.collection('robotPreviews').add(previewData);

                // 5️⃣ REGRA FINAL DE ENVIO REAL
                if (robotMode === 'live') {
                    // SALVA NO FIREBASE PARA O SOCKET EXTERNO CONSUMIR
                    await db.collection('clients').doc(clientId).update({
                        'payment.lastBillingNotificationRomantic': finalMessage,
                        'payment.lastBillingCycle': currentCycle,
                        'payment.generatedAt': admin.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    // Em dry-run, apenas logamos que a mensagem foi gerada para preview
                    console.log(`[DRY-RUN] Mensagem gerada para ${client.name}: ${finalMessage}`);
                }

                count++;
            }
        }

        return res.status(200).json({ 
            success: true, 
            mode: robotMode,
            cycle: currentCycle, 
            messagesProcessed: count,
            simulatedDate: targetDateStr
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

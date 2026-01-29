
// api/cron-reminders.ts
import * as admin from 'firebase-admin';

/**
 * 🤖 MOTOR DO ROBÔ REAL (APP B)
 * Este endpoint deve ser chamado via Cron Job.
 * Ele gera as mensagens e marca o ciclo como processado.
 * 
 * ATUALIZAÇÃO: RESOLUÇÃO ESTRITA DE DESTINATÁRIO (Sem fallback global).
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
function parseMessage(template: string, data: Record<string, string>, settings: any, client: any) {
    let msg = template || "";
    
    // 1️⃣ Resolução de {EMPRESA} (quem cobra)
    // Regra: settings.billingCompanyName -> settings.companyName -> Fallback fixo
    const companyName = settings?.billingCompanyName || settings?.companyName || "Equipe Financeira";
    
    // 2️⃣ Resolução de {DESTINATARIO} (quem recebe) - ESTRITAMENTE POR CLIENTE
    // Regra: client.payment.recipientName -> Se ausente, retorna null para indicar erro crítico
    const recipientName = client?.payment?.recipientName;

    // Se o template usa {DESTINATARIO} mas o valor está vazio/ausente, abortamos a mensagem retornando null
    if (msg.includes('{DESTINATARIO}') && (!recipientName || recipientName.trim() === "")) {
        return null; 
    }

    // Substituições prioritárias
    msg = msg.replace(/{EMPRESA}/g, companyName);
    if (recipientName) {
        msg = msg.replace(/{DESTINATARIO}/g, recipientName);
    }

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

        const robotMode = bot.robotMode || 'dry-run';
        const robotTestDateStr = bot.robotTestDate;
        const now = robotTestDateStr ? new Date(robotTestDateStr + 'T12:00:00') : new Date();
        const currentCycle = `${now.getFullYear()}-${now.getMonth() + 1}`;
        
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + 2);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        const MAX_CLIENTS = robotMode === 'dry-run' ? 1 : (bot.maxClientsPerRun || 1);

        const clientsSnap = await db.collection('clients').where('clientStatus', '==', 'Ativo').get();
        let count = 0;

        for (const doc of clientsSnap.docs) {
            if (count >= MAX_CLIENTS) break;

            const client = doc.data();
            const clientId = doc.id;

            if (client.payment?.lastBillingCycle === currentCycle && robotMode === 'live') continue;
            if (client.payment?.status === 'Pago') continue;

            const dueDateStr = String(client.payment?.dueDate).split('T')[0];

            if (dueDateStr === targetDateStr) {
                // TENTA GERAR A MENSAGEM COM VALIDAÇÃO ESTRITA
                const finalMessage = parseMessage(bot.billingReminder, {
                    'CLIENTE': client.name.split(' ')[0],
                    'VALOR': "consulte seu painel", 
                    'VENCIMENTO': new Date(client.payment.dueDate).toLocaleDateString('pt-BR'),
                    'PIX': client.pixKey || settings?.pixKey || "Chave no painel"
                }, settings, client);

                // SE A MENSAGEM RETORNOU NULL, É ERRO DE DESTINATÁRIO
                if (finalMessage === null) {
                    await db.collection('robotPreviews').add({
                        clientId: clientId,
                        clientName: client.name,
                        phone: client.phone || 'N/A',
                        messageFinal: "ERRO: Campo {DESTINATARIO} exigido no template mas não configurado no pagamento do cliente.",
                        dueDate: client.payment.dueDate,
                        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        status: 'Error'
                    });
                    console.error(`[ROBOT ERROR] Cliente ${client.name} ignorado: Destinatário ausente.`);
                    continue; // Pula para o próximo cliente
                }

                // REGISTRO DE PREVIEW/LOG SUCESSO
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
            cycle: currentCycle, 
            messagesProcessed: count,
            simulatedDate: targetDateStr
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}

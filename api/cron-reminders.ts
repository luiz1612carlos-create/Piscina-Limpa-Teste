
// api/cron-reminders.ts
import admin from 'firebase-admin';

/**
 * 🤖 MOTOR DO ROBÔ REAL (APP B)
 * Atualizado com validações defensivas extremas para evitar FUNCTION_INVOCATION_FAILED.
 */

// Inicialização segura do Firebase Admin
try {
  if (!admin.apps || admin.apps.length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    }
  }
} catch (initError) {
  console.error("Erro na inicialização do Firebase Admin:", initError);
}

const db = admin.firestore();

// Utilitário de substituição de variáveis com validação defensiva
function parseMessage(template: string, data: Record<string, string>, settings: any, client: any) {
  let msg = template || "";
  if (!msg || typeof msg !== 'string') return "";
  
  // 1️⃣ Resolução de {EMPRESA} (quem cobra)
  const companyName = settings?.billingCompanyName || settings?.companyName || "Equipe Financeira";
  
  // 2️⃣ Resolução de {DESTINATARIO} (quem recebe) - ESTRITAMENTE POR CLIENTE
  const recipientName = client?.payment?.recipientName;

  // Trava Financeira: Se o template usa {DESTINATARIO} mas o valor está vazio, aborta.
  if (msg.includes('{DESTINATARIO}')) {
    const safeRecipient = recipientName ? String(recipientName).trim() : "";
    if (safeRecipient.length === 0) {
      return null; 
    }
  }

  // Substituições prioritárias
  msg = msg.replace(/{EMPRESA}/g, String(companyName));
  if (recipientName) {
    msg = msg.replace(/{DESTINATARIO}/g, String(recipientName));
  }

  // Outras variáveis dinâmicas com fallback para data
  const safeData = data || {};
  Object.entries(safeData).forEach(([key, val]) => {
    const regex = new RegExp(`{${key}}`, 'gi');
    msg = msg.replace(regex, String(val || ""));
  });
  
  return msg;
}

export default async function handler(req: any, res: any) {
  // Try-catch global para garantir que erros virem JSON e não crash no Vercel
  try {
    // 1. Verificação de Autorização
    const authHeader = req.headers?.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized", message: "Token inválido ou ausente." });
    }

    // 2. Carregamento de Configurações
    const settingsSnap = await db.collection('settings').doc('main').get();
    if (!settingsSnap || !settingsSnap.exists) {
      return res.status(200).json({ status: "Settings not found" });
    }
    
    const settings = settingsSnap.data();
    const bot = settings?.aiBot;

    if (!bot || !bot.enabled) {
      return res.status(200).json({ status: "Robot is off" });
    }

    // 3. Lógica de Data (Proteção contra Invalid Date)
    const robotMode = bot.robotMode || 'dry-run';
    const robotTestDateStr = bot.robotTestDate;
    
    let now: Date;
    if (robotTestDateStr && typeof robotTestDateStr === 'string' && robotTestDateStr.trim().length > 0) {
      now = new Date(robotTestDateStr + 'T12:00:00');
    } else {
      now = new Date();
    }

    if (isNaN(now.getTime())) {
      return res.status(400).json({ error: "Configuração de data de teste inválida." });
    }

    const currentCycle = `${now.getFullYear()}-${now.getMonth() + 1}`;
    
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + 2);
    
    // toISOString() pode falhar se o tempo for inválido
    let targetDateStr = "";
    try {
      targetDateStr = targetDate.toISOString().split('T')[0];
    } catch (e) {
      return res.status(500).json({ error: "Erro ao processar data alvo." });
    }

    // 4. Busca de Clientes
    const clientsSnap = await db.collection('clients').where('clientStatus', '==', 'Ativo').get();
    
    if (!clientsSnap || !clientsSnap.docs || clientsSnap.docs.length === 0) {
      return res.status(200).json({ status: "No active clients found", processed: 0 });
    }

    const MAX_CLIENTS = robotMode === 'dry-run' ? 1 : (Number(bot.maxClientsPerRun) || 1);
    let count = 0;

    // 5. Loop de Processamento
    for (const doc of clientsSnap.docs) {
      if (count >= MAX_CLIENTS) break;

      const client = doc.data();
      const clientId = doc.id;
      
      if (!client || !client.payment) continue;

      // Travas de segurança (Ciclo e Pagamento)
      if (client.payment.lastBillingCycle === currentCycle && robotMode === 'live') continue;
      if (client.payment.status === 'Pago') continue;

      const rawDueDate = client.payment.dueDate;
      const dueDateStr = rawDueDate && typeof rawDueDate === 'string' ? rawDueDate.split('T')[0] : "";

      if (dueDateStr === targetDateStr) {
        const clientName = client.name || "Cliente";
        
        // Geração de mensagem com validação estrita de {DESTINATARIO}
        const finalMessage = parseMessage(bot.billingReminder, {
          'CLIENTE': clientName.split(' ')[0] || "Cliente",
          'VALOR': "consulte seu painel", 
          'VENCIMENTO': rawDueDate ? new Date(rawDueDate).toLocaleDateString('pt-BR') : "---",
          'PIX': client.pixKey || settings?.pixKey || "Chave no painel"
        }, settings, client);

        if (finalMessage === null) {
          // Registro de Erro Crítico de Dados
          await db.collection('robotPreviews').add({
            clientId: clientId,
            clientName: clientName,
            phone: client.phone || 'N/A',
            messageFinal: "ERRO: Variável {DESTINATARIO} exigida no template, mas recipientName está ausente no cadastro deste cliente.",
            dueDate: rawDueDate || "",
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'Error'
          });
          continue; 
        }

        // Registro de Log com sucesso (ou simulação)
        const previewData = {
          clientId: clientId,
          clientName: clientName,
          phone: client.phone || 'N/A',
          messageFinal: finalMessage,
          dueDate: rawDueDate || "",
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
    console.error("Erro fatal no robô:", error);
    return res.status(500).json({ 
      error: "INTERNAL_SERVER_ERROR", 
      message: error.message || "Erro desconhecido na execução do robô."
    });
  }
}

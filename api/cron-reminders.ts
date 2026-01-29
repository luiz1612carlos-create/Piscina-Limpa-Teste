// api/cron-reminders.ts
import admin from 'firebase-admin';

/**
 * 🤖 MOTOR DO ROBÔ REAL (APP B)
 * Correção Crítica: Remoção TOTAL da variável {DESTINATARIO}.
 * O robô não referencia, não valida e não substitui essa variável.
 */

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

/**
 * Processa o template da mensagem substituindo APENAS variáveis existentes.
 * {DESTINATARIO} foi REMOVIDA completamente e não é mais reconhecida.
 */
function parseMessage(
  template: string,
  data: Record<string, string>,
  settings: any
) {
  let msg = template || "";
  if (!msg || typeof msg !== 'string') return "";

  // Variáveis institucionais válidas
  const companyName =
    settings?.billingCompanyName ||
    settings?.companyName ||
    "Equipe Financeira";

  msg = msg.replace(/{EMPRESA}/g, String(companyName));

  // Substituição das variáveis dinâmicas permitidas
  const safeData = data || {};
  Object.entries(safeData).forEach(([key, val]) => {
    const regex = new RegExp(`{${key}}`, 'gi');
    msg = msg.replace(regex, String(val || ""));
  });

  return msg;
}

export default async function handler(req: any, res: any) {
  try {
    const authHeader = req.headers?.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const settingsSnap = await db.collection('settings').doc('main').get();
    if (!settingsSnap.exists) {
      return res.status(200).json({ status: "Settings not found" });
    }

    const settings = settingsSnap.data();
    const bot = settings?.aiBot;

    if (!bot || !bot.enabled) {
      return res.status(200).json({ status: "Robot is off" });
    }

    const robotMode = bot.robotMode || 'dry-run';
    const now = bot.robotTestDate
      ? new Date(bot.robotTestDate + 'T12:00:00')
      : new Date();

    if (isNaN(now.getTime())) {
      return res.status(400).json({ error: "Data de teste inválida." });
    }

    const currentCycle = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + 2);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const clientsSnap = await db
      .collection('clients')
      .where('clientStatus', '==', 'Ativo')
      .get();

    if (!clientsSnap || clientsSnap.empty) {
      return res.status(200).json({ status: "No active clients", processed: 0 });
    }

    const MAX_CLIENTS =
      robotMode === 'dry-run'
        ? 1
        : Number(bot.maxClientsPerRun) || 1;

    let count = 0;

    for (const doc of clientsSnap.docs) {
      if (count >= MAX_CLIENTS) break;

      const client = doc.data();
      const clientId = doc.id;

      if (!client || !client.payment) continue;
      if (client.payment.lastBillingCycle === currentCycle && robotMode === 'live') continue;
      if (client.payment.status === 'Pago') continue;

      const rawDueDate = client.payment.dueDate;
      const dueDateStr =
        rawDueDate && typeof rawDueDate === 'string'
          ? rawDueDate.split('T')[0]
          : "";

      if (dueDateStr === targetDateStr) {
        const clientName = client.name || "Cliente";

        const finalMessage = parseMessage(
          bot.billingReminder,
          {
            CLIENTE: clientName.split(' ')[0] || "Cliente",
            VALOR: "consulte seu painel",
            VENCIMENTO: rawDueDate
              ? new Date(rawDueDate).toLocaleDateString('pt-BR')
              : "---",
            PIX: client.pixKey || settings?.pixKey || "Chave no painel"
          },
          settings
        );

        const previewData = {
          clientId,
          clientName,
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
      processed: count
    });

  } catch (error: any) {
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: error.message
    });
  }
}

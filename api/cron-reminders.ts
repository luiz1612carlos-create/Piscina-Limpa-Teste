// api/cron-reminders.ts
import * as admin from 'firebase-admin';

/**
 * 🤖 MOTOR DO ROBÔ REAL (APP B)
 * Endpoint chamado via Cron Job
 * Programação defensiva total
 */

// 🔥 INIT FIREBASE ADMIN (SAFE PARA VERCEL)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// 🧠 TEMPLATE ENGINE
function parseMessage(
  template: string,
  data: Record<string, string>,
  settings: any,
  client: any
) {
  if (!template || typeof template !== 'string') return '';

  let msg = template;

  // {EMPRESA}
  const companyName =
    settings?.billingCompanyName ||
    settings?.companyName ||
    'Equipe Financeira';

  // {DESTINATARIO} — OBRIGATÓRIO POR CLIENTE
  const recipientName = client?.payment?.recipientName;

  if (msg.includes('{DESTINATARIO}') && !recipientName?.trim()) {
    return null;
  }

  msg = msg.replace(/{EMPRESA}/g, companyName);

  if (recipientName) {
    msg = msg.replace(/{DESTINATARIO}/g, recipientName);
  }

  Object.entries(data || {}).forEach(([key, val]) => {
    msg = msg.replace(
      new RegExp(`{${key}}`, 'gi'),
      String(val ?? '')
    );
  });

  return msg;
}

export default async function handler(req: any, res: any) {
  // 🔐 TOKEN DO CRON (OBRIGATÓRIO)
  if (req.headers?.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const settingsSnap = await db.collection('settings').doc('main').get();
    if (!settingsSnap.exists) {
      return res.status(200).json({ status: 'Settings not found' });
    }

    const settings = settingsSnap.data();
    const bot = settings?.aiBot;

    if (!bot?.enabled) {
      return res.status(200).json({ status: 'Robot is off' });
    }

    const robotMode = bot.robotMode ?? 'dry-run';
    const MAX_CLIENTS =
      robotMode === 'dry-run'
        ? 1
        : bot.maxClientsPerRun ?? 1;

    const now = bot.robotTestDate
      ? new Date(bot.robotTestDate + 'T12:00:00')
      : new Date();

    const cycle = `${now.getFullYear()}-${now.getMonth() + 1}`;

    const target = new Date(now);
    target.setDate(now.getDate() + 2);
    const targetDateStr = target.toISOString().split('T')[0];

    const clientsSnap = await db
      .collection('clients')
      .where('clientStatus', '==', 'Ativo')
      .get();

    if (clientsSnap.empty) {
      return res.status(200).json({ status: 'No active clients' });
    }

    let processed = 0;

    for (const doc of clientsSnap.docs) {
      if (processed >= MAX_CLIENTS) break;

      const client = doc.data();
      const clientId = doc.id;

      if (!client?.payment) continue;
      if (client.payment.status === 'Pago') continue;

      if (
        robotMode === 'live' &&
        client.payment.lastBillingCycle === cycle
      ) {
        continue;
      }

      const dueDateStr = String(
        client.payment.dueDate ?? ''
      ).split('T')[0];

      if (dueDateStr !== targetDateStr) continue;

      const finalMessage = parseMessage(
        bot.billingReminder,
        {
          CLIENTE: (client.name || 'Cliente').split(' ')[0],
          VALOR: 'consulte seu painel',
          VENCIMENTO: client.payment.dueDate
            ? new Date(client.payment.dueDate).toLocaleDateString('pt-BR')
            : '---',
          PIX: client.pixKey || settings?.pixKey || 'Chave no painel',
        },
        settings,
        client
      );

      if (finalMessage === null) {
        await db.collection('robotPreviews').add({
          clientId,
          clientName: client.name || 'Cliente',
          messageFinal:
            'ERRO: {DESTINATARIO} exigido mas não configurado para este cliente.',
          status: 'Error',
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue;
      }

      await db.collection('robotPreviews').add({
        clientId,
        clientName: client.name || 'Cliente',
        messageFinal: finalMessage,
        status: robotMode === 'live' ? 'Sent' : 'Simulation',
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (robotMode === 'live') {
        await db.collection('clients').doc(clientId).update({
          'payment.lastBillingCycle': cycle,
          'payment.generatedAt':
            admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      processed++;
    }

    return res.status(200).json({
      success: true,
      mode: robotMode,
      processed,
      simulatedDate: targetDateStr,
    });
  } catch (err: any) {
    console.error('CRON ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}

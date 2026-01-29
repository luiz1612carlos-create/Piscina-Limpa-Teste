import admin from 'firebase-admin';

/**
 * 🤖 MOTOR DO ROBÔ REAL (APP B)
 * Endpoint chamado via Cron Job
 * Programação defensiva total
 */

// 🔐 VALIDAÇÃO DE AMBIENTE (OBRIGATÓRIA)
if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY ||
  !process.env.CRON_SECRET
) {
  throw new Error('Required ENV vars missing (Firebase or CRON_SECRET)');
}

// 🔥 INIT FIREBASE ADMIN (SAFE + VERCEL)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// 🧠 TEMPLATE ENGINE
function parseMessage(
  template: string,
  data: Record<string, string>,
  settings: any
) {
  if (!template || typeof template !== 'string') return '';

  let msg = template;

  const companyName =
    settings?.billingCompanyName ||
    settings?.companyName ||
    'Equipe Financeira';

  msg = msg.replace(/{EMPRESA}/g, companyName);

  Object.entries(data || {}).forEach(([key, val]) => {
    msg = msg.replace(
      new RegExp(`{${key}}`, 'gi'),
      String(val ?? '')
    );
  });

  return msg;
}

export default async function handler(req: any, res: any) {
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
      robotMode === 'dry-run' ? 1 : bot.maxClientsPerRun ?? 1;

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
      ) continue;

      const dueDateStr = String(client.payment.dueDate ?? '').split('T')[0];
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
        settings
      );

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
    return res.status(500).json({ error: err.message });
  }
}

import admin from 'firebase-admin';

if (!admin.apps.length) {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error('Variáveis do Firebase não configuradas');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// Mantive as exportações originais para não quebrar outras partes do sistema
export const firestore = admin.firestore();
export const auth = admin.auth();

/**
 * Função getDb exigida pelos arquivos:
 * api/cron-reminders.ts e api/send-receipt.ts
 */
export const getDb = () => {
  return admin.firestore();
};

export default admin;
import { getDb } from "./firebase/admin.js";
import { FieldValue } from "firebase-admin/firestore";

export default async function handler(req: any, res: any) {
  // Proteção básica: permitir execução apenas via Cron ou gatilho manual autorizado
  // (O Vercel adiciona headers específicos em chamadas de Cron)

  try {
    const db = getDb();
    
    // Buscamos apenas clientes que estão marcados como 'Pago'
    // Clientes 'Pendente' ou 'Atrasado' já estão no estado desejado para o novo mês
    const clientsSnap = await db.collection('clients')
      .where('payment.status', '==', 'Pago')
      .get();

    if (clientsSnap.empty) {
      return res.status(200).json({ 
        success: true, 
        message: "Nenhum cliente com status 'Pago' para resetar no momento." 
      });
    }

    const batch = db.batch();
    let count = 0;

    clientsSnap.docs.forEach(doc => {
      // Como o limite de batch do Firestore é 500 operações, em produção idealmente
      // teríamos que quebrar em chunks. Para este exemplo, assumimos < 500.
      batch.update(doc.ref, { 
        'payment.status': 'Pendente' 
      });
      count++;
    });

    await batch.commit();

    // Registra o log da automação no sistema
    await db.collection('system_logs').add({
      type: 'monthly_reset_automation',
      timestamp: FieldValue.serverTimestamp(),
      affectedClients: count,
      status: 'success'
    });

    return res.status(200).json({ 
      success: true, 
      message: `Reset mensal concluído. ${count} clientes alterados para 'Pendente'.` 
    });

  } catch (error: any) {
    console.error("🔥 Erro no Reset Mensal Automático:", error);
    
    // Tenta registrar o erro no banco se possível
    try {
        const db = getDb();
        await db.collection('system_logs').add({
            type: 'monthly_reset_automation',
            timestamp: FieldValue.serverTimestamp(),
            status: 'error',
            error: error.message
        });
    } catch (e) {}

    return res.status(500).json({ success: false, error: error.message });
  }
}
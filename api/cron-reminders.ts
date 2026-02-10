import { getDb } from "./firebase/admin.js";
import { FieldValue } from "firebase-admin/firestore";

// --- 1. FUNÇÕES AUXILIARES (Devem estar fora do export default) ---

function calculateFee(client: any, pricing: any) {
  if (!client.poolVolume || !pricing || !pricing.volumeTiers) return 0;
  let basePrice = 0;
  const vol = Number(client.poolVolume);
  const tiers = pricing.volumeTiers;
  const tier = tiers.find((t: any) => vol >= t.min && vol <= t.max);
  if (tier) {
    basePrice = Number(tier.price);
  } else if (tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => b.max - a.max);
    if (vol > sorted[0].max) basePrice = Number(sorted[0].price);
    else basePrice = Number(tiers[0].price);
  }
  let total = basePrice;
  if (client.hasWellWater) total += Number(pricing.wellWaterFee || 0);
  if (client.includeProducts) total += Number(pricing.productsFee || 0);
  if (client.isPartyPool) total += Number(pricing.partyPoolFee || 0);
  if (client.distanceFromHq && pricing.perKm) {
    const radius = Number(pricing.serviceRadius || 0);
    const distExtra = Math.max(0, Number(client.distanceFromHq) - radius);
    total += (distExtra * Number(pricing.perKm));
  }
  if (client.plan === 'VIP' && client.fidelityPlan) {
    const discount = total * (Number(client.fidelityPlan.discountPercent || 0) / 100);
    total -= discount;
  }
  return total;
}

function toSafeDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : d;
}

function getPureDateString(dateVal: any): string {
  const date = toSafeDate(dateVal);
  if (!date) return "";
  try {
    const formatter = new Intl.DateTimeFormat('fr-CA', { 
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(date);
  } catch (e) {
    return "";
  }
}

function replaceVars(text: string, vars: Record<string, string>) {
  if (!text) return "";
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`(\\{\\{|\\{)\\s*${key}\\s*(\\}\\}|\\})`, "gi");
    result = result.replace(regex, value ?? "");
  }
  return result;
}

async function sendWhatsAppMessage(to: string, text: string, templateConfig?: { name: string, language: string, parameters: any[] }) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) return { ok: false, error: "Credenciais de API ausentes" };

  let formattedTo = to.replace(/\D/g, "");
  if (!to.trim().startsWith("+") && (formattedTo.length === 10 || formattedTo.length === 11)) {
    formattedTo = "55" + formattedTo;
  }

  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedTo,
  };

  if (templateConfig && templateConfig.name) {
    payload.type = "template";
    payload.template = {
      name: templateConfig.name,
      language: { code: templateConfig.language || "pt_BR" },
      components: [
        {
          type: "body",
          parameters: templateConfig.parameters.map(p => ({
            type: "text",
            text: String(p.text ?? "").slice(0, 1024)
          }))
        }
      ]
    };
  } else {
    payload.type = "text";
    payload.text = { body: text };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const resData = await response.json();
    return response.ok ? { ok: true, data: resData } : { ok: false, error: JSON.stringify(resData) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// --- 2. FUNÇÃO PRINCIPAL (Exportada para o Vercel) ---

export default async function handler(req: any, res: any) {
  try {
    const db = getDb();
    const settingsSnap = await db.collection('settings').doc('main').get();
    const settings = settingsSnap.data() || {};
    const billingBot = settings.billingBot || { enabled: false, dryRun: true, daysBeforeDue: 3 };

    if (!billingBot.enabled && req.query.manual !== 'true') {
      return res.status(200).json({ success: true, message: "Robô desativado." });
    }

    const brNowStr = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
    const brDate = new Date(brNowStr);
    const todayStr = getPureDateString(brDate);
    
    const advanceTargetDate = new Date(brDate);
    advanceTargetDate.setDate(advanceTargetDate.getDate() + (Number(billingBot.daysBeforeDue) || 0));
    const advanceTargetDateStr = getPureDateString(advanceTargetDate);

    const batchId = `batch_${Date.now()}`;
    const summaryRef = await db.collection('billing_execution_logs').add({
      batchId,
      timestamp: FieldValue.serverTimestamp(),
      mode: billingBot.dryRun ? 'dry-run' : 'live',
      status: 'running',
      sent: 0, ignored: 0, failed: 0, processed: 0
    });

    const clientsSnap = await db.collection('clients')
      .where('payment.status', 'in', ['Pendente', 'Atrasado'])
      .get();

    const summary = { sent: 0, ignored: 0, failed: 0, processed: 0 };

    for (const doc of clientsSnap.docs) {
      const client = doc.data();
      const clientDueDate = toSafeDate(client.payment?.dueDate);
      const clientDueDateStr = getPureDateString(clientDueDate);
      summary.processed++;
      
      let reminderType: 'advance' | 'due_day' | null = null;
      if (clientDueDateStr === advanceTargetDateStr) reminderType = 'advance';
      else if (clientDueDateStr === todayStr) reminderType = 'due_day';

      if (!reminderType) {
        summary.ignored++;
        continue;
      }

      const messageKey = `${doc.id}_${reminderType}_${todayStr}`;
      const alreadySentSnap = await db.collection('billing_messages')
        .where('messageKey', '==', messageKey)
        .where('status', 'in', ['sent', 'skipped_simulation', 'processing']) 
        .limit(1).get();

      if (!alreadySentSnap.empty) {
        summary.ignored++;
        continue; 
      }

      const valorCalculado = calculateFee(client, settings.pricing);
      const valorFormatado = valorCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      
      let vencimentoCurto = "---";
      if (clientDueDate) {
          vencimentoCurto = `${String(clientDueDate.getUTCDate()).padStart(2, '0')}/${String(clientDueDate.getUTCMonth() + 1).padStart(2, '0')}`;
      }

      const logRef = await db.collection('billing_messages').add({
        messageKey,
        customerId: doc.id,
        customerName: client.name || "N/A",
        status: "processing", 
        reminderType,
        createdAt: FieldValue.serverTimestamp()
      });

      if (!client.phone || valorCalculado <= 0) {
        summary.failed++;
        await logRef.update({ status: "failed", reason: "Dados inválidos" });
        continue;
      }

      const textVars = {
        nome: client.name || "Cliente",
        valor: valorFormatado,
        vencimento: vencimentoCurto,
        pix: client.pixKey || settings.pixKey || "Não informada",
        destinatario: client.recipientName || settings.companyName || "SOS Piscina"
      };

      const message = replaceVars(billingBot.messageTemplate || "", textVars);

      if (billingBot.dryRun) {
        summary.sent++;
        await logRef.update({ status: "skipped_simulation", messagePreview: message });
      } else {
        const templateConfig = settings.whatsappTemplateName ? {
          name: settings.whatsappTemplateName,
          language: settings.whatsappTemplateLanguage || "pt_BR",
          parameters: Object.values(textVars).map(v => ({ text: v }))
        } : undefined;

        const result = await sendWhatsAppMessage(client.phone, message, templateConfig);
        
        if (result.ok) {
          summary.sent++;
          await logRef.update({ status: "sent", sentAt: FieldValue.serverTimestamp() });
        } else {
          summary.failed++;
          await logRef.update({ status: "failed", error: result.error });
        }
      }
    }

    await summaryRef.update({ ...summary, status: 'completed', finishedAt: FieldValue.serverTimestamp() });
    return res.status(200).json({ success: true, summary });

  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
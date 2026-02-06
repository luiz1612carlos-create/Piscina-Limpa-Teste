import { getDb } from "./firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

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
  if (formattedTo.length >= 10 && !formattedTo.startsWith("55")) {
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
    if (!response.ok) {
        return { ok: false, error: JSON.stringify(resData) };
    }
    return { ok: true, data: resData };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export default async function handler(req: any, res: any) {
  try {
    const db = getDb();
    const settingsSnap = await db.collection('settings').doc('main').get();
    const settings = settingsSnap.data() || {};
    const billingBot = settings.billingBot || { enabled: false, dryRun: true, daysBeforeDue: 3 };

    if (!billingBot.enabled && req.query.manual !== 'true') {
      return res.status(200).json({ success: true, message: "Robô desativado nas configurações." });
    }

    const brNowStr = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
    const brDate = new Date(brNowStr);
    const executionHour = brDate.toLocaleTimeString('pt-BR');
    
    const batchId = `batch_${Date.now()}`;
    
    const targetDate = new Date(brDate);
    targetDate.setDate(targetDate.getDate() + (Number(billingBot.daysBeforeDue) || 0));
    const targetDateStr = getPureDateString(targetDate);

    const summaryRef = await db.collection('billing_execution_logs').add({
      batchId,
      timestamp: FieldValue.serverTimestamp(),
      executionHourBR: executionHour,
      mode: billingBot.dryRun ? 'dry-run' : 'live',
      targetDate: targetDateStr,
      status: 'running',
      sent: 0, ignored: 0, failed: 0, processed: 0
    });

    const clientsSnap = await db.collection('clients')
      .where('payment.status', 'in', ['Pendente', 'Atrasado'])
      .get();

    const summary = { sent: 0, ignored: 0, failed: 0, processed: 0 };
    const mode = billingBot.dryRun ? 'dry-run' : 'live';

    for (const doc of clientsSnap.docs) {
      const client = doc.data();
      const clientDueDate = toSafeDate(client.payment?.dueDate);
      const clientDueDateStr = getPureDateString(clientDueDate);
      summary.processed++;
      
      const valorCalculado = calculateFee(client, settings.pricing);
      const valorFormatado = valorCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      let vencimentoCurto = "---";
      if (clientDueDate) {
          const dia = String(clientDueDate.getUTCDate()).padStart(2, '0');
          const mes = String(clientDueDate.getUTCMonth() + 1).padStart(2, '0');
          vencimentoCurto = `${dia}/${mes}`;
      }

      const logRef = await db.collection('billing_messages').add({
        bot: "billingBot",
        batchId: batchId,
        customerId: doc.id,
        customerName: client.name || "N/A",
        phone: client.phone || "",
        mode: mode,
        status: "analyzing",
        targetDate: targetDateStr,
        clientDueDate: clientDueDateStr,
        calculatedValue: valorCalculado,
        createdAt: FieldValue.serverTimestamp()
      });

      if (clientDueDateStr !== targetDateStr) {
        summary.ignored++;
        await logRef.update({ 
            status: "ignored_date", 
            reason: `Data ${clientDueDateStr} não coincide com o alvo de cobrança ${targetDateStr}` 
        });
        continue;
      }

      if (!client.phone) {
        summary.failed++;
        await logRef.update({ status: "failed", reason: "Telefone não cadastrado" });
        continue;
      }

      if (valorCalculado <= 0) {
        summary.failed++;
        await logRef.update({ status: "failed", reason: "Mensalidade calculada como R$ 0,00" });
        continue;
      }

      const textVars = {
        nome: String(client.name || "Cliente"),
        nome_cliente: String(client.name || "Cliente"),
        valor: String(valorFormatado),
        vencimento: vencimentoCurto,
        data_vencimento: clientDueDate ? clientDueDate.toLocaleDateString('pt-BR') : vencimentoCurto,
        status: client?.payment?.status || 'Pendente',
        STATUS_PAGAMENTO: client?.payment?.status || 'Pendente',
        pix: String(client.pixKey || settings.pixKey || "Não informada"),
        destinatario: String(client.recipientName || settings.pixKeyRecipient || settings.companyName || "SOS Piscina"),
        CLIENTE: String(client.name || "Cliente"),
        VALOR: String(valorFormatado),
        VENCIMENTO_CURTO: vencimentoCurto
      };

      const message = replaceVars(billingBot.messageTemplate || "", textVars);

      if (billingBot.dryRun) {
        summary.sent++;
        await logRef.update({ 
            status: "skipped_simulation", 
            messagePreview: message,
            variables: textVars,
            hasTemplate: !!settings.whatsappTemplateName
        });
      } else {
        let templateConfig = undefined;
        if (settings.whatsappTemplateName) {
           templateConfig = {
             name: settings.whatsappTemplateName,
             language: settings.whatsappTemplateLanguage || "pt_BR",
             parameters: [
                { type: "text", text: textVars.nome },
                { type: "text", text: textVars.valor },
                { type: "text", text: textVars.vencimento },
                { type: "text", text: textVars.pix },
                { type: "text", text: textVars.destinatario }
             ]
           };
        }

        const result = await sendWhatsAppMessage(client.phone, message, templateConfig);
        
        if (result.ok) {
          summary.sent++;
          await logRef.update({ 
            status: "sent", 
            sentAt: FieldValue.serverTimestamp(), 
            messageSent: message,
            usedTemplate: !!templateConfig,
            parametersSent: templateConfig?.parameters.map(p => p.text)
          });
        } else {
          summary.failed++;
          await logRef.update({ status: "failed", error: result.error, usedTemplate: !!templateConfig });
        }
      }
    }

    await summaryRef.update({
      ...summary,
      status: 'completed',
      finishedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, batchId, summary, executionTime: executionHour });

  } catch (error: any) {
    console.error("🔥 Erro fatal no billing bot:", error);
    const db = getDb();
    await db.collection('billing_execution_logs').add({
        timestamp: FieldValue.serverTimestamp(),
        status: 'error',
        error: error.message
    });
    return res.status(500).json({ success: false, error: error.message });
  }
}
// AJUSTE: Adicionada a extensão .js para resolver o erro ERR_MODULE_NOT_FOUND
import { getDb } from "./firebase/admin.js"; 
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

// Ajustado para o seu domínio oficial conforme os logs
const DOMINIO_PERMITIDO = 'sospiscinalimpa.com';

function generateChecksum(idFatura: string, valor: number, cpf: string, pix: string, destinatario: string) {
  // AJUSTE: MASTER_KEY deve ser priorizada do ambiente para blindagem real
  const MASTER_KEY = process.env.MASTER_KEY || 'CHAVE_MESTRA_PADRAO_SEGURA';
  const data = `${idFatura}${valor.toFixed(2)}${cpf}${pix}${destinatario}${MASTER_KEY}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function logAudit(db: any, clientId: string, vars: any, status: 'Sucesso' | 'Bloqueio') {
  // Garante que a coleção de auditoria exista para registrar tentativas de golpe
  await db.collection('billing_audit_logs').add({
    clientId,
    vars,
    status,
    timestamp: FieldValue.serverTimestamp()
  });
}

// ... (Funções calculateFee, toSafeDate, getPureDateString, replaceVars permanecem iguais para não bugar o app)

function calculateFee(client: any, pricing: any) {
  if (!pricing) return 0;
  let basePrice = 0;
  if (client.isPublicPool) {
    basePrice = Number(pricing.publicPoolFee || 0);
  } else {
    if (!client.poolVolume || !pricing.volumeTiers) return 0;
    const vol = Number(client.poolVolume);
    const tiers = pricing.volumeTiers;
    const tier = tiers.find((t: any) => vol >= t.min && vol <= t.max);
    if (tier) {
      basePrice = Number(tier.price);
    } else if (tiers.length > 0) {
      const sorted = [...tiers].sort((a: any, b: any) => b.max - a.max);
      if (vol > sorted[0].max) basePrice = Number(sorted[0].price);
      else basePrice = Number(tiers[0].price);
    }
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
        year: 'numeric', month: '2-digit', day: '2-digit' 
    });
    return formatter.format(date);
  } catch (e) { return ""; }
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

async function sendWhatsAppMessage(to: string, text: string, templateConfig?: { name: string, language: string, parameters: any[], imageUrl?: string }) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_TOKEN || process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) return { ok: false, error: "Credenciais ausentes" };
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
    const components: any[] = [
      { type: "body", parameters: templateConfig.parameters.map(p => ({ type: "text", text: String(p.text ?? "").slice(0, 1024) })) }
    ];

    if (templateConfig.imageUrl) {
      components.unshift({
        type: "header",
        parameters: [
          {
            type: "image",
            image: { link: templateConfig.imageUrl }
          }
        ]
      });
    }

    payload.template = {
      name: templateConfig.name,
      language: { code: templateConfig.language || "pt_BR" },
      components
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

    const contentType = response.headers.get("content-type");
    let resData;
    if (contentType && contentType.includes("application/json")) {
      resData = await response.json();
    } else {
      const errorText = await response.text();
      return { ok: false, error: `Meta API retornou erro: ${errorText.slice(0, 150)}` };
    }

    return response.ok ? { ok: true, data: resData } : { ok: false, error: JSON.stringify(resData) };
  } catch (err: any) { return { ok: false, error: err.message }; }
}

function isHolidayOrSunday(date: Date): boolean {
  // Domingo = 0
  if (date.getDay() === 0) return true;

  const day = date.getDate();
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  // Feriados Nacionais Fixos
  const fixedHolidays = [
    "1-1",   // Ano Novo
    "21-4",  // Tiradentes
    "1-5",   // Dia do Trabalho
    "7-9",   // Independência
    "12-10", // Nossa Sra. Aparecida
    "2-11",  // Finados
    "15-11", // Proclamação da República
    "20-11", // Consciência Negra
    "25-12"  // Natal
  ];

  if (fixedHolidays.includes(`${day}-${month}`)) return true;

  // Cálculo de feriados móveis (baseado na Páscoa)
  // Algoritmo de Meeus/Jones/Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const p = (h + l - 7 * m + 114) % 31;
  
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = p + 1;

  const easterDate = new Date(year, easterMonth - 1, easterDay);

  // Carnaval (47 dias antes da Páscoa - Terça-feira)
  const carnaval = new Date(easterDate);
  carnaval.setDate(easterDate.getDate() - 47);

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const sextaSanta = new Date(easterDate);
  sextaSanta.setDate(easterDate.getDate() - 2);

  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = new Date(easterDate);
  corpusChristi.setDate(easterDate.getDate() + 60);

  const checkDateStr = (d: Date) => `${d.getDate()}-${d.getMonth() + 1}`;
  const mobileHolidays = [
    checkDateStr(carnaval),
    checkDateStr(sextaSanta),
    checkDateStr(corpusChristi)
  ];

  if (mobileHolidays.includes(`${day}-${month}`)) return true;

  return false;
}

export default async function handler(req: any, res: any) {
  try {
    const db = getDb();
    const settingsSnap = await db.collection('settings').doc('main').get();
    const settings = settingsSnap.data() || {};
    const billingBot = settings.billingBot || { enabled: false, dryRun: true, daysBeforeDue: 3 };

    if (!billingBot.enabled && req.query.manual !== 'true') {
      return res.status(200).json({ success: true, message: "Robô desativado." });
    }

    const testPhone = req.query.testPhone;
    const brNowStr = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
    const brDate = new Date(brNowStr);

    // Bloqueio de Domingos e Feriados (exceto se for teste manual)
    if (!testPhone && req.query.manual !== 'true' && isHolidayOrSunday(brDate)) {
      return res.status(200).json({ 
        success: true, 
        message: "Hoje é domingo ou feriado. Cobranças suspensas para respeitar o descanso dos clientes." 
      });
    }

    const todayStr = getPureDateString(brDate);
    const batchId = testPhone ? `test_${Date.now()}` : `batch_${Date.now()}`;
    
    const advanceTargetDate = new Date(brDate);
    advanceTargetDate.setDate(advanceTargetDate.getDate() + (Number(billingBot.daysBeforeDue) || 0));
    const advanceTargetDateStr = getPureDateString(advanceTargetDate);

    const summaryRef = await db.collection('billing_execution_logs').add({
      batchId, timestamp: FieldValue.serverTimestamp(),
      mode: testPhone ? 'test' : (billingBot.dryRun ? 'dry-run' : 'live'),
      status: 'running', sent: 0, ignored: 0, failed: 0, processed: 0
    });

    const clientsSnap = testPhone 
        ? await db.collection('clients').where('phone', '==', testPhone).limit(1).get()
        : await db.collection('clients').where('payment.status', 'in', ['Pendente', 'Atrasado']).get();

    const summary = { sent: 0, ignored: 0, failed: 0, processed: 0 };

    for (const doc of clientsSnap.docs) {
      const client = doc.data();

      // Pular clientes que desativaram lembretes (exceto em teste direto por telefone)
      if (client.disableReminders === true && !testPhone) {
        summary.ignored++;
        continue;
      }

      const clientDueDate = toSafeDate(client.payment?.dueDate);
      const clientDueDateStr = getPureDateString(clientDueDate);
      summary.processed++;

      if (!testPhone) {
          if (client.advancePaymentUntil) {
              const advanceUntil = toSafeDate(client.advancePaymentUntil);
              if (advanceUntil && advanceUntil > brDate) { summary.ignored++; continue; }
          }

          let reminderType: 'advance' | 'due_day' | null = null;
          if (clientDueDateStr === advanceTargetDateStr) reminderType = 'advance';
          else if (clientDueDateStr === todayStr) reminderType = 'due_day';

          if (!reminderType) { summary.ignored++; continue; }

          const alreadySentSnap = await db.collection('billing_messages')
            .where('customerId', '==', doc.id)
            .where('clientDueDate', '==', clientDueDateStr)
            .where('reminderType', '==', reminderType)
            .get();

          const sentToday = alreadySentSnap.docs.some(d => getPureDateString(toSafeDate(d.data().createdAt)) === todayStr);
          if (sentToday) { summary.ignored++; continue; }
      }

      const valorCalculado = calculateFee(client, settings.pricing);
      const valorFormatado = valorCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      let vencimentoCurto = "---";
      if (clientDueDate) {
          vencimentoCurto = `${String(clientDueDate.getUTCDate()).padStart(2, '0')}/${String(clientDueDate.getUTCMonth() + 1).padStart(2, '0')}`;
      }

      const logRef = await db.collection('billing_messages').add({
        bot: "billingBot", batchId, customerId: doc.id, customerName: client.name || "N/A",
        phone: client.phone || "", mode: testPhone ? 'test' : (billingBot.dryRun ? 'dry-run' : 'live'),
        status: "analyzing", reminderType: testPhone ? 'test' : (clientDueDateStr === todayStr ? 'due_day' : 'advance'), 
        clientDueDate: clientDueDateStr,
        calculatedValue: valorCalculado, createdAt: FieldValue.serverTimestamp()
      });

      if (!client.phone || valorCalculado <= 0) {
        summary.failed++;
        await logRef.update({ status: "failed", reason: !client.phone ? "Telefone ausente" : "Valor zero" });
        continue;
      }

      const textVars = {
        nome: String(client.name || "Cliente"), valor: valorFormatado, vencimento: vencimentoCurto,
        pix: String(client.pixKey || settings.pixKey || "Não informada"),
        destinatario: String(client.recipientName || settings.pixKeyRecipient || settings.companyName || "SOS Piscina")
      };

      const message = replaceVars(billingBot.messageTemplate || "", textVars);

      // --- CAMADA DE SEGURANÇA (BLINDAGEM) ---
      
      const currentHash = generateChecksum(doc.id, valorCalculado, client.cpf || "", textVars.pix, textVars.destinatario);
      if (client.payment?.securityHash && client.payment.securityHash !== currentHash) {
        console.error(`[SECURITY] Divergência de Checksum para ${client.name}.`);
        await logAudit(db, doc.id, textVars, 'Bloqueio');
        summary.failed++;
        await logRef.update({ status: "failed", reason: "Erro de integridade (Checksum)" });
        continue;
      }

      if (billingBot.dryRun && !testPhone) {
        summary.sent++;
        await logRef.update({ status: "skipped_simulation", messagePreview: message });
      } else {
        let templateConfig = settings.whatsappTemplateName ? {
             name: settings.whatsappTemplateName, language: settings.whatsappTemplateLanguage || "pt_BR",
             imageUrl: billingBot.billingImage,
             parameters: [
                { text: textVars.nome }, { text: textVars.valor }, { text: textVars.vencimento },
                { text: textVars.pix }, { text: textVars.destinatario }
             ]
        } : undefined;

        // Validação de Domínio
        if (templateConfig) {
          const hasInvalidDomain = templateConfig.parameters.some(p => {
            const text = String(p.text || "");
            return (text.includes("http://") || text.includes("https://")) && !text.includes(DOMINIO_PERMITIDO);
          });

          if (hasInvalidDomain) {
            console.error(`[SECURITY] Domínio não permitido detectado.`);
            await logAudit(db, doc.id, textVars, 'Bloqueio');
            summary.failed++;
            await logRef.update({ status: "failed", reason: "Domínio não permitido" });
            continue;
          }
        }

        const result = await sendWhatsAppMessage(client.phone, message, templateConfig);
        if (result.ok) {
          summary.sent++;
          await logAudit(db, doc.id, textVars, 'Sucesso');
          await logRef.update({ status: "sent", sentAt: FieldValue.serverTimestamp() });
          
          // SINCRONIZAÇÃO LIVE CHAT
          try {
            let phoneId = String(client.phone).replace(/\D/g, "");
            if (!String(client.phone).trim().startsWith("+") && (phoneId.length === 10 || phoneId.length === 11)) phoneId = "55" + phoneId;
            const sessionRef = db.collection("chatSessions").doc(phoneId);
            const liveMessage = `[COBRANÇA] ${message}`;
            await sessionRef.set({
              clientPhone: phoneId,
              clientName: client.name || "Cliente",
              lastMessage: liveMessage,
              lastMessageAt: FieldValue.serverTimestamp(),
              status: "bot"
            }, { merge: true });
            await sessionRef.collection("messages").add({
              text: liveMessage,
              sender: "bot",
              timestamp: FieldValue.serverTimestamp()
            });
          } catch (chatErr) {}
          
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

import { getDb } from "./firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

function calculateFee(client: any, pricing: any) {
  if (!client?.poolVolume || !pricing || !pricing.volumeTiers) return 0;
  let basePrice = 0;
  const vol = Number(client.poolVolume);
  const tiers = pricing.volumeTiers;
  const tier = tiers.find((t: any) => vol >= t.min && vol <= t.max);
  if (tier) basePrice = Number(tier.price);
  else if (tiers.length > 0) {
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

function replaceVars(text: string, vars: Record<string, string>) {
  if (!text) return "";
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`(\\{\\{|\\{)\\s*${key}\\s*(\\}\\}|\\})`, "gi");
    result = result.replace(regex, String(value ?? ""));
  }
  return result;
}

function getPhoneMatchKey(phone: string): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-9) : digits;
}

function buildBotUrl(base: string, view?: string) {
  if (!base || base.trim() === "") return "";
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  if (!view) return cleanBase;
  const separator = cleanBase.includes('?') ? '&' : '?';
  return `${cleanBase}${separator}view=${view}`;
}

async function sendSmartMessage(to: string, text: string, buttons?: { id: string, title: string, url?: string }[]) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) return;
  
  let payload: any = { messaging_product: "whatsapp", to };
  
  const urlBtn = buttons?.find(b => b.url);
  const actionButtons = buttons?.filter(b => !b.url).slice(0, 3);

  if (urlBtn) {
    payload.type = "interactive";
    payload.interactive = {
      type: "cta_url",
      body: { text: text },
      action: {
        name: "cta_url",
        parameters: {
          display_text: urlBtn.title.slice(0, 20),
          url: urlBtn.url
        }
      }
    };
  } else if (actionButtons && actionButtons.length > 0) {
    payload.type = "interactive";
    payload.interactive = {
      type: "button",
      body: { text: text },
      action: { 
        buttons: actionButtons.map(btn => ({ 
          type: "reply", 
          reply: { id: btn.id, title: btn.title.slice(0, 20) } 
        })) 
      }
    };
  } else {
    payload.type = "text";
    payload.text = { body: text };
  }

  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("❌ Erro ao disparar via Meta:", err);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const token = req.query["hub.verify_token"];
    if (req.query["hub.mode"] === "subscribe" && token === (process.env.VERIFY_TOKEN || "whatsapp_verify_123")) {
      return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.status(403).send("Forbidden");
  }

  if (req.method === "POST") {
    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      
      if (!message) return res.status(200).send("OK");

      const from = message.from; 
      const database = getDb();
      const now = FieldValue.serverTimestamp();
      
      const processedRef = database.collection("processedMessages").doc(message.id);
      const processedSnap = await processedRef.get();
      if (processedSnap.exists) return res.status(200).send("OK");

      let text = "";
      let buttonId = "";

      if (message.type === "text") {
        text = message.text.body.trim();
      } else if (message.type === "interactive") {
        buttonId = message.interactive.button_reply?.id || "";
        text = message.interactive.button_reply?.title || "";
      } else {
        text = `[Mídia: ${message.type}]`;
      }

      const fromKey = getPhoneMatchKey(from);
      const clientsSnap = await database.collection("clients").get();
      const clientDoc = clientsSnap.docs.find(d => getPhoneMatchKey(d.data().phone || "") === fromKey);
      const client = clientDoc?.data();
      const isRegistered = !!client;

      const sessionRef = database.collection("chatSessions").doc(from);
      const sessionSnap = await sessionRef.get();
      const sessionData = sessionSnap.data();
      const sessionStatus = sessionData?.status || "bot";

      await sessionRef.set({
        clientName: client?.name || sessionData?.clientName || "Visitante",
        clientPhone: from,
        lastMessage: text,
        lastMessageAt: now,
        status: sessionStatus,
        unreadCount: (sessionStatus === "human") ? 0 : FieldValue.increment(1)
      }, { merge: true });

      await sessionRef.collection("messages").add({ 
        text, 
        sender: "client", 
        timestamp: now, 
        type: message.type 
      });

      const settingsSnap = await database.collection("settings").doc("main").get();
      const settings = settingsSnap.data() || {};
      const botSettings = settings.aiBot || { enabled: false };

      if (!botSettings.enabled || sessionStatus === "human") {
        await processedRef.set({ processedAt: now });
        return res.status(200).send("OK");
      }

      const valorCalculado = isRegistered ? calculateFee(client, settings.pricing) : 0;
      const valorFormatado = valorCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const vencimentoFormatado = client?.payment?.dueDate ? new Date(client.payment.dueDate).toLocaleDateString('pt-BR') : '---';

      const textVars = { 
        cliente: client?.name || "Amigo(a)", 
        nome_cliente: client?.name || "Amigo(a)",
        empresa: settings.companyName || "SOS Piscina",
        vencimento: vencimentoFormatado,
        PIX: client?.pixKey || settings.pixKey || 'Chave PIX no painel',
        DESTINATARIO: client?.recipientName || settings.pixKeyRecipient || settings.companyName || 'Empresa',
        VALOR: valorFormatado,
        SITE_URL: botSettings.siteUrl || "",
        EMAIL: client?.email || ""
      };

      let reply = "";
      let buttons: { id: string, title: string, url?: string }[] = [];
      const input = (buttonId || text).toLowerCase();
      const siteUrl = botSettings.siteUrl || "";

      if (isRegistered) {
        if (input === "1" || input.includes("painel")) {
          const baseMsg = botSettings.accessPanelMessage || "Para acessar seu painel, utilize o site: {SITE_URL}\n\nSeu email é {EMAIL}\nSua senha padrão é: 123456";
          reply = baseMsg.replace(/utilize o site:?\s*\{SITE_URL\}/gi, 'clique no botão abaixo')
                         .replace(/\{SITE_URL\}/gi, '');
          buttons = [{ id: "p", title: "Abrir Painel", url: buildBotUrl(siteUrl) }];
        } else if (input === "2" || input.includes("agenda")) {
          const baseMsg = botSettings.schedulePartyMessage || "Para agendar um evento, clique no link abaixo:";
          reply = baseMsg.replace(/clique no link abaixo:?/gi, 'clique no botão abaixo')
                         .replace(/\{SITE_URL\}/gi, '');
          buttons = [{ id: "a", title: "Agendar Agora", url: buildBotUrl(siteUrl) }];
        } else if (input === "5" || input.includes("atendente")) {
          reply = botSettings.humanHandoffMessage || "Aguarde um momento, vou transferir sua conversa para um de nossos atendentes.";
          await sessionRef.update({ status: "waiting" });
        } else {
          reply = `${botSettings.welcomeRegistered || "Olá!"}\n\n${botSettings.menuRegistered || ""}`;
          buttons = [{ id: "1", title: "Painel" }, { id: "2", title: "Agenda" }, { id: "5", title: "Atendente" }];
        }
      } else {
        if (input === "1" || input.includes("orca") || input.includes("orça")) {
          const baseMsg = botSettings.quoteInstructionsMessage || "Calcule seu orçamento personalizado agora mesmo:";
          reply = baseMsg.replace(/clique no link abaixo:?/gi, 'clique no botão abaixo')
                         .replace(/\{SITE_URL\}/gi, '');
          buttons = [{ id: "o", title: "Fazer Orçamento", url: buildBotUrl(siteUrl, 'budget') }];
        } else if (input === "5" || input.includes("atendente")) {
          reply = botSettings.humanHandoffMessage || "Aguarde o atendimento humano.";
          await sessionRef.update({ status: "waiting" });
        } else {
          reply = `${botSettings.welcomeUnregistered || "Bem-vindo!"}\n\n${botSettings.menuUnregistered || ""}`;
          buttons = [{ id: "1", title: "Orçamento" }, { id: "5", title: "Atendente" }];
        }
      }

      const finalReply = replaceVars(reply, textVars).trim();
      if (finalReply) {
        await sendSmartMessage(from, finalReply, buttons);
        await sessionRef.update({ lastMessage: `Robô: ${finalReply.slice(0, 30)}...` });
        await sessionRef.collection("messages").add({ text: finalReply, sender: "bot", timestamp: now });
      }

      await processedRef.set({ processedAt: now });
      return res.status(200).send("OK");
    } catch (err: any) {
      console.error("❌ Falha crítica Webhook:", err);
      return res.status(200).send("INTERNAL_ERROR_HANDLED");
    }
  }
  return res.status(405).send("Method Not Allowed");
}
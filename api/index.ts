import { getDb } from "./firebase/admin.js";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

// Helper para substituir variáveis
function replaceVars(text: string, vars: Record<string, any>) {
  if (!text) return "";
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`(\\{\\{|\\{)\\s*${key}\\s*(\\}\\}|\\})`, "gi");
    result = result.replace(regex, String(value ?? ""));
  }
  return result;
}

// Normaliza números para comparação
function getPhoneMatchKey(phone: string): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  const clean = digits.startsWith("55") ? digits.slice(2) : digits;
  return clean.length >= 8 ? clean : "";
}

async function sendSmartMessage(to: string, text: string, buttons?: { id: string, title: string, url?: string }[]) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_TOKEN || process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) {
      console.error("❌ Erro: Variáveis de ambiente do WhatsApp não configuradas.");
      return;
  }
  
  let payload: any = { messaging_product: "whatsapp", to };
  
  const urlBtn = buttons?.find(b => b.url);
  const actionButtons = buttons?.filter(b => !b.url).slice(0, 3);

  if (urlBtn) {
    payload.interactive = {
      type: "cta_url",
      header: { type: "text", text: "Painel do Cliente" },
      body: { text: text },
      action: { 
        name: "cta_url", 
        parameters: { 
            display_text: urlBtn.title.slice(0, 20), 
            url: urlBtn.url 
        } 
      }
    };
    payload.type = "interactive";
  } else if (actionButtons && actionButtons.length > 0) {
    payload.interactive = {
      type: "button",
      body: { text: text },
      action: { buttons: actionButtons.map(btn => ({ type: "reply", reply: { id: btn.id, title: btn.title.slice(0, 20) } })) }
    };
    payload.type = "interactive";
  } else {
    payload.text = { body: text };
    payload.type = "text";
  }

  try {
    const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!metaResponse.ok) {
        const errText = await metaResponse.text();
        console.error("❌ Erro Meta API (sendSmartMessage):", errText);
    }
  } catch (e) {
    console.error("Erro ao enviar mensagem Meta:", e);
  }
}

async function getGeminiResponse(userMessage: string, context: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) return "Erro de configuração: Chave AI ausente.";

    const ai = new GoogleGenAI({ apiKey });
    
    const p = context.pricing || {};
    const tiersText = p.volumeTiers?.map((t: any) => `- De ${t.min}L até ${t.max}L: R$ ${t.price}`).join('\n        ') || 'Nenhuma faixa configurada';
    
    const pricingInfo = `
      TABELA DE PREÇOS OFICIAL (USE EXATAMENTE ESTES VALORES):
      - ACADEMIA / CONDOMÍNIO (Uso Coletivo): Valor FIXO de R$ ${p.publicPoolFee || '2.400,00'}.
      - RESIDENCIAL (Calculado por Volume):
        ${tiersText}
      - TAXAS ADICIONAIS:
        * Água de Poço: +R$ ${p.wellWaterFee || 0}
        * Piscina de Festa/Eventos/Airbnb: +R$ ${p.partyPoolFee || 0}
        * Deslocamento: R$ ${p.perKm || 0} por KM excedente (após ${p.serviceRadius || 0}km da base).
    `;

    let clientContext = "SITUAÇÃO: O contato atual não foi localizado no banco de dados como cliente ativo. Trate-o como um possível NOVO CLIENTE (Visitante).";
    
    if (context.client) {
      const c = context.client;
      clientContext = `
        SITUAÇÃO: CLIENTE REGISTRADO IDENTIFICADO.
        NOME: ${c.name}
        E-MAIL: ${c.email}
        PLANO: ${c.plan} ${c.fidelityPlan ? `(Fidelidade ${c.fidelityPlan.months} meses)` : ''}
        ENDEREÇO: ${c.address?.street || 'N/A'}, ${c.address?.number || 'N/A'} - ${c.address?.neighborhood || 'N/A'}, ${c.address?.city || 'N/A'}
        STATUS FINANCEIRO: ${c.payment?.status || 'N/A'}
        VENCIMENTO: ${c.payment?.dueDate || 'N/A'}
        ULTIMA LEITURA: pH ${c.poolStatus?.ph || 'N/A'}, Cloro ${c.poolStatus?.cloro || 'N/A'}
        DADOS DO APP: Login é o e-mail ${c.email} e a senha padrão é 123456.
        INFORMAÇÃO DE ROTA PARA HOJE: ${context.isScheduledToday ? 'SIM, ele está agendado para hoje!' : 'Não consta na rota de hoje.'}
        STATUS DA EQUIPE NA RUA: ${context.isRouteActive ? 'A equipe JÁ INICIOU os atendimentos.' : 'A equipe ainda não saiu para a rota.'}
      `;
    }

    const systemPrompt = `Você é o atendente humano da ${context.empresa}.
    
    ${clientContext}

    ${pricingInfo}

    URL_DO_SISTEMA: ${context.siteUrl || "https://www.sospiscinalimpa.com"}

    ${context.botSettings?.systemInstructions || ""}

    INSTRUÇÃO DE BOTÃO (IMPORTANTE):
    - Se a resposta envolver "Informações do App" ou "Painel", adicione obrigatoriamente a tag [ACESSO RÁPIDO] no final da mensagem.
    - Se necessário falar com um atendente humano, adicione a tag [FALAR COM HUMANO] no final da mensagem.

    HISTÓRICO RECENTE:
    ${context.history.map((m: any) => `${m.sender === 'client' ? 'Cliente' : 'Você'}: ${m.text}`).join('\n')}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      },
    });

    return response.text || "Desculpe, não consegui processar sua resposta agora.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return "Tive um probleminha técnico. Pode repetir?";
  }
}

export default async function handler(req: any, res: any) {
  // Verificação de Webhook da Meta (GET)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    // Suporta ambos os tokens de verificação para compatibilidade
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.VERIFY_TOKEN || "whatsapp_verify_123";
    
    if (mode === "subscribe" && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    console.log("📩 Webhook recebido (api/index):", JSON.stringify(req.body));
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

    if (message.type === "audio" || message.type === "voice") {
        await sendSmartMessage(from, "Olá! No momento não consigo ouvir áudios. ❌ Por favor, envie sua mensagem por texto.");
        await processedRef.set({ processedAt: now });
        return res.status(200).send("OK");
    }

    let text = (message.type === "text") ? message.text.body.trim() : "";
    let buttonId = (message.type === "interactive") ? message.interactive.button_reply?.id || "" : "";

    const fromKey = getPhoneMatchKey(from);
    const clientsSnap = await database.collection("clients").get();
    const clientDoc = clientsSnap.docs.find(d => {
        const clientPhone = d.data().phone || "";
        return getPhoneMatchKey(clientPhone).includes(fromKey) || fromKey.includes(getPhoneMatchKey(clientPhone));
    });
    const client = clientDoc?.data();

    const brNow = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const todayName = days[brNow.getDay()];
    const routesSnap = await database.collection("routes").doc("main").get();
    const routesData = routesSnap.data();
    const todayRoute = routesData ? routesData[todayName] : null;
    const isScheduledToday = todayRoute?.clients?.some((c: any) => c.id === clientDoc?.id) || false;
    const isRouteActive = todayRoute?.isRouteActive || false;

    const settingsSnap = await database.collection("settings").doc("main").get();
    const settings = settingsSnap.data() || {};
    const botSettings = settings.aiBot || { enabled: false };

    const sessionRef = database.collection("chatSessions").doc(from);
    const sessionSnap = await sessionRef.get();
    const sessionData = sessionSnap.data();
    let sessionStatus = sessionData?.status || "bot";

    const lastMessagePreview = text || (buttonId ? `[Botão: ${buttonId}]` : "[Mídia]");

    await sessionRef.set({ 
      clientName: client?.name || "Visitante", 
      clientPhone: from, 
      lastMessage: lastMessagePreview,
      lastMessageAt: now, 
      status: sessionStatus,
      unreadCount: FieldValue.increment(1)
    }, { merge: true });
    
    await sessionRef.collection("messages").add({ 
      text: lastMessagePreview, 
      sender: "client", 
      timestamp: now 
    });

    if (!botSettings.enabled || sessionStatus === "human") {
      await processedRef.set({ processedAt: now });
      return res.status(200).send("OK");
    }

    const historySnap = await sessionRef.collection("messages").orderBy("timestamp", "desc").limit(10).get();
    const history = historySnap.docs.map(d => d.data()).reverse();

    const context = { 
      empresa: settings.companyName || "SOS Piscina Limpa", 
      pricing: settings.pricing, 
      client,
      isScheduledToday,
      isRouteActive,
      history,
      botSettings,
      siteUrl: botSettings.siteUrl
    };
    
    let reply = "";
    let buttons: any[] = [];

    if (buttonId === "btn_humano") {
        await sessionRef.update({ status: "waiting" });
        reply = replaceVars(botSettings.humanHandoffMessage, { cliente: client?.name || "Amigo(a)" }) || "Aguarde, um atendente já vai te responder.";
    } else {
        reply = await getGeminiResponse(text || "Olá", context);
    }

    if (reply.includes("[ACESSO RÁPIDO]")) {
        reply = reply.replace("[ACESSO RÁPIDO]", "").trim();
        if(botSettings.siteUrl) buttons.push({ id: "btn_app", title: "Entrar no App", url: botSettings.siteUrl });
    }
    
    if (reply.includes("[FALAR COM HUMANO]")) {
        reply = reply.replace("[FALAR COM HUMANO]", "").trim();
        buttons.push({ id: "btn_humano", title: "Falar com Humano" });
    }

    if (reply) {
      await sendSmartMessage(from, reply, buttons);
      await sessionRef.collection("messages").add({ text: reply, sender: "bot", timestamp: now });
    }

    await processedRef.set({ processedAt: now });
    return res.status(200).send("OK");
  } catch (err: any) { 
    console.error("Handler Error:", err.message);
    return res.status(200).send("OK");
  }
}

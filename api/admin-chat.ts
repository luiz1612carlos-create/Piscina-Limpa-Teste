// api/admin-chat.ts
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

function calculateFee(client: any, settings: any): string {
  // PRIORIDADE: Valor manual
  if (client.manualFee !== undefined && client.manualFee !== null) {
      return Number(client.manualFee).toFixed(2).replace('.', ',');
  }

  if (!client || !settings || !settings.pricing) return "0,00";
  const pricing = settings.pricing;
  const volume = Number(client.poolVolume || 0);
  let basePrice = 0;
  const tier = (pricing.volumeTiers || []).find((t: any) => volume >= Number(t.min) && volume <= Number(t.max));
  if (tier) basePrice = Number(tier.price);
  else if (pricing.volumeTiers?.length > 0) {
      const sorted = [...pricing.volumeTiers].sort((a,b) => b.max - a.max);
      if (volume > sorted[0].max) basePrice = Number(sorted[0].price);
  }
  let total = basePrice;
  if (client.hasWellWater) total += Number(pricing.wellWaterFee || 0);
  if (client.includeProducts) total += Number(pricing.productsFee || 0);
  if (client.isPartyPool) total += Number(pricing.partyPoolFee || 0);
  return total.toFixed(2).replace('.', ',');
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { sessionId, text, useTemplate } = req.body;
  if (!sessionId || !text) return res.status(400).json({ error: "Missing parameters" });

  try {
    const settingsSnap = await db.collection("settings").doc("main").get();
    const settings = settingsSnap.data() || {};

    let payload: any;

    if (useTemplate && settings.whatsappTemplateName) {
      // LOGICA DE TEMPLATE (PARA COBRANÇA FORA DA JANELA DE 24H)
      // Buscamos os dados do cliente para preencher as variáveis do template Meta
      const from = sessionId.replace(/\D/g, "");
      const clientsSnap = await db.collection("clients").get();
      const clientDoc = clientsSnap.docs.find(d => {
          const p = String(d.data().phone || "").replace(/\D/g, "");
          return p.slice(-8) === from.slice(-8);
      });
      const client = clientDoc?.data();

      let resolvedPix = settings.pixKey || "";
      if (client?.pixKey) resolvedPix = client.pixKey;
      else if (client?.bankId) {
          const bank = await db.collection("banks").doc(client.bankId).get();
          if (bank.exists) resolvedPix = bank.data()?.pixKey || resolvedPix;
      }

      payload = {
        messaging_product: "whatsapp",
        to: sessionId,
        type: "template",
        template: {
          name: settings.whatsappTemplateName,
          language: { code: settings.whatsappTemplateLanguage || "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: client?.name || "Cliente" },
                { type: "text", text: client ? calculateFee(client, settings) : "0,00" },
                { type: "text", text: client?.payment?.dueDate ? new Date(client.payment.dueDate).toLocaleDateString('pt-BR') : "A definir" },
                { type: "text", text: resolvedPix }
              ]
            }
          ]
        }
      };
    } else {
      // LOGICA DE TEXTO LIVRE (DENTRO DA JANELA DE 24H)
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = text.match(urlRegex);
      const firstUrl = matches ? matches[0] : null;

      if (firstUrl) {
        const cleanText = text.replace(firstUrl, "").trim();
        let buttonLabel = "Abrir Link";
        if (firstUrl.includes("google")) buttonLabel = "Avaliar no Google ✨";
        else if (firstUrl.includes("app") || firstUrl.includes("vercel")) buttonLabel = "Acessar Sistema 📲";

        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: sessionId,
          type: "interactive",
          interactive: {
            type: "cta_url",
            body: { text: cleanText || "Veja as informações no link abaixo:" },
            action: {
              name: "cta_url",
              parameters: { display_text: buttonLabel, url: firstUrl }
            }
          }
        };
      } else {
        payload = { messaging_product: "whatsapp", to: sessionId, type: "text", text: { body: text } };
      }
    }

    const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const metaData = await metaResponse.json();
    if (!metaResponse.ok) {
        console.error("❌ Erro Meta API:", metaData);
        // Se falhou por falta de template e tentamos texto livre, avisar
        if (metaData.error?.code === 131030) {
            return res.status(403).json({ error: "JANELA_FECHADA", message: "O cliente não responde há 24h. Use um Template Oficial." });
        }
    }

    const sessionRef = db.collection("chatSessions").doc(sessionId);
    const serverNow = admin.firestore.FieldValue.serverTimestamp();
    await sessionRef.collection("messages").add({ text, sender: "admin", timestamp: serverNow });
    await sessionRef.update({ lastMessage: text, lastMessageAt: serverNow, status: "human", unreadCount: 0 });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
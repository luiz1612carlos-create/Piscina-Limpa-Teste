import { getDb } from "./firebase/admin.js";
import { FieldValue } from "firebase-admin/firestore";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { 
        clientPhone, 
        clientName, 
        newStatus, 
        companyName 
    } = req.body;

    if (!clientPhone || !newStatus) {
        return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
    }

    const db = getDb();
    const settingsSnap = await db.collection('settings').doc('main').get();
    const settings = settingsSnap.data() || {};
    const statusBot = settings.poolStatusBot || { enabled: false };

    if (!statusBot.enabled) {
      return res.status(200).json({ success: true, message: "Avisos de status desativados." });
    }

    const isRestricted = newStatus === 'Em tratamento';
    const templateName = isRestricted ? statusBot.restrictedTemplate : statusBot.releasedTemplate;
    const imageUrl = isRestricted ? statusBot.restrictedImage : statusBot.releasedImage;

    if (!templateName) {
        return res.status(200).json({ success: true, message: "Template não configurado para este status." });
    }

    const horaAtual = new Date().toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'America/Sao_Paulo' 
    });
    
    let formattedTo = String(clientPhone).replace(/\D/g, "");
    if (!String(clientPhone).trim().startsWith("+") && (formattedTo.length === 10 || formattedTo.length === 11)) {
        formattedTo = "55" + formattedTo;
    }

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.META_TOKEN || process.env.WHATSAPP_TOKEN;

    if (!phoneId || !token) {
        throw new Error("Credenciais de WhatsApp ausentes.");
    }

    const bodyParameters = isRestricted 
        ? [
            { type: "text", text: String(clientName || "Cliente") },
            { type: "text", text: horaAtual },
            { type: "text", text: String(companyName || "SOS Piscina") }
          ]
        : [
            { type: "text", text: String(clientName || "Cliente") },
            { type: "text", text: "LIBERADA" }
          ];

    const components: any[] = [
        {
            type: "body",
            parameters: bodyParameters
        }
    ];

    if (imageUrl) {
        components.unshift({
            type: "header",
            parameters: [
                {
                    type: "image",
                    image: { link: imageUrl }
                }
            ]
        });
    }

    const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedTo,
        type: "template",
        template: {
            name: templateName,
            language: { code: statusBot.templateLanguage || "pt_BR" },
            components: components
        }
    };

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const resData = await response.json();

    if (!response.ok) {
        return res.status(400).json({ error: "Erro Meta API", detail: resData });
    }

    await db.collection('status_alert_logs').add({
        timestamp: FieldValue.serverTimestamp(),
        clientName: clientName,
        phone: formattedTo,
        status: newStatus,
        template: templateName,
        hasImage: !!imageUrl
    });

    // SINCRONIZAÇÃO LIVE CHAT
    try {
        const sessionRef = db.collection("chatSessions").doc(formattedTo);
        const liveMessage = `[SEGURANÇA] Status da piscina alterado para: ${newStatus.toUpperCase()}.`;
        await sessionRef.set({
            clientPhone: formattedTo,
            clientName: clientName || "Cliente",
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

    return res.status(200).json({ success: true, metaId: resData.messages?.[0]?.id });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
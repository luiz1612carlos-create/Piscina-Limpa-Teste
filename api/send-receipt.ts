import { getDb } from "./firebase/admin.js";
import { FieldValue } from "firebase-admin/firestore";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { 
        clientPhone, 
        clientName, 
        amount, 
        paymentMethod, 
        companyName,
        clientId
    } = req.body;

    if (!clientPhone || !amount) {
        return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
    }

    const db = getDb();
    const settingsSnap = await db.collection('settings').doc('main').get();
    const settings = settingsSnap.data() || {};
    const receiptBot = settings.receiptBot || { enabled: false };

    if (!receiptBot.enabled || !receiptBot.templateName) {
      return res.status(200).json({ success: true, message: "Recibo automático desativado." });
    }

    const valorFormatado = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dataPagamento = new Date().toLocaleDateString('pt-BR');
    
    let formattedTo = String(clientPhone).replace(/\D/g, "");
    if (!String(clientPhone).trim().startsWith("+") && (formattedTo.length === 10 || formattedTo.length === 11)) {
        formattedTo = "55" + formattedTo;
    }

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.META_TOKEN || process.env.WHATSAPP_TOKEN;

    if (!phoneId || !token) {
        throw new Error("Credenciais de WhatsApp ausentes no ambiente.");
    }

    const components: any[] = [
        {
            type: "body",
            parameters: [
                { type: "text", text: String(clientName || "Cliente") },
                { type: "text", text: String(valorFormatado) },
                { type: "text", text: String(dataPagamento) },
                { type: "text", text: String(paymentMethod || "Pix") },
                { type: "text", text: String(companyName || "Empresa") }
            ]
        }
    ];

    if (receiptBot.receiptImage) {
        components.unshift({
            type: "header",
            parameters: [
                {
                    type: "image",
                    image: { link: receiptBot.receiptImage }
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
            name: receiptBot.templateName,
            language: { code: receiptBot.templateLanguage || "pt_BR" },
            components: components
        }
    };

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
        console.error("❌ Erro Crítico Meta (Não é JSON):", errorText);
        return res.status(500).json({ error: "Meta API retornou erro não-JSON", detail: errorText.slice(0, 200) });
    }

    if (!response.ok) {
        console.error("❌ Erro Meta API Recibo:", JSON.stringify(resData));
        await db.collection('receipt_errors').add({
            timestamp: FieldValue.serverTimestamp(),
            phone: formattedTo,
            error: resData,
            template: receiptBot.templateName
        });
        return res.status(400).json({ error: "Erro Meta API", detail: resData });
    }

    await db.collection('receipt_logs').add({
        timestamp: FieldValue.serverTimestamp(),
        clientId: clientId || 'N/A',
        clientName: clientName,
        phone: formattedTo,
        amount: amount,
        status: "sent",
        metaId: resData.messages?.[0]?.id
    });

    // SINCRONIZAÇÃO LIVE CHAT
    try {
        const sessionRef = db.collection("chatSessions").doc(formattedTo);
        const liveMessage = `[RECIBO] Pagamento de R$ ${valorFormatado} confirmado no dia ${dataPagamento}.`;
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
    console.error("🔥 Erro fatal no envio de recibo:", error);
    return res.status(500).json({ error: error.message });
  }
}
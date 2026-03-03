import { getDb } from "./firebase/admin.js";
import { FieldValue } from "firebase-admin/firestore";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, text } = req.body;

  if (!sessionId || !text || !text.trim()) {
    return res.status(400).json({ error: "Missing or invalid parameters" });
  }

  const token = process.env.META_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.error("❌ Erro: Variáveis de ambiente do WhatsApp não configuradas (admin-chat).");
    return res.status(500).json({ error: "WhatsApp environment variables not configured" });
  }

  try {
    const db = getDb();
    const cleanText = text.trim();

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: sessionId,
      type: "text",
      text: { body: cleanText },
    };

    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!metaResponse.ok) {
      const errorText = await metaResponse.text();
      console.error("Erro Meta API:", errorText);
      return res.status(400).json({
        error: "Erro Meta API",
        detail: errorText,
      });
    }

    const sessionRef = db.collection("chatSessions").doc(sessionId);
    const serverNow = FieldValue.serverTimestamp();

    // Garante que o documento existe
    await sessionRef.set(
      {
        clientPhone: sessionId,
        lastInteractionAt: serverNow,
      },
      { merge: true }
    );

    await sessionRef.collection("messages").add({
      text: cleanText,
      sender: "admin",
      timestamp: serverNow,
    });

    await sessionRef.set(
      {
        lastMessage: cleanText,
        lastMessageAt: serverNow,
        status: "human",
        unreadCount: 0,
      },
      { merge: true }
    );

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error("Erro send-message:", error);
    return res.status(500).json({
      error: "Internal server error",
      detail: error?.message || "Unknown error",
    });
  }
}
import { getDb } from "./firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const { sessionId, text } = req.body;
  if (!sessionId || !text) return res.status(400).json({ error: "Missing parameters" });

  try {
    const db = getDb();
    
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: sessionId,
      type: "text",
      text: { body: text },
    };

    const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!metaResponse.ok) {
        const metaData = await metaResponse.json();
        return res.status(400).json({ error: "Erro Meta API", detail: metaData });
    }

    const sessionRef = db.collection("chatSessions").doc(sessionId);
    const serverNow = FieldValue.serverTimestamp();
    
    await sessionRef.collection("messages").add({ 
      text, 
      sender: "admin", 
      timestamp: serverNow 
    });
    
    await sessionRef.update({ 
      lastMessage: text, 
      lastMessageAt: serverNow, 
      status: "human", 
      unreadCount: 0 
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
import { GoogleGenAI, Type } from "@google/genai";
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "whatsapp_verify_123";

export default async function handler(req: any, res: any) {
  
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.status(403).send("Erro: Token inválido.");
  }

  if (req.method === "POST") {
    try {
      const entry = req.body.entry?.[0];
      const message = entry?.changes?.[0]?.value?.messages?.[0];
      if (!message || message.type !== "text") return res.status(200).send("EVENT_RECEIVED");

      const from = message.from; 
      const userText = message.text.body;

      // 1. BUSCAR CONFIGURAÇÕES GERAIS
      const settingsSnap = await db.collection('settings').doc('main').get();
      const settings = settingsSnap.data();
      const aiSettings = settings?.aiBot;

      if (!aiSettings?.enabled) return res.status(200).send("BOT_DISABLED");

      // 2. IDENTIFICAR CLIENTE
      const phoneSuffix = from.slice(-8); 
      const clientSnap = await db.collection('clients').where('clientStatus', '==', 'Ativo').get();
      const client = clientSnap.docs.find(d => d.data().phone.replace(/\D/g, '').endsWith(phoneSuffix));
      const clientData = client?.data();

      // 3. CONFIGURAR GEMINI COM PROMPT DINÂMICO
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

      const tools = [{
        functionDeclarations: [
          {
            name: 'agendar_festa_piscina',
            description: 'Registra um evento de uso da piscina informado pelo cliente.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                data: { type: Type.STRING, description: 'Data no formato AAAA-MM-DD' },
                motivo: { type: Type.STRING, description: 'Ex: Aniversário, Churrasco, etc.' }
              },
              required: ['data']
            }
          },
          {
             name: 'chamar_atendente',
             description: 'Aciona o transbordo para atendimento humano.',
             parameters: { type: Type.OBJECT, properties: { razao: { type: Type.STRING } } }
          }
        ]
      }];

      const systemInstruction = `
        VOCÊ: ${aiSettings.name || 'Assistente SOS Piscina'} 🌊.
        PERSONALIDADE E REGRAS: ${aiSettings.systemInstructions}
        
        CONTEXTO DO USUÁRIO:
        - Nome: ${clientData?.name || "Visitante"}
        - Status: ${client ? 'CLIENTE CADASTRADO' : 'NÃO CADASTRADO'}
        - Vencimento: ${clientData?.payment?.dueDate ? new Date(clientData.payment.dueDate).toLocaleDateString('pt-BR') : 'Sem dados'}
        
        TABELA DE PREÇOS (Para Orçamentos):
        ${JSON.stringify(settings?.pricing?.volumeTiers || [])}
        
        REGRAS DE AGENDAMENTO:
        - Use a função 'agendar_festa_piscina' se o cliente pedir para agendar um uso.
        - Use a função 'chamar_atendente' se o cliente pedir para falar com alguém ou tiver dúvida complexa.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: userText }] }],
        config: { systemInstruction, tools },
      });

      let finalReply = response.text || "";

      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'agendar_festa_piscina' && client && aiSettings.autoSchedulingEnabled) {
            const { data, motivo } = fc.args as any;
            await db.collection('poolEvents').add({
              clientId: clientData?.uid || client.id,
              clientName: clientData?.name,
              eventDate: admin.firestore.Timestamp.fromDate(new Date(data + 'T12:00:00')),
              notes: `Agendado via IA: ${motivo || 'Uso da piscina'}`,
              status: 'notified',
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            finalReply = `Tudo certo, ${clientData?.name}! Acabei de agendar o uso para o dia ${new Date(data).toLocaleDateString('pt-BR')}. Nossa equipe cuidará de tudo! 🏊‍♂️✨`;
          }
          
          if (fc.name === 'chamar_atendente') {
             finalReply = aiSettings.humanHandoffMessage || "Entendido. Vou passar sua solicitação para um de nossos especialistas. Por favor, aguarde um momento! 👨‍💻";
          }
        }
      }

      if (!finalReply) finalReply = "Poderia repetir? Não consegui processar sua mensagem agora. 🌊";

      await fetch(
        `https://graph.facebook.com/v23.0/911056812090553/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: finalReply },
          }),
        }
      );

      return res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
      console.error("Erro no Robô:", error);
      return res.status(200).send("EVENT_RECEIVED");
    }
  }
  return res.status(405).send("Method Not Allowed");
}
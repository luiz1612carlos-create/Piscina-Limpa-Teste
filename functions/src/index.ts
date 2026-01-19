import { onRequest } from "firebase-functions/v2/https";
import { processMensagem } from "./robobot";

export const whatsappWebhook = onRequest(async (req, res) => {
  try {
    // Verificação do webhook (Meta)
    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === "meu_token_secreto") {
        res.status(200).send(challenge);
        return;
      }

      res.status(403).send("Forbidden");
      return;
    }

    // Recebendo mensagens
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      res.sendStatus(200);
      return;
    }

    const texto = message.text?.body || "";
    const resposta = await processMensagem(texto);

    console.log("Mensagem recebida:", texto);
    console.log("Resposta do bot:", resposta);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

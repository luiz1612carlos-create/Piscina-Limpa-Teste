
// api/whatsapp.ts
/**
 * ARQUIVO DE WEBHOOKS (APP B)
 * Limpo de Meta API Send Logic.
 * Mantido apenas para recepção de status de leitura se integrado com o Socket Real.
 */

export default async function handler(req: any, res: any) {
  // Webhook de verificação simples
  if (req.method === "GET") {
    return res.status(200).send(req.query["hub.challenge"] || "App B Robot Active");
  }

  // Apenas responde OK para evitar retries de serviços externos
  if (req.method === "POST") {
    return res.status(200).send("OK");
  }

  return res.status(405).send("Method Not Allowed");
}

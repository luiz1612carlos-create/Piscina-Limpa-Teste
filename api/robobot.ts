export async function processMensagem(texto: string): Promise<string> {
  if (!texto) {
    return "Olá! Sou o atendimento automático da S.O.S Piscina Limpa 💧";
  }

  const msg = texto.toLowerCase();

  if (msg.includes("orçamento")) {
    return "Claro 😊 Vou te ajudar com um orçamento.";
  }

  if (msg.includes("limpeza")) {
    return "Trabalhamos com limpeza e manutenção de piscinas 🏊‍♂️";
  }

  if (msg.includes("emergência") || msg.includes("emergencia")) {
    return "⚠️ Atendimento emergencial sujeito à disponibilidade fora do recesso.";
  }

  return "Olá! Posso te ajudar com orçamento, limpeza ou manutenção 😊";
}
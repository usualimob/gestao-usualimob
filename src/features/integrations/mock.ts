export type MockNote = {
  id: string | number;
  contratoNumero: string | number;
  competencia: string;
  valor: number;
  status: string;
  proprietario?: string;
  inquilino?: string;
};

export function simulateInvoice(note: MockNote, customer: string, service: string) {
  if (note.status !== "a emitir" || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(note.competencia)
    || !Number.isFinite(note.valor) || note.valor <= 0 || !customer.trim() || !service.trim()) {
    throw new Error("Selecione uma nota a emitir e preencha tomador, serviço, competência e valor válidos.");
  }
  return {
    reference: `SIMULADO-${note.id}-${note.competencia}`,
    customer: customer.trim(),
    service: service.trim(),
    amount: note.valor,
  };
}

export function simulateWhatsApp(invoice: ReturnType<typeof simulateInvoice>, name: string, phone: string, consent: boolean) {
  const digits = phone.replace(/\D/g, "");
  if (!consent) throw new Error("Marque o consentimento fictício para testar o próximo passo.");
  if (!/^55\d{10,11}$/.test(digits)) throw new Error("Informe um telefone com DDI 55, DDD e número.");
  if (!name.trim()) throw new Error("Informe o nome do destinatário.");
  const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(invoice.amount);
  return {
    phone: digits,
    text: `[SIMULAÇÃO — NÃO ENVIADA] Olá, ${name.trim()}. Sua NFS-e referente a ${invoice.service} (${amount}) foi simulada sob a referência ${invoice.reference}.`,
  };
}

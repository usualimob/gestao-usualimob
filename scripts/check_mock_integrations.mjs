import assert from "node:assert/strict";
import { simulateInvoice, simulateWhatsApp } from "../src/features/integrations/mock.ts";

const note = { id: 7, contratoNumero: 19, competencia: "2026-10", valor: 120, status: "a emitir" };
const invoice = simulateInvoice(note, "Cliente Exemplo", "Administração de imóvel");
assert.equal(invoice.reference, "SIMULADO-7-2026-10");
assert.equal(invoice.amount, 120);
assert.match(simulateWhatsApp(invoice, "Cliente Exemplo", "+55 (31) 99999-9999", true).text, /NÃO ENVIADA/);
assert.throws(() => simulateInvoice({ ...note, status: "emitida" }, "Cliente", "Serviço"));
assert.throws(() => simulateInvoice({ ...note, valor: 0 }, "Cliente", "Serviço"));
assert.throws(() => simulateWhatsApp(invoice, "Cliente", "+55 (31) 99999-9999", false));
assert.throws(() => simulateWhatsApp(invoice, "Cliente", "9999", true));
console.log("Simulações de NFS-e e WhatsApp OK");

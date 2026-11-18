"use client";

import { useState } from "react";
import { simulateInvoice, simulateWhatsApp, type MockNote } from "@/features/integrations/mock";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function MockFiscalFlow({ notes }: { notes: MockNote[] }) {
  const available = notes.filter((note) => note.status === "a emitir");
  const [noteId, setNoteId] = useState(String(available[0]?.id ?? ""));
  const [recipient, setRecipient] = useState<"proprietario" | "inquilino">("proprietario");
  const [customer, setCustomer] = useState("");
  const [service, setService] = useState("Administração de imóvel (exemplo)");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [invoice, setInvoice] = useState<ReturnType<typeof simulateInvoice> | null>(null);
  const [message, setMessage] = useState<ReturnType<typeof simulateWhatsApp> | null>(null);
  const [error, setError] = useState("");
  const selected = available.find((note) => String(note.id) === noteId) ?? available[0];
  const suggestedCustomer = recipient === "proprietario" ? selected?.proprietario : selected?.inquilino;
  const invalidateInvoice = () => { setInvoice(null); setMessage(null); setError(""); };

  function previewInvoice() {
    try {
      if (!selected) throw new Error("Não há notas a emitir para simular.");
      setInvoice(simulateInvoice(selected, customer || suggestedCustomer || "", service));
      setMessage(null);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível simular."); }
  }
  function previewWhatsApp() {
    try {
      if (!invoice) throw new Error("Simule primeiro a emissão da nota.");
      setMessage(simulateWhatsApp(invoice, name || invoice.customer, phone, consent));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível simular."); }
  }

  return <section className="panel mock-fiscal-flow" aria-labelledby="mock-fiscal-title">
    <h2 id="mock-fiscal-title">Simulador · NFS-e e WhatsApp</h2>
    <p className="muted">Teste a sequência com dados de exemplo ou registros pendentes. Nada é gravado, emitido ou enviado; o resultado desaparece ao recarregar a página. Esta prévia não valida regras fiscais.</p>
    {!selected ? <p className="muted">Não há registros “a emitir” para simular.</p> : <>
      <div className="mock-fiscal-grid">
        <label>Registro a simular<select value={String(selected.id)} onChange={(event) => { setNoteId(event.target.value); setCustomer(""); invalidateInvoice(); }}>
          {available.map((note) => <option value={String(note.id)} key={String(note.id)}>Contrato {note.contratoNumero} · {note.competencia} · {currency.format(note.valor)}</option>)}
        </select></label>
        <label>Tomador do serviço (hipótese)<select value={recipient} onChange={(event) => { setRecipient(event.target.value as "proprietario" | "inquilino"); setCustomer(""); invalidateInvoice(); }}>
          <option value="proprietario">Proprietário</option><option value="inquilino">Inquilino</option>
        </select></label>
        <label>Nome do tomador<input value={customer || suggestedCustomer || ""} onChange={(event) => { setCustomer(event.target.value); invalidateInvoice(); }} placeholder="Informe um nome para a simulação" /></label>
        <label>Serviço (texto demonstrativo)<input value={service} onChange={(event) => { setService(event.target.value); invalidateInvoice(); }} /></label>
      </div>
      <button type="button" className="primary" onClick={previewInvoice}>Simular emissão</button>
      {invoice && <div className="mock-fiscal-result" role="status"><strong>NFS-e simulada — sem valor fiscal</strong><p>Referência fictícia: {invoice.reference}</p><p>Tomador: {invoice.customer} · Valor: {currency.format(invoice.amount)}</p></div>}
      <div className="mock-fiscal-grid">
        <label>Nome para o aviso<input value={name} onChange={(event) => { setName(event.target.value); setMessage(null); }} placeholder="Nome do destinatário" /></label>
        <label>Telefone com DDI<input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setMessage(null); }} placeholder="+55 31 99999-9999" /></label>
      </div>
      <label className="mock-fiscal-consent"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setMessage(null); }} />Considerar consentimento registrado apenas nesta simulação (não é salvo)</label>
      <button type="button" disabled={!invoice} onClick={previewWhatsApp}>Simular aviso WhatsApp</button>
      {message && <div className="mock-fiscal-result" role="status"><strong>Prévia para +{message.phone} — NÃO ENVIADA</strong><p>{message.text}</p></div>}
      {error && <p className="action-notice" role="alert">{error}</p>}
    </>}
  </section>;
}

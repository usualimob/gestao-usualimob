"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
const bucket = "modelos-contrato";
const today = () => { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); };

export function ContractModels() {
  const [models, setModels] = useState<string[]>([]);
  const [people, setPeople] = useState<Row[]>([]);
  const [properties, setProperties] = useState<Row[]>([]);
  const [model, setModel] = useState("");
  const [details, setDetails] = useState({ owner: "", tenant: "", property: "", amount: "", start: today(), condominium: "0", iptu: "0", insurance: "0", insurer: "", fillMode: "ambos" });
  const [months, setMonths] = useState(30);
  const [purpose, setPurpose] = useState("Residencial");
  const [waterLight, setWaterLight] = useState("Por conta do locatário");
  const [guarantor1, setGuarantor1] = useState("");
  const [guarantor2, setGuarantor2] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  async function refresh() {
    const supabase = createClient();
    const [{ data: files, error: storageError }, { data: persons, error: peopleError }, { data: buildings, error: propertyError }] = await Promise.all([
      supabase.storage.from(bucket).list("", { limit: 100 }),
      supabase.from("pessoas").select("id,nome,tipo").limit(1000),
      supabase.from("imoveis").select("id,endereco").limit(1000),
    ]);
    if (storageError || peopleError || propertyError) throw storageError ?? peopleError ?? propertyError;
    setModels((files ?? []).filter((item) => item.name.endsWith(".docx")).map((item) => item.name));
    setPeople(persons ?? []);
    setProperties(buildings ?? []);
  }
  useEffect(() => { void refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Modelos indisponíveis.")); }, []);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("modelo");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".docx") || file.size > 5242880) {
      setNotice("Selecione um DOCX de até 5 MB.");
      return;
    }
    const base = file.name.slice(0, -5).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    if (!base) { setNotice("Nome de arquivo inválido."); return; }
    setBusy(true);
    try {
      const name = base + ".docx";
      const { error } = await createClient().storage.from(bucket).upload(name, file, {
        upsert: false,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (error) throw error;
      await refresh();
      setModel(name);
      setNotice("Modelo enviado ao armazenamento privado.");
      formElement.reset();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao enviar modelo."); }
    finally { setBusy(false); }
  }

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/contratos/documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelo: model, prazo_meses: months, finalidade: purpose, agua_luz: waterLight,
          proprietario_id: details.owner, inquilino_id: details.tenant, imovel_id: details.property,
          valor: details.amount, inicio: details.start, preencher: details.fillMode,
          condominio_valor: details.condominium, iptu_valor: details.iptu,
          seguro_valor: details.insurance, seguro_seguradora: details.insurer,
          fiadores: [guarantor1, guarantor2].filter(Boolean).map(Number),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Falha ao gerar documento.");
      }
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "minuta-contrato.docx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice("Contrato gerado. Revise o documento antes de assinar.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao gerar documento."); }
    finally { setBusy(false); }
  }

  const change = (name: keyof typeof details, value: string) => setDetails((current) => ({ ...current, [name]: value }));

  return <section className="panel contract-actions">
    <div><h2>Contratos Word</h2><p className="muted">Gere uma minuta a partir de um contrato ou dos cadastros.</p></div>
    <button type="button" className="primary" onClick={() => dialog.current?.showModal()}>Gerar contrato (Word)</button>
    <dialog ref={dialog} className="edit-dialog contract-dialog" aria-labelledby="contract-document-title">
      <div className="dialog-heading"><h2 id="contract-document-title">Gerar contrato em Word</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="Fechar" title="Fechar"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div>
      <p className="action-notice" role="status" aria-live="polite">{notice}</p>
      <form className="form-grid contract-form" onSubmit={generate}>
      <label className="contract-span-all">Modelo de contrato <select value={model} onChange={(event) => setModel(event.target.value)} required>
        <option value="">Selecione</option>{models.map((name) => <option key={name} value={name}>{name}</option>)}
      </select></label>
      <label>Preencher dados de <select value={details.fillMode} onChange={(event) => change("fillMode", event.target.value)}>
        <option value="ambos">Ambos (cliente e proprietário)</option><option value="inquilino">Somente cliente</option><option value="proprietario">Somente proprietário</option>
      </select></label>
      <label>Cliente (inquilino) <select value={details.tenant} onChange={(event) => change("tenant", event.target.value)} required={details.fillMode !== "proprietario"}><option value="">— não preencher —</option>{people.filter((person) => person.tipo === "inquilino").map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.nome)}</option>)}</select></label>
      <label>Proprietário <select value={details.owner} onChange={(event) => change("owner", event.target.value)} required={details.fillMode !== "inquilino"}><option value="">— não preencher —</option>{people.filter((person) => person.tipo === "proprietario").map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.nome)}</option>)}</select></label>
      <label className="contract-span-all">Imóvel <select value={details.property} onChange={(event) => change("property", event.target.value)} required><option value="">— não preencher —</option>{properties.map((property) => <option key={String(property.id)} value={String(property.id)}>{String(property.endereco)}</option>)}</select></label>
      {[guarantor1, guarantor2].map((value, index) => <label key={index}>Responsável solidário / fiador {index + 1} <select value={value} onChange={(event) => (index ? setGuarantor2 : setGuarantor1)(event.target.value)}>
        <option value="">— sem fiador —</option>{people.filter((person) => person.tipo === "fiador").map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.nome)}</option>)}
      </select></label>)}
      <label>Aluguel (R$) <input type="number" min="0" max="999999999" step="0.01" value={details.amount} onChange={(event) => change("amount", event.target.value)} required /></label>
      <label>Prazo (meses) <input type="number" min="1" max="600" value={months} onChange={(event) => setMonths(Number(event.target.value))} required /></label>
      <label>Início do contrato <input type="date" value={details.start} onChange={(event) => change("start", event.target.value)} required /></label>
      <label>Água e luz <input value={waterLight} onChange={(event) => setWaterLight(event.target.value)} required maxLength={100} /></label>
      <label>Finalidade <input value={purpose} onChange={(event) => setPurpose(event.target.value)} required maxLength={100} /></label>
      <label>Condomínio R$/mês (0 = não incluir) <input type="number" min="0" step="0.01" value={details.condominium} onChange={(event) => change("condominium", event.target.value)} /></label>
      <label>IPTU R$/mês (0 = não incluir) <input type="number" min="0" step="0.01" value={details.iptu} onChange={(event) => change("iptu", event.target.value)} /></label>
      <label>Seguro fiança — seguradora <input value={details.insurer} onChange={(event) => change("insurer", event.target.value)} maxLength={100} /></label>
      <label>Seguro fiança — R$/mês <input type="number" min="0" step="0.01" value={details.insurance} onChange={(event) => change("insurance", event.target.value)} /></label>
      <div className="dialog-actions contract-span-all"><button type="button" onClick={() => dialog.current?.close()}>Cancelar</button><button className="primary" type="submit" disabled={busy || !models.length}>Gerar Word</button></div>
      </form>
      <details className="model-management">
        <summary>Gerenciar modelos DOCX</summary>
        <form className="toolbar" onSubmit={upload}>
          <label>Enviar novo modelo <input name="modelo" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></label>
          <button type="submit" disabled={busy}>Enviar modelo</button>
        </form>
      </details>
    </dialog>
  </section>;
}


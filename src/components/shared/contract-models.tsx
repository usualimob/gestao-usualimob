"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
const bucket = "modelos-contrato";

export function ContractModels({ contracts }: { contracts: Row[] }) {
  const [models, setModels] = useState<string[]>([]);
  const [people, setPeople] = useState<Row[]>([]);
  const [model, setModel] = useState("");
  const [number, setNumber] = useState("");
  const [months, setMonths] = useState(30);
  const [purpose, setPurpose] = useState("Residencial");
  const [waterLight, setWaterLight] = useState("Por conta do locatário");
  const [guarantor1, setGuarantor1] = useState("");
  const [guarantor2, setGuarantor2] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const [{ data: files, error: storageError }, { data: persons, error: peopleError }] = await Promise.all([
      supabase.storage.from(bucket).list("", { limit: 100 }),
      supabase.from("pessoas").select("id,nome,tipo").eq("tipo", "fiador").limit(1000),
    ]);
    if (storageError || peopleError) throw storageError ?? peopleError;
    setModels((files ?? []).filter((item) => item.name.endsWith(".docx")).map((item) => item.name));
    setPeople(persons ?? []);
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
          modelo: model, numero: Number(number), prazo_meses: months, finalidade: purpose, agua_luz: waterLight,
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
      link.download = `minuta-contrato-${number}.docx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice("Contrato gerado. Revise o documento antes de assinar.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao gerar documento."); }
    finally { setBusy(false); }
  }

  return <section className="panel"><h2>Contratos Word</h2>
    <p className="muted">Os modelos ficam em armazenamento privado. Revise o texto, cláusulas e dados após gerar.</p>
    <form className="toolbar" onSubmit={upload}>
      <label>Enviar modelo DOCX <input name="modelo" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></label>
      <button type="submit" disabled={busy}>Enviar modelo</button>
    </form>
    <form className="toolbar" onSubmit={generate}>
      <label>Modelo <select value={model} onChange={(event) => setModel(event.target.value)} required>
        <option value="">Selecione</option>{models.map((name) => <option key={name} value={name}>{name}</option>)}
      </select></label>
      <label>Contrato <select value={number} onChange={(event) => setNumber(event.target.value)} required>
        <option value="">Selecione</option>{contracts.map((contract) => <option key={String(contract.numero)} value={String(contract.numero)}>#{String(contract.numero)} · {String(contract.inquilino)}</option>)}
      </select></label>
      <label>Prazo (meses) <input type="number" min="1" max="600" value={months} onChange={(event) => setMonths(Number(event.target.value))} required /></label>
      <label>Finalidade <input value={purpose} onChange={(event) => setPurpose(event.target.value)} required maxLength={100} /></label>
      <label>Água e luz <input value={waterLight} onChange={(event) => setWaterLight(event.target.value)} required maxLength={100} /></label>
      {[guarantor1, guarantor2].map((value, index) => <label key={index}>Fiador {index + 1} <select value={value} onChange={(event) => (index ? setGuarantor2 : setGuarantor1)(event.target.value)}>
        <option value="">Sem fiador</option>{people.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.nome)}</option>)}
      </select></label>)}
      <button className="primary" type="submit" disabled={busy || !models.length}>Gerar contrato Word</button>
    </form>
    <p className="action-notice" role="status" aria-live="polite">{notice}</p>
  </section>;
}


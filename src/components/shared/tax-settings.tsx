"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function TaxSettings({ notes }: { notes: Record<string, unknown>[] }) {
  const [rent, setRent] = useState(0);
  const [sale, setSale] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void createClient().from("config").select("chave,valor").in("chave", ["aliq_aluguel", "aliq_venda"]).then(({ data, error }) => {
      if (!active) return;
      if (error) { setNotice(error.message); return; }
      setRent(Number(data?.find((item) => item.chave === "aliq_aluguel")?.valor || 0));
      setSale(Number(data?.find((item) => item.chave === "aliq_venda")?.valor || 0));
    });
    return () => { active = false; };
  }, []);
  const estimate = notes.filter((note) => note.status === "emitida")
    .reduce((total, note) => total + Number(note.valor || 0) * (note.atividade === "venda" ? sale : rent) / 100, 0);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rent < 0 || rent > 100 || sale < 0 || sale > 100) { setNotice("Informe alíquotas entre 0 e 100%."); return; }
    const { error } = await createClient().from("config").upsert([
      { chave: "aliq_aluguel", valor: String(rent) }, { chave: "aliq_venda", valor: String(sale) },
    ], { onConflict: "chave" });
    setNotice(error ? error.message : "Alíquotas salvas.");
  }
  return <section className="panel"><h2>Alíquotas e previsão de impostos</h2>
    <p>Previsão das notas emitidas: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(estimate)}</strong></p>
    <form className="toolbar" onSubmit={save}>
      <label>Aluguel/administração (%) <input type="number" min="0" max="100" step="any" value={rent} onChange={(event) => setRent(Number(event.target.value))} /></label>
      <label>Venda/intermediação (%) <input type="number" min="0" max="100" step="any" value={sale} onChange={(event) => setSale(Number(event.target.value))} /></label>
      <button type="submit" className="primary">Salvar alíquotas</button>
    </form>
    <p className="action-notice" role="status" aria-live="polite">{notice}</p>
  </section>;
}


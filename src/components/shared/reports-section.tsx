"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateDimob } from "@/features/legacy/dimob";
import { commission, gross } from "@/features/legacy/derived";

type Row = Record<string, unknown>;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fields = ["cnpj", "nome", "cpf_resp", "endereco", "uf", "cod_municipio", "cep"] as const;
const labels: Record<string, string> = {
  cnpj: "CNPJ", nome: "Nome empresarial", cpf_resp: "CPF do responsável",
  endereco: "Endereço", uf: "UF", cod_municipio: "Código do município", cep: "CEP",
};
const monthNow = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };

export function ReportsSection() {
  const [competencia, setCompetencia] = useState(monthNow);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [kind, setKind] = useState<"mensal" | "despesas" | "pendencias" | "dimob">("mensal");
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const entries = await Promise.all(["lancamentos", "contratos", "pessoas", "despesas", "pendencias", "config"].map(async (name) => {
          const rows: Row[] = [];
          for (let offset = 0; ; offset += 1000) {
            const { data: page, error } = await supabase.from(name).select("*").range(offset, offset + 999);
            if (error) throw error;
            rows.push(...(page ?? []));
            if (!page || page.length < 1000) break;
          }
          return [name, rows] as const;
        }));
        if (active) {
          const next = Object.fromEntries(entries);
          setData(next);
          setConfig(Object.fromEntries((next.config ?? []).map((row: Row) => [String(row.chave), String(row.valor)])));
        }
      } catch (error) { if (active) setNotice(error instanceof Error ? error.message : "Falha ao carregar relatórios."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = fields.map((field) => ({ chave: `dimob_${field}`, valor: String(form.get(field) ?? "").trim() }));
      const { error } = await createClient().from("config").upsert(payload, { onConflict: "chave" });
      if (error) throw error;
      setConfig((current) => ({ ...current, ...Object.fromEntries(payload.map((item) => [item.chave, item.valor])) }));
      setNotice("Dados do declarante salvos.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar."); }
  }

  function downloadDimob() {
    try {
      const content = generateDimob(year, config, data.contratos ?? [], data.pessoas ?? [], data.lancamentos ?? []);
      const file = new Blob([content], { type: "text/plain;charset=us-ascii" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dimob-${year}-para-validacao.txt`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Arquivo gerado. Importe no PGD DIMOB e confira todos os campos antes do envio.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível gerar a DIMOB.");
    }
  }

  const contracts = new Map((data.contratos ?? []).map((row) => [Number(row.numero), row]));
  const people = new Map((data.pessoas ?? []).map((row) => [Number(row.id), row]));
  const filtered = kind === "mensal"
    ? (data.lancamentos ?? []).filter((row) => row.competencia === competencia).map((row) => {
        const contract = contracts.get(Number(row.contrato_numero));
        return [row.contrato_numero, contract?.inquilino, contract?.proprietario, money.format(Number(row.aluguel || 0)),
          money.format(gross(row)), `${(Number(row.pct_imob || 0) * 100).toLocaleString("pt-BR")}%`,
          money.format(commission(row)), money.format(gross(row) - commission(row)), row.vencimento_dia,
          row.recebido_em || "—", row.via || "—", row.repassado_em || "—"];
      })
    : kind === "despesas"
      ? (data.despesas ?? []).filter((row) => row.competencia === competencia).map((row) =>
          [row.tipo, row.categoria, row.origem, money.format(Number(row.valor || 0)), row.vencimento, row.situacao])
      : kind === "pendencias"
        ? (data.pendencias ?? []).filter((row) => !row.repassado_em).map((row) =>
            [row.competencia, row.tipo, row.descricao, row.contrato_numero, money.format(Number(row.valor || 0)), row.criada_em])
        : (data.lancamentos ?? []).filter((row) => String(row.recebido_em ?? "").startsWith(String(year))).map((row) => {
            const contract = contracts.get(Number(row.contrato_numero));
            const owner = people.get(Number(contract?.proprietario_id));
            const tenant = people.get(Number(contract?.inquilino_id));
            return [row.contrato_numero, owner?.nome || contract?.proprietario, owner?.cpf || "CPF ausente",
              tenant?.nome || contract?.inquilino, tenant?.cpf || "CPF ausente",
              row.recebido_em, money.format(Number(row.aluguel || 0)),
              money.format(Number(row.aluguel || 0) * Number(row.pct_imob || 0))];
          });
  const columns = kind === "mensal"
    ? ["Nº", "Inquilino", "Proprietário", "Aluguel", "Bruto", "%", "Taxa", "Líquido", "Venc.", "Recebido", "Via", "Repassado"]
    : kind === "despesas"
      ? ["Descrição", "Categoria", "Origem", "Valor", "Vencimento", "Situação"]
      : kind === "pendencias"
        ? ["Competência", "Tipo", "Descrição", "Contrato", "Valor", "Criada em"]
        : ["Contrato", "Locador", "CPF", "Locatário", "CPF", "Pagamento", "Aluguel", "Comissão"];
  const title = kind === "mensal" ? `Controle do mês · ${competencia}`
    : kind === "despesas" ? `Despesas · ${competencia}`
      : kind === "pendencias" ? "Pendências em aberto"
        : `Conferência DIMOB · ${year}`;
  const monthly = (data.lancamentos ?? []).filter((row) => row.competencia === competencia);
  const expenses = (data.despesas ?? []).filter((row) => row.competencia === competencia);
  const reportTotal = kind === "mensal" ? money.format(monthly.reduce((sum, row) => sum + gross(row), 0))
    : kind === "despesas" ? money.format(expenses.reduce((sum, row) => sum + Number(row.valor || 0), 0))
      : kind === "pendencias" ? money.format((data.pendencias ?? []).filter((row) => !row.repassado_em).reduce((sum, row) => sum + Number(row.valor || 0), 0))
        : money.format((data.lancamentos ?? []).filter((row) => String(row.recebido_em ?? "").startsWith(String(year))).reduce((sum, row) => sum + Number(row.aluguel || 0), 0));

  return <div className="reports-page">
    <div className="page-intro"><div><p className="eyebrow">Dados da equipe</p><h1>Relatórios</h1><p className="muted">Confira os registros antes de imprimir ou salvar em PDF pelo navegador.</p></div></div>
    <div className="toolbar no-print">
      <label>Relatório <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
        <option value="mensal">Controle mensal</option><option value="despesas">Despesas</option>
        <option value="pendencias">Pendências</option><option value="dimob">Conferência DIMOB</option>
      </select></label>
      {(kind === "mensal" || kind === "despesas") && <label>Competência <input type="month" value={competencia} onChange={(event) => setCompetencia(event.target.value)} /></label>}
      {kind === "dimob" && <label>Ano calendário <input type="number" min="2000" max="2099" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>}
      <button type="button" className="primary" onClick={() => window.print()} disabled={loading}>Imprimir / salvar PDF</button>
      {kind === "dimob" && <button type="button" onClick={downloadDimob} disabled={loading}>Gerar TXT para validar no PGD</button>}
    </div>
    <p className="action-notice no-print" role="status" aria-live="polite">{loading ? "Carregando..." : notice}</p>
    {kind === "dimob" && <p className="demo-banner no-print">Conferência baseada na data do recebimento. Verifique CPFs, valores e regras fiscais antes da declaração. O TXT gerado precisa ser importado e validado no PGD oficial antes do envio.</p>}
    <section className="panel report-print"><h2>{title}</h2>
      <div className="table-scroll"><table><thead><tr>{columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead>
        <tbody>{filtered.length ? filtered.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{String(value ?? "—")}</td>)}</tr>)
          : <tr><td colSpan={columns.length}>Nenhum registro no período.</td></tr>}</tbody></table></div>
      <p className="muted">Total de registros: {filtered.length} · Valor total: {reportTotal}</p>
    </section>
    {kind === "dimob" && !loading && <section className="panel no-print"><h2>Dados do declarante</h2>
      <form className="form-grid" onSubmit={saveConfig}>{fields.map((field) => <label key={field} htmlFor={field}>{labels[field]}
        <input id={field} name={field} defaultValue={config[`dimob_${field}`] ?? ""} />
      </label>)}<button className="primary" type="submit">Salvar declarante</button></form>
    </section>}
  </div>;
}


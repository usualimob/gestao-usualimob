"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoSection } from "@/features/demo/content";
import { modules, sectionModules, type Field, type Module } from "@/features/legacy/modules";
import { createClient } from "@/lib/supabase/client";
import { TaxSettings } from "@/components/shared/tax-settings";
import { DashboardPanels, ControlPanels } from "@/components/shared/operations-overview";
import { ContractModels } from "@/components/shared/contract-models";

type Row = Record<string, unknown>;
type Editor = { module: Module; row?: Row };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const now = () => { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); };
const month = () => now().slice(0, 7);
const amount = (value: unknown) => Number(value || 0);
const gross = (row: Row) => ["aluguel", "tx_incendio", "fianca", "condominio", "iptu", "agua_luz"].reduce((total, key) => total + amount(row[key]), 0);
const moneyFields = new Set(["aluguel", "caucao", "adiantado", "tx_incendio", "fianca", "condominio", "iptu", "agua_luz", "valor", "valor_total", "valor_parcela", "valor_materiais", "valor_mao_obra"]);
const labelFor = (module: Module, name: string) => module.fields.find((field) => field.name === name)?.label ?? name.replaceAll("_", " ");
const valueFor = (module: Module, name: string, value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (name === "ativo" || name.startsWith("tem_")) return Number(value) ? "Sim" : "Não";
  if (moneyFields.has(name)) return currency.format(amount(value));
  if (name === "pct_imob") return `${(amount(value) * 100).toLocaleString("pt-BR")}%`;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");
  return String(value);
};

function FieldInput({ field, row, lookup }: { field: Field; row?: Row; lookup: Record<string, Row[]> }) {
  const value = row?.[field.name];
  const common = { name: field.name, id: `edit-${field.name}`, required: field.required };
  if (field.type === "checkbox") {
    return <label className="check-field"><input {...common} type="checkbox" defaultChecked={Boolean(Number(value ?? (field.name === "ativo" ? 1 : 0)))} />{field.label}</label>;
  }
  if (field.type === "textarea") {
    return <label htmlFor={common.id}>{field.label}<textarea {...common} defaultValue={String(value ?? "")} rows={3} /></label>;
  }
  if (field.type === "select" || field.type === "contract" || field.type === "person" || field.type === "property") {
    let options = field.options?.map((option) => ({ value: option, label: option })) ?? [];
    if (field.type === "contract") options = (lookup.contratos ?? []).map((item) => ({ value: String(item.numero), label: `#${item.numero} · ${item.inquilino}` }));
    if (field.type === "person") options = (lookup.pessoas ?? []).filter((item) => !field.name.includes("proprietario") || item.tipo === "proprietario").filter((item) => !field.name.includes("inquilino") || item.tipo === "inquilino").map((item) => ({ value: String(item.id), label: String(item.nome) }));
    if (field.type === "property") options = (lookup.imoveis ?? []).map((item) => ({ value: String(item.id), label: String(item.endereco) }));
    return <label htmlFor={common.id}>{field.label}<select {...common} defaultValue={String(value ?? "")}><option value="">— selecione —</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  }
  const type = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "month" ? "month" : "text";
  return <label htmlFor={common.id}>{field.label}<input {...common} type={type} step={type === "number" ? "any" : undefined} defaultValue={String(value ?? "")} disabled={Boolean(row && field.name === "numero")} /></label>;
}

function RowTable({ module, rows, search, onEdit, onDelete, onAction }: {
  module: Module; rows: Row[]; search: string; onEdit: (row: Row) => void;
  onDelete: (row: Row) => void; onAction: (row: Row, action: string) => void;
}) {
  const filtered = rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))));
  return <section className="panel" aria-label={module.title}>
    <h2>{module.title} <span className="count">{filtered.length}</span></h2>
    <div className="table-scroll"><table>
      <thead><tr>{module.columns.map((name) => <th scope="col" key={name}>{labelFor(module, name)}</th>)}<th scope="col">Ações</th></tr></thead>
      <tbody>{filtered.length ? filtered.map((row) => <tr key={String(row[module.key])}>
        {module.columns.map((name) => <td key={name}>{valueFor(module, name, row[name])}</td>)}
        <td><div className="row-actions">
          {module.table === "lancamentos" && !row.recebido_em && <button type="button" onClick={() => onAction(row, "receber")}>Receber</button>}
          {module.table === "lancamentos" && Boolean(row.recebido_em) && !row.repassado_em && <><button type="button" onClick={() => onAction(row, "repassar")}>Repassar</button><button type="button" className="danger" onClick={() => onAction(row, "estornar")}>Estornar</button></>}
          {["iptus", "condominios", "seguros"].includes(module.table) && <button type="button" onClick={() => onAction(row, "pagar-mes")}>Pagar mês</button>}
          {module.table === "despesas" && row.situacao !== "pago" && <button type="button" onClick={() => onAction(row, "pagar")}>Pagar</button>}
          {module.table === "notas_fiscais" && row.status !== "emitida" && <button type="button" onClick={() => onAction(row, "emitir")}>Marcar emitida</button>}
          {module.table === "pendencias" && !row.repassado_em && <button type="button" onClick={() => onAction(row, "repassar-pendencia")}>Repassar</button>}
          <button type="button" onClick={() => onEdit(row)}>Editar</button>
          {module.table !== "caixas" && !(module.table === "lancamentos" && row.recebido_em) && <button type="button" className="danger" onClick={() => onDelete(row)}>{module.table === "contratos" ? "Encerrar" : "Excluir"}</button>}
        </div></td>
      </tr>) : <tr><td colSpan={module.columns.length + 1} className="muted">Nenhum registro encontrado.</td></tr>}</tbody>
    </table></div>
  </section>;
}

export function LiveSection({ section }: { section: DemoSection }) {
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [lookup, setLookup] = useState<Record<string, Row[]>>({});
  const [search, setSearch] = useState("");
  const [competencia, setCompetencia] = useState(month);
  const [status, setStatus] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [personType, setPersonType] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const names = section.path === "dashboard"
    ? ["contratos", "lancamentos", "despesas", "caixas"]
    : section.path === "controle"
      ? ["contratos", "lancamentos", "despesas", "iptus", "condominios", "seguros", "pendencias", "manutencoes"]
      : sectionModules[section.path] ?? [];

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const entries = await Promise.all(names.map(async (name) => {
        const result: Row[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data: page, error } = await supabase.from(name).select("*").range(offset, offset + 999);
          if (error) throw error;
          result.push(...(page ?? []));
          if (!page || page.length < 1000) break;
        }
        return [name, result] as const;
      }));
      setData(Object.fromEntries(entries));
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar os dados.");
    } finally { setBusy(false); }
  }, [section.path]); // names deriva apenas da rota
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (editor && !dialog.current?.open) dialog.current?.showModal(); }, [editor]);

  async function open(module: Module, row?: Row) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      const supabase = createClient();
      const references = await Promise.all(["contratos", "pessoas", "imoveis"].map(async (name) => {
        if (data[name]) return [name, data[name]] as const;
        const { data: rows, error } = await supabase.from(name).select("*").limit(1000);
        if (error) throw error;
        return [name, rows ?? []] as const;
      }));
      setLookup(Object.fromEntries(references));
      setEditor({ module, row });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível abrir o formulário."); }
  }
  function close() {
    dialog.current?.close();
    setEditor(null);
    opener.current?.focus();
  }
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    try { await action(); await load(); setNotice(success); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Operação não concluída."); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const { module, row } = editor;
    const form = new FormData(event.currentTarget);
    const payload: Row = {};
    for (const field of module.fields) {
      if (row && field.name === module.key) continue;
      if (module.table === "lancamentos" && field.name === "recebido_em" && !row?.recebido_em) continue;
      const raw = String(form.get(field.name) ?? "");
      if (field.type === "checkbox") payload[field.name] = form.has(field.name) ? 1 : 0;
      else if (field.type === "number" || ["contract", "person", "property"].includes(field.type ?? "")) {
        payload[field.name] = raw === "" ? (["contract", "person", "property"].includes(field.type ?? "") ? null : 0) : Number(raw);
      } else if ((field.type === "date" || field.type === "month") && !raw) payload[field.name] = module.table === "lancamentos" || module.table === "notas_fiscais" || (module.table === "contratos" && field.name === "data_inicio") ? null : "";
      else payload[field.name] = raw;
    }
    if (module.table === "lancamentos" && row?.recebido_em && !payload.recebido_em) { setNotice("Use Estornar para desfazer um recebimento."); return; }
    if (!row && module.table === "despesas" && !payload.competencia) payload.competencia = competencia;
    await run(async () => {
      const supabase = createClient();
      const result = row
        ? await supabase.from(module.table).update(payload).eq(module.key, row[module.key] as string | number)
        : await supabase.from(module.table).insert(payload);
      if (result.error) throw result.error;
      close();
    }, row ? "Registro atualizado." : "Registro criado.");
  }
  async function remove(module: Module, row: Row) {
    if (module.table === "lancamentos" && row.recebido_em) { setNotice("Estorne o recebimento antes de remover o lançamento."); return; }
    const label = module.table === "contratos" ? "Encerrar este contrato?" : "Excluir este registro?";
    if (!window.confirm(label)) return;
    await run(async () => {
      const supabase = createClient();
      const result = module.table === "contratos"
        ? await supabase.from("contratos").update({ ativo: 0 }).eq("numero", Number(row.numero))
        : await supabase.from(module.table).delete().eq(module.key, row[module.key] as string | number);
      if (result.error) throw result.error;
    }, module.table === "contratos" ? "Contrato encerrado." : "Registro excluído.");
  }
  async function rowAction(module: Module, row: Row, action: string) {
    if (action === "estornar" && !window.confirm("Estornar o recebimento e remover nota/pendências ainda não concluídas?")) return;
    const supabase = createClient();
    const id = row[module.key] as number;
    await run(async () => {
      if (action === "estornar") {
        const { error } = await supabase.rpc("estornar_recebimento", { p_id: id });
        if (error) throw error;
        return;
      }
      if (action === "receber") {
        const { error } = await supabase.rpc("registrar_recebimento", { p_id: id, p_data: now(), p_via: "" });
        if (error) throw error;
        return;
      }
      let patch: Row = {};
      if (action === "repassar" || action === "repassar-pendencia") patch = { repassado_em: now() };
      if (action === "pagar-mes") {
        const { error } = await supabase.rpc("registrar_parcela", { p_tabela: module.table, p_id: id, p_competencia: month() });
        if (error) throw error;
        return;
      }
      if (action === "pagar") patch = { situacao: "pago" };
      if (action === "emitir") patch = { status: "emitida", emitida_em: now() };
      const { error } = await supabase.from(module.table).update(patch).eq(module.key, id);
      if (error) throw error;
    }, "Situação atualizada.");
  }
  async function generateMonth() {
    if (!window.confirm(`Gerar lançamentos da competência ${competencia}?`)) return;
    await run(async () => {
      const { error } = await createClient().rpc("gerar_competencia", { p_competencia: competencia });
      if (error) throw error;
    }, "Competência gerada.");
  }
  async function copyExpenses() {
    const destination = window.prompt("Competência de destino (AAAA-MM):");
    if (!destination) return;
    const includeOrdinary = window.confirm("Incluir também despesas ordinárias?");
    await run(async () => {
      const { error } = await createClient().rpc("copiar_despesas", { p_origem: competencia, p_destino: destination, p_incluir_ordinarias: includeOrdinary });
      if (error) throw error;
    }, "Despesas fixas copiadas.");
  }

  const rowsFor = (name: string) => (data[name] ?? []).filter((row) => {
    if (name === "pendencias" && section.path === "iptus") return row.tipo === "iptu" || row.tipo === "condominio";
    if (name === "pendencias" && section.path === "seguros") return row.tipo === "seguro";
    if (name === "lancamentos" || name === "despesas" || name === "notas_fiscais") {
      if (row.competencia !== competencia) return false;
    }
    if (name === "lancamentos") {
      const day = Number(row.vencimento_dia || 0);
      if (dueFrom && day < Number(dueFrom)) return false;
      if (dueTo && day > Number(dueTo)) return false;
      if (status && (status === "recebido" ? !row.recebido_em : Boolean(row.recebido_em))) return false;
    }
    if (name === "pessoas" && personType && row.tipo !== personType) return false;
    if (name === "despesas" && expenseCategory && (expenseCategory === "fixas" ? row.categoria === "ordinária" : row.categoria !== "ordinária")) return false;
    if (name === "contratos" && status === "ativos") return Number(row.ativo) === 1;
    if (name === "notas_fiscais" && status) return row.status === status;
    if (name === "despesas" && status) return row.situacao === status;
    return true;
  }).sort((a, b) => name === "lancamentos" ? (order === "asc" ? 1 : -1) * (Number(a.vencimento_dia || 0) - Number(b.vencimento_dia || 0) || Number(a.contrato_numero || 0) - Number(b.contrato_numero || 0)) : 0);
  const lancamentos = rowsFor("lancamentos");
  const recebido = lancamentos.filter((row) => row.recebido_em);
  const cards = section.path === "dashboard" || section.path === "lancamentos"
    ? [
      ["Contratos ativos", String((data.contratos ?? []).filter((row) => Number(row.ativo) === 1).length)],
      ["Previsto", currency.format(lancamentos.reduce((sum, row) => sum + gross(row), 0))],
      ["Recebido", currency.format(recebido.reduce((sum, row) => sum + gross(row), 0))],
      ["Comissão prevista", currency.format(lancamentos.reduce((sum, row) => sum + amount(row.aluguel) * amount(row.pct_imob), 0))],
    ]
    : section.path === "despesas"
      ? [["Total", currency.format(rowsFor("despesas").reduce((sum, row) => sum + amount(row.valor), 0))],
         ["Pendente", currency.format(rowsFor("despesas").filter((row) => row.situacao !== "pago").reduce((sum, row) => sum + amount(row.valor), 0))]]
      : [];

  return <>
    <div className="page-intro"><div><p className="eyebrow">Dados da equipe</p><h1>{section.heading}</h1><p className="muted">{section.description}</p></div></div>
    <div className="toolbar">
      {["dashboard", "lancamentos", "despesas", "notas", "relatorios"].includes(section.path) && <label>Competência <input type="month" value={competencia} onChange={(event) => setCompetencia(event.target.value)} /></label>}
      {names.length > 0 && <label className="search-control">Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar registros..." /></label>}
      {section.path === "lancamentos" && <><select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="recebido">Recebidos</option><option value="pendente">Pendentes</option></select><select aria-label="Ordem por vencimento" value={order} onChange={(event) => setOrder(event.target.value as "asc" | "desc")}><option value="asc">Vencimento crescente</option><option value="desc">Vencimento decrescente</option></select>
        <label>Venc. de <input type="number" min="1" max="31" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} className="day-input" /></label>
        <label>Até <input type="number" min="1" max="31" value={dueTo} onChange={(event) => setDueTo(event.target.value)} className="day-input" /></label>
        <button className="primary" type="button" disabled={busy} onClick={generateMonth}>Gerar mês</button></>}
      {section.path === "cadastros" && <select aria-label="Tipo de pessoa" value={personType} onChange={(event) => setPersonType(event.target.value)}><option value="">Todas as pessoas</option><option value="inquilino">Inquilinos</option><option value="proprietario">Proprietários</option><option value="fiador">Fiadores</option></select>}
      {section.path === "contratos" && <select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os contratos</option><option value="ativos">Somente ativos</option></select>}
      {section.path === "notas" && <select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todas</option><option value="a emitir">A emitir</option><option value="emitida">Emitidas</option></select>}
      {section.path === "despesas" && <><select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todas</option><option value="pendente">Pendentes</option><option value="pago">Pagas</option></select><select aria-label="Categoria" value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)}><option value="">Todas as categorias</option><option value="fixas">Fixas e mensais</option><option value="ordinaria">Ordinárias</option></select><button type="button" onClick={copyExpenses} disabled={busy}>Copiar despesas</button></>}
      {(sectionModules[section.path] ?? []).filter((name) => modules[name]?.create !== false).map((name) => <button key={name} type="button" className="primary" disabled={busy} onClick={() => open(modules[name])}>Novo {modules[name].title.toLowerCase()}</button>)}
    </div>
    <p role="status" aria-live="polite" className="action-notice">{busy ? "Carregando..." : notice}</p>
    {cards.length > 0 && <div className="cards">{cards.map(([label, value]) => <div className="card" key={label}><div className="s">{label}</div><div className="v">{value}</div></div>)}</div>}
    {section.path === "dashboard" && <DashboardPanels data={data} competencia={competencia} />}
    {section.path === "dashboard" && <div className="panel-grid">
      <RowTable module={modules.lancamentos} rows={lancamentos.filter((row) => !row.recebido_em)} search={search} onEdit={(row) => open(modules.lancamentos, row)} onDelete={(row) => remove(modules.lancamentos, row)} onAction={(row, action) => rowAction(modules.lancamentos, row, action)} />
      <RowTable module={modules.lancamentos} rows={lancamentos.filter((row) => row.recebido_em && !row.repassado_em)} search={search} onEdit={(row) => open(modules.lancamentos, row)} onDelete={(row) => remove(modules.lancamentos, row)} onAction={(row, action) => rowAction(modules.lancamentos, row, action)} />
    </div>}
    {section.path === "controle" && <ControlPanels data={data} />}
    {section.path === "controle" && <div className="panel-stack">{["lancamentos", "despesas", "iptus", "condominios", "seguros", "pendencias", "manutencoes"].map((name) => <RowTable key={name} module={modules[name]} rows={rowsFor(name)} search={search} onEdit={(row) => open(modules[name], row)} onDelete={(row) => remove(modules[name], row)} onAction={(row, action) => rowAction(modules[name], row, action)} />)}</div>}
    {!["dashboard", "controle", "relatorios"].includes(section.path) && <div className="panel-stack">{(sectionModules[section.path] ?? []).map((name) => <RowTable key={name} module={modules[name]} rows={rowsFor(name)} search={search} onEdit={(row) => open(modules[name], row)} onDelete={(row) => remove(modules[name], row)} onAction={(row, action) => rowAction(modules[name], row, action)} />)}</div>}
    {section.path === "contratos" && <ContractModels contracts={data.contratos ?? []} />}
    {section.path === "notas" && <TaxSettings notes={data.notas_fiscais ?? []} />}
    <dialog ref={dialog} className="edit-dialog" onClose={() => { setEditor(null); opener.current?.focus(); }} aria-label={editor ? `Editar ${editor.module.title}` : "Formulário"}>
      {editor && <form onSubmit={save}>
        <div className="dialog-heading"><h2>{editor.row ? "Editar" : "Novo"} · {editor.module.title}</h2><button type="button" onClick={close} aria-label="Fechar">×</button></div>
        <div className="form-grid">{editor.module.fields.filter((field) => !(editor.module.table === "lancamentos" && field.name === "recebido_em" && !editor.row?.recebido_em)).map((field) => <FieldInput key={field.name} field={field} row={editor.row} lookup={lookup} />)}</div>
        <div className="dialog-actions"><button type="button" onClick={close}>Cancelar</button><button className="primary" type="submit" disabled={busy}>Salvar</button></div>
      </form>}
    </dialog>
  </>;
}


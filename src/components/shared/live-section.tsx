"use client";

import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import type { DemoSection } from "@/features/demo/content";
import { getOverviewColumns, modules, sectionModules, type Field, type Module } from "@/features/legacy/modules";
import { createClient } from "@/lib/supabase/client";
import { TaxSettings } from "@/components/shared/tax-settings";
import { DashboardPanels, ControlPanels } from "@/components/shared/operations-overview";
import { ContractModels } from "@/components/shared/contract-models";
import { commission, deriveRow, gross } from "@/features/legacy/derived";

type Row = Record<string, unknown>;
type Editor = { module: Module; row?: Row };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const now = () => { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); };
const month = () => now().slice(0, 7);
const amount = (value: unknown) => Number(value || 0);
const moneyFields = new Set(["aluguel", "caucao", "adiantado", "tx_incendio", "fianca", "condominio", "iptu", "agua_luz", "valor", "valor_total", "valor_parcela", "valor_materiais", "valor_mao_obra", "total_bruto", "taxa", "total_liquido", "saldo", "imposto"]);
const computedLabels: Record<string, string> = { total_bruto: "Total bruto", taxa: "Comissão", total_liquido: "Total líquido", saldo: "Saldo", imposto: "Imposto", situacao: "Situação" };
const totalFields: Record<string, string[]> = { lancamentos: ["aluguel", "total_bruto", "taxa", "total_liquido"], iptus: ["saldo"], despesas: ["valor"], pendencias: ["valor"] };
const labelFor = (module: Module, name: string) => module.fields.find((field) => field.name === name)?.label ?? computedLabels[name] ?? name.replaceAll("_", " ");
const valueFor = (module: Module, name: string, value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (name === "ativo") return Number(value) ? "Ativo" : "Encerrado";
  if (name.startsWith("tem_")) return Number(value) ? "Sim" : "Não";
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
    const relation = ["contract", "person", "property"].includes(field.type ?? "");
    return <label htmlFor={common.id}>{field.label}<select {...common} defaultValue={String(value ?? (relation ? "" : options[0]?.value ?? ""))}>{relation && <option value="">— sem vínculo —</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  }
  const type = field.type === "number" || field.type === "percent" ? "number" : field.type === "date" ? "date" : field.type === "month" ? "month" : "text";
  const displayed = field.type === "percent" ? Number(value ?? 0.1) * 100 : value ?? "";
  return <label htmlFor={common.id}>{field.label}<input {...common} type={type} step={type === "number" ? "any" : undefined} min={field.type === "percent" ? 0 : undefined} max={field.type === "percent" ? 100 : undefined} defaultValue={String(displayed)} disabled={Boolean(row && field.name === "numero")} /></label>;
}

function RowActions({ module, row, onEdit, onDelete, onAction }: {
  module: Module; row: Row; onEdit: (row: Row) => void;
  onDelete: (row: Row) => void; onAction: (row: Row, action: string) => void;
}) {
  const target = `${labelFor(module, module.columns[0])} ${valueFor(module, module.columns[0], row[module.columns[0]])}`;
  const action = (label: string) => `${label} · ${target}`;
  const iconButton = (label: string, icon: string, onClick: () => void, danger = false) =>
    <button type="button" className={danger ? "danger" : undefined} aria-label={action(label)} title={label} onClick={onClick}>
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    </button>;
  return <div className="row-actions">
    {module.table === "lancamentos" && !row.recebido_em && iconButton("Receber", "payments", () => onAction(row, "receber"))}
    {module.table === "lancamentos" && Boolean(row.recebido_em) && !row.repassado_em && <>{iconButton("Repassar", "send", () => onAction(row, "repassar"))}{iconButton("Estornar", "undo", () => onAction(row, "estornar"), true)}</>}
    {["iptus", "condominios", "seguros"].includes(module.table) && (Number(row.parcelas) === 0 || Number(row.parcelas_pagas) < Number(row.parcelas)) && <>{String(row.pago_ate ?? "") < month() && iconButton("Pagar mês", "event_available", () => onAction(row, "pagar-mes"))}{iconButton("Marcar mais uma parcela paga", "add_task", () => onAction(row, "pagar-parcela"))}</>}
    {module.table === "despesas" && row.situacao !== "pago" && iconButton("Pagar", "payments", () => onAction(row, "pagar"))}
    {module.table === "notas_fiscais" && row.status !== "emitida" && iconButton("Marcar emitida", "task_alt", () => onAction(row, "emitir"))}
    {module.table === "pendencias" && !row.repassado_em && iconButton("Repassar", "send", () => onAction(row, "repassar-pendencia"))}
    {iconButton("Editar", "edit", () => onEdit(row))}
    {module.table !== "caixas" && !(module.table === "lancamentos" && row.recebido_em) && iconButton(module.table === "contratos" ? "Encerrar" : "Excluir", module.table === "contratos" ? "block" : "delete", () => onDelete(row), true)}
  </div>;
}

function RowTable({ module, title, rows, search, onEdit, onDelete, onAction, onDeleteSelected }: {
  module: Module; title?: string; rows: Row[]; search: string; onEdit: (row: Row) => void;
  onDelete: (row: Row) => void; onAction: (row: Row, action: string) => void;
  onDeleteSelected?: (rows: Row[]) => Promise<boolean>;
}) {
  const [fullTable, setFullTable] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const tableId = useId();
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = rows.filter((row) => !query || module.columns.some((name) => valueFor(module, name, row[name]).toLocaleLowerCase("pt-BR").includes(query)));
  const totals = totalFields[module.table] ?? [];
  const overviewColumns = getOverviewColumns(module);
  const extraColumns = module.columns.filter((name) => !overviewColumns.includes(name));
  const visibleColumns = fullTable ? module.columns : overviewColumns;
  const sectionTitle = title ?? module.title;
  const selectableRows = onDeleteSelected ? filtered.filter((row) => !row.recebido_em) : [];
  const selected = selectableRows.filter((row) => selectedRows.has(String(row[module.key])));
  const toggleSelected = (key: string) => setSelectedRows((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const deleteSelected = async () => {
    if (!onDeleteSelected || !selected.length) return;
    if (await onDeleteSelected(selected)) setSelectedRows(new Set());
  };
  const toggleDetails = (key: string) => setExpandedRows((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const state = (name: string, value: unknown) => {
    if (!["situacao", "status", "ativo"].includes(name)) return null;
    const label = valueFor(module, name, value);
    const positive = ["Ativo", "Repassado", "emitida", "pago", "concluida"].includes(label);
    const warning = ["Aguarda repasse", "a emitir", "pendente", "programada"].includes(label);
    return <span className={`state-pill ${positive ? "is-positive" : warning ? "is-warning" : ""}`}>{label}</span>;
  };
  return <section className="panel record-panel" aria-label={sectionTitle}>
    <div className="record-toolbar"><h2>{sectionTitle} <span className="count">{filtered.length}</span></h2>
      {extraColumns.length > 0 && <div className="record-table-tools">
        <button type="button" className="view-toggle" onClick={() => setFullTable((current) => !current)}>{fullTable ? "Ver resumo" : "Ver tabela completa"}</button>
        {fullTable && <div className="column-controls"><button type="button" aria-label={`Voltar colunas de ${sectionTitle}`} title="Voltar colunas" onClick={() => tableRef.current?.scrollBy({ left: -Math.max(240, tableRef.current.clientWidth * .8), behavior: "auto" })}><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span></button><button type="button" aria-label={`Avançar colunas de ${sectionTitle}`} title="Avançar colunas" onClick={() => tableRef.current?.scrollBy({ left: Math.max(240, tableRef.current.clientWidth * .8), behavior: "auto" })}><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></div>}
      </div>}
      {onDeleteSelected && <button type="button" className="danger bulk-action" disabled={!selected.length} onClick={deleteSelected}>Excluir selecionados ({selected.length})</button>}
    </div>
    <div ref={tableRef} className={`table-scroll record-table ${fullTable ? "is-full" : "is-overview"}`} role={fullTable ? "region" : undefined} aria-label={fullTable ? `Tabela completa de ${sectionTitle}` : undefined} tabIndex={fullTable ? 0 : undefined}><table>
      <caption className="visually-hidden">{sectionTitle}</caption>
      <thead><tr>{onDeleteSelected && <th scope="col" className="select-column"><input type="checkbox" aria-label="Selecionar todos os lançamentos não recebidos" checked={selectableRows.length > 0 && selected.length === selectableRows.length} onChange={(event) => setSelectedRows(event.target.checked ? new Set(selectableRows.map((row) => String(row[module.key]))) : new Set())} /></th>}{visibleColumns.map((name) => <th scope="col" key={name} className={moneyFields.has(name) ? "numeric" : undefined}>{labelFor(module, name)}</th>)}<th scope="col">Ações</th></tr></thead>
      <tbody>{filtered.length ? filtered.map((row) => {
        const key = String(row[module.key]);
        const expanded = expandedRows.has(key);
        return <Fragment key={key}><tr>
          {onDeleteSelected && <td className="select-column"><input type="checkbox" aria-label={`Selecionar ${valueFor(module, module.columns[0], row[module.columns[0]])}`} checked={!row.recebido_em && selectedRows.has(key)} disabled={Boolean(row.recebido_em)} onChange={() => toggleSelected(key)} /></td>}
          {visibleColumns.map((name, index) => index === 0 ? <th scope="row" key={name}>{state(name, row[name]) ?? valueFor(module, name, row[name])}{!fullTable && extraColumns.length > 0 && <button type="button" className="details-toggle" aria-label={`${expanded ? "Ocultar" : "Ver"} detalhes de ${labelFor(module, name)} ${valueFor(module, name, row[name])}`} aria-expanded={expanded} aria-controls={`${tableId}-${key}`} onClick={() => toggleDetails(key)}>{expanded ? "Ocultar detalhes" : "Ver detalhes"}</button>}</th> : <td key={name} className={moneyFields.has(name) ? "numeric" : undefined}>{state(name, row[name]) ?? valueFor(module, name, row[name])}</td>)}
          <td><RowActions module={module} row={row} onEdit={onEdit} onDelete={onDelete} onAction={onAction} /></td>
        </tr>{extraColumns.length > 0 && <tr id={`${tableId}-${key}`} className="expanded-row" hidden={fullTable || !expanded}><td colSpan={visibleColumns.length + 1 + Number(Boolean(onDeleteSelected))}><dl>{extraColumns.map((name) => <div key={name}><dt>{labelFor(module, name)}</dt><dd>{state(name, row[name]) ?? valueFor(module, name, row[name])}</dd></div>)}</dl></td></tr>}</Fragment>;
      }) : <tr><td colSpan={visibleColumns.length + 1 + Number(Boolean(onDeleteSelected))} className="muted">Nenhum registro encontrado.</td></tr>}</tbody>
      {filtered.length > 0 && totals.length > 0 && fullTable && <tfoot><tr>{visibleColumns.map((name, index) => index === 0
        ? <th scope="row" colSpan={onDeleteSelected ? 2 : 1} key={name}>Total ({filtered.length})</th>
        : <td key={name} className={moneyFields.has(name) ? "numeric" : undefined}>{totals.includes(name) ? currency.format(filtered.reduce((sum, row) => sum + amount(row[name]), 0)) : null}</td>)}<td /></tr></tfoot>}
    </table></div>
    {filtered.length > 0 && totals.length > 0 && !fullTable && <dl className="overview-totals">{totals.map((name) => <div key={name}><dt>{labelFor(module, name)}</dt><dd>{currency.format(filtered.reduce((sum, row) => sum + amount(row[name]), 0))}</dd></div>)}</dl>}
    <div className="record-cards">
      {filtered.length ? filtered.map((row) => {
        const first = module.columns[0];
        const statusName = module.columns.find((name) => ["situacao", "status", "ativo"].includes(name));
        const fields = (names: string[]) => <dl className="record-fields">{names.map((name) => <div key={name}><dt>{labelFor(module, name)}</dt><dd>{state(name, row[name]) ?? valueFor(module, name, row[name])}</dd></div>)}</dl>;
        return <article className="record-card" aria-label={`${labelFor(module, first)} ${valueFor(module, first, row[first])}`} key={String(row[module.key])}>
          {onDeleteSelected && !row.recebido_em && <label className="record-select"><input type="checkbox" checked={selectedRows.has(String(row[module.key]))} onChange={() => toggleSelected(String(row[module.key]))} />Selecionar para excluir</label>}
          <div className="record-heading"><div><span className="record-kicker">{labelFor(module, first)}</span><h3>{valueFor(module, first, row[first])}</h3>{module.columns[1] && <span className="record-subtitle">{labelFor(module, module.columns[1])}: {valueFor(module, module.columns[1], row[module.columns[1]])}</span>}</div>{statusName && state(statusName, row[statusName])}</div>
          {module.columns.length > 2 && fields(module.columns.slice(2, 5))}
          {module.columns.length > 5 && <details className="record-details"><summary aria-label={`Ver todos os dados de ${valueFor(module, first, row[first])}`}>Ver todos os dados</summary>{fields(module.columns.slice(5))}</details>}
          <RowActions module={module} row={row} onEdit={onEdit} onDelete={onDelete} onAction={onAction} />
        </article>;
      }) : <p className="muted">Nenhum registro encontrado.</p>}
      {filtered.length > 0 && totals.length > 0 && <div className="record-card record-summary"><strong>Total ({filtered.length})</strong><dl className="record-fields">{totals.map((name) => <div key={name}><dt>{labelFor(module, name)}</dt><dd>{currency.format(filtered.reduce((sum, row) => sum + amount(row[name]), 0))}</dd></div>)}</dl></div>}
    </div>
  </section>;
}

export function LiveSection({ section }: { section: DemoSection }) {
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [lookup, setLookup] = useState<Record<string, Row[]>>({});
  const [search, setSearch] = useState("");
  const [competencia, setCompetencia] = useState(month);
  const [status, setStatus] = useState(section.path === "contratos" ? "ativos" : "");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [personType, setPersonType] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const copyDialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const names = section.path === "dashboard"
    ? ["contratos", "lancamentos", "despesas", "caixas"]
    : section.path === "controle"
      ? ["contratos", "lancamentos", "despesas", "iptus", "condominios", "seguros", "pendencias", "manutencoes"]
      : section.path === "lancamentos"
        ? ["lancamentos", "contratos"]
        : section.path === "notas"
          ? ["notas_fiscais", "contratos", "config"]
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
    try { await action(); await load(); setNotice(success); return true; }
    catch (error) { setNotice(error instanceof Error ? error.message : "Operação não concluída."); return false; }
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
      else if (field.type === "number" || field.type === "percent" || ["contract", "person", "property"].includes(field.type ?? "")) {
        payload[field.name] = raw === "" ? (["contract", "person", "property"].includes(field.type ?? "") ? null : 0) : field.type === "percent" ? Number(raw) / 100 : Number(raw);
      } else if ((field.type === "date" || field.type === "month") && !raw) payload[field.name] = module.table === "lancamentos" || module.table === "notas_fiscais" || (module.table === "contratos" && field.name === "data_inicio") ? null : "";
      else payload[field.name] = raw;
    }
    if (module.table === "lancamentos" && row?.recebido_em && !payload.recebido_em) { setNotice("Use Estornar para desfazer um recebimento."); return; }
    if (!row && module.table === "despesas" && !payload.competencia) payload.competencia = competencia;
    const existingContract = !row && module.table === "contratos"
      ? (data.contratos ?? []).find((contract) => Number(contract.numero) === Number(payload.numero)) : undefined;
    if (existingContract?.ativo && Number(existingContract.ativo) === 1) { setNotice("Já existe um contrato ativo com esse número."); return; }
    if (existingContract && !window.confirm("Esse contrato está encerrado. Deseja reativá-lo com os novos dados?")) return;
    await run(async () => {
      const supabase = createClient();
      const result = row
        ? await supabase.from(module.table).update(payload).eq(module.key, row[module.key] as string | number)
        : existingContract
          ? await supabase.from("contratos").update(payload).eq("numero", Number(existingContract.numero))
          : await supabase.from(module.table).insert(payload);
      if (result.error) throw result.error;
      close();
    }, row ? "Registro atualizado." : existingContract ? "Contrato reativado." : "Registro criado.");
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
      if (action === "pagar-parcela") {
        const { error } = await supabase.rpc("registrar_parcela_avulsa", { p_tabela: module.table, p_id: id });
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
  async function copyExpenses(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const origin = String(form.get("origem") ?? "");
    const destination = String(form.get("destino") ?? "");
    const includeOrdinary = form.has("incluir_ordinarias");
    if (!/^\d{4}-\d{2}$/.test(origin) || !/^\d{4}-\d{2}$/.test(destination) || origin === destination) {
      setNotice("Informe competências diferentes para origem e destino.");
      return;
    }
    await run(async () => {
      const { error } = await createClient().rpc("copiar_despesas", { p_origem: origin, p_destino: destination, p_incluir_ordinarias: includeOrdinary });
      if (error) throw error;
      copyDialog.current?.close();
      setCompetencia(destination);
    }, "Despesas fixas copiadas.");
  }

  async function removeSelected(rows: Row[]) {
    const ids = rows.map((row) => Number(row.id)).filter(Number.isSafeInteger);
    if (!ids.length || !window.confirm(`Excluir ${ids.length} lançamento(s) não recebido(s)?`)) return false;
    return run(async () => {
      const { data: removed, error } = await createClient().from("lancamentos").delete().in("id", ids).is("recebido_em", null).select("id");
      if (error) throw error;
      if ((removed ?? []).length !== ids.length) throw new Error("Alguns lançamentos mudaram de situação. Atualize a lista e tente novamente.");
    }, `${ids.length} lançamento(s) excluído(s).`);
  }

  const contractsByNumber = new Map((data.contratos ?? []).map((contract) => [Number(contract.numero), contract]));
  const taxRates = {
    rent: Number((data.config ?? []).find((item) => item.chave === "aliq_aluguel")?.valor || 0),
    sale: Number((data.config ?? []).find((item) => item.chave === "aliq_venda")?.valor || 0),
  };
  const rowsFor = (name: string) => (data[name] ?? []).filter((row) => {
    if (name === "pendencias" && section.path === "iptus") return row.tipo === "iptu" || row.tipo === "condominio";
    if (name === "pendencias" && section.path === "seguros") return row.tipo === "seguro";
    if (name === "lancamentos" || name === "despesas") {
      if (row.competencia !== competencia) return false;
    }
    if (name === "pendencias" && row.repassado_em) return false;
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
  }).sort((a, b) => name === "lancamentos" ? (order === "asc" ? 1 : -1) * (Number(a.vencimento_dia || 0) - Number(b.vencimento_dia || 0) || Number(a.contrato_numero || 0) - Number(b.contrato_numero || 0)) : 0)
    .map((row) => deriveRow(name, row, contractsByNumber, taxRates));
  const lancamentos = rowsFor("lancamentos");
  const recebido = lancamentos.filter((row) => row.recebido_em);
  const monthExpenses = (data.despesas ?? []).filter((row) => row.competencia === competencia);
  const cards = section.path === "dashboard"
    ? [
      ["Contratos ativos", String((data.contratos ?? []).filter((row) => Number(row.ativo) === 1).length)],
      ["Previsto no mês (bruto)", currency.format(lancamentos.reduce((sum, row) => sum + gross(row), 0))],
      [`Recebido (${recebido.length}/${lancamentos.length})`, currency.format(recebido.reduce((sum, row) => sum + gross(row), 0))],
      ["A receber", currency.format(lancamentos.filter((row) => !row.recebido_em).reduce((sum, row) => sum + gross(row), 0))],
      ["Comissão prevista", currency.format(lancamentos.reduce((sum, row) => sum + commission(row), 0))],
      ["Comissão recebida", currency.format(recebido.reduce((sum, row) => sum + commission(row), 0))],
      ["Despesas pendentes", currency.format((data.despesas ?? []).filter((row) => row.competencia === competencia && row.situacao !== "pago").reduce((sum, row) => sum + amount(row.valor), 0))],
      ["Caixa atual", currency.format(amount((data.caixas ?? []).find((row) => row.nome === "CAIXA ATUAL")?.valor))],
    ]
    : section.path === "lancamentos"
      ? [
        ["Lançamentos", String(lancamentos.length)],
        ["Previsto", currency.format(lancamentos.reduce((sum, row) => sum + gross(row), 0))],
        ["Recebido", currency.format(recebido.reduce((sum, row) => sum + gross(row), 0))],
        ["Comissão prevista", currency.format(lancamentos.reduce((sum, row) => sum + commission(row), 0))],
      ]
    : section.path === "despesas"
      ? [["Total do mês", currency.format(monthExpenses.reduce((sum, row) => sum + amount(row.valor), 0))],
         ["Fixas e mensais", currency.format(monthExpenses.filter((row) => row.categoria !== "ordinária").reduce((sum, row) => sum + amount(row.valor), 0))],
         ["Ordinárias", currency.format(monthExpenses.filter((row) => row.categoria === "ordinária").reduce((sum, row) => sum + amount(row.valor), 0))],
         ["Pendente", currency.format(monthExpenses.filter((row) => row.situacao !== "pago").reduce((sum, row) => sum + amount(row.valor), 0))]]
      : [];

  return <>
    <div className="page-intro"><div><p className="eyebrow">Dados da equipe</p><h1>{section.heading}</h1><p className="muted">{section.description}</p></div></div>
    <div className="toolbar">
      {["dashboard", "lancamentos", "despesas"].includes(section.path) && <label className="month-control">Competência <input type="month" value={competencia} onChange={(event) => setCompetencia(event.target.value)} /></label>}
      {names.length > 0 && <label className="search-control">Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar registros..." /></label>}
      {section.path === "lancamentos" && <><select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="recebido">Recebidos</option><option value="pendente">Pendentes</option></select><select aria-label="Ordem por vencimento" value={order} onChange={(event) => setOrder(event.target.value as "asc" | "desc")}><option value="asc">Vencimento crescente</option><option value="desc">Vencimento decrescente</option></select>
        <label>Venc. de <input type="number" min="1" max="31" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} className="day-input" /></label>
        <label>Até <input type="number" min="1" max="31" value={dueTo} onChange={(event) => setDueTo(event.target.value)} className="day-input" /></label>
        <button className="primary" type="button" disabled={busy} onClick={generateMonth}>Gerar mês</button></>}
      {section.path === "cadastros" && <select aria-label="Tipo de pessoa" value={personType} onChange={(event) => setPersonType(event.target.value)}><option value="">Todas as pessoas</option><option value="inquilino">Inquilinos</option><option value="proprietario">Proprietários</option><option value="fiador">Fiadores</option></select>}
      {section.path === "contratos" && <select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os contratos</option><option value="ativos">Somente ativos</option></select>}
      {section.path === "notas" && <select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todas</option><option value="a emitir">A emitir</option><option value="emitida">Emitidas</option></select>}
      {section.path === "despesas" && <><select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todas</option><option value="pendente">Pendentes</option><option value="pago">Pagas</option></select><select aria-label="Categoria" value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)}><option value="">Todas as categorias</option><option value="fixas">Fixas e mensais</option><option value="ordinaria">Ordinárias</option></select><button type="button" onClick={() => copyDialog.current?.showModal()} disabled={busy}>Copiar despesas</button></>}
      {(sectionModules[section.path] ?? []).filter((name) => modules[name]?.create !== false).map((name) => <button key={name} type="button" className="primary" disabled={busy} onClick={() => open(modules[name])}>Novo {modules[name].title.toLowerCase()}</button>)}
    </div>
    <p role="status" aria-live="polite" className="action-notice">{busy ? "Carregando..." : notice}</p>
    {cards.length > 0 && <div className="cards">{cards.map(([label, value]) => <div className={`card ${label.startsWith("Recebido") || label === "Comissão recebida" ? "green" : label === "A receber" || label === "Pendente" ? "orange" : label === "Despesas pendentes" ? "red" : ""}`} key={label}><div className="s">{label}</div><div className="v">{value}</div></div>)}</div>}
    {section.path === "dashboard" && <DashboardPanels data={data} competencia={competencia} search={search} />}
    {section.path === "dashboard" && <div className="panel-grid">
      <RowTable module={modules.lancamentos} title="Pendentes de recebimento" rows={lancamentos.filter((row) => !row.recebido_em)} search={search} onEdit={(row) => open(modules.lancamentos, row)} onDelete={(row) => remove(modules.lancamentos, row)} onAction={(row, action) => rowAction(modules.lancamentos, row, action)} />
      <RowTable module={modules.lancamentos} title="Recebidos aguardando repasse" rows={lancamentos.filter((row) => row.recebido_em && !row.repassado_em)} search={search} onEdit={(row) => open(modules.lancamentos, row)} onDelete={(row) => remove(modules.lancamentos, row)} onAction={(row, action) => rowAction(modules.lancamentos, row, action)} />
    </div>}
    {section.path === "controle" && <ControlPanels data={data} />}
    {section.path === "controle" && <div className="panel-stack">{["lancamentos", "despesas", "iptus", "condominios", "seguros", "pendencias", "manutencoes"].map((name) => <RowTable key={name} module={modules[name]} rows={rowsFor(name)} search={search} onEdit={(row) => open(modules[name], row)} onDelete={(row) => remove(modules[name], row)} onAction={(row, action) => rowAction(modules[name], row, action)} />)}</div>}
    {section.path === "contratos" && <ContractModels />}
    {!["dashboard", "controle", "relatorios"].includes(section.path) && <div className="panel-stack">{(sectionModules[section.path] ?? []).flatMap((name) => name === "pendencias" && section.path === "iptus" ? ["iptu", "condominio"].map((kind) => <RowTable key={kind} module={modules.pendencias} title={kind === "iptu" ? "Repasses de IPTU" : "Repasses de condomínio"} rows={rowsFor(name).filter((row) => row.tipo === kind)} search={search} onEdit={(row) => open(modules.pendencias, row)} onDelete={(row) => remove(modules.pendencias, row)} onAction={(row, action) => rowAction(modules.pendencias, row, action)} />) : <RowTable key={name} module={modules[name]} rows={rowsFor(name)} search={search} onEdit={(row) => open(modules[name], row)} onDelete={(row) => remove(modules[name], row)} onAction={(row, action) => rowAction(modules[name], row, action)} onDeleteSelected={name === "lancamentos" && section.path === "lancamentos" ? removeSelected : undefined} />)}</div>}
    {section.path === "notas" && <TaxSettings notes={data.notas_fiscais ?? []} onSaved={() => void load()} />}
    <dialog ref={dialog} className="edit-dialog" onClose={() => { setEditor(null); opener.current?.focus(); }} aria-label={editor ? `Editar ${editor.module.title}` : "Formulário"}>
      {editor && <form onSubmit={save}>
        <div className="dialog-heading"><h2>{editor.row ? "Editar" : "Novo"} · {editor.module.title}</h2><button type="button" onClick={close} aria-label="Fechar" title="Fechar"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div>
        <div className="form-grid">{editor.module.fields.filter((field) => !(editor.module.table === "lancamentos" && field.name === "recebido_em" && !editor.row?.recebido_em)).map((field) => <FieldInput key={field.name} field={field} row={editor.row} lookup={lookup} />)}</div>
        <div className="dialog-actions"><button type="button" onClick={close}>Cancelar</button><button className="primary" type="submit" disabled={busy}>Salvar</button></div>
      </form>}
    </dialog>
    <dialog ref={copyDialog} className="edit-dialog" aria-labelledby="copy-expenses-title">
      <form onSubmit={copyExpenses}>
        <div className="dialog-heading"><h2 id="copy-expenses-title">Copiar despesas para outro mês</h2><button type="button" onClick={() => copyDialog.current?.close()} aria-label="Fechar" title="Fechar"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div>
        <div className="form-grid">
          <label>Copiar do mês<input name="origem" type="month" defaultValue={competencia} required /></label>
          <label>Para o mês<input name="destino" type="month" defaultValue={(() => { const [year, current] = competencia.split("-").map(Number); return current === 12 ? `${year + 1}-01` : `${year}-${String(current + 1).padStart(2, "0")}`; })()} required /></label>
          <label className="check-field"><input name="incluir_ordinarias" type="checkbox" />Incluir também despesas ordinárias</label>
        </div>
        <div className="dialog-actions"><button type="button" onClick={() => copyDialog.current?.close()}>Cancelar</button><button type="submit" className="primary" disabled={busy}>Copiar despesas</button></div>
      </form>
    </dialog>
  </>;
}


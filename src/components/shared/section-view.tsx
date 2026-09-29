"use client";

import { useState } from "react";
import type { DemoSection, DemoTable } from "@/features/demo/content";

function DataTable({ table, query }: { table: DemoTable; query: string }) {
  const rows = table.rows.filter((row) => row.join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  return <section className="panel" aria-label={table.title}>
    <h2>{table.title}</h2>
    <div className="table-scroll"><table>
      <thead><tr>{table.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((row, index) => <tr key={`${table.title}-${index}`}>{row.map((value, cell) => <td key={table.columns[cell]}>{value}</td>)}</tr>) : <tr><td colSpan={table.columns.length} className="muted">Nenhum exemplo encontrado.</td></tr>}</tbody>
    </table></div>
  </section>;
}

export function SectionView({ section }: { section: DemoSection }) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  return <>
    <div className="page-intro">
      <div><p className="eyebrow">Demonstração · dados fictícios</p><h1>{section.heading}</h1><p className="muted">{section.description}</p></div>
    </div>
    <div className="demo-banner" role="note">Esta versão permite consultar exemplos fictícios. Configure o projeto Supabase de destino para acessar dados e operações reais.</div>
    <div className="toolbar">
      <label className="search-label" htmlFor="section-search">Buscar exemplos</label>
      <input id="section-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar em ${section.label.toLowerCase()}...`} />
      {section.actions?.map((action) => <button key={action} type="button" className="primary" onClick={() => setNotice(`${action}: disponível com o Supabase de destino configurado.`)}>{action}</button>)}
    </div>
    <p className="action-notice" role="status" aria-live="polite">{notice}</p>
    {section.cards && <div className="cards">{section.cards.map((card) => <div className={`card ${card.tone ?? ""}`} key={card.label}><div className="s">{card.label}</div><div className="v">{card.value}</div></div>)}</div>}
    <div className={section.path === "dashboard" || section.path === "controle" || section.path === "relatorios" ? "panel-grid" : "panel-stack"}>{section.tables.map((table) => <DataTable key={table.title} table={table} query={query} />)}</div>
  </>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editableTables } from "@/lib/team-permissions";

type Member = { user_id: string; nome: string; email: string; papel: string; ativo: boolean; pode_editar: string[] };

export function TeamManager({ members }: { members: Member[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(path: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/equipe", { method: path, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      setNotice(result.message);
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  function permissions(form: FormData) { return editableTables.map(([name]) => name).filter((name) => form.has(name)); }
  const boxes = (selected: string[]) => <div className="permission-grid">{editableTables.map(([name, label]) =>
    <label key={name} className="check-field"><input type="checkbox" name={name} defaultChecked={selected.includes(name)} />{label}</label>)}</div>;

  return <>
    <div className="page-intro"><div><p className="eyebrow">Administração</p><h1>Equipe</h1><p className="muted">Convide funcionários e escolha os módulos que podem alterar. Todos os integrantes ativos podem consultar os dados.</p></div></div>
    <section className="panel team-panel"><h2>Adicionar usuário</h2>
      <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void send("POST", { nome: form.get("nome"), email: form.get("email"), pode_editar: permissions(form) }); }}>
        <div className="form-grid"><label>Nome<input name="nome" required maxLength={120} autoComplete="name" /></label><label>E-mail<input name="email" type="email" required autoComplete="email" /></label></div>
        <fieldset><legend>Pode editar</legend>{boxes([])}</fieldset>
        <button type="submit" className="primary" disabled={busy}>Enviar convite</button>
      </form>
    </section>
    <p className="action-notice" role="status" aria-live="polite">{notice}</p>
    <div className="panel-stack">{members.map((member) => <section className="panel team-panel" key={member.user_id}>
      <h2>{member.nome || member.email}</h2><p className="muted">{member.email} · {member.papel === "admin" ? "Administrador" : member.ativo ? "Ativo" : "Desativado"}</p>
      {member.papel === "funcionario" && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void send("PATCH", { user_id: member.user_id, ativo: form.has("ativo"), pode_editar: permissions(form) }); }}>
        <fieldset><legend>Permissões de edição</legend>{boxes(member.pode_editar)}</fieldset>
        <label className="check-field"><input type="checkbox" name="ativo" defaultChecked={member.ativo} />Acesso ativo</label>
        <button type="submit" disabled={busy}>Salvar acessos</button>
      </form>}
    </section>)}</div>
  </>;
}
